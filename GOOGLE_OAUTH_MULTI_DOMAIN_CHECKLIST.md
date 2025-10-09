# Google OAuth Multi-Domain Setup Checklist

Complete checklist for enabling Google OAuth across both `trilogis.ca` and `admin.trilogis.ca`.

## Prerequisites

- [X] Google Cloud Console access
- [X] Supabase Dashboard access (Project: `lwtjrizdzrdzkzcwtgfj`)
- [ ] Cloudflare DNS access (for domain setup)
- [ ] Vercel Dashboard access

---

## Step 1: Configure DNS (If Not Done)

### Cloudflare Dashboard

URL: https://dash.cloudflare.com/

- [ ] Go to domain `trilogis.ca`
- [ ] Navigate to **DNS** → **Records**
- [ ] Click **Add record**
- [ ] Configure CNAME:
  ```
  Type:    CNAME
  Name:    admin
  Target:  cname.vercel-dns.com
  Proxy:   ✅ Proxied (orange cloud)
  TTL:     Auto
  ```
- [X] Click **Save**
- [X] Wait 2-5 minutes for DNS propagation

---

## Step 2: Add Custom Domain in Vercel

### Vercel Dashboard

URL: https://vercel.com/cedric-lajoies-projects/admin-trilogis-ca/settings/domains

- [X] Click **Add Domain**
- [X] Enter: `admin.trilogis.ca`
- [X] Click **Add**
- [X] Wait for Vercel to verify (should be instant if DNS is configured)
- [X] Verify domain shows ✅ **Valid Configuration**

---

## Step 3: Update Google Cloud Console

### Google Cloud Console - OAuth Client

URL: https://console.cloud.google.com/apis/credentials

- [ ] Navigate to **APIs & Services** → **Credentials**
- [ ] Find your OAuth 2.0 Client ID
- [ ] Click **✏️ Edit**

### Update Authorized JavaScript Origins``

- [ ] Click **+ ADD URI** under "Authorized JavaScript origins"
- [ ] Add all these origins (one at a time):

```
`✅ https://trilogis.ca
✅ https://admin.trilogis.ca
✅ https://admin-trilogis-ca.vercel.app
✅ http://localhost:3000
```

### Update Authorized Redirect URIs

- [ ] Click **+ ADD URI** under "Authorized redirect URIs"
- [ ] Add all these URIs (one at a time):

```
✅ https://lwtjrizdzrdzkzcwtgfj.supabase.co/auth/v1/callback

Main Portal Callbacks:
✅ https://trilogis.ca/portal/auth/callback

Admin Portal Callbacks:
✅ https://admin.trilogis.ca/api/auth/callback
✅ https://admin-trilogis-ca.vercel.app/api/auth/callback

Local Development:
✅ http://localhost:3000/portal/auth/callback
✅ http://localhost:3000/api/auth/callback
```

- [ ] Click **Save**
- [ ] Verify no errors appear

---

## Step 4: Update Supabase Configuration

### Supabase Dashboard - URL Configuration

URL: https://app.supabase.com/project/lwtjrizdzrdzkzcwtgfj/auth/url-configuration

- [ ] Navigate to **Authentication** → **URL Configuration**

### Set Site URL

- [ ] Update **Site URL** to:

  ```
  https://trilogis.ca
  ```

  **Note**: This is your primary domain. Users will be redirected here by default.

### Add Redirect URLs

- [ ] Scroll to **Redirect URLs**
- [ ] Add all these URLs (one per line):

```
https://trilogis.ca/**
https://admin.trilogis.ca/**
https://admin-trilogis-ca.vercel.app/**
http://localhost:3000/**
```

- [ ] Click **Save**

### Verify Google Provider Credentials

- [ ] Navigate to **Authentication** → **Providers**
- [ ] Find **Google** provider
- [ ] Verify it shows ✅ **Enabled**
- [ ] Verify **Client ID** is filled
- [ ] Verify **Client Secret** is filled (shows as dots)
- [ ] Verify **Redirect URL** shows:
  ```
  https://lwtjrizdzrdzkzcwtgfj.supabase.co/auth/v1/callback
  ```

---

## Step 5: Update Vercel Environment Variables

### Vercel Dashboard - Environment Variables

URL: https://vercel.com/cedric-lajoies-projects/admin-trilogis-ca/settings/environment-variables

- [ ] Click **Environment Variables** in sidebar
- [ ] Verify these variables exist (add if missing):

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

- [ ] Ensure they're set for:

  - ✅ Production
  - ✅ Preview
  - ✅ Development
- [ ] If you added/updated variables, click **Redeploy** in the Deployments tab

---

## Step 6: Testing

### Test 1: Main Portal (trilogis.ca)

- [ ] Open browser in **Incognito/Private mode**
- [ ] Navigate to: `https://trilogis.ca/portal`
- [ ] Click **"Continue with Google"** button
- [ ] Complete Google sign-in
- [ ] Verify redirect back to `https://trilogis.ca`
- [ ] Verify successful login

### Test 2: Admin Portal (admin.trilogis.ca)

- [ ] **Without closing the browser**, open new tab
- [ ] Navigate to: `https://admin.trilogis.ca/login`
- [ ] Click **"Continue with Google"** button
- [ ] Verify you're already logged in (should redirect immediately)
- [ ] OR if not logged in, complete sign-in
- [ ] Verify redirect back to `https://admin.trilogis.ca/dashboard`
- [ ] Verify successful login

### Test 3: Cross-Domain Session (SSO)

- [ ] After logging in on one domain
- [ ] Visit the other domain
- [ ] Verify you're automatically logged in (no need to sign in again)

### Test 4: Admin Portal - Vercel URL

- [ ] Navigate to: `https://admin-trilogis-ca.vercel.app/login`
- [ ] Click **"Continue with Google"**
- [ ] Verify OAuth flow works
- [ ] Verify redirect back to Vercel URL

### Test 5: Local Development

- [ ] Run local dev server:
  ```bash
  cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca
  npm run dev
  ```
- [ ] Navigate to: `http://localhost:3000/login`
- [ ] Click **"Continue with Google"**
- [ ] Verify OAuth flow works locally
- [ ] Verify redirect back to localhost

---

## Troubleshooting Checklist

### Error: "redirect_uri_mismatch"

- [ ] Check Google Console redirect URIs match exactly (no typos)
- [ ] Ensure no trailing slashes in URIs
- [ ] Wait 5 minutes for Google changes to propagate
- [ ] Clear browser cache and try again

### Error: "Access blocked: This app's request is invalid"

- [ ] Go to Google Cloud Console → OAuth consent screen
- [ ] Verify authorized domains include:
  - `trilogis.ca`
  - `vercel.app`
  - `supabase.co`
- [ ] Add your email as a test user (if app is in Testing mode)

### Error: Users redirected to wrong domain

- [ ] Check Supabase **Site URL** is set correctly
- [ ] Verify Supabase **Redirect URLs** include all domains
- [ ] Check OAuth callback code in your app

### Button not showing on one of the sites

- [ ] Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
- [ ] Check browser console for JavaScript errors
- [ ] Verify latest code is deployed on Vercel
- [ ] Check component is imported correctly

### Session not persisting across domains

This is **expected behavior**. Sessions are domain-specific for security.

However, if using the same Supabase project:

- [ ] Users must sign in on each domain separately
- [ ] But they use the same credentials (same user account)
- [ ] Consider implementing custom SSO if needed

---

## Verification Commands

### Check DNS Resolution

```bash
# Check admin subdomain
dig admin.trilogis.ca +short

# Should show Cloudflare IPs or CNAME to Vercel
```

### Check SSL Certificate

```bash
# Verify HTTPS works
curl -I https://admin.trilogis.ca

# Should return 200 OK with valid SSL
```

### Test OAuth Redirect

```bash
# Check if redirect URL is accessible
curl -I https://admin.trilogis.ca/api/auth/callback

# Should return 307 or 200 (not 404)
```

---

## Completion Checklist

After completing all steps:

- [ ] ✅ DNS configured for `admin.trilogis.ca`
- [ ] ✅ Custom domain added in Vercel
- [ ] ✅ Google OAuth redirect URIs updated
- [ ] ✅ Supabase redirect URLs updated
- [ ] ✅ Environment variables set in Vercel
- [ ] ✅ Tested on `trilogis.ca`
- [ ] ✅ Tested on `admin.trilogis.ca`
- [ ] ✅ Tested on `admin-trilogis-ca.vercel.app`
- [ ] ✅ Tested locally
- [ ] ✅ Verified cross-domain authentication works

---

## Quick Reference

### Your Domains

| Domain                           | Purpose               | Hosting    | OAuth Callback            |
| -------------------------------- | --------------------- | ---------- | ------------------------- |
| `trilogis.ca`                  | Main Portal           | AWS Server | `/portal/auth/callback` |
| `admin.trilogis.ca`            | Admin Portal          | Vercel     | `/api/auth/callback`    |
| `admin-trilogis-ca.vercel.app` | Admin Portal (Vercel) | Vercel     | `/api/auth/callback`    |

### Key URLs

- **Google Console**: https://console.cloud.google.com/apis/credentials
- **Supabase Dashboard**: https://app.supabase.com/project/lwtjrizdzrdzkzcwtgfj
- **Vercel Dashboard**: https://vercel.com/cedric-lajoies-projects/admin-trilogis-ca
- **Cloudflare DNS**: https://dash.cloudflare.com/

### Support

If you encounter issues:

1. Check each step in this checklist
2. Review troubleshooting section
3. Check browser console for errors
4. Verify all URLs are saved correctly

---

## Estimated Time

- **DNS Setup**: 5 minutes
- **Google Console**: 5 minutes
- **Supabase Configuration**: 3 minutes
- **Vercel Setup**: 3 minutes
- **Testing**: 10 minutes

**Total**: ~25 minutes

---

**Good luck! 🚀**
