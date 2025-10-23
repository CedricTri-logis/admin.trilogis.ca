import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/contacts/convert
 * Convert a person to a business
 *
 * Body:
 * {
 *   contactId: string,
 *   businessName: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactId, businessName } = body;

    if (!contactId || !businessName) {
      return NextResponse.json(
        { error: 'contactId and businessName are required' },
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

    // Call conversion function
    const { data: result, error: conversionError } = await supabase
      .schema('contacts')
      .rpc('convert_person_to_business', {
        p_contact_id: contactId,
        p_business_name: businessName,
        p_converted_by: user.id,
      });

    if (conversionError) {
      console.error('Conversion error:', conversionError);
      return NextResponse.json(
        { error: 'Failed to convert contact', details: conversionError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
