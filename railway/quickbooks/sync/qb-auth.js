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
    console.log(`🔄 Attempting to refresh token for realm ${token.realm_id}...`);

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
    const { error: dbError } = await supabase
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

    if (dbError) {
      console.error('❌ Failed to update token in database:', dbError);
      throw new Error(`Database update failed: ${dbError.message}`);
    }

    console.log('✅ Token refreshed successfully for realm', token.realm_id);

    return {
      ...token,
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token
    };
  } catch (error) {
    // Log detailed error information
    console.error('❌ Token refresh failed:', {
      realm_id: token.realm_id,
      error_message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      error_data: error.response?.data
    });

    // Check if the refresh token itself is expired or invalid
    if (error.response?.status === 400) {
      const errorDesc = error.response?.data?.error_description || error.response?.data?.error;
      throw new Error(`Refresh token is invalid or expired: ${errorDesc}. Please reconnect QuickBooks.`);
    }

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
      // Log detailed error information for diagnosis
      console.error(`❌ Request error (attempt ${attempt + 1}/${retries}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        qbError: error.response?.data?.Fault?.Error?.[0],
        message: error.message,
        url: error.config?.url
      });

      // If 401 Unauthorized or 403 Forbidden, refresh token and retry
      if ((error.response?.status === 401 || error.response?.status === 403) && attempt < retries - 1) {
        console.log(`⚠️  ${error.response?.status} error, attempting token refresh (attempt ${attempt + 1}/${retries})`);

        try {
          const refreshedToken = await refreshToken(token, supabase);
          if (!refreshedToken) {
            throw new Error(`Failed to refresh token after ${error.response?.status} error`);
          }

          // Update token reference for next retry
          token.access_token = refreshedToken.access_token;
          token.refresh_token = refreshedToken.refresh_token;

          console.log(`✅ Token refreshed, retrying request...`);

          // Wait a bit before retrying to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } catch (refreshError) {
          console.error(`❌ Token refresh failed:`, refreshError);
          throw new Error(`Token refresh failed: ${refreshError.message}. You may need to reconnect QuickBooks.`);
        }
      }

      // For other errors or final retry, throw
      if (attempt === retries - 1) {
        const qbError = error.response?.data?.Fault?.Error?.[0];
        const errorMsg = qbError?.Message || error.response?.statusText || error.message;
        const errorDetail = qbError?.Detail ? ` (${qbError.Detail})` : '';
        throw new Error(`QuickBooks API request failed: ${errorMsg}${errorDetail}`);
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
