/**
 * Mews Import Worker - Express Server
 * Handles long-running Mews data import operations without Vercel timeout constraints
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const MewsSyncWorker = require('./sync/mews-sync-worker');

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// CORS - allow requests from Vercel app and other domains
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if origin is a Vercel deployment
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mews-import',
    timestamp: new Date().toISOString()
  });
});

// Start Mews sync endpoint
app.post('/api/sync/start', async (req, res) => {
  try {
    const { from, to, truncate = false, batchDays, reservationBatchDays, reservationLeadDays } = req.body;

    // Create sync job
    const { data: job, error } = await supabase
      .from('mews_sync_jobs')
      .insert({
        status: 'pending',
        options: { from, to, truncate, batchDays, reservationBatchDays, reservationLeadDays },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create Mews sync job:', error);
      return res.status(500).json({ error: 'Failed to create sync job' });
    }

    // Start sync in background (don't await)
    runMewsSyncInBackground(job.id, { from, to, truncate, batchDays, reservationBatchDays, reservationLeadDays });

    // Return job ID immediately
    res.json({
      jobId: job.id,
      message: 'Mews sync job started'
    });
  } catch (error) {
    console.error('Error starting Mews sync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run Mews sync in background
 */
async function runMewsSyncInBackground(jobId, options) {
  try {
    const worker = new MewsSyncWorker(jobId, supabase, options);
    await worker.run();
  } catch (error) {
    console.error('Background Mews sync error:', error);
  }
}

// SSE stream endpoint for Mews
app.get('/api/sync/stream/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

  // Track last event ID to avoid duplicates
  let lastEventId = null;

  // Poll for new events every 500ms
  const interval = setInterval(async () => {
    try {
      // Check if job is complete first
      const { data: job } = await supabase
        
        .from('mews_sync_jobs')
        .select('status, stats, error_message')
        .eq('id', jobId)
        .single();

      // Query for new events
      let query = supabase
        
        .from('mews_sync_events')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (lastEventId) {
        query = query.gt('id', lastEventId);
      }

      const { data: events, error } = await query;

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      // Stream each event to client
      for (const event of events || []) {
        res.write(`data: ${JSON.stringify({
          type: event.event_type,
          ...event.event_data,
          timestamp: event.created_at
        })}\n\n`);

        lastEventId = event.id;

        // Delete event after sending (cleanup)
        await supabase
          
          .from('mews_sync_events')
          .delete()
          .eq('id', event.id);
      }

      // If job is complete, send final messages and close
      if (job && (job.status === 'completed' || job.status === 'failed')) {
        // Wait a bit to ensure all events are processed
        await new Promise(resolve => setTimeout(resolve, 500));

        // Do one final check for any remaining events
        const { data: finalEvents } = await supabase
          
          .from('mews_sync_events')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        // Send any remaining events
        for (const event of finalEvents || []) {
          res.write(`data: ${JSON.stringify({
            type: event.event_type,
            ...event.event_data,
            timestamp: event.created_at
          })}\n\n`);

          // Delete event after sending
          await supabase
            
            .from('mews_sync_events')
            .delete()
            .eq('id', event.id);
        }

        // Send final message
        if (job.status === 'completed') {
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            stats: job.stats
          })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: job.error_message
          })}\n\n`);
        }

        // Send done signal
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

        // Close connection
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('Polling error:', err);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval);
    console.log(`Client disconnected from Mews job ${jobId}`);
  });
});

// Get Mews sync job status
app.get('/api/sync/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      
      .from('mews_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching Mews job status:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent Mews sync jobs
app.get('/api/sync/jobs', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data: jobs, error } = await supabase
      
      .from('mews_sync_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    res.json({ jobs });
  } catch (error) {
    console.error('Error listing Mews jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mews Import Worker running on port ${PORT}`);
  console.log(`📊 Mews API: ${process.env.MEWS_API_URL || 'https://api.mews.com'}`);
  console.log(`✅ Ready to handle import requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
