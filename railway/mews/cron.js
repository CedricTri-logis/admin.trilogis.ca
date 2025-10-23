/**
 * Daily Mews Import Cron Job
 * Triggers the Mews import API to run automatically
 */

const axios = require('axios');

const MEWS_API_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:8080';

async function runDailyImport() {
  console.log('🕐 Starting scheduled Mews import...');
  console.log(`📍 API URL: ${MEWS_API_URL}`);

  // Calculate date range (yesterday to today)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();

  const from = yesterday.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  console.log(`📅 Date range: ${from} to ${to}`);

  try {
    const response = await axios.post(`${MEWS_API_URL}/api/sync/start`, {
      from,
      to,
      truncate: false,
      batchDays: 7,
      reservationBatchDays: 31,
      reservationLeadDays: 120
    });

    console.log('✅ Import job started successfully:', response.data);
    console.log(`📊 Job ID: ${response.data.jobId}`);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to start import:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }

    // Exit with error code
    process.exit(1);
  }
}

runDailyImport();
