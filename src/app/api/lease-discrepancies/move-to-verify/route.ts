import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for rclone operations

interface MoveToVerifyRequest {
  record_id: string;
  record_type: 'lease' | 'renewal';
  discrepancy_record1_id: string;
  discrepancy_record2_id: string;
  discrepancy_type: string;
  reason: string;
  notes?: string;
}

// Configuration
const RCLONE_REMOTE = process.env.RCLONE_REMOTE || 'gdrive';
const BAUX_TEAM_DRIVE = process.env.BAUX_TEAM_DRIVE_ID || '0APEN2UaRsBfZUk9PVA';
const DESTINATION_FOLDER = 'BAUX/SCAN/TO_VERIFY';

/**
 * Add _ERREURS suffix before file extension
 */
function addErrorsSuffix(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${filename}_ERREURS`;
  }
  const basename = filename.substring(0, lastDotIndex);
  const ext = filename.substring(lastDotIndex);
  return `${basename}_ERREURS${ext}`;
}

/**
 * Convert Storage path to Google Drive path
 * documents/BAUX/106_Carter/... -> BAUX/106_Carter/...
 */
function storagePathToGdrivePath(storagePath: string): string {
  return storagePath.replace(/^documents\//, '');
}

/**
 * Build rclone path with team drive
 */
function buildRclonePath(filePath: string): string {
  return `${RCLONE_REMOTE},team_drive=${BAUX_TEAM_DRIVE}:${filePath}`;
}

/**
 * Move file using rclone
 */
async function moveFileWithRclone(
  originalGdrivePath: string,
  newGdrivePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sourcePath = buildRclonePath(originalGdrivePath);
    const destPath = buildRclonePath(newGdrivePath);

    const rcloneCmd = `rclone moveto "${sourcePath}" "${destPath}" --drive-shared-with-me`;

    console.log('[move-to-verify] Executing rclone command');
    console.log('[move-to-verify] Source:', originalGdrivePath);
    console.log('[move-to-verify] Destination:', newGdrivePath);

    const { stdout, stderr } = await execAsync(rcloneCmd, {
      timeout: 30000, // 30 second timeout per file
    });

    if (stderr && !stderr.includes('Transferred:')) {
      console.error('[move-to-verify] rclone stderr:', stderr);
    }

    if (stdout) {
      console.log('[move-to-verify] rclone output:', stdout);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[move-to-verify] rclone error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get lease/renewal document info
 */
async function getDocumentInfo(
  supabase: any,
  recordId: string,
  recordType: 'lease' | 'renewal'
) {
  const table = recordType === 'lease' ? 'leases' : 'renewals';

  const { data, error } = await supabase
    .from(table)
    .select(
      `
      id,
      document_path,
      file_name,
      lease_start_date,
      lease_end_date,
      monthly_rent,
      apartment_number,
      tenant_details
    `
    )
    .eq('id', recordId)
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  try {
    console.log('[move-to-verify] API route called');

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: MoveToVerifyRequest = await request.json();
    console.log('[move-to-verify] Request body:', {
      ...body,
      user_id: user.id,
    });

    // Validate request
    if (!body.record_id || !body.record_type || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: record_id, record_type, reason' },
        { status: 400 }
      );
    }

    // Get document info from lease/renewal table
    const docInfo = await getDocumentInfo(
      supabase.schema('long_term'),
      body.record_id,
      body.record_type
    );

    if (!docInfo.document_path) {
      return NextResponse.json(
        { error: 'Document path not found for this record' },
        { status: 404 }
      );
    }

    // Convert storage path to Google Drive path
    const originalGdrivePath = storagePathToGdrivePath(docInfo.document_path);
    const originalFilename = docInfo.file_name;
    const newFilename = addErrorsSuffix(originalFilename);
    const newGdrivePath = `${DESTINATION_FOLDER}/${newFilename}`;

    console.log('[move-to-verify] Paths:', {
      storage: docInfo.document_path,
      gdrive_original: originalGdrivePath,
      gdrive_new: newGdrivePath,
    });

    // Check if already excluded
    const { data: existing } = await supabase
      .schema('integration')
      .from('lease_document_exclusions')
      .select('*')
      .eq('file_path', docInfo.document_path)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: 'Document already excluded',
          details: {
            action_type: existing.action_type,
            gdrive_new_path: existing.gdrive_new_path,
            excluded_at: existing.excluded_at,
          },
        },
        { status: 409 }
      );
    }

    // Move file with rclone
    const moveResult = await moveFileWithRclone(
      originalGdrivePath,
      newGdrivePath
    );

    // Track in database
    const { data: exclusion, error: exclusionError } = await supabase
      .schema('integration')
      .from('lease_document_exclusions')
      .insert({
        file_path: docInfo.document_path,
        gdrive_original_path: originalGdrivePath,
        gdrive_team_drive_id: BAUX_TEAM_DRIVE,
        action_type: 'move_to_verify',
        gdrive_action_status: moveResult.success ? 'completed' : 'failed',
        gdrive_new_path: moveResult.success ? newGdrivePath : null,
        gdrive_error_message: moveResult.error,
        reason: body.reason,
        notes: body.notes,
        discrepancy_record1_id: body.discrepancy_record1_id,
        discrepancy_record2_id: body.discrepancy_record2_id,
        discrepancy_type: body.discrepancy_type,
        document_metadata: {
          record_type: body.record_type,
          record_id: body.record_id,
          lease_start_date: docInfo.lease_start_date,
          lease_end_date: docInfo.lease_end_date,
          monthly_rent: docInfo.monthly_rent,
          apartment_number: docInfo.apartment_number,
          tenant_details: docInfo.tenant_details,
          original_filename: originalFilename,
          new_filename: newFilename,
        },
        excluded_by: user.id,
      })
      .select()
      .single();

    if (exclusionError) {
      console.error('[move-to-verify] Exclusion tracking error:', exclusionError);
      return NextResponse.json(
        { error: 'Failed to track exclusion', details: exclusionError.message },
        { status: 500 }
      );
    }

    if (!moveResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to move file in Google Drive',
          details: moveResult.error,
          exclusion_id: exclusion.id,
          status: 'failed',
        },
        { status: 500 }
      );
    }

    console.log('[move-to-verify] Success!', {
      exclusion_id: exclusion.id,
      new_path: newGdrivePath,
    });

    return NextResponse.json({
      success: true,
      message: 'Document moved to TO_VERIFY folder',
      exclusion_id: exclusion.id,
      original_path: originalGdrivePath,
      new_path: newGdrivePath,
      new_filename: newFilename,
    });
  } catch (error) {
    console.error('[move-to-verify] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
