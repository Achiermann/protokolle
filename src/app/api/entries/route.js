import { NextResponse } from 'next/server';
import { supabase } from '@/db/supabase';

// GET /api/entries
export async function GET() {
  try {
    const { data, error, count } = await supabase
      .schema('protokoll_app')
      .from('entries')
      .select('*', { count: 'exact' })
      .order('date_created', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      items: data || [],
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
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

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
