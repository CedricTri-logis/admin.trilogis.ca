# 🎯 Final Deployment Steps - Quick Guide

## ✅ What's Already Done

### QuickBooks CDC Sync Worker
- ✅ **Deployed to Railway**
- ✅ **URL:** https://quickbooks-cdc-sync-production.up.railway.app
- ✅ **All environment variables set**
- ✅ **Service is running**

**Status:** 🟢 Ready to use (just need to add URL to Vercel)

---

## 🔧 What You Need to Do (5 minutes)

### Step 1: Deploy Mews Worker (3 minutes)

The Mews worker needs a separate Railway project. Run this:

```bash
cd railway/mews
./DEPLOY.sh
```

**The script will:**
1. Create a new Railway project called "mews-import-worker"
2. Deploy the Mews service
3. Set all environment variables
4. Generate a public domain

**⚠️ Important:** You'll need to provide your Mews tokens when prompted:
- Replace `your_mews_client_token` with your actual token
- Replace `your_mews_access_token` with your actual token

**Save the Railway URL** that's generated at the end.

---

### Step 2: Update Vercel Environment Variables (2 minutes)

Go to: https://vercel.com/dashboard

**Add these two environment variables:**

```
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://quickbooks-cdc-sync-production.up.railway.app
NEXT_PUBLIC_MEWS_SYNC_URL=<your-mews-railway-url-from-step-1>
```

**Then redeploy** (Vercel will auto-deploy on the next git push, or manually trigger)

---

### Step 3: Test Everything (1 minute)

Once Vercel deploys:

1. **Test QuickBooks:**
   - Go to: https://admin.trilogis.ca/integration/quickbooks/import
   - Should load without errors
   - Try starting a sync

2. **Test Mews:**
   - Go to: https://admin.trilogis.ca/integration/mews/import
   - Should load without errors
   - Try starting an import

---

## 🎉 That's It!

You now have:
- ✅ Two independent Railway services
- ✅ Separate scaling and monitoring
- ✅ Failure isolation
- ✅ Clean architecture

---

## 📖 Alternative: Manual Railway Deployment (if script fails)

If the `DEPLOY.sh` script doesn't work, deploy manually via Railway Dashboard:

### Via Railway Dashboard:

1. Go to: https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose: `CedricTri-logis/admin.trilogis.ca`
5. **Root Directory:** `railway/mews`
6. Add environment variables:
   ```
   SUPABASE_URL=https://jcfptydvuqnxagrntepd.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your_key>
   MEWS_CLIENT_TOKEN=<your_token>
   MEWS_ACCESS_TOKEN=<your_token>
   MEWS_API_URL=https://api.mews.com
   MEWS_SERVICE_ID=205b838c-02a3-47ae-a329-aee8010a0a25
   ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000
   ```
7. Deploy
8. Generate domain
9. Add domain to Vercel as `NEXT_PUBLIC_MEWS_SYNC_URL`

---

## 🆘 Need Help?

- **Railway Docs:** https://docs.railway.app/
- **Deployment Status:** See `railway/DEPLOYMENT_STATUS.md`
- **QuickBooks README:** `railway/quickbooks/README.md`
- **Mews README:** `railway/mews/README.md`
