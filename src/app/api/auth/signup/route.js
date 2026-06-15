import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/db/supabase-admin";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Name, E-Mail und Passwort sind erforderlich",
          },
        },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Passwort muss mindestens 8 Zeichen lang sein",
          },
        },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    // Create the (unconfirmed) user and generate a 6-digit OTP without sending
    // Supabase's built-in email — we deliver our own via Resend.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });

    if (error) {
      const exists = /already|registered|exist/i.test(error.message || "");
      return NextResponse.json(
        {
          error: {
            code: "SIGNUP_ERROR",
            message: exists
              ? "Ein Konto mit dieser E-Mail existiert bereits"
              : error.message,
          },
        },
        { status: 400 },
      );
    }

    const otp = data?.properties?.email_otp;
    const userId = data?.user?.id;

    if (!otp || !userId) {
      return NextResponse.json(
        {
          error: {
            code: "SIGNUP_ERROR",
            message: "Bestätigungscode konnte nicht erstellt werden",
          },
        },
        { status: 500 },
      );
    }

    // Create profile entry for email/name lookup
    await admin
      .schema("protokoll_app")
      .from("profiles")
      .upsert([{ id: userId, email: email.toLowerCase(), name: name.trim() }], {
        onConflict: "id",
      });

    await sendVerificationEmail(email, otp);

    return NextResponse.json({ email }, { status: 201 });
  } catch (error) {
    console.error("[signup] route crashed:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Registrierung fehlgeschlagen",
        },
      },
      { status: 500 },
    );
  }
}
