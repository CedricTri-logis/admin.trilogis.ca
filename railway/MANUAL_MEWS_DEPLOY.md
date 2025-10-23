# Manual Mews Deployment - Railway Dashboard

Since the Railway CLI requires interactive mode to create separate projects, please deploy Mews manually via the Railway Dashboard. This takes ~3 minutes.

## Step-by-Step Instructions

### 1. Go to Railway Dashboard
Visit: https://railway.app/dashboard

### 2. Create New Project
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**

### 3. Configure Repository
- Choose repository: **CedricTri-logis/admin.trilogis.ca**
- Click **"Deploy Now"**

### 4. Configure Service
After deployment starts, click on the service and set:

**Settings → General:**
- **Service Name:** `mews-import-worker`
- **Root Directory:** `railway/mews`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### 5. Add Environment Variables
Go to **Variables** tab and add:

```
SUPABASE_URL=https://jcfptydvuqnxagrntepd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dGpyaXpkenJkemt6Y3d0Z2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MzYyNSwiZXhwIjoyMDcxMDY5NjI1fQ.J7Jio2Xqk0TdTzeCHMemzXPD9QxE_419CSGrCE2HImw
MEWS_CLIENT_TOKEN=your_actual_mews_client_token
MEWS_ACCESS_TOKEN=your_actual_mews_access_token  
MEWS_API_URL=https://api.mews.com
MEWS_SERVICE_ID=205b838c-02a3-47ae-a329-aee8010a0a25
ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000
```

### 6. Generate Domain
- Go to **Settings → Networking**
- Click **"Generate Domain"**
- Copy the generated URL (e.g., `mews-import-worker-production.up.railway.app`)

### 7. Update Vercel
Go to Vercel Dashboard: https://vercel.com/dashboard

Add environment variables:
```
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://quickbooks-cdc-sync-production.up.railway.app
NEXT_PUBLIC_MEWS_SYNC_URL=https://your-mews-url.up.railway.app
```

Redeploy Vercel.

### 8. Test
- https://admin.trilogis.ca/integration/quickbooks/import
- https://admin.trilogis.ca/integration/mews/import

## Done! 🎉

You now have two completely independent Railway projects.
