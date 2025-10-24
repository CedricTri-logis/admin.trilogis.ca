# Railway Workers - Separated Services

This directory contains separate Railway worker services for different import operations. Each service is independent and can be deployed separately.

## ⚠️ Important: Clean Architecture

**ONLY these two services should be deployed to Railway:**
1. `railway/quickbooks/` - QuickBooks cron service
2. `railway/mews/` - Mews import worker

**DO NOT** deploy from the `railway/` root directory. Each service has its own isolated code in its subdirectory.

## Structure

```
railway/
├── quickbooks/          # ✅ QuickBooks Cron Service (Service 1)
│   ├── cron.js          # Daily sync trigger
│   ├── server.js        # [Deprecated - not used by cron]
│   ├── package.json     # QB-specific dependencies
│   ├── railway.toml     # Railway config: runs cron.js
│   └── sync/
│       ├── cdc-sync-worker.js
│       ├── qb-auth.js
│       └── entity-preparers.js
│
├── mews/                # ✅ Mews Import Worker (Service 2)
│   ├── server.js        # Express server with Mews endpoints
│   ├── package.json     # Mews-specific dependencies
│   ├── railway.toml     # Railway config: runs server.js
│   └── sync/
│       └── mews-sync-worker.js
│
└── [Shared files]
    ├── package.json     # Shared dependency definitions
    ├── README.md        # This file
    └── *.md             # Documentation files
```

## Why Separate Services?

### Benefits:
1. **Independent Scaling** - Each service scales based on its own load
2. **Failure Isolation** - If one crashes, the other continues working
3. **Separate Logs** - Easier debugging and monitoring
4. **Independent Deployments** - Update one without affecting the other
5. **Resource Optimization** - Railway can allocate resources independently
6. **Clean Separation** - Each service has its own dependencies

## Deployment

### QuickBooks CDC Sync Worker

```bash
cd railway/quickbooks
railway login
railway init
railway up
railway domain
```

Set environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_ENVIRONMENT`
- `ALLOWED_ORIGINS`

Frontend env: `NEXT_PUBLIC_QUICKBOOKS_SYNC_URL`

### Mews Import Worker

```bash
cd railway/mews
railway login
railway init
railway up
railway domain
```

Set environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MEWS_CLIENT_TOKEN`
- `MEWS_ACCESS_TOKEN`
- `MEWS_API_URL`
- `MEWS_SERVICE_ID`
- `ALLOWED_ORIGINS`

Frontend env: `NEXT_PUBLIC_MEWS_SYNC_URL`

## Local Development

### QuickBooks Worker
```bash
cd railway/quickbooks
npm install
npm run dev  # Runs on port 3001
```

### Mews Worker
```bash
cd railway/mews
npm install
npm run dev  # Runs on port 3002
```

## API Endpoints

Both services share the same endpoint structure for consistency:

- `GET /health` - Health check
- `POST /api/sync/start` - Start sync/import
- `GET /api/sync/stream/:jobId` - SSE progress stream
- `GET /api/sync/status/:jobId` - Get job status
- `GET /api/sync/jobs` - List recent jobs

## Frontend Integration

The frontend uses separate environment variables:

**QuickBooks Import Page** (`/integration/quickbooks/import`):
- Uses `NEXT_PUBLIC_QUICKBOOKS_SYNC_URL`

**Mews Import Page** (`/integration/mews/import`):
- Uses `NEXT_PUBLIC_MEWS_SYNC_URL`

## Railway Services to Keep

Your Railway dashboard should have **exactly TWO services**:

1. **quickbooks-daily-cron** (or similar name)
   - Root Directory: `railway/quickbooks`
   - Start Command: `node cron.js`
   - Purpose: Runs daily QuickBooks sync

2. **mews-import-worker** (or similar name)
   - Root Directory: `railway/mews`
   - Start Command: `node server.js`
   - Purpose: Handles Mews import requests

## ⚠️ Delete Old Service

If you see a third service with a random name (e.g., "tranquil-learning") that runs from the root `railway/` directory, **DELETE IT** - it's the deprecated combined service that is no longer needed.

## Monitoring

Each service can be monitored independently in Railway:
- View logs separately
- Monitor resource usage per service
- Set up alerts per service
- Scale independently based on load
