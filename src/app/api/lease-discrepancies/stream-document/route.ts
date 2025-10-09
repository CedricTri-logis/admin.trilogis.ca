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

    console.log('[stream-document] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      serviceKeyLength: serviceRoleKey?.length,
      serviceKeyPrefix: serviceRoleKey?.substring(0, 20) + '...'
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[stream-document] Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - missing credentials' },
        { status: 500 }
      );
    }

    // Create service role client for direct storage access
    const supabaseServiceRole = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[stream-document] Attempting to download file using Supabase SDK');

    // Use the download method with service role
    const { data: fileBlob, error: downloadError } = await supabaseServiceRole.storage
      .from('documents')
      .download(storagePath);

    console.log('[stream-document] Download attempt result:', {
      success: !!fileBlob,
      hasError: !!downloadError,
      errorMessage: downloadError?.message,
      errorName: downloadError?.name,
      blobSize: fileBlob?.size,
      blobType: fileBlob?.type
    });

    if (downloadError) {
      // Access the originalError property which is a Response object
      const originalError = (downloadError as any).originalError as Response;

      console.error('[stream-document] Download error - Status:', originalError?.status);
      console.error('[stream-document] Download error - URL:', originalError?.url);

      // Read the response body to get the actual error message
      let errorBody = null;
      if (originalError && !originalError.bodyUsed) {
        try {
          errorBody = await originalError.json();
          console.error('[stream-document] Supabase error response body:', errorBody);
        } catch (e) {
          console.error('[stream-document] Could not parse error body:', e);
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to download document from storage',
          details: errorBody?.error || errorBody?.message || 'Supabase Storage returned 400 Bad Request',
          supabaseError: errorBody,
          storagePath,
          status: originalError?.status,
          url: originalError?.url
        },
        { status: 500 }
      );
    }

    if (!fileBlob) {
      console.error('[stream-document] No file blob returned');
      return NextResponse.json(
        {
          error: 'No file data returned from storage',
          storagePath
        },
        { status: 500 }
      );
    }

    // Convert blob to array buffer
    const arrayBuffer = await fileBlob.arrayBuffer();

    console.log('[stream-document] Successfully downloaded file, streaming to client');

    // Return the file as a stream
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': fileBlob.type || 'application/pdf',
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
