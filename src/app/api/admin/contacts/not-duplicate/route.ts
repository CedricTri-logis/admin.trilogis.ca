import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/contacts/not-duplicate
 * Mark two contacts as NOT duplicates (ignore this pair in future duplicate detection)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactId1, contactId2, reason } = body;

    if (!contactId1 || !contactId2) {
      return NextResponse.json(
        { error: 'contactId1 and contactId2 are required' },
        { status: 400 }
      );
    }

    if (contactId1 === contactId2) {
      return NextResponse.json(
        { error: 'Cannot mark the same contact as not duplicate with itself' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Insert the pair (unique index will prevent duplicates)
    const { data, error } = await supabase
      .schema('contacts')
      .from('not_duplicate_pairs')
      .insert({
        contact_id_1: contactId1,
        contact_id_2: contactId2,
        reason: reason || 'Marked as not duplicate',
        marked_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to mark as not duplicate', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      message: 'Contacts marked as not duplicate',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/contacts/not-duplicate
 * Unmark two contacts as NOT duplicates (remove from ignore list)
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { contactId1, contactId2 } = body;

    if (!contactId1 || !contactId2) {
      return NextResponse.json(
        { error: 'contactId1 and contactId2 are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the pair (need to handle both orderings)
    const { error } = await supabase
      .schema('contacts')
      .from('not_duplicate_pairs')
      .delete()
      .or(`and(contact_id_1.eq.${contactId1},contact_id_2.eq.${contactId2}),and(contact_id_1.eq.${contactId2},contact_id_2.eq.${contactId1})`);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to remove not duplicate mark', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Not duplicate mark removed',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/contacts/not-duplicate
 * Get all pairs marked as NOT duplicates
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all ignored pairs
    const { data: pairs, error } = await supabase
      .schema('contacts')
      .from('not_duplicate_pairs')
      .select('*')
      .order('marked_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ignored duplicates', details: error },
        { status: 500 }
      );
    }

    // For each pair, get contact details
    const enrichedPairs = await Promise.all(
      (pairs || []).map(async (pair) => {
        const { data: contacts } = await supabase
          .schema('contacts')
          .rpc('get_duplicate_details', {
            p_contact_ids: [pair.contact_id_1, pair.contact_id_2],
          });

        return {
          ...pair,
          contacts: contacts || [],
        };
      })
    );

    return NextResponse.json({
      data: enrichedPairs,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
