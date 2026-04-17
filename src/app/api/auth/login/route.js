import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'E-Mail und Passwort sind erforderlich' } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: 'Ungültige Anmeldedaten' } },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Anmeldung fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
