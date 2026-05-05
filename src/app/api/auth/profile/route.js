import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

export async function PATCH(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Nicht angemeldet' } },
        { status: 401 }
      );
    }

    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name ist erforderlich' } },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .schema('protokoll_app')
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ name: name.trim() });
  } catch (error) {
    console.error('[PATCH /api/auth/profile]', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error.message || 'Aktualisierung fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
