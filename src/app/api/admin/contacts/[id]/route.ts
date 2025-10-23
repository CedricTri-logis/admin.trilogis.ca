import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/contacts/[id]
 * Get full details for a single contact
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
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

    // Use the get_duplicate_details function with a single contact ID
    const { data: contactDetails, error: detailsError } = await supabase
      .schema('contacts')
      .rpc('get_duplicate_details', {
        p_contact_ids: [id],
      });

    if (detailsError) {
      console.error('Details error:', detailsError);
      return NextResponse.json(
        { error: 'Failed to fetch contact details', details: detailsError },
        { status: 500 }
      );
    }

    if (!contactDetails || contactDetails.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: contactDetails[0],
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
 * PATCH /api/admin/contacts/[id]
 * Update contact fields (type, names, date of birth, etc.)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
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

    // Get current contact to check type
    const { data: currentContact, error: fetchError } = await supabase
      .schema('contacts')
      .from('contacts')
      .select('contact_type')
      .eq('id', id)
      .single();

    if (fetchError || !currentContact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const {
      contact_type,
      first_name,
      middle_name,
      last_name,
      display_name,
      date_of_birth,
    } = body;

    // Update base contact table
    const contactUpdates: any = {};
    if (contact_type !== undefined) contactUpdates.contact_type = contact_type;
    if (display_name !== undefined) contactUpdates.display_name = display_name;

    if (Object.keys(contactUpdates).length > 0) {
      const { error: updateError } = await supabase
        .schema('contacts')
        .from('contacts')
        .update(contactUpdates)
        .eq('id', id);

      if (updateError) {
        console.error('Contact update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update contact', details: updateError },
          { status: 500 }
        );
      }
    }

    // If changing type or updating person-specific fields
    if (contact_type === 'person' || currentContact.contact_type === 'person') {
      // Update or create person record
      const personUpdates: any = {};
      if (first_name !== undefined) personUpdates.first_name = first_name;
      if (middle_name !== undefined) personUpdates.middle_name = middle_name;
      if (last_name !== undefined) personUpdates.last_name = last_name;
      if (date_of_birth !== undefined) personUpdates.date_of_birth = date_of_birth || null;

      if (Object.keys(personUpdates).length > 0) {
        // Check if person record exists
        const { data: existingPerson } = await supabase
          .schema('contacts')
          .from('persons')
          .select('id')
          .eq('id', id)
          .single();

        if (existingPerson) {
          // Update existing person record
          const { error: updateError } = await supabase
            .schema('contacts')
            .from('persons')
            .update(personUpdates)
            .eq('id', id);

          if (updateError) {
            console.error('Person update error:', updateError);
            return NextResponse.json(
              { error: 'Failed to update person details', details: updateError },
              { status: 500 }
            );
          }
        } else if (contact_type === 'person') {
          // Create new person record if converting to person
          const { error: insertError } = await supabase
            .schema('contacts')
            .from('persons')
            .insert({
              id,
              ...personUpdates,
            });

          if (insertError) {
            console.error('Person insert error:', insertError);
            return NextResponse.json(
              { error: 'Failed to create person details', details: insertError },
              { status: 500 }
            );
          }
        }
      }
    }

    // TODO: Handle business-specific fields if needed in the future

    return NextResponse.json({
      message: 'Contact updated successfully',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
