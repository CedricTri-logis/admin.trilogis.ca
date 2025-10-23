import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/contacts/merge/preview
 * Preview what would happen during a merge (non-destructive)
 *
 * Body:
 * {
 *   sourceId: string,
 *   targetId: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'sourceId and targetId are required' },
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

    // Call preview function
    const { data: previewData, error: previewError } = await supabase
      .schema('contacts')
      .rpc('preview_merge', {
        p_source_contact_id: sourceId,
        p_target_contact_id: targetId,
      });

    if (previewError) {
      console.error('Preview error:', previewError);
      return NextResponse.json(
        { error: 'Failed to preview merge', details: previewError },
        { status: 500 }
      );
    }

    // Transform data for frontend
    const conflicts = Object.entries(previewData.conflicts || {}).map(
      ([field, values]: [string, any]) => ({
        field,
        sourceValue: values.source,
        targetValue: values.target,
      })
    );

    return NextResponse.json({
      data: {
        conflicts,
        willTransfer: previewData.will_transfer || { emails: 0, phones: 0, addresses: 0 },
        foreignKeyUpdates: previewData.foreign_key_updates || {},
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
