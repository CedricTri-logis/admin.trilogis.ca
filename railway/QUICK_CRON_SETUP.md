# ⚡ Quick Cron Setup (2 Minutes)

Railway MCP doesn't support creating services directly, but here's the absolute fastest way:

---

## 📱 Super Quick Setup

### 1. Open This Link:
**https://railway.app/project/4b6312d5-289c-48a8-b9ca-575221127399**

This goes directly to your Railway project.

### 2. Click "New" → "Empty Service"

### 3. Name It:
```
mews-daily-cron
```

### 4. Click the Service → Settings → Source

- **Connect**: Your GitHub repo (CedricTri-logis/admin.trilogis.ca)
- **Branch**: master
- **Root Directory**: `railway/mews`

### 5. Still in Settings → Cron

- **Cron Schedule**: `0 2 * * *`

### 6. Still in Settings → Deploy

- **Start Command**: `node cron.js`

### 7. Click "Deploy"

---

## ✅ Done!

Your Mews import will now run automatically every day at 2 AM.

View results at: **https://admin.trilogis.ca/integration/mews/import**

---

## 🔄 Alternative: One-Click Deploy

Coming soon: Railway template for instant deployment.

---

## Why Not MCP?

Railway MCP tools don't support creating new services within existing projects - they only support:
- Deploying to existing services
- Creating new projects
- Managing environment variables

Service creation requires the Dashboard UI (takes 2 minutes).

