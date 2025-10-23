# Mews Import Worker

Express server that handles Mews data import operations (space categories, spaces, reservations, accounting items) without Vercel timeout constraints.

## Features

- **Full Import**: Space categories, spaces, reservations, and accounting items
- **Date Range**: Configurable import period
- **SSE Streaming**: Real-time progress updates via Server-Sent Events
- **Truncate Option**: Clean imports by clearing existing data
- **Batch Processing**: Handles large datasets with configurable batch sizes
- **Job Management**: Track and monitor import jobs

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
railway variables set MEWS_CLIENT_TOKEN=your_mews_client_token
railway variables set MEWS_ACCESS_TOKEN=your_mews_access_token
railway variables set MEWS_API_URL=https://api.mews.com
railway variables set MEWS_SERVICE_ID=your_service_id
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
NEXT_PUBLIC_MEWS_SYNC_URL=https://your-railway-url.railway.app
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/sync/start` - Start Mews import
  ```json
  {
    "from": "2024-01-01",
    "to": "2024-12-31",
    "truncate": false,
    "batchDays": 7,
    "reservationBatchDays": 31,
    "reservationLeadDays": 120
  }
  ```
- `GET /api/sync/stream/:jobId` - SSE stream for progress
- `GET /api/sync/status/:jobId` - Get job status
- `GET /api/sync/jobs?limit=10` - List recent jobs

## Local Development

```bash
npm install
npm run dev
```

Server runs on port 3002 by default.

## Import Process

1. **Space Metadata**: Import categories and spaces (with template detection)
2. **Reservations**: Import reservations with configurable lead days
3. **Accounting Items**: Import revenue items with space linkage
4. **Statistics**: Track counts for all imported entities

## Configuration

- `batchDays`: Days per batch for accounting items (default: 7)
- `reservationBatchDays`: Days per batch for reservations (default: 31)
- `reservationLeadDays`: Lead days before/after date range (default: 120)
