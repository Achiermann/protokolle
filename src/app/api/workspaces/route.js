import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

// GET /api/workspaces — list workspaces for authenticated user
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[workspaces] user:', user?.id, 'authError:', authError?.message);

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Nicht angemeldet' } },
        { status: 401 }
      );
    }

    const { data: memberships, error: memberError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id);

    console.log('[workspaces] memberships:', memberships, 'memberError:', memberError);

    if (memberError) {
      throw memberError;
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const workspaceIds = memberships.map((m) => m.workspace_id);

    const { data: workspaces, error: wsError } = await supabase
      .schema('protokoll_app')
      .from('workspaces')
      .select('id, name, created_at')
      .in('id', workspaceIds);

    if (wsError) {
      throw wsError;
    }

    const items = (workspaces || []).map((ws) => {
      const membership = memberships.find((m) => m.workspace_id === ws.id);
      return { ...ws, role: membership?.role || 'member' };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[GET /api/workspaces]', error);
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message || 'Workspaces konnten nicht geladen werden' } },
      { status: 500 }
    );
  }
}

// POST /api/workspaces — create a new workspace
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

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Workspace-Name ist erforderlich' } },
        { status: 400 }
      );
    }

    // Create workspace
    const { data: workspace, error: wsError } = await supabase
      .schema('protokoll_app')
      .from('workspaces')
      .insert([{ name: name.trim(), created_by: user.id }])
      .select()
      .single();

    if (wsError) {
      throw wsError;
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .insert([{ workspace_id: workspace.id, user_id: user.id, role: 'owner' }]);

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({ item: workspace }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'CREATE_ERROR', message: error.message || 'Workspace konnte nicht erstellt werden' } },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces — rename the active workspace (owner only; RLS
// enforces the same via workspaces_update, this check gives a clean 403)
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

    const { name } = await request.json();
    const trimmed = typeof name === 'string' ? name.trim() : '';

    if (!trimmed) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Workspace-Name ist erforderlich' } },
        { status: 400 }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (membership?.role !== 'owner') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Nur Owner können den Workspace umbenennen' } },
        { status: 403 }
      );
    }

    const { data: workspace, error: wsError } = await supabase
      .schema('protokoll_app')
      .from('workspaces')
      .update({ name: trimmed })
      .eq('id', workspaceId)
      .select('id, name, created_at')
      .single();

    if (wsError) {
      throw wsError;
    }

    return NextResponse.json({ item: workspace });
  } catch (error) {
    console.error('[PATCH /api/workspaces]', error);
    return NextResponse.json(
      { error: { code: 'UPDATE_ERROR', message: error.message || 'Workspace konnte nicht umbenannt werden' } },
      { status: 500 }
    );
  }
}
