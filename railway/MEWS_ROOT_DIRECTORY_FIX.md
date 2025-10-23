# ⚠️ Mews Service Root Directory Fix Required

## Problem

The Mews service is currently running from the repository root instead of the `railway/mews` directory, causing it to load the wrong server.js file.

**Error Symptom:** HTTP 400 errors and logs showing "QuickBooks CDC Sync & Mews Import Worker" instead of just "Mews Import Worker"

---

## Solution: Update Root Directory in Railway Dashboard

1. Go to **Railway Dashboard**: https://railway.app/dashboard

2. Select your project: **quickbooks-cdc-sync**

3. Click on the **mews-import-worker** service

4. Go to **Settings** tab

5. Scroll to **Root Directory** section

6. Set the root directory to:
   ```
   railway/mews
   ```

7. Click **Save**

8. The service will automatically redeploy with the correct configuration

---

## Verification

After redeployment, check the logs:
- ✅ **Correct:** "🚀 Mews Import Worker running on port 8080"
- ❌ **Wrong:** "🚀 QuickBooks CDC Sync & Mews Import Worker running on port 8080"

Visit: https://mews-import-worker-production.up.railway.app/health

Should return:
```json
{
  "status": "healthy",
  "service": "mews-import",
  "timestamp": "..."
}
```

---

## Why This Happened

Railway deployed the code but used the repository root as the working directory instead of the `railway/mews` subdirectory. This caused it to execute the root `server.js` file (which is the combined QuickBooks + Mews server) instead of the dedicated Mews server at `railway/mews/server.js`.

---

## Alternative: QuickBooks Service Check

While you're in the Railway dashboard, verify the QuickBooks service also has the correct root directory:

**Service:** quickbooks-cdc-sync
**Root Directory Should Be:** `railway/quickbooks`

---

## Test After Fix

Once the root directory is updated and the service redeploys:

1. Visit: https://admin.trilogis.ca/integration/mews/import
2. Select date range
3. Click "Démarrer l'importation"
4. Should see progress messages, not HTTP 400 errors

