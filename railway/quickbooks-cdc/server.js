/**
 * QuickBooks CDC Sync Service
 * Simple Express wrapper around the proven CDC sync script
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'quickbooks' },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://admin.trilogis.ca',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'quickbooks-cdc-sync',
    timestamp: new Date().toISOString()
  });
});

// Start sync
app.post('/api/sync/start', async (req, res) => {
  try {
    const { realmId, verify = false } = req.body;

    if (!realmId) {
      return res.status(400).json({ error: 'realmId is required' });
    }

    console.log(`📥 Sync request received for realm: ${realmId}`);

    // Create initial sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('qb_cdc_sync_log')
      .insert({
        realm_id: realmId,
        sync_started_at: new Date().toISOString(),
        status: 'in_progress',
        changed_since: new Date().toISOString(),
        last_sync_checkpoint: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create sync log:', logError);
      return res.status(500).json({ error: 'Failed to create sync log' });
    }

    const jobId = syncLog.id;
    console.log(`✅ Job created: ${jobId}`);

    // Return immediately
    res.json({
      jobId,
      status: 'started',
      realmId
    });

    // Run sync script in background
    const scriptPath = path.join(__dirname, 'sync-cdc-worker.js');
    const args = ['--realm', realmId];
    if (verify) args.push('--verify');

    console.log(`🚀 Starting sync script: node ${scriptPath} ${args.join(' ')}`);

    const child = spawn('node', [scriptPath, ...args], {
      env: process.env,
      stdio: 'inherit',
      detached: false
    });

    child.on('error', (error) => {
      console.error(`❌ Script error:`, error);
      supabase
        .from('qb_cdc_sync_log')
        .update({
          status: 'failed',
          error_message: error.message,
          sync_completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .then(() => console.log('Updated job status to failed'));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ Sync completed successfully for job ${jobId}`);
      } else {
        console.error(`❌ Sync failed with code ${code} for job ${jobId}`);
      }
    });

  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
app.get('/api/sync/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data, error } = await supabase
      .from('qb_cdc_sync_log')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent sync jobs
app.get('/api/sync/jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const { data, error } = await supabase
      .from('qb_cdc_sync_log')
      .select('*')
      .order('sync_started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching jobs:', error);
      return res.status(500).json({ error: error.message });
    }

    // Transform to match frontend expectations
    const jobs = data.map(job => ({
      id: job.id,
      realm_id: job.realm_id,
      status: job.status === 'success' ? 'completed' : job.status,
      verify: false, // CDC doesn't track this separately
      started_at: job.sync_started_at,
      completed_at: job.sync_completed_at,
      stats: {
        created: job.records_created || 0,
        updated: job.records_updated || 0,
        deleted: job.records_deleted || 0,
        errors: 0
      },
      error_message: job.error_message,
      created_at: job.created_at || job.sync_started_at
    }));

    res.json({ jobs });
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Server-Sent Events for real-time progress
app.get('/api/sync/stream/:jobId', async (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  console.log(`📡 SSE connection established for job ${jobId}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

  // Poll the database for updates
  const pollInterval = setInterval(async () => {
    try {
      const { data, error } = await supabase
        .from('qb_cdc_sync_log')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('Error polling job:', error);
        clearInterval(pollInterval);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`);
        res.end();
        return;
      }

      // Send progress update
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        status: data.status,
        stats: {
          created: data.records_created || 0,
          updated: data.records_updated || 0,
          deleted: data.records_deleted || 0
        }
      })}\n\n`);

      // If job is complete, send final message and close
      if (data.status === 'success' || data.status === 'failed') {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          status: data.status,
          stats: {
            created: data.records_created || 0,
            updated: data.records_updated || 0,
            deleted: data.records_deleted || 0
          },
          error: data.error_message
        })}\n\n`);
        clearInterval(pollInterval);
        res.end();
      }
    } catch (error) {
      console.error('Error in SSE polling:', error);
      clearInterval(pollInterval);
      res.end();
    }
  }, 2000); // Poll every 2 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`📡 SSE connection closed for job ${jobId}`);
    clearInterval(pollInterval);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 QuickBooks CDC Sync Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
