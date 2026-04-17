import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Passwort muss mindestens 8 Zeichen lang sein' } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: 'Passwort konnte nicht aktualisiert werden' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Passwort-Update fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
