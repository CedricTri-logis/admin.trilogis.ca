# ⚡ QuickBooks Cron Setup (2 Minutes)

Set up automated daily QuickBooks CDC sync for all active companies.

---

## 📱 Quick Setup

### 1. Open Railway Project
**https://railway.app/project/4b6312d5-289c-48a8-b9ca-575221127399**

### 2. Create New Service
- Click **"New"** → **"Empty Service"**
- Name it: **`quickbooks-daily-cron`**

### 3. Configure Source
Click the service → **Settings** → **Source**:
- **Repository**: CedricTri-logis/admin.trilogis.ca
- **Branch**: master
- **Root Directory**: `railway/quickbooks`

### 4. Set Cron Schedule
**Settings** → **Cron**:
- **Cron Schedule**: `0 2 * * *` (runs daily at 2:00 AM)

### 5. Configure Deployment
**Settings** → **Deploy**:
- **Start Command**: `node cron.js`

### 6. Set Environment Variables
**Settings** → **Variables** → Add these:
```
SUPABASE_URL=https://lwtjrizdzrdzkzcwtgfj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RAILWAY_PUBLIC_DOMAIN=<quickbooks-cdc-sync-url>
```

Get the `RAILWAY_PUBLIC_DOMAIN` from your **quickbooks-cdc-sync** service domain.

### 7. Deploy
Click **"Deploy"** button

---

## ✅ What It Does

The cron job will:
1. Run automatically at 2:00 AM daily
2. Fetch all active QuickBooks companies from Supabase
3. Trigger CDC sync for each company with verification
4. Log results showing success/failure counts
5. Exit cleanly

---

## 📊 View Results

### Check Logs
**Railway Dashboard** → **quickbooks-daily-cron** → **Deployments** → View logs

Expected output:
```
🕐 Starting scheduled QuickBooks sync...
📍 API URL: https://quickbooks-cdc-sync-production.up.railway.app
📋 Fetching active companies...
✅ Found 2 active companies

🏢 Syncing: Company A
   Realm ID: 123456789
   ✅ Sync started - Job ID: abc-123

🏢 Syncing: Company B
   Realm ID: 987654321
   ✅ Sync started - Job ID: def-456

📊 Summary:
   ✅ Successful: 2
   ❌ Failed: 0

🎉 Daily QuickBooks sync completed!
```

### View Sync History
**https://admin.trilogis.ca/integration/quickbooks/import**

Scroll to **"Historique des synchronisations"** to see all syncs (cron or manual).

---

## 🔧 Troubleshooting

### Cron Not Running?
1. Verify **Cron Schedule** is set in Railway settings
2. Check **Start Command** is `node cron.js`
3. Confirm **Root Directory** is `railway/quickbooks`
4. Ensure environment variables are set

### No Companies Found?
Check that companies have `is_active = true` in `quickbooks.qb_auth_tokens` table.

### Sync Fails to Start?
1. Verify **quickbooks-cdc-sync** service is running
2. Check `RAILWAY_PUBLIC_DOMAIN` points to correct service
3. Ensure Supabase credentials are valid

---

## 📅 Schedule Options

| Schedule | Description | When It Runs |
|----------|-------------|--------------|
| `0 2 * * *` | Every day at 2:00 AM | 2:00 AM daily |
| `0 6 * * *` | Every day at 6:00 AM | 6:00 AM daily |
| `0 */12 * * *` | Every 12 hours | Noon & Midnight |
| `0 1 * * 1-5` | Weekdays at 1:00 AM | Monday-Friday only |

---

## 🎉 You're Done!

QuickBooks will now sync automatically every day for all active companies!
