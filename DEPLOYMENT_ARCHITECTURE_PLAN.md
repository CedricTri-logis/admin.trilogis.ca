# Deployment Architecture Plan

## Current Situation Analysis

### Your Two Projects

**1. Main Portal** (`/Users/cedriclajoie/Project/cs50/DockerFile copy`)
- **Name**: trilogis-property-management
- **Purpose**: Main tenant/landlord portal
- **GitHub**: `CedricTri-logis/dockerfile-copy`
- **Current Deployment**:
  - AWS server (ubuntu@15.222.179.123)
  - Has extensive AWS deployment scripts
  - Can switch between port 3000 and 3001

**2. Admin Portal** (`/Users/cedriclajoie/Project/cs50/admin.trilogis.ca`)
- **Name**: admin-trilogis-landlord-portal
- **Purpose**: Landlord admin-only portal
- **GitHub**: `CedricTri-logis/admin.trilogis.ca`
- **Current Deployment**:
  - Vercel: `admin-trilogis-ca.vercel.app`
  - No AWS deployment configured

### Current DNS Status

```
trilogis.ca → Cloudflare → 172.67.70.63, 104.26.0.146
admin.trilogis.ca → ❌ NOT CONFIGURED (no DNS records)
```

### The Problem

When users visit `admin.trilogis.ca`, there's no DNS record, so it may be falling back to the main domain or showing an error.

---

## 🎯 Recommended Solution: **Hybrid Deployment**

Keep it simple: Main portal on AWS, Admin portal on Vercel.

### Architecture

```
Internet
   |
   ├─ trilogis.ca ────────────────► AWS Server (nginx) ────► Port 3000 (Main Portal)
   |                                    |
   |                                    └─► Port 3001 (available for staging)
   |
   └─ admin.trilogis.ca ──────────► Vercel ─────────────────► Admin Portal
```

### Setup Steps

#### 1. Configure DNS in Cloudflare

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → `trilogis.ca` → DNS

**Add new CNAME record:**
```
Type:    CNAME
Name:    admin
Target:  cname.vercel-dns.com
Proxy:   ✅ Proxied (orange cloud)
TTL:     Auto
```

#### 2. Configure Custom Domain in Vercel

1. Go to [Vercel Project Settings](https://vercel.com/cedric-lajoies-projects/admin-trilogis-ca/settings/domains)
2. Click **Add Domain**
3. Enter: `admin.trilogis.ca`
4. Click **Add**
5. Vercel will verify the domain (should work immediately with CNAME)

#### 3. Update Supabase Redirect URLs

Go to [Supabase Dashboard](https://app.supabase.com/project/lwtjrizdzrdzkzcwtgfj/settings/auth)

**Site URL:**
```
https://admin.trilogis.ca
```

**Redirect URLs:**
```
https://admin.trilogis.ca/**
https://admin-trilogis-ca.vercel.app/**
https://trilogis.ca/**
http://localhost:3000/**
```

#### 4. Update Google OAuth Redirect URIs

Add to Google Cloud Console → OAuth Credentials:
```
https://admin.trilogis.ca/api/auth/callback
```

### Advantages ✅

- **Separation of Concerns**: Main portal and admin portal are independent
- **Easy Deployment**:
  - Main portal: `git push` to AWS
  - Admin portal: `git push` auto-deploys via Vercel
- **Scalability**: Each can scale independently
- **Simple DNS**: Just one CNAME record
- **Cost Effective**: Vercel free tier for admin portal

---

## Alternative Option 2: **Both on AWS Server**

If you want everything on your own server.

### Architecture

```
Internet
   |
Cloudflare
   |
   ├─ trilogis.ca ─────────────────► nginx (80/443)
   |                                    |
   |                                    ├─► Port 3000 → Main Portal
   |
   └─ admin.trilogis.ca ──────────► nginx (80/443)
                                         |
                                         └─► Port 3001 → Admin Portal
```

### Setup Steps

#### 1. Deploy Admin Portal to AWS

```bash
# SSH into your AWS server
ssh -i ~/.ssh/trilogis-aws-key.pem ubuntu@15.222.179.123

# Create directory for admin portal
cd /home/ubuntu
git clone https://github.com/CedricTri-logis/admin.trilogis.ca.git admin-portal
cd admin-portal

# Build and run on port 3001
npm install
npm run build
pm2 start npm --name "admin-portal" -- start -- -p 3001
pm2 save
```

#### 2. Configure Nginx

```bash
# Create nginx config for admin subdomain
sudo nano /etc/nginx/sites-available/admin-trilogis

# Add this configuration:
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.trilogis.ca;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.trilogis.ca;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/admin.trilogis.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.trilogis.ca/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/admin-trilogis /etc/nginx/sites-enabled/

# Get SSL certificate
sudo certbot --nginx -d admin.trilogis.ca

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Configure DNS in Cloudflare

```
Type:  A
Name:  admin
IPv4:  15.222.179.123
Proxy: ✅ Proxied
```

### Advantages ✅

- **Full Control**: Everything on your server
- **Single Infrastructure**: Easier to manage backups, monitoring
- **No Third-Party Dependencies**: Don't rely on Vercel

### Disadvantages ❌

- **More Complex**: Manual deployments, SSL certs, nginx config
- **Higher Maintenance**: You manage server updates, scaling
- **Single Point of Failure**: If AWS server goes down, everything is down

---

## Alternative Option 3: **Both on Vercel**

Simplest option if you don't need AWS.

### Setup Steps

#### 1. Deploy Main Portal to Vercel

```bash
cd "/Users/cedriclajoie/Project/cs50/DockerFile copy"

# Install Vercel CLI if needed
npm i -g vercel

# Link and deploy
vercel
```

#### 2. Configure Custom Domains

- Main portal: Add `trilogis.ca` in Vercel
- Admin portal: Add `admin.trilogis.ca` in Vercel

#### 3. Update DNS in Cloudflare

```
trilogis.ca      → CNAME → cname.vercel-dns.com
admin.trilogis.ca → CNAME → cname.vercel-dns.com
```

### Advantages ✅

- **Simplest Setup**: Just DNS records
- **Auto Deployments**: Git push = deploy
- **Global CDN**: Vercel's edge network
- **Zero Maintenance**: Vercel handles everything

### Disadvantages ❌

- **Cost**: May exceed free tier with traffic
- **Less Control**: Dependent on Vercel platform

---

## 📋 Recommended Action Plan

**I recommend Option 1 (Hybrid)**:

### Step-by-Step Implementation

1. **Configure DNS** (5 minutes)
   ```
   Cloudflare → trilogis.ca → DNS → Add CNAME
   Name: admin
   Target: cname.vercel-dns.com
   ```

2. **Add Custom Domain in Vercel** (2 minutes)
   ```
   Vercel → admin-trilogis-ca → Settings → Domains
   Add: admin.trilogis.ca
   ```

3. **Update Supabase** (2 minutes)
   ```
   Site URL: https://admin.trilogis.ca
   Redirect URLs: https://admin.trilogis.ca/**
   ```

4. **Update Google OAuth** (2 minutes)
   ```
   Add redirect URI: https://admin.trilogis.ca/api/auth/callback
   ```

5. **Test** (5 minutes)
   - Visit `https://trilogis.ca` → Should show main portal
   - Visit `https://admin.trilogis.ca` → Should show admin portal
   - Test Google OAuth on both

**Total Time: ~15 minutes**

---

## Questions?

- **Want to keep main portal on AWS?** → Use Option 1 (Hybrid)
- **Want everything on your server?** → Use Option 2 (Both on AWS)
- **Want simplicity above all?** → Use Option 3 (Both on Vercel)

Let me know which option you prefer and I can help with implementation!
