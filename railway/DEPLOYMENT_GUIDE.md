# QuickBooks CDC Sync Worker - Deployment Guide

## Overview

The QuickBooks CDC Sync Worker is now deployed on Railway at:

**🚀 https://quickbooks-cdc-sync-production.up.railway.app**

This service handles long-running QuickBooks CDC synchronization operations without Vercel's timeout constraints.

## Required Environment Variables

You **MUST** set these environment variables in Railway for the service to work:

### 1. Via Railway Dashboard

Visit: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399

Click on your service → Variables → Add the following:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# QuickBooks Configuration
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox  # or 'production'

# CORS Configuration
ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000

# Server Configuration (already set by Railway)
PORT=3001
NODE_ENV=production
```

### 2. Via Railway CLI

Alternatively, set variables using the CLI:

```bash
cd railway
railway variables set SUPABASE_URL="your_supabase_url"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
railway variables set QUICKBOOKS_CLIENT_ID="your_quickbooks_client_id"
railway variables set QUICKBOOKS_CLIENT_SECRET="your_quickbooks_client_secret"
railway variables set QUICKBOOKS_ENVIRONMENT="sandbox"
railway variables set ALLOWED_ORIGINS="https://admin.trilogis.ca,http://localhost:3000"
```

## API Endpoints

### Health Check
```bash
GET https://quickbooks-cdc-sync-production.up.railway.app/health
```

### Start CDC Sync
```bash
POST https://quickbooks-cdc-sync-production.up.railway.app/api/sync/start
Content-Type: application/json

{
  "realmId": "9130348651845276",
  "verify": true
}
```

Response:
```json
{
  "jobId": "uuid-here",
  "message": "Sync job started"
}
```

### Stream Sync Progress (SSE)
```bash
GET https://quickbooks-cdc-sync-production.up.railway.app/api/sync/stream/{jobId}
```

Returns Server-Sent Events with real-time progress updates.

### Get Job Status
```bash
GET https://quickbooks-cdc-sync-production.up.railway.app/api/sync/status/{jobId}
```

### List Recent Jobs
```bash
GET https://quickbooks-cdc-sync-production.up.railway.app/api/sync/jobs?realmId={realmId}&limit=10
```

## Testing the Deployment

### 1. Health Check
```bash
curl https://quickbooks-cdc-sync-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "quickbooks-cdc-sync",
  "timestamp": "2025-01-23T..."
}
```

### 2. Start a Sync Job
```bash
curl -X POST https://quickbooks-cdc-sync-production.up.railway.app/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{"realmId":"9130348651845276","verify":true}'
```

### 3. Monitor Progress
```bash
# Use the jobId from the previous response
curl -N https://quickbooks-cdc-sync-production.up.railway.app/api/sync/stream/{jobId}
```

## Next Steps: Integrate with Next.js

### 1. Add Railway URL to Vercel

Add this environment variable to your Vercel deployment:

```bash
NEXT_PUBLIC_CDC_SYNC_URL=https://quickbooks-cdc-sync-production.up.railway.app
```

### 2. Create Frontend Component

Create a new page at `src/app/(landlord)/integration/quickbooks/cdc-sync/page.tsx` (example provided in CLAUDE_RAILWAY_CDC_PROMPT.md).

### 3. Test the Integration

1. Navigate to `/integration/quickbooks/cdc-sync`
2. Click "Start CDC Sync"
3. Watch real-time progress updates via SSE
4. View sync statistics and verification results

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  Next.js on Vercel  │         │  Railway CDC Worker  │
│                     │         │                      │
│  User clicks        │  HTTP   │  Express.js Server   │
│  "Start Sync"  ────────POST──→  /api/sync/start     │
│                     │         │                      │
│  Opens SSE     ←────────SSE────  /api/sync/stream   │
│  connection         │         │                      │
│                     │         │  • Fetch CDC data    │
│  Receives real-time │         │  • Process entities  │
│  progress updates   │         │  • Update database   │
│                     │         │  • Verify counts     │
└─────────────────────┘         └──────────────────────┘
                                         │
                                         ▼
                                ┌────────────────┐
                                │  Supabase DB   │
                                │  qb_* tables   │
                                └────────────────┘
```

## Monitoring & Logs

View logs in Railway:
```bash
railway logs -f
```

Or visit: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399

## Troubleshooting

### Issue: 401 Unauthorized from QuickBooks
**Solution**: Token expired. The worker automatically refreshes tokens, but if it persists, re-authenticate via the Next.js app.

### Issue: Deployment Fails
**Solution**: Check Railway logs for missing environment variables.

### Issue: SSE Connection Drops
**Solution**: Check CORS configuration. Ensure `ALLOWED_ORIGINS` includes your Vercel domain.

### Issue: Sync Takes Too Long
**Solution**: This is normal! CDC sync can take 4-5 minutes for large datasets. The worker has no timeout limits.

## Redeployment

To redeploy after making changes:

```bash
cd railway
railway up
```

Or push to git and Railway will auto-deploy (if connected to GitHub).

## Project Structure

```
railway/
├── server.js                    # Express server with SSE
├── sync/
│   ├── cdc-sync-worker.js      # Main CDC sync logic
│   ├── entity-preparers.js     # Entity data transformers
│   └── qb-auth.js              # QuickBooks auth & token refresh
├── package.json
└── DEPLOYMENT_GUIDE.md         # This file
```

## Success Criteria

✅ Deployment completes successfully
✅ Health check returns 200
✅ Environment variables are set
✅ Domain is accessible
✅ SSE streams work without timeout
✅ CDC sync completes (240-300 seconds)
✅ Database is updated with QuickBooks data
✅ Verification shows matching counts

---

**Deployed on**: 2025-01-23
**Service URL**: https://quickbooks-cdc-sync-production.up.railway.app
**Railway Project**: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399
