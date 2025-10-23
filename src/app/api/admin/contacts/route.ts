import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/contacts
 * Get contacts with server-side pagination and efficient queries
 *
 * Query params:
 * - type: 'person' | 'business' (optional)
 * - search: string (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - sortBy: string (default: 'display_name')
 * - sortDir: 'asc' | 'desc' (default: 'asc')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'display_name';
    const sortDir = (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc';

    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use raw SQL for efficient single-query fetch with all data
    const { data: contacts, error: fetchError } = await supabase
      .schema('contacts')
      .rpc('get_contacts_with_details', {
        p_type: type,
        p_search: search,
        p_limit: limit,
        p_offset: offset,
        p_sort_by: sortBy,
        p_sort_dir: sortDir === 'desc',
      });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch contacts', details: fetchError },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .schema('contacts')
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_merged', false);

    if (type && ['person', 'business'].includes(type)) {
      countQuery = countQuery.eq('contact_type', type);
    }
    if (search) {
      countQuery = countQuery.ilike('display_name', `%${search}%`);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      data: contacts || [],
      meta: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
