# QuickBooks CDC Sync Service

Unified Railway service that wraps the proven QuickBooks CDC sync script with a simple Express API.

## Architecture

This service uses a **lightweight wrapper pattern**:
- **server.js** (250 lines) - Express API that spawns the sync script as a background process
- **sync-cdc-worker.js** (1,264 lines) - The proven CDC sync script with 95%+ accuracy

Benefits of this approach:
- Reuses the working script that achieves 19/20 entity perfect match
- Simple API layer for frontend integration
- Uses same database tables as the local script (qb_cdc_sync_log)
- No duplication of sync logic or tracking tables

## API Endpoints

All endpoints match the existing API contract for easy frontend migration:

- `GET /health` - Health check
- `POST /api/sync/start` - Start sync job
  ```json
  {
    "realmId": "9130...",
    "verify": false
  }
  ```
- `GET /api/sync/status/:jobId` - Get job status
- `GET /api/sync/jobs?limit=10` - List recent sync jobs
- `GET /api/sync/stream/:jobId` - SSE stream for real-time progress

## Deployment to Railway

### 1. Create New Service

```bash
cd railway/quickbooks-cdc
railway login
railway init
```

When prompted:
- **Project**: Select existing project (4b6312d5-289c-48a8-b9ca-575221127399)
- **Service name**: `quickbooks-cdc-unified`

### 2. Set Environment Variables

```bash
railway variables set SUPABASE_URL="https://lwtjrizdzrdzkzcwtgfj.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJ..."
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://lwtjrizdzrdzkzcwtgfj.supabase.co"
railway variables set QUICKBOOKS_CLIENT_ID="AB2l47..."
railway variables set QUICKBOOKS_CLIENT_SECRET="C8Aii4..."
railway variables set QUICKBOOKS_ENVIRONMENT="production"
railway variables set ALLOWED_ORIGINS="https://admin.trilogis.ca,http://localhost:3000"
railway variables set PORT="3001"
```

### 3. Deploy

```bash
railway up
```

### 4. Generate Domain

```bash
railway domain
```

Save the generated URL (e.g., `https://quickbooks-cdc-unified-production.up.railway.app`)

### 5. Update Frontend

Update `.env.local`:
```bash
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://quickbooks-cdc-unified-production.up.railway.app
```

Deploy to Vercel:
```bash
vercel env add NEXT_PUBLIC_QUICKBOOKS_SYNC_URL production
# Enter the Railway URL when prompted
vercel --prod
```

## Local Development

```bash
cd railway/quickbooks-cdc
npm install
npm start
```

The service will run on `http://localhost:3001`

Test the health check:
```bash
curl http://localhost:3001/health
```

Start a sync:
```bash
curl -X POST http://localhost:3001/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{"realmId":"9130348256395025"}'
```

## Database Tables Used

This service uses the same tables as the proven local script:

- `quickbooks.qb_cdc_sync_log` - Sync job tracking
- `quickbooks.qb_deletion_log` - Deletion tracking
- All entity tables: `qb_invoices`, `qb_customers`, `qb_bills`, etc.

**Does NOT use** the old worker tables:
- ❌ `sync_jobs`
- ❌ `sync_entity_jobs`
- ❌ `sync_batches`
- ❌ `qb_sync_jobs`
- ❌ `qb_sync_events`

## Monitoring

View logs in Railway dashboard:
```
https://railway.app/project/4b6312d5.../service/[service-id]/logs
```

Check sync history:
```bash
curl https://your-railway-url.railway.app/api/sync/jobs?limit=20
```

## Cleanup Old Services

After verifying this service works, delete the old services:

1. **quickbooks-cdc-sync** (old failing worker)
2. **quickbooks-daily-cron** (old cron service)

Keep only:
- ✅ `quickbooks-cdc-unified` (this new service)
- ✅ `mews-import-worker` (separate service)

## Troubleshooting

### 403 Errors
The service automatically refreshes expired QuickBooks tokens. If you see persistent 403 errors, check:
1. QuickBooks connection is active in frontend settings
2. OAuth tokens are not expired (they refresh automatically every 100 days)

### Sync Progress
Monitor real-time progress via SSE:
```javascript
const eventSource = new EventSource(`/api/sync/stream/${jobId}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data);
};
```

### Job Status
Check job status:
```bash
curl https://your-railway-url.railway.app/api/sync/status/{jobId}
```

## Performance

Based on testing with the local script:
- **Accuracy**: 19/20 entities achieve 95-100% match
- **Speed**: Syncs 21,450 invoices + 2,024 customers in ~2-3 minutes
- **Reliability**: Proven script with automatic token refresh
