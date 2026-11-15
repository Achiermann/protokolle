import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

const isAdminRole = (role) => role === 'owner' || role === 'admin';

// GET /api/workspaces/members — list members of active workspace
export async function GET() {
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

    // Get all members of this workspace
    const { data: members, error: memberError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('id, user_id, role, created_at')
      .eq('workspace_id', workspaceId);

    if (memberError) {
      throw memberError;
    }

    // Enrich with email from profiles table
    const userIds = members.map((m) => m.user_id);

    const { data: profiles, error: profileError } = await supabase
      .schema('protokoll_app')
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const items = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        email: profile?.email || '–',
        name: profile?.name || null,
        role: m.role,
        created_at: m.created_at,
      };
    });

    // Determine caller's role
    const callerMember = members.find((m) => m.user_id === user.id);

    // Pending invitations (people without an account yet). RLS returns them
    // to admins only; everyone else gets an empty list.
    const { data: invitations, error: invitationError } = await supabase
      .schema('protokoll_app')
      .from('workspace_invitations')
      .select('id, email, role, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (invitationError) {
      throw invitationError;
    }

    return NextResponse.json({
      items,
      invitations: invitations || [],
      callerRole: callerMember?.role || null,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/members]', error);
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message || 'Mitglieder konnten nicht geladen werden' } },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/members — remove a member (owner only)
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

    // Verify caller is an owner
    const { data: callerMembership } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!callerMembership || !isAdminRole(callerMembership.role)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Nur Admins können Mitglieder entfernen' } },
        { status: 403 }
      );
    }

    const { member_id } = await request.json();

    if (!member_id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'member_id ist erforderlich' } },
        { status: 400 }
      );
    }

    // Don't allow removing owners
    const { data: target } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('role')
      .eq('id', member_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!target) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Mitglied nicht gefunden' } },
        { status: 404 }
      );
    }

    if (target.role === 'owner') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Besitzer können nicht entfernt werden' } },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .delete()
      .eq('id', member_id)
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/workspaces/members]', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error.message || 'Entfernen fehlgeschlagen' } },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/members — { member_id, admin: boolean } (admins only).
// The owner (workspace creator) is always admin; nobody can change their own
// role, so a workspace can never lose its last admin by accident.
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

    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;
    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'NO_WORKSPACE', message: 'Kein Workspace ausgewählt' } },
        { status: 400 }
      );
    }

    const { member_id, admin } = await request.json();
    if (!member_id || typeof admin !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'member_id und admin sind erforderlich' } },
        { status: 400 }
      );
    }

    const db = supabase.schema('protokoll_app');
    const { data: caller } = await db
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!caller || !isAdminRole(caller.role)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Nur Admins können Rollen ändern' } },
        { status: 403 }
      );
    }

    const { data: target } = await db
      .from('workspace_members')
      .select('id, user_id, role')
      .eq('id', member_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!target) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Mitglied nicht gefunden' } },
        { status: 404 }
      );
    }
    if (target.role === 'owner') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Der Ersteller ist immer Admin' } },
        { status: 403 }
      );
    }
    if (target.user_id === user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Die eigene Rolle kann nicht geändert werden' } },
        { status: 403 }
      );
    }

    const { data, error } = await db
      .from('workspace_members')
      .update({ role: admin ? 'admin' : 'member' })
      .eq('id', member_id)
      .eq('workspace_id', workspaceId)
      .select('id, role')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('[PATCH /api/workspaces/members]', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: error.message || 'Ändern fehlgeschlagen' } },
      { status: 500 }
    );
  }
}
