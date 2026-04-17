import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

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
      .select('id, email, display_name')
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
        display_name: profile?.display_name || null,
        role: m.role,
        created_at: m.created_at,
      };
    });

    // Determine caller's role
    const callerMember = members.find((m) => m.user_id === user.id);

    return NextResponse.json({ items, callerRole: callerMember?.role || null });
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

    if (!callerMembership || callerMembership.role !== 'owner') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Nur Besitzer können Mitglieder entfernen' } },
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
