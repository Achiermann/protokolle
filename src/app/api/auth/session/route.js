import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null, workspace: null });
    }

    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value || null;

    let workspace = null;
    if (workspaceId) {
      const { data } = await supabase
        .schema('protokoll_app')
        .from('workspaces')
        .select('id, name')
        .eq('id', workspaceId)
        .single();
      workspace = data;
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Sitzung konnte nicht geladen werden' } },
      { status: 500 }
    );
  }
}
