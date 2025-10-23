# Railway Workers - Simple Setup

This folder contains a simple web server that runs your background jobs on Railway.

## How It Works

1. **Server runs 24/7** - Railway keeps this server running
2. **External cron triggers it** - cron-job.org sends requests on schedule
3. **Server runs your scripts** - Executes your existing scripts as-is
4. **No time limits** - Scripts can run for hours

## Architecture

```
cron-job.org (Free scheduler)
    ↓
    Sends HTTP request at 2 AM daily
    ↓
Railway Server (This server.js)
    ↓
    Runs: node scripts/quickbooks/Import/sync-cdc-incremental.js
    ↓
    Takes 30-60 minutes (no problem!)
    ↓
    Returns "done"
```

## Files in This Folder

- `server.js` - Web server that triggers your scripts
- `package.json` - Dependencies needed

## Testing Locally

1. Go to railway folder:
```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca/railway
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Test health check (open new terminal):
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","uptime":123}
```

5. Test triggering QB sync (OPTIONAL - will actually run your script!):
```bash
curl -X POST http://localhost:3000/sync/quickbooks \
  -H "Authorization: Bearer change-me-in-production"
```

## Deployment to Railway

### 1. Sign Up for Railway
- Go to https://railway.app
- Sign up with GitHub

### 2. Create New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your `admin.trilogis.ca` repository

### 3. Configure Root Directory
- Click your service
- Go to "Settings"
- Set "Root Directory" to: `railway`

### 4. Add Environment Variables
Click "Variables" tab and add ALL these:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
QUICKBOOKS_CLIENT_ID=your_id
QUICKBOOKS_CLIENT_SECRET=your_secret
QUICKBOOKS_ENVIRONMENT=production
MEWS_CLIENT_TOKEN=your_token
MEWS_ACCESS_TOKEN=your_token
MEWS_API_URL=https://api.mews.com
MEWS_SERVICE_ID=your_id

# Create a strong random secret (use https://www.uuidgenerator.net/)
CRON_SECRET=your-very-secret-random-string-here
```

### 5. Deploy
- Railway automatically deploys
- Wait ~2 minutes
- You'll get a URL: `your-app.railway.app`

### 6. Set Up Cron Jobs

Go to https://cron-job.org (free):

**Job 1: QuickBooks Sync**
- Title: "QuickBooks CDC Sync"
- URL: `https://your-app.railway.app/sync/quickbooks`
- Schedule: `0 2 * * *` (Daily at 2 AM)
- Request method: POST
- Headers → Add:
  - Key: `Authorization`
  - Value: `Bearer your-cron-secret` (use same as Railway CRON_SECRET)

**Job 2: MEWS Sync**
- Title: "MEWS Import"
- URL: `https://your-app.railway.app/sync/mews`
- Schedule: `0 3 * * *` (Daily at 3 AM)
- Request method: POST
- Headers → Add:
  - Key: `Authorization`
  - Value: `Bearer your-cron-secret`

## Monitoring

### View Railway Logs
1. Go to Railway dashboard
2. Click your service
3. Click "Deployments"
4. View live logs

### Manual Test
```bash
# Test health
curl https://your-app.railway.app/health

# Trigger QB sync manually
curl -X POST https://your-app.railway.app/sync/quickbooks \
  -H "Authorization: Bearer your-cron-secret"
```

## Cost

- **Railway**: $5/month
- **cron-job.org**: FREE
- **Total**: $5/month

## Your Scripts Run Exactly As-Is

No changes needed to:
- `scripts/quickbooks/Import/sync-cdc-incremental.js`
- `scripts/mews/import-mews2-data.js`

They run with no time limits!
