import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

// GET /api/todos
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
      .from('todos')
      .select('*, entry:entries(topic, project)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const items = (data || []).map(({ entry, ...t }) => ({
      ...t,
      topic: entry?.topic || null,
      project: entry?.project || null,
      date_created: t.created_at,
    }));

    return NextResponse.json({
      items,
      total: count || 0,
      page: 1,
      pageSize: 20,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: error.message || 'Failed to fetch todos',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/todos
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

    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'title is required',
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('todos')
      .insert([
        {
          title: body.title.trim(),
          entry_id: body.entry_id || null,
          workspace_id: workspaceId,
        },
      ])
      .select('*, entry:entries(topic, project)')
      .single();

    if (error) {
      throw error;
    }

    const { entry, ...rest } = data;
    const item = {
      ...rest,
      topic: entry?.topic || null,
      project: entry?.project || null,
      date_created: rest.created_at,
    };

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'CREATE_ERROR',
          message: error.message || 'Failed to create todo',
        },
      },
      { status: 500 }
    );
  }
}
