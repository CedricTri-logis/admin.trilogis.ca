import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/contacts/merge
 * Execute a contact merge operation
 *
 * Body:
 * {
 *   sourceId: string,
 *   targetId: string,
 *   conflictResolutions: Record<string, any>,
 *   reason: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, targetId, conflictResolutions, reason } = body;

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

    // Apply conflict resolutions first if provided
    if (conflictResolutions && Object.keys(conflictResolutions).length > 0) {
      const updates: Record<string, any> = {};

      // Handle conflict resolutions
      for (const [field, value] of Object.entries(conflictResolutions)) {
        if (value !== undefined && value !== null && value !== 'manual') {
          updates[field] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .schema('contacts')
          .from('persons')
          .update(updates)
          .eq('id', targetId);

        if (updateError) {
          console.error('Conflict resolution error:', updateError);
          return NextResponse.json(
            { error: 'Failed to apply conflict resolutions', details: updateError },
            { status: 500 }
          );
        }
      }
    }

    // Execute merge
    const { data: mergeResult, error: mergeError } = await supabase
      .schema('contacts')
      .rpc('merge_contacts', {
        p_source_contact_id: sourceId,
        p_target_contact_id: targetId,
        p_merged_by: user.id,
        p_reason: reason || 'Duplicate contact merged via admin panel',
      });

    if (mergeError) {
      console.error('Merge error:', mergeError);
      return NextResponse.json(
        { error: 'Failed to merge contacts', details: mergeError },
        { status: 500 }
      );
    }

    // Get updated target contact details
    const { data: updatedContact, error: fetchError } = await supabase
      .schema('contacts')
      .from('contacts')
      .select('*, persons(*)')
      .eq('id', targetId)
      .single();

    if (fetchError) {
      console.warn('Failed to fetch updated contact:', fetchError);
    }

    return NextResponse.json({
      success: true,
      data: {
        mergeResult,
        updatedContact,
      },
      message: 'Contacts merged successfully',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
