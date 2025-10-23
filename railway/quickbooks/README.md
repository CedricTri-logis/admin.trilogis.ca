# QuickBooks CDC Sync Worker

Express server that handles QuickBooks Change Data Capture (CDC) synchronization operations without Vercel timeout constraints.

## Features

- **CDC Sync**: Incremental sync for all QuickBooks entities
- **SSE Streaming**: Real-time progress updates via Server-Sent Events
- **Verification**: Optional entity count verification against QuickBooks
- **Token Refresh**: Automatic OAuth token refresh handling
- **Job Management**: Track and monitor sync jobs

## Deployment to Railway

### 1. Create New Railway Project

```bash
railway login
railway init
```

### 2. Set Environment Variables

```bash
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
railway variables set QUICKBOOKS_CLIENT_ID=your_qb_client_id
railway variables set QUICKBOOKS_CLIENT_SECRET=your_qb_client_secret
railway variables set QUICKBOOKS_ENVIRONMENT=sandbox
railway variables set ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000
```

### 3. Deploy

```bash
railway up
```

### 4. Get Deployment URL

```bash
railway domain
```

### 5. Update Frontend Environment Variable

Add to Vercel:
```
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://your-railway-url.railway.app
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/sync/start` - Start CDC sync
  ```json
  {
    "realmId": "123456789",
    "verify": true
  }
  ```
- `GET /api/sync/stream/:jobId` - SSE stream for progress
- `GET /api/sync/status/:jobId` - Get job status
- `GET /api/sync/jobs?realmId=&limit=10` - List recent jobs

## Local Development

```bash
npm install
npm run dev
```

Server runs on port 3001 by default.
