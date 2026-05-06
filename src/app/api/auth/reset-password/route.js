import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'E-Mail ist erforderlich' } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?reset=true`;
    console.log('[reset-password] redirectTo:', redirectTo);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[reset-password] resetPasswordForEmail failed:', error);
      return NextResponse.json(
        { error: { code: 'RESET_ERROR', message: error.message, status: error.status, redirectTo } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[reset-password] route crashed:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error?.message || 'Passwort-Reset fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
