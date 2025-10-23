# 🕐 Railway Cron Setup - Complete Guide

## Set Up Daily Automated Mews Import (5 minutes)

This guide shows you how to create a Railway cron job that runs the Mews import automatically every day.

---

## Step 1: Go to Railway Dashboard

Visit: **https://railway.app/dashboard**

---

## Step 2: Open Your Project

Click on your project: **quickbooks-cdc-sync**

---

## Step 3: Add New Service

1. Click **"New"** button (top right)
2. Select **"Empty Service"**
3. Name it: **`mews-daily-cron`**

---

## Step 4: Connect to GitHub

1. Click on the **mews-daily-cron** service you just created
2. Go to **Settings** tab
3. Under **Source** section:
   - Click **"Connect Repo"**
   - Select repository: **CedricTri-logis/admin.trilogis.ca**
   - Branch: **master**
   - **Root Directory**: `railway/mews`

---

## Step 5: Configure Cron Schedule

1. Still in **Settings** tab
2. Scroll to **Cron** section
3. **Cron Schedule**: `0 2 * * *`
   - This runs every day at 2:00 AM
   - Change if you want a different time (see schedule options below)

---

## Step 6: Set Start Command

1. In **Settings** tab
2. Under **Deploy** section
3. **Start Command**: `node cron.js`

---

## Step 7: Deploy

1. Click **"Deploy"** button
2. Railway will build and deploy your cron service
3. The cron job will now run automatically on the schedule you set!

---

## ✅ Verify It Works

### Test Manually First:

In the **mews-daily-cron** service, go to **Deployments** → Click latest deployment → **"Run"**

This manually triggers the cron job to make sure it works.

### Check Logs:

In the **mews-daily-cron** service:
- Go to **Deployments**
- Click latest deployment
- View logs to see if the import started successfully

You should see:
```
🕐 Starting scheduled Mews import...
📍 API URL: https://mews-import-worker-production.up.railway.app
📅 Date range: 2024-10-22 to 2024-10-23
✅ Import job started successfully
```

### View Import Results:

1. Go to: **https://admin.trilogis.ca/integration/mews/import**
2. Scroll to bottom: **"Historique des synchronisations"**
3. You'll see all imports (manual and automatic)

---

## 📅 Cron Schedule Options

| Schedule | Description | When It Runs |
|----------|-------------|--------------|
| `0 2 * * *` | Every day at 2:00 AM | 2:00 AM daily |
| `0 6 * * *` | Every day at 6:00 AM | 6:00 AM daily |
| `0 23 * * *` | Every day at 11:00 PM | 11:00 PM daily |
| `0 */12 * * *` | Every 12 hours | Noon & Midnight |
| `0 0 * * 0` | Every Sunday at midnight | Weekly on Sunday |
| `0 1 * * 1-5` | Weekdays at 1:00 AM | Monday-Friday only |

---

## 🎯 What the Cron Job Does

1. **Runs on schedule** (e.g., 2 AM daily)
2. **Calculates date range** (yesterday's data)
3. **Calls Mews API** → `POST /api/sync/start`
4. **Import starts** in background
5. **Cron exits** (job continues in worker)

---

## 🔄 How To Change Settings

### Change Time:

1. Go to **mews-daily-cron** service
2. **Settings** → **Cron** section
3. Update **Cron Schedule**
4. Click **Save**

### Change Date Range:

Edit `railway/mews/cron.js`:

```javascript
// Current: imports yesterday's data
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

// Change to: import last 7 days
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

// Then update:
const from = weekAgo.toISOString().split('T')[0];
```

Commit and push - Railway auto-deploys!

---

## 📊 Monitoring

### View All Cron Executions:

**Railway Dashboard** → **mews-daily-cron** → **Deployments**

Each cron run appears as a separate deployment.

### View Import Results:

**https://admin.trilogis.ca/integration/mews/import**

Scroll to **"Historique des synchronisations"** to see:
- All imports (cron or manual)
- Date ranges imported
- Success/failure status
- Statistics (categories, spaces, reservations)
- Duration

### Check If Cron Is Running:

```bash
# Via Railway CLI
railway logs --service mews-daily-cron

# Or check latest execution in Dashboard
```

---

## 🆘 Troubleshooting

### Cron Not Running?

1. Check **mews-daily-cron** service is **Active** (not paused)
2. Verify **Cron Schedule** is set correctly
3. Check **Start Command** is `node cron.js`
4. Verify **Root Directory** is `railway/mews`

### Import Not Starting?

1. Check **mews-daily-cron** logs for errors
2. Verify **mews-import-worker** service is running
3. Check environment variables are set correctly
4. Test manual import at https://admin.trilogis.ca/integration/mews/import

### Wrong Date Range?

Edit `railway/mews/cron.js` and adjust the date calculations.

---

## ✨ Benefits

✅ **Automatic daily imports** - No manual work needed
✅ **Fresh data** - Always have yesterday's Mews data
✅ **Reliable** - Railway handles scheduling and retries
✅ **Monitored** - See all executions in history
✅ **Free** - Included in Railway's free tier
✅ **Easy to modify** - Change schedule anytime in Dashboard

---

## 🎉 You're Done!

Your Mews import now runs automatically every day!

Check the history at https://admin.trilogis.ca/integration/mews/import to see all syncs.
