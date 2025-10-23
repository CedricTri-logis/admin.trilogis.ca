import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/contacts/duplicates
 * Detect duplicate contacts by name, email, or phone
 *
 * Query params:
 * - type: 'name' | 'email' | 'phone' (default: 'name')
 * - limit: number (default: 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'name';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate type
    if (!['name', 'email', 'phone'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be name, email, or phone' },
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

    // Call appropriate detection function(s) based on type
    let duplicateGroups: any[] = [];

    if (type === 'name') {
      // For names, check both person and business duplicates
      const [personResult, businessResult] = await Promise.all([
        supabase.schema('contacts').rpc('find_duplicate_names'),
        supabase.schema('contacts').rpc('find_duplicate_business_names'),
      ]);

      if (personResult.error) {
        console.error('Person detection error:', personResult.error);
      }
      if (businessResult.error) {
        console.error('Business detection error:', businessResult.error);
      }

      // Combine both results
      duplicateGroups = [
        ...(personResult.data || []),
        ...(businessResult.data || []),
      ];
    } else {
      // For email and phone, use the existing functions
      const functionName =
        type === 'email' ? 'find_duplicate_emails' : 'find_duplicate_phones';

      const { data, error: detectionError } = await supabase
        .schema('contacts')
        .rpc(functionName);

      if (detectionError) {
        console.error('Detection error:', detectionError);
        return NextResponse.json(
          { error: 'Failed to detect duplicates', details: detectionError },
          { status: 500 }
        );
      }

      duplicateGroups = data || [];
    }

    // For each duplicate group, get full contact details
    const enrichedGroups = await Promise.all(
      (duplicateGroups || []).slice(0, limit).map(async (group: any) => {
        const { data: contactDetails, error: detailsError } = await supabase
          .schema('contacts')
          .rpc('get_duplicate_details', {
            p_contact_ids: group.contact_ids,
          });

        if (detailsError) {
          console.error('Details error:', detailsError);
          return {
            ...group,
            contacts: [],
            error: detailsError.message,
          };
        }

        return {
          identifier: group.identifier,
          type,
          count: group.duplicate_count,
          contacts: contactDetails || [],
        };
      })
    );

    return NextResponse.json({
      data: enrichedGroups,
      meta: {
        total: duplicateGroups?.length || 0,
        type,
        limit,
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
