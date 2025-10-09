import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[stream-document] API called');

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('[stream-document] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('record_id');
    const recordType = searchParams.get('record_type') as 'lease' | 'renewal' | null;

    if (!recordId || !recordType) {
      return NextResponse.json(
        { error: 'Missing required parameters: record_id, record_type' },
        { status: 400 }
      );
    }

    // Get document path from lease or renewal table
    const table = recordType === 'lease' ? 'leases' : 'renewals';

    const { data: record, error: recordError } = await supabase
      .schema('long_term')
      .from(table)
      .select('document_path, file_name')
      .eq('id', recordId)
      .single();

    console.log('[stream-document] Record query result:', {
      found: !!record,
      error: recordError,
      document_path: record?.document_path
    });

    if (recordError || !record || !record.document_path) {
      console.error('[stream-document] Record not found or missing document_path');
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Extract the path after 'documents/' prefix
    const storagePath = record.document_path.replace(/^documents\//, '');
    console.log('[stream-document] Storage path:', storagePath);

    // Verify environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[stream-document] Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - missing credentials' },
        { status: 500 }
      );
    }

    // Manually construct URL with proper encoding of each path segment
    // The Supabase SDK doesn't properly encode special characters like :, &, $, ()
    const pathSegments = storagePath.split('/');
    const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
    const encodedPath = encodedSegments.join('/');

    const storageApiUrl = `${supabaseUrl}/storage/v1/object/documents/${encodedPath}`;

    console.log('[stream-document] Original path:', storagePath);
    console.log('[stream-document] Encoded path:', encodedPath);
    console.log('[stream-document] Fetching from:', storageApiUrl);

    // Fetch directly with properly encoded URL
    const response = await fetch(storageApiUrl, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    });

    console.log('[stream-document] Fetch result:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[stream-document] Error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      return NextResponse.json(
        {
          error: 'Failed to download document from storage',
          details: `${response.status} ${response.statusText}`,
          errorText,
          storagePath
        },
        { status: 500 }
      );
    }

    // Get the file as array buffer
    const arrayBuffer = await response.arrayBuffer();

    console.log('[stream-document] Successfully downloaded file, streaming to client');

    // Return the file as a stream
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/pdf',
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': `inline; filename="${record.file_name || 'document.pdf'}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[stream-document] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
