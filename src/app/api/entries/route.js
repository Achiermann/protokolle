import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

// GET /api/entries
export async function GET() {
  try {
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'NO_WORKSPACE', message: 'Kein Workspace ausgewählt' } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error, count } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('date_created', { ascending: false });

    if (error) {
      throw error;
    }

    const entries = data || [];
    const creatorIds = [
      ...new Set(entries.map((e) => e.created_by).filter(Boolean)),
    ];

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .schema('protokoll_app')
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      for (const entry of entries) {
        const profile = profileMap.get(entry.created_by);
        entry.created_by_name =
          profile?.name ||
          (profile?.email ? profile.email.split('@')[0] : null);
      }
    }

    return NextResponse.json({
      items: entries,
      total: count || 0,
      page: 1,
      pageSize: 20,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: error.message || 'Failed to fetch entries',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/entries
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'NO_WORKSPACE', message: 'Kein Workspace ausgewählt' } },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validation
    if (!body.item_title) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'item_title is required',
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Nicht angemeldet' } },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .insert([
        {
          item_title: body.item_title,
          content: body.content || null,
          topic: body.topic || null,
          project: body.project || null,
          members: body.members || [],
          workspace_id: workspaceId,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { data: profile } = await supabase
      .schema('protokoll_app')
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    data.created_by_name =
      profile?.name ||
      (profile?.email ? profile.email.split('@')[0] : null);

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'CREATE_ERROR',
          message: error.message || 'Failed to create entry',
        },
      },
      { status: 500 }
    );
  }
}
