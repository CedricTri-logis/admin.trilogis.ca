# Railway Deployment Status

Last Updated: October 23, 2025

## ✅ QuickBooks CDC Sync Worker - DEPLOYED

**Service URL:** https://quickbooks-cdc-sync-production.up.railway.app
**Project:** quickbooks-cdc-sync
**Status:** ✅ Running

### Completed:
- ✅ Deployed to Railway
- ✅ Domain generated
- ✅ Basic environment variables set (SUPABASE_URL, ALLOWED_ORIGINS)

### Remaining Steps:
1. **Add these environment variables in Railway dashboard:**
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `QUICKBOOKS_CLIENT_ID` - Your QuickBooks OAuth client ID
   - `QUICKBOOKS_CLIENT_SECRET` - Your QuickBooks OAuth client secret

2. **Add to Vercel environment variables:**
   ```
   NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://quickbooks-cdc-sync-production.up.railway.app
   ```

3. **Test the service:**
   - Visit: https://admin.trilogis.ca/integration/quickbooks/import
   - Select companies and start sync

---

## ⏳ Mews Import Worker - MANUAL SETUP REQUIRED

**Status:** ⏳ Awaiting manual deployment

The Railway CLI requires interactive terminal mode to create a new separate project. Please deploy manually using one of the methods below:

### Method 1: Railway Dashboard (Recommended - Easiest)

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `CedricTri-logis/admin.trilogis.ca`
5. Configure the service:
   - **Name:** mews-import-worker
   - **Root Directory:** `railway/mews`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

6. **Add all environment variables:**
   ```bash
   SUPABASE_URL=https://jcfptydvuqnxagrntepd.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   MEWS_CLIENT_TOKEN=<your_mews_client_token>
   MEWS_ACCESS_TOKEN=<your_mews_access_token>
   MEWS_API_URL=https://api.mews.com
   MEWS_SERVICE_ID=205b838c-02a3-47ae-a329-aee8010a0a25
   ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000,https://admin-trilogis-4m4yyxesv-cedric-lajoies-projects.vercel.app
   ```

7. Click **"Deploy"**

8. Once deployed, click **"Generate Domain"** to get the public URL

9. **Add the URL to Vercel:**
   ```
   NEXT_PUBLIC_MEWS_SYNC_URL=<your-mews-railway-url>
   ```

10. **Test the service:**
    - Visit: https://admin.trilogis.ca/integration/mews/import
    - Configure date range and start import

### Method 2: Railway CLI (For Terminal Users)

```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca/railway/mews

# Initialize new Railway project (interactive)
railway init
# When prompted:
# - Select: "Create a new project"
# - Name: "mews-import-worker"

# Deploy
railway up

# Generate domain
railway domain

# Set environment variables
railway variables set SUPABASE_URL=https://jcfptydvuqnxagrntepd.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=<your_key>
railway variables set MEWS_CLIENT_TOKEN=<your_token>
railway variables set MEWS_ACCESS_TOKEN=<your_token>
railway variables set MEWS_API_URL=https://api.mews.com
railway variables set MEWS_SERVICE_ID=205b838c-02a3-47ae-a329-aee8010a0a25
railway variables set ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000
```

---

## Verification Checklist

### QuickBooks Worker
- [ ] All environment variables set in Railway
- [ ] `NEXT_PUBLIC_QUICKBOOKS_SYNC_URL` added to Vercel
- [ ] Service responds to `/health` endpoint
- [ ] Frontend page loads without errors
- [ ] Can start a sync job successfully

### Mews Worker
- [ ] Railway project created
- [ ] Deployed from `railway/mews` directory
- [ ] All environment variables set in Railway
- [ ] Domain generated
- [ ] `NEXT_PUBLIC_MEWS_SYNC_URL` added to Vercel
- [ ] Service responds to `/health` endpoint
- [ ] Frontend page loads without errors
- [ ] Can start an import job successfully

---

## Architecture

Both services are now **completely independent**:

- ✅ Separate Railway projects
- ✅ Separate deployments
- ✅ Independent scaling
- ✅ Isolated failures
- ✅ Separate logs and monitoring
- ✅ Different environment variables

**Frontend Integration:**
- QuickBooks page uses: `NEXT_PUBLIC_QUICKBOOKS_SYNC_URL`
- Mews page uses: `NEXT_PUBLIC_MEWS_SYNC_URL`

---

## Need Help?

- **Railway Dashboard:** https://railway.app/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Documentation:** See `railway/quickbooks/README.md` and `railway/mews/README.md`
