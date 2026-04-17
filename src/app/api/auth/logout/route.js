import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });
    response.cookies.delete('workspace_id');
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Abmeldung fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
