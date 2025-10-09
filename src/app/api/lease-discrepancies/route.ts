import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('[lease-discrepancies] API route called');

    const supabase = await createClient();
    console.log('[lease-discrepancies] Supabase client created');

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[lease-discrepancies] User check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userError: userError?.message
    });

    if (userError || !user) {
      console.log('[lease-discrepancies] Unauthorized - returning 401');
      return NextResponse.json({
        error: 'Unauthorized',
        details: userError?.message
      }, { status: 401 });
    }

    console.log('[lease-discrepancies] User authenticated:', user.email);

    const { searchParams } = new URL(request.url);
    const severityFilter = searchParams.get('severity'); // CRITICAL, HIGH, MEDIUM
    const typeFilter = searchParams.get('type'); // lease-to-lease, renewal-to-renewal, lease-to-renewal
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get summary statistics
    console.log('Fetching lease overlap summary...');
    const { data: summary, error: summaryError } = await supabase
      .schema('integration')
      .rpc('get_lease_overlap_summary');

    console.log('Summary result:', { summary, summaryError });

    if (summaryError) {
      console.error('Error fetching lease overlap summary:', summaryError);
      console.error('Full error details:', JSON.stringify(summaryError, null, 2));
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    // Build query for detailed discrepancies
    let query = supabase
      .schema('integration')
      .from('all_lease_discrepancies')
      .select('*')
      .limit(limit);

    // Apply filters
    if (severityFilter) {
      query = query.ilike('severity', `${severityFilter}%`);
    }

    if (typeFilter) {
      const typeMap: Record<string, string> = {
        'lease-to-lease': 'Lease-to-Lease Overlap',
        'renewal-to-renewal': 'Renewal-to-Renewal Overlap',
        'lease-to-renewal': 'Lease-to-Renewal Overlap',
      };
      const mappedType = typeMap[typeFilter];
      if (mappedType) {
        query = query.eq('discrepancy_type', mappedType);
      }
    }

    console.log('Fetching discrepancies...');
    const { data: discrepancies, error: discrepanciesError } = await query;

    console.log('Discrepancies result:', {
      count: discrepancies?.length,
      error: discrepanciesError
    });

    if (discrepanciesError) {
      console.error('Error fetching lease discrepancies:', discrepanciesError);
      console.error('Full error details:', JSON.stringify(discrepanciesError, null, 2));
      return NextResponse.json({ error: discrepanciesError.message }, { status: 500 });
    }

    return NextResponse.json({
      summary,
      discrepancies,
      total: discrepancies?.length || 0,
    });
  } catch (error) {
    console.error('Unexpected error in lease-discrepancies API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
