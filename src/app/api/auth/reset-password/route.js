import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/db/supabase-admin";
import { sendPasswordResetEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "E-Mail ist erforderlich",
          },
        },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    // Don't reveal whether the email exists (no account enumeration).
    if (error) {
      console.warn("[reset-password] generateLink failed:", error.message);
      return NextResponse.json({ success: true });
    }

    const otp = data?.properties?.email_otp;
    if (otp) {
      await sendPasswordResetEmail(email, otp);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reset-password] route crashed:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Passwort-Reset fehlgeschlagen",
        },
      },
      { status: 500 },
    );
  }
}
