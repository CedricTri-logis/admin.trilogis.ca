import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface GetDocumentUrlRequest {
  record_id: string;
  record_type: 'lease' | 'renewal';
}

export async function POST(request: Request) {
  try {
    console.log('[get-document-url] API called');

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log('[get-document-url] User check:', { hasUser: !!user, userError });

    if (userError || !user) {
      console.log('[get-document-url] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GetDocumentUrlRequest = await request.json();
    console.log('[get-document-url] Request body:', body);

    if (!body.record_id || !body.record_type) {
      return NextResponse.json(
        { error: 'Missing required fields: record_id, record_type' },
        { status: 400 }
      );
    }

    // Get document path from lease or renewal table
    const table = body.record_type === 'lease' ? 'leases' : 'renewals';

    const { data: record, error: recordError } = await supabase
      .schema('long_term')
      .from(table)
      .select('document_path, file_name')
      .eq('id', body.record_id)
      .single();

    console.log('[get-document-url] Record query result:', {
      found: !!record,
      error: recordError,
      document_path: record?.document_path
    });

    if (recordError || !record) {
      console.error('[get-document-url] Record not found:', recordError);
      return NextResponse.json(
        { error: 'Document not found', details: recordError?.message },
        { status: 404 }
      );
    }

    if (!record.document_path) {
      console.error('[get-document-url] No document_path in record');
      return NextResponse.json(
        { error: 'Document path not found for this record' },
        { status: 404 }
      );
    }

    // Use stream endpoint directly - signed URLs don't work with special characters
    const streamUrl = `/api/lease-discrepancies/stream-document?record_id=${encodeURIComponent(body.record_id)}&record_type=${encodeURIComponent(body.record_type)}`;

    console.log('[get-document-url] Using stream endpoint to handle special characters in path');
    return NextResponse.json({
      url: streamUrl,
      fileName: record.file_name,
    });
  } catch (error) {
    console.error('[get-document-url] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
