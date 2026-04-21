import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/db/supabase-server';

// GET /api/foerderungen
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('orgaprof')
      .from('förderungen')
      .select('id, förderstelle, kanton, stadt, einsendeschluss, förderbereiche, förderformat')
      .order('einsendeschluss', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: error.message || 'Failed to fetch förderungen',
        },
      },
      { status: 500 }
    );
  }
}
