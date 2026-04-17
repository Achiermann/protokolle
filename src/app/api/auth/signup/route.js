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

    if (password.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Passwort muss mindestens 8 Zeichen lang sein' } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json(
        { error: { code: 'SIGNUP_ERROR', message: error.message } },
        { status: 400 }
      );
    }

    // Create profile entry for email lookup
    if (data.user?.id) {
      await supabase
        .schema('protokoll_app')
        .from('profiles')
        .upsert([{ id: data.user.id, email: email.toLowerCase() }], { onConflict: 'id' });
    }

    return NextResponse.json({ user: data.user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Registrierung fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
