/**
 * QuickBooks Authentication Module
 * Handles token retrieval, refresh, and API request retries
 */

const axios = require('axios');

/**
 * Get active QuickBooks authentication token for a realm
 */
async function getAuthToken(realmId, supabase) {
  const { data, error } = await supabase
    .from('qb_auth_tokens')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`No active QuickBooks connection found for realm ${realmId}`);
  }

  return data;
}

/**
 * Refresh an expired QuickBooks access token
 */
async function refreshToken(token, supabase) {
  try {
    const response = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const newTokenData = response.data;

    // Update token in database
    await supabase
      .from('qb_auth_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        access_token_expires_at: new Date(
          Date.now() + newTokenData.expires_in * 1000
        ).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', token.id);

    console.log('✅ Token refreshed successfully');

    return {
      ...token,
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token
    };
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

/**
 * Make a QuickBooks API request with automatic token refresh on 401
 */
async function makeQBRequest(method, url, token, supabase, data = null, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        data,
        timeout: 120000 // 2 minute timeout for CDC requests
      });

      return response.data;
    } catch (error) {
      // If 401 Unauthorized, refresh token and retry
      if (error.response?.status === 401 && attempt < retries - 1) {
        console.log(`⚠️  401 error, refreshing token (attempt ${attempt + 1}/${retries})`);

        const refreshedToken = await refreshToken(token, supabase);
        if (!refreshedToken) {
          throw new Error('Failed to refresh token after 401 error');
        }

        // Update token reference for next retry
        token.access_token = refreshedToken.access_token;
        token.refresh_token = refreshedToken.refresh_token;
        continue;
      }

      // For other errors or final retry, throw
      if (attempt === retries - 1) {
        const errorMsg = error.response?.data?.Fault?.Error?.[0]?.Message || error.message;
        throw new Error(`QuickBooks API request failed: ${errorMsg}`);
      }

      // Exponential backoff for retries
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`⚠️  Request failed, retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Get the base URL for QuickBooks API based on environment
 */
function getQuickBooksBaseUrl() {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

module.exports = {
  getAuthToken,
  refreshToken,
  makeQBRequest,
  getQuickBooksBaseUrl
};
