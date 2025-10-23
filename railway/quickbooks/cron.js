/**
 * Daily QuickBooks Sync Cron Job
 * Triggers incremental CDC sync for all active QuickBooks companies
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const QB_API_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3001';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runDailySync() {
  console.log('🕐 Starting scheduled QuickBooks sync...');
  console.log(`📍 API URL: ${QB_API_URL}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'quickbooks' },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    // Fetch all active companies
    console.log('📋 Fetching active companies...');
    const { data: companies, error } = await supabase
      .from('qb_auth_tokens')
      .select('realm_id, company_name')
      .eq('is_active', true)
      .order('company_name');

    if (error) {
      console.error('❌ Failed to fetch companies:', error);
      process.exit(1);
    }

    if (!companies || companies.length === 0) {
      console.log('⚠️  No active companies found');
      process.exit(0);
    }

    console.log(`✅ Found ${companies.length} active companies`);

    let successCount = 0;
    let errorCount = 0;

    // Trigger sync for each company
    for (const company of companies) {
      console.log(`\n🏢 Syncing: ${company.company_name}`);
      console.log(`   Realm ID: ${company.realm_id}`);

      try {
        const response = await axios.post(`${QB_API_URL}/api/sync/start`, {
          realmId: company.realm_id,
          verify: true // Run verification after sync
        });

        console.log(`   ✅ Sync started - Job ID: ${response.data.jobId}`);
        successCount++;

        // Small delay between companies to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`   ❌ Failed to start sync:`, error.message);
        if (error.response) {
          console.error('   Response:', error.response.data);
        }
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);

    // Exit successfully if at least one sync started
    if (successCount > 0) {
      console.log('\n🎉 Daily QuickBooks sync completed!');
      process.exit(0);
    } else {
      console.error('\n❌ All syncs failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runDailySync();
