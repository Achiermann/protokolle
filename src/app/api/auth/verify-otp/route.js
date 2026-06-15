import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";

const ALLOWED_TYPES = ["signup", "recovery"];

export async function POST(request) {
  try {
    const { email, token, type } = await request.json();

    if (!email || !token || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "E-Mail und Code sind erforderlich",
          },
        },
        { status: 400 },
      );
    }

    // Cookie-based client so a valid OTP establishes the session (logs the user
    // in for signup, or authorises the password update for recovery).
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "OTP_ERROR",
            message: "Code ist ungültig oder abgelaufen",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Code-Überprüfung fehlgeschlagen",
        },
      },
      { status: 500 },
    );
  }
}
