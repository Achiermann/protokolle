import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

// POST /api/workspaces/invite — invite a user by email
export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Nicht angemeldet' } },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'NO_WORKSPACE', message: 'Kein Workspace ausgewählt' } },
        { status: 400 }
      );
    }

    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'E-Mail ist erforderlich' } },
        { status: 400 }
      );
    }

    // Look up user by email via the profiles table
    const { data: profile, error: profileError } = await supabase
      .schema('protokoll_app')
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Kein Konto mit dieser E-Mail gefunden. Die Person muss zuerst ein Konto erstellen.' } },
        { status: 404 }
      );
    }

    // Check if already a member
    const { data: existing } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', profile.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_MEMBER', message: 'Diese Person ist bereits Mitglied' } },
        { status: 409 }
      );
    }

    // Add as member
    const { error: insertError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .insert([{ workspace_id: workspaceId, user_id: profile.id, role: 'member' }]);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true, member: { user_id: profile.id, email: profile.email, role: 'member' } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/workspaces/invite]', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error.message || 'Einladung fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
