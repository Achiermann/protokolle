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

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user by email via the profiles table
    const { data: profile } = await supabase
      .schema('protokoll_app')
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // No account yet → store a pending invitation. It becomes a membership as
    // soon as the person signs in with this email (src/lib/claimInvitations.js).
    if (!profile) {
      const { error: inviteError } = await supabase
        .schema('protokoll_app')
        .from('workspace_invitations')
        .insert([{ workspace_id: workspaceId, email: normalizedEmail, role: 'member', invited_by: user.id }]);

      if (inviteError?.code === '23505') {
        return NextResponse.json(
          { error: { code: 'ALREADY_INVITED', message: 'Diese E-Mail ist bereits eingeladen' } },
          { status: 409 }
        );
      }
      if (inviteError?.code === '42501') {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Nur Admins können Mitglieder einladen' } },
          { status: 403 }
        );
      }
      if (inviteError) {
        throw inviteError;
      }

      return NextResponse.json({ success: true, pending: true, email: normalizedEmail }, { status: 201 });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', profile.id)
      .maybeSingle();

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

// DELETE /api/workspaces/invite — { invitation_id } withdraw a pending
// invitation (admins only; RLS limits the delete to the caller's workspaces).
export async function DELETE(request) {
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

    const { invitation_id } = await request.json();

    if (!invitation_id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'invitation_id ist erforderlich' } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('workspace_invitations')
      .delete()
      .eq('id', invitation_id)
      .eq('workspace_id', workspaceId)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Einladung nicht gefunden' } },
        { status: 404 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/workspaces/invite]', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error.message || 'Zurückziehen fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
