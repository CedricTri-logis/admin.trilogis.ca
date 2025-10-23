# Setting Up Daily Automated Mews Import

## 🚂 Railway Cron Job Setup (Recommended)

Railway makes it easy to run scheduled tasks. Here's how to set up daily Mews imports:

---

## Option 1: Railway Dashboard (Easiest - 2 minutes)

### Step 1: Add a New Service

1. Go to https://railway.app/dashboard
2. Select your project: **quickbooks-cdc-sync**
3. Click **"New"** → **"Empty Service"**
4. Name it: **mews-daily-cron**

### Step 2: Configure the Cron Service

1. Go to **Settings** tab
2. Under **Source**:
   - Connect to your GitHub repo: `CedricTri-logis/admin.trilogis.ca`
   - Set **Root Directory**: `railway/mews`

3. Under **Deploy**:
   - **Cron Schedule**: `0 2 * * *` (runs at 2 AM daily)
   - **Start Command**: `node cron.js`

### Step 3: Add Environment Variables

The cron service will automatically have access to:
- `RAILWAY_PUBLIC_DOMAIN` (auto-set by Railway)

No additional variables needed!

### Step 4: Deploy

Click **Deploy** and the cron job will run automatically every day at 2 AM.

---

## Option 2: Using Railway CLI

```bash
cd railway/mews

# Add a new cron service
railway add --service mews-daily-cron

# Deploy the cron service
railway up

# Set cron schedule via Railway Dashboard (Settings → Cron Schedule)
# Enter: 0 2 * * *
```

---

## Cron Schedule Options

| Schedule | Description |
|----------|-------------|
| `0 2 * * *` | Every day at 2:00 AM |
| `0 6 * * *` | Every day at 6:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Every Sunday at midnight |

---

## How It Works

1. Railway triggers `node cron.js` on schedule
2. `cron.js` calculates yesterday's date
3. Makes HTTP POST to `/api/sync/start` endpoint
4. Mews import worker processes the request
5. Job runs in background, cron exits

---

## Monitoring

**View Cron Logs:**
1. Go to Railway Dashboard
2. Select **mews-daily-cron** service
3. Click **Deployments** → View logs

**Check Last Import:**
```bash
curl https://mews-import-worker-production.up.railway.app/api/sync/jobs?limit=5
```

---

## Manual Trigger

You can manually trigger the cron job anytime:

```bash
# Via Railway CLI
railway run node cron.js

# Or directly via API
curl -X POST https://mews-import-worker-production.up.railway.app/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2024-01-01",
    "to": "2024-01-31",
    "truncate": false
  }'
```

---

## Customization

Edit `cron.js` to change:
- Date range (currently: yesterday to today)
- Truncate option (currently: false)
- Batch sizes
- Error handling

Then commit and push - Railway will auto-deploy!

---

## Benefits of Railway Cron

✅ **Simple**: No external services needed
✅ **Integrated**: Same project, logs, and monitoring
✅ **Reliable**: Railway handles scheduling and retries
✅ **Scalable**: Independent service, doesn't affect main worker
✅ **Free**: Included in Railway's free tier

