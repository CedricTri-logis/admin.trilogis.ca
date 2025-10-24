# How to Create a New Service on Railway

Complete step-by-step guide for deploying the QuickBooks CDC service to Railway.

## Prerequisites

- Railway account with access to project: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399
- Code committed to Git repository
- Railway CLI installed (optional, but recommended)

## Method 1: Deploy via Railway Dashboard (Easiest)

### Step 1: Create New Service

1. Navigate to your Railway project:
   ```
   https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399
   ```

2. Click the **"New"** button in the top right corner

3. Select **"GitHub Repo"** (if using Git deployment)
   - Or select **"Empty Service"** for manual upload

4. If using GitHub:
   - Select your repository: `admin.trilogis.ca`
   - Railway will detect the repository

### Step 2: Configure Service Settings

1. Click on the newly created service card

2. Go to **Settings** tab

3. Configure the following:

   **Service Name:**
   ```
   quickbooks-cdc-unified
   ```

   **Root Directory:**
   ```
   railway/quickbooks-cdc
   ```

   **Start Command:** (should auto-detect from railway.json, but verify)
   ```
   node server.js
   ```

   **Builder:**
   ```
   NIXPACKS
   ```

   **Restart Policy:**
   - Type: `ON_FAILURE`
   - Max Retries: `10`

   **Healthcheck Path:**
   ```
   /health
   ```

### Step 3: Add Environment Variables

1. Go to **Variables** tab

2. Click **"New Variable"** and add each of these:

   ```
   SUPABASE_URL=https://lwtjrizdzrdzkzcwtgfj.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dGpyaXpkenJkemt6Y3d0Z2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MzYyNSwiZXhwIjoyMDcxMDY5NjI1fQ.J7Jio2Xqk0TdTzeCHMemzXPD9QxE_419CSGrCE2HImw
   NEXT_PUBLIC_SUPABASE_URL=https://lwtjrizdzrdzkzcwtgfj.supabase.co
   QUICKBOOKS_CLIENT_ID=AB2l47MnudsFyqjjV87lfWuoladLMw0Bimty5lULIohYq7lu4O
   QUICKBOOKS_CLIENT_SECRET=C8Aii4DwuEHl7SwG9QgbEFPcHi8gsXaD8Ey0VfT3
   QUICKBOOKS_ENVIRONMENT=production
   ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000
   PORT=3001
   ```

3. Click **"Add"** for each variable

### Step 4: Deploy

1. Railway will automatically trigger a deployment after you configure settings

2. Or manually trigger deployment:
   - Go to **Deployments** tab
   - Click **"Deploy"** button

3. Watch the build logs to ensure successful deployment

### Step 5: Generate Public Domain

1. Go to **Settings** tab

2. Scroll to **Networking** section

3. Click **"Generate Domain"**

4. Railway will generate a public URL like:
   ```
   https://quickbooks-cdc-unified-production.up.railway.app
   ```

5. **Save this URL** - you'll need it for the frontend configuration

### Step 6: Verify Deployment

Test the health endpoint:

```bash
curl https://quickbooks-cdc-unified-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "quickbooks-cdc-sync",
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

---

## Method 2: Deploy via Railway CLI

### Step 1: Install Railway CLI (if not installed)

```bash
# macOS
brew install railway

# Or via npm
npm install -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

This will open a browser window for authentication.

### Step 3: Navigate to Service Directory

```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca/railway/quickbooks-cdc
```

### Step 4: Initialize Railway Project

```bash
railway init
```

When prompted:
- **Select project**: Choose existing project (4b6312d5-289c-48a8-b9ca-575221127399)
- **Create new service**: Yes
- **Service name**: `quickbooks-cdc-unified`

### Step 5: Set Environment Variables

```bash
railway variables set SUPABASE_URL="https://lwtjrizdzrdzkzcwtgfj.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dGpyaXpkenJkemt6Y3d0Z2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MzYyNSwiZXhwIjoyMDcxMDY5NjI1fQ.J7Jio2Xqk0TdTzeCHMemzXPD9QxE_419CSGrCE2HImw"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://lwtjrizdzrdzkzcwtgfj.supabase.co"
railway variables set QUICKBOOKS_CLIENT_ID="AB2l47MnudsFyqjjV87lfWuoladLMw0Bimty5lULIohYq7lu4O"
railway variables set QUICKBOOKS_CLIENT_SECRET="C8Aii4DwuEHl7SwG9QgbEFPcHi8gsXaD8Ey0VfT3"
railway variables set QUICKBOOKS_ENVIRONMENT="production"
railway variables set ALLOWED_ORIGINS="https://admin.trilogis.ca,http://localhost:3000"
railway variables set PORT="3001"
```

### Step 6: Deploy

```bash
railway up
```

This will:
1. Build your application
2. Upload to Railway
3. Deploy to production
4. Show build logs

### Step 7: Generate Domain

```bash
railway domain
```

Save the generated URL.

### Step 8: Check Status

```bash
railway status
```

View logs:
```bash
railway logs
```

---

## Method 3: Deploy via Git Push (With Railway GitHub Integration)

### Step 1: Commit Code to Git

```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca
git add railway/quickbooks-cdc/
git commit -m "feat: Add unified QuickBooks CDC sync service"
git push origin master
```

### Step 2: Create Service in Railway Dashboard

1. Go to Railway project dashboard
2. Click **"New"** → **"GitHub Repo"**
3. Select your repository
4. Railway will automatically detect the push

### Step 3: Configure Service

Follow the same configuration steps as **Method 1, Step 2** above.

---

## Post-Deployment Configuration

### Update Frontend Environment Variables

After getting your Railway URL, update the frontend:

#### Option 1: Update .env.local (Local Development)

```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca
```

Edit `.env.local`:
```bash
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL=https://quickbooks-cdc-unified-production.up.railway.app
```

#### Option 2: Update Vercel Production Environment

```bash
vercel env rm NEXT_PUBLIC_QUICKBOOKS_SYNC_URL production --yes
echo -n "https://quickbooks-cdc-unified-production.up.railway.app" | vercel env add NEXT_PUBLIC_QUICKBOOKS_SYNC_URL production
```

Redeploy:
```bash
vercel --prod
```

---

## Testing the Deployment

### Test 1: Health Check

```bash
curl https://your-railway-url.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "quickbooks-cdc-sync",
  "timestamp": "2025-10-24T..."
}
```

### Test 2: Start a Sync Job

```bash
curl -X POST https://your-railway-url.railway.app/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{
    "realmId": "9130348256395025"
  }'
```

Expected response:
```json
{
  "jobId": "uuid-here",
  "status": "started",
  "realmId": "9130348256395025"
}
```

### Test 3: Check Job Status

```bash
curl https://your-railway-url.railway.app/api/sync/status/{jobId}
```

### Test 4: List Recent Jobs

```bash
curl https://your-railway-url.railway.app/api/sync/jobs?limit=5
```

### Test 5: Monitor via SSE (Server-Sent Events)

```bash
curl -N https://your-railway-url.railway.app/api/sync/stream/{jobId}
```

This will stream real-time progress updates.

---

## Monitoring and Maintenance

### View Logs

**Via Railway Dashboard:**
1. Go to your service
2. Click **Deployments** tab
3. Click on latest deployment
4. View **Logs** section

**Via Railway CLI:**
```bash
cd railway/quickbooks-cdc
railway logs
```

Follow logs in real-time:
```bash
railway logs --follow
```

### Check Service Metrics

In Railway dashboard:
1. Go to service
2. Click **Metrics** tab
3. View CPU, Memory, Network usage

### Restart Service

**Via Dashboard:**
1. Go to service
2. Click **Settings** tab
3. Click **Restart** button

**Via CLI:**
```bash
railway service restart
```

---

## Troubleshooting

### Issue: Build Fails

**Check build logs:**
```bash
railway logs
```

**Common causes:**
- Missing dependencies in package.json
- Incorrect start command
- Node version mismatch

**Fix:**
- Verify `package.json` is present
- Check `railway.json` start command
- Add `engines` field to package.json:
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```

### Issue: Service Crashes on Start

**Check logs:**
```bash
railway logs
```

**Common causes:**
- Missing environment variables
- Supabase connection error
- Port binding issues

**Fix:**
- Verify all environment variables are set
- Check SUPABASE_URL and keys are correct
- Ensure PORT is set (Railway provides this automatically)

### Issue: 403 Errors from QuickBooks

**Check:**
1. QuickBooks connection is active in frontend
2. OAuth tokens are valid
3. QUICKBOOKS_CLIENT_ID and SECRET are correct

**Fix:**
- Reconnect QuickBooks via frontend settings
- Verify environment variables match Vercel/frontend

### Issue: Wrong Service Linked

**Check current link:**
```bash
railway status
```

**Fix - Unlink and relink:**
```bash
railway unlink
railway link
```

Select the correct service when prompted.

---

## Cleanup Old Services

After verifying the new unified service works:

### Step 1: Identify Old Services to Delete

- ❌ `quickbooks-cdc-sync` (old worker with 403 errors)
- ❌ `quickbooks-daily-cron` (old cron service)
- ✅ `quickbooks-cdc-unified` (NEW - keep this one)
- ✅ `mews-import-worker` (keep)
- ✅ `mews-daily-cron` (keep)

### Step 2: Delete via Railway Dashboard

1. Go to project dashboard
2. Click on service to delete
3. Go to **Settings** tab
4. Scroll to bottom
5. Click **"Delete Service"**
6. Confirm deletion

### Step 3: Verify Frontend is Using New Service

Check `.env.local` and Vercel environment variables:
```bash
vercel env ls
```

Should show:
```
NEXT_PUBLIC_QUICKBOOKS_SYNC_URL = https://quickbooks-cdc-unified-production.up.railway.app
```

---

## Service Configuration Reference

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node server.js"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[healthcheck]
path = "/health"
timeout = 300
interval = 30
```

### package.json
```json
{
  "name": "quickbooks-cdc-sync",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "axios": "^1.6.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Best Practices

1. **Always test locally first**: Run `npm start` before deploying
2. **Use environment variables**: Never hardcode secrets
3. **Monitor logs**: Check logs after each deployment
4. **Version control**: Commit changes before deploying
5. **Incremental updates**: Deploy small changes, test, then proceed
6. **Keep backups**: Don't delete old services until new one is verified
7. **Document changes**: Update README.md with any configuration changes

---

## Quick Reference Commands

```bash
# Login
railway login

# Check status
railway status

# View logs
railway logs

# Deploy
railway up

# Generate domain
railway domain

# Set environment variable
railway variables set KEY="value"

# List variables
railway variables

# Restart service
railway service restart

# Unlink/relink
railway unlink
railway link
```

---

## Support and Resources

- **Railway Documentation**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Project Dashboard**: https://railway.com/project/4b6312d5-289c-48a8-b9ca-575221127399
- **Service README**: See `README.md` in this directory for API documentation
