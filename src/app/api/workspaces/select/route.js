import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

// POST /api/workspaces/select — set active workspace cookie
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

    const { workspace_id } = await request.json();

    if (!workspace_id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'workspace_id ist erforderlich' } },
        { status: 400 }
      );
    }

    // Verify user is a member of this workspace
    const { data: membership, error: memberError } = await supabase
      .schema('protokoll_app')
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Kein Zugriff auf diesen Workspace' } },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('workspace_id', workspace_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Workspace konnte nicht ausgewählt werden' } },
      { status: 500 }
    );
  }
}
