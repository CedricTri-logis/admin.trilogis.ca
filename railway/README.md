# Railway Workers - Separated Services

This directory contains separate Railway worker services for different import operations. Each service is independent and can be deployed separately.

## Structure

```
railway/
├── quickbooks/          # QuickBooks CDC Sync Worker
│   ├── server.js        # Express server with QB endpoints
│   ├── package.json     # QB-specific dependencies
│   ├── README.md        # QB deployment guide
│   └── sync/
│       ├── cdc-sync-worker.js
│       ├── qb-auth.js
│       └── entity-preparers.js
│
└── mews/                # Mews Import Worker
    ├── server.js        # Express server with Mews endpoints
    ├── package.json     # Mews-specific dependencies
    ├── README.md        # Mews deployment guide
    └── sync/
        └── mews-sync-worker.js
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

## Migration from Combined Service

If migrating from a combined service:

1. Deploy QuickBooks worker
2. Deploy Mews worker
3. Update Vercel environment variables
4. Test both services
5. Remove old combined service

## Monitoring

Each service can be monitored independently in Railway:
- View logs separately
- Monitor resource usage per service
- Set up alerts per service
- Scale independently based on load
