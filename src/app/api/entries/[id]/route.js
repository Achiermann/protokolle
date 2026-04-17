import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';
import { cookies } from 'next/headers';

// GET /api/entries/:id
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Entry not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: error.message || 'Failed to fetch entry',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/entries/:id
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Entry not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_ERROR',
          message: error.message || 'Failed to update entry',
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/entries/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get('workspace_id')?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Entry not found',
          },
        },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'DELETE_ERROR',
          message: error.message || 'Failed to delete entry',
        },
      },
      { status: 500 }
    );
  }
}
