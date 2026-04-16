import { NextResponse } from 'next/server';
import { supabase } from '@/db/supabase';

// GET /api/entries/:id
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .select('*')
      .eq('id', id)
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

    const { data, error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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

    const { error } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .delete()
      .eq('id', id);

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
