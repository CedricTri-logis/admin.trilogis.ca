# Manual Deployment Steps for qb-cdc-worker Service

The Railway CLI is having linking issues. Please complete these steps manually in the Railway dashboard.

## ✅ What's Already Done

1. ✅ Service `qb-cdc-worker` has been created
2. ✅ Domain generated: `https://qb-cdc-worker-production.up.railway.app`
3. ✅ Environment variables set:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_SUPABASE_URL
   - QUICKBOOKS_CLIENT_ID
   - QUICKBOOKS_CLIENT_SECRET
   - QUICKBOOKS_ENVIRONMENT
   - ALLOWED_ORIGINS
4. ✅ Code committed to git (commit: 58c18f9)
5. ✅ Code deployed but using wrong configuration

## ❌ Current Problem

The service is starting with `node cron.js` instead of `node server.js` because Railway hasn't been configured to use the correct root directory.

## 🔧 Fix Required (Manual Steps)

### Step 1: Open Railway Project

Go to: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399

### Step 2: Find and Click `qb-cdc-worker` Service

Look for the service tile named `qb-cdc-worker` in your project canvas.

### Step 3: Configure Service Settings

Click on the service, then go to the **Settings** tab.

### Step 4: Connect GitHub Repository

In the **Source** section:
1. Click **"Connect Repo"**
2. Select repository: `CedricTri-logis/admin.trilogis.ca`
3. Branch: `master`

### Step 5: Set Root Directory

**CRITICAL:** In the **Root Directory** field, enter:
```
railway/quickbooks-cdc
```

This tells Railway to look for `railway.json` and code in the correct directory.

### Step 6: Verify Build & Start Commands

Railway should auto-detect from `railway.json`:
- **Build Command**: (leave as auto-detect, should be `npm install`)
- **Start Command**: Should show `node server.js`

If Start Command shows `node cron.js`, manually change it to:
```
node server.js
```

### Step 7: Verify Environment Variables

Go to **Variables** tab and confirm these exist:
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ QUICKBOOKS_CLIENT_ID
- ✅ QUICKBOOKS_CLIENT_SECRET
- ✅ QUICKBOOKS_ENVIRONMENT
- ✅ ALLOWED_ORIGINS

### Step 8: Trigger Deployment

After saving the Root Directory setting:
1. Go to **Deployments** tab
2. Click **"Deploy"** button
3. Watch build logs to ensure it builds successfully

### Step 9: Test the Deployment

After deployment completes (green checkmark), test the health endpoint:

```bash
curl https://qb-cdc-worker-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "quickbooks-cdc-sync",
  "timestamp": "2025-10-24T..."
}
```

## ✅ Success Criteria

When correctly configured, you should see in the deployment logs:
```
🚀 QuickBooks CDC Sync Service running on port 3001
📍 Health check: http://localhost:3001/health
```

NOT this (which is the Mews cron):
```
🕐 Starting scheduled Mews import...
```

## 📊 After Successful Deployment

### Update Frontend Environment

1. **Local development** - Edit `.env.local`:
   ```
   NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://qb-cdc-worker-production.up.railway.app
   ```

2. **Vercel production**:
   ```bash
   vercel env rm NEXT_PUBLIC_QUICKBOOKS_SYNC_URL production --yes
   echo -n "https://qb-cdc-worker-production.up.railway.app" | vercel env add NEXT_PUBLIC_QUICKBOOKS_SYNC_URL production
   vercel --prod
   ```

### Test from Frontend

1. Go to: https://admin.trilogis.ca/integration/quickbooks/import
2. Click "Start Sync"
3. Should see real-time progress
4. Check sync completes successfully

### Cleanup Old Services (After Verification)

Once the new service works, delete these old services:
1. ❌ `quickbooks-cdc-sync` (old failing worker)
2. ❌ `quickbooks-daily-cron` (old cron service)

Keep these:
- ✅ `qb-cdc-worker` (NEW unified service)
- ✅ `mews-import-worker`
- ✅ `mews-daily-cron`

## 🐛 Troubleshooting

### Issue: Still seeing "node cron.js" in logs

**Fix:** Root Directory is not set correctly. Verify it's exactly:
```
railway/quickbooks-cdc
```

### Issue: Build fails with "Cannot find module"

**Fix:** Check that root directory path is correct and railway.json exists in that directory.

### Issue: 502 Application failed to respond

**Check:**
1. Deployment logs show successful build
2. Runtime logs show server started on port 3001
3. Environment variables are all set

### Issue: Service links to wrong GitHub repo

**Fix:** Disconnect and reconnect the GitHub source in Settings.

## 📚 Reference

- Service URL: https://qb-cdc-worker-production.up.railway.app
- Project URL: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399
- GitHub Commit: 58c18f9
- Code Location: `railway/quickbooks-cdc/`

## 🎯 Quick Checklist

- [ ] Open Railway project dashboard
- [ ] Click on `qb-cdc-worker` service
- [ ] Go to Settings tab
- [ ] Connect GitHub repo: `CedricTri-logis/admin.trilogis.ca`
- [ ] Set Root Directory: `railway/quickbooks-cdc`
- [ ] Verify Start Command: `node server.js`
- [ ] Deploy
- [ ] Test health endpoint
- [ ] Update frontend env vars
- [ ] Test sync from frontend
- [ ] Delete old services

---

**Note:** The Railway CLI had issues with service linking, which is why manual configuration is needed. Once the root directory is set correctly, future deployments can be automatic via GitHub pushes.
