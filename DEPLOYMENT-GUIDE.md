# Deployment Guide: admin.trilogis.ca

Complete step-by-step guide to deploy the Tri-Logis Landlord Portal to admin.trilogis.ca

## Prerequisites Checklist

- [ ] Server access to admin.trilogis.ca (SSH key configured)
- [ ] Domain DNS pointing to server IP
- [ ] Supabase credentials (same as tenant portal)
- [ ] Node.js 18+ installed on server
- [ ] PM2 installed globally on server
- [ ] Nginx installed on server
- [ ] Certbot installed for SSL

---

## Phase 1: Local Setup & Repository

### 1.1 Create Remote Repository

```bash
# On GitHub/GitLab/Bitbucket, create new repository named "admin-trilogis-landlord-portal"
# Then add remote:
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

### 1.2 Verify Local Build

```bash
# Install dependencies
npm install

# Create .env.local from example
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# (Use same credentials as tenant portal)

# Test build
npm run build

# Test locally
npm run dev
# Visit http://localhost:3000
```

---

## Phase 2: Server Setup

### 2.1 SSH into Server

```bash
ssh user@admin.trilogis.ca
```

### 2.2 Install Prerequisites (if not already installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should be v20.x
npm -v   # Should be v9+

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## Phase 3: Deploy Application

### 3.1 Create Deployment Directory

```bash
# Create directory
sudo mkdir -p /var/www/admin.trilogis.ca
sudo chown -R $USER:$USER /var/www/admin.trilogis.ca

# Clone repository
cd /var/www/admin.trilogis.ca
git clone <your-repo-url> .
```

### 3.2 Configure Environment

```bash
# Create production environment file
nano .env.production
```

Add your environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://admin.trilogis.ca
NODE_ENV=production
```

Save and secure the file:

```bash
chmod 600 .env.production
```

### 3.3 Build and Start Application

```bash
# Install dependencies
npm install --production

# Build application
npm run build

# Start with PM2
pm2 start npm --name "admin-trilogis" -- start

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs (usually involves sudo)
```

### 3.4 Verify Application Running

```bash
pm2 status
pm2 logs admin-trilogis

# Test locally
curl http://localhost:3000
```

---

## Phase 4: Nginx Configuration

### 4.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/admin.trilogis.ca
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name admin.trilogis.ca;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting for login endpoint
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    location /login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Client max body size
    client_max_body_size 10M;
}
```

### 4.2 Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/admin.trilogis.ca /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Phase 5: SSL/TLS Setup

### 5.1 Obtain SSL Certificate

```bash
sudo certbot --nginx -d admin.trilogis.ca
```

Follow prompts:
- Enter email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 5.2 Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

### 5.3 Verify SSL

```bash
# Test SSL configuration
curl -I https://admin.trilogis.ca

# Or visit in browser and check for padlock icon
```

---

## Phase 6: Firewall Configuration

### 6.1 Setup UFW Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Phase 7: Automated Backups

### 7.1 Create Backup Script

```bash
sudo nano /usr/local/bin/backup-admin-trilogis.sh
```

Paste this script:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/admin-trilogis"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/admin.trilogis.ca"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup application files
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \
    -C /var/www admin.trilogis.ca \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=.git

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/backup-admin-trilogis.sh
```

### 7.2 Schedule Daily Backups

```bash
sudo crontab -e
```

Add this line:

```cron
0 2 * * * /usr/local/bin/backup-admin-trilogis.sh >> /var/log/admin-trilogis-backup.log 2>&1
```

### 7.3 Test Backup

```bash
sudo /usr/local/bin/backup-admin-trilogis.sh
ls -lh /var/backups/admin-trilogis/
```

---

## Phase 8: Monitoring & Maintenance

### 8.1 PM2 Monitoring

```bash
# View logs
pm2 logs admin-trilogis

# Monitor resources
pm2 monit

# View process info
pm2 info admin-trilogis
```

### 8.2 Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### 8.3 Application Logs

```bash
# PM2 logs location
~/.pm2/logs/admin-trilogis-out.log
~/.pm2/logs/admin-trilogis-error.log
```

---

## Phase 9: Deployment Updates

### 9.1 Manual Deployment

```bash
# SSH into server
ssh user@admin.trilogis.ca

# Navigate to app directory
cd /var/www/admin.trilogis.ca

# Pull latest changes
git pull origin main

# Install dependencies (if package.json changed)
npm install --production

# Rebuild application
npm run build

# Reload PM2
pm2 reload admin-trilogis

# Check status
pm2 status
pm2 logs admin-trilogis --lines 50
```

### 9.2 Automated Deployment Script

Create `scripts/deploy.sh` in your repository:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying admin.trilogis.ca..."

# Navigate to app directory
cd /var/www/admin.trilogis.ca

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build application
echo "🔨 Building application..."
npm run build

# Reload PM2
echo "♻️  Reloading PM2..."
pm2 reload admin-trilogis

echo "✅ Deployment complete!"
pm2 status
```

Then deploy with:

```bash
ssh user@admin.trilogis.ca 'bash -s' < scripts/deploy.sh
```

---

## Phase 10: CI/CD with GitHub Actions (Optional)

### 10.1 Create GitHub Action

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: admin.trilogis.ca
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/admin.trilogis.ca
            git pull origin main
            npm install --production
            npm run build
            pm2 reload admin-trilogis
            pm2 status
```

### 10.2 Add GitHub Secrets

Go to repository Settings → Secrets → Actions:
- `SSH_USER`: Your SSH username
- `SSH_PRIVATE_KEY`: Your private SSH key

---

## Verification Checklist

### Application

- [ ] Application runs on PM2: `pm2 status`
- [ ] Application accessible locally: `curl http://localhost:3000`
- [ ] No errors in logs: `pm2 logs admin-trilogis`

### Nginx

- [ ] Nginx config valid: `sudo nginx -t`
- [ ] Site enabled in sites-enabled
- [ ] HTTP accessible: `curl http://admin.trilogis.ca`

### SSL

- [ ] HTTPS working: `curl https://admin.trilogis.ca`
- [ ] SSL certificate valid (no browser warnings)
- [ ] Auto-renewal configured: `sudo certbot renew --dry-run`

### Security

- [ ] Firewall enabled: `sudo ufw status`
- [ ] SSH port protected
- [ ] Rate limiting on login endpoint
- [ ] Security headers present: `curl -I https://admin.trilogis.ca`

### Authentication

- [ ] Login page loads
- [ ] Can authenticate with valid credentials
- [ ] Landlord access check works
- [ ] Non-landlord users denied access
- [ ] Session persists across pages

### Monitoring

- [ ] PM2 monitoring active
- [ ] Logs rotating properly
- [ ] Backups running daily
- [ ] Backup restoration tested

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs admin-trilogis --lines 100

# Check environment variables
pm2 env admin-trilogis

# Restart PM2
pm2 restart admin-trilogis
```

### Nginx 502 Bad Gateway

```bash
# Check if application is running
pm2 status

# Check application port
lsof -i :3000

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Issues

```bash
# Renew certificate manually
sudo certbot renew --force-renewal

# Check certificate expiry
sudo certbot certificates
```

### Database Connection Issues

```bash
# Verify environment variables
cat /var/www/admin.trilogis.ca/.env.production

# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/
```

---

## Performance Optimization

### 1. Enable Gzip Compression (Nginx)

Add to nginx config:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. PM2 Cluster Mode

```bash
pm2 delete admin-trilogis
pm2 start npm --name "admin-trilogis" -i max -- start
pm2 save
```

### 3. Nginx Caching

Add to nginx config:

```nginx
# Cache static assets
location /_next/static/ {
    proxy_pass http://localhost:3000;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, immutable";
}
```

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **PM2 Docs**: https://pm2.keymetrics.io/docs
- **Nginx Docs**: https://nginx.org/en/docs

---

## Summary

You now have:
- ✅ Landlord portal deployed to admin.trilogis.ca
- ✅ SSL/HTTPS configured
- ✅ Automated backups
- ✅ PM2 process management
- ✅ Nginx reverse proxy
- ✅ Security hardening
- ✅ Monitoring and logging
- ✅ Deployment workflow

**Production URL**: https://admin.trilogis.ca
