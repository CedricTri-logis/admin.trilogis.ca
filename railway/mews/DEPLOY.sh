#!/bin/bash
# Mews Worker Deployment Script
# Run this in your terminal to deploy the Mews worker

set -e

echo "🚀 Deploying Mews Import Worker to Railway"
echo "==========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: Please run this script from the railway/mews directory"
    exit 1
fi

# Step 1: Create new Railway project
echo "📦 Step 1: Creating new Railway project..."
railway init

# Step 2: Deploy
echo "🚀 Step 2: Deploying to Railway..."
railway up

# Step 3: Set environment variables
echo "🔧 Step 3: Setting environment variables..."
railway variables set SUPABASE_URL=https://jcfptydvuqnxagrntepd.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dGpyaXpkenJkemt6Y3d0Z2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MzYyNSwiZXhwIjoyMDcxMDY5NjI1fQ.J7Jio2Xqk0TdTzeCHMemzXPD9QxE_419CSGrCE2HImw
railway variables set MEWS_CLIENT_TOKEN=your_mews_client_token
railway variables set MEWS_ACCESS_TOKEN=your_mews_access_token
railway variables set MEWS_API_URL=https://api.mews.com
railway variables set MEWS_SERVICE_ID=205b838c-02a3-47ae-a329-aee8010a0a25
railway variables set ALLOWED_ORIGINS=https://admin.trilogis.ca,http://localhost:3000

# Step 4: Generate domain
echo "🌐 Step 4: Generating public domain..."
railway domain

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the Railway domain URL from above"
echo "2. Go to Vercel dashboard (https://vercel.com/dashboard)"
echo "3. Add environment variable:"
echo "   NEXT_PUBLIC_MEWS_SYNC_URL=<your-railway-url>"
echo "4. Redeploy your Vercel app"
echo ""
echo "🧪 Test your deployment:"
echo "   https://admin.trilogis.ca/integration/mews/import"
