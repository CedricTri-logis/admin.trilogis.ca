# Google OAuth Setup for Admin Trilogis Portal

Quick setup guide for adding Google OAuth to the Tri-Logis Landlord Admin Portal.

## Your Configuration

- **Project**: admin-trilogis-ca (Landlord Portal)
- **Supabase Project ID**: `lwtjrizdzrdzkzcwtgfj`
- **Vercel URL**: `https://admin-trilogis-ca.vercel.app`
- **Custom Domain**: `https://admin.trilogis.ca` (if configured)
- **Local Dev**: `http://localhost:3000`

## What's Already Done ✅

The Google OAuth button has been added to your login page:
- `src/app/login/page.tsx` - Login page updated with Google button
- `src/components/auth/GoogleOAuthButton.tsx` - Google OAuth button component
- `src/app/api/auth/callback/route.ts` - OAuth callback handler

## Google Cloud Console Setup

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **OAuth consent screen**
   - Set User type: **External**
   - Add authorized domains: `trilogis.ca`, `vercel.app`, `supabase.co`
3. Navigate to: **APIs & Services** → **Credentials**
4. Click **+ Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Add **Authorized JavaScript origins**:
   ```
   https://admin-trilogis-ca.vercel.app
   https://admin.trilogis.ca
   http://localhost:3000
   ```

7. Add **Authorized redirect URIs**:
   ```
   https://lwtjrizdzrdzkzcwtgfj.supabase.co/auth/v1/callback
   https://admin-trilogis-ca.vercel.app/api/auth/callback
   https://admin.trilogis.ca/api/auth/callback
   http://localhost:3000/api/auth/callback
   ```

8. Click **Create**
9. **Copy** your Client ID and Client Secret

## Supabase Dashboard Configuration

1. Go to [Supabase Dashboard](https://app.supabase.com/project/lwtjrizdzrdzkzcwtgfj)
2. Navigate to: **Authentication** → **Providers** → **Google**
3. Toggle **Enable Sign in with Google**
4. Paste:
   - **Client ID** (from Google Console)
   - **Client Secret** (from Google Console)
5. Verify the **Redirect URL** matches:
   ```
   https://lwtjrizdzrdzkzcwtgfj.supabase.co/auth/v1/callback
   ```
6. Under **Site URL**, set: `https://admin-trilogis-ca.vercel.app`
7. Under **Redirect URLs**, add:
   ```
   https://admin-trilogis-ca.vercel.app/**
   https://admin.trilogis.ca/**
   http://localhost:3000/**
   ```
8. Click **Save**

## Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/cedric-lajoies-projects/admin-trilogis-ca)
2. Navigate to: **Settings** → **Environment Variables**
3. Add these variables (if not already present):
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-from-google
   GOOGLE_CLIENT_ID=your-client-id-from-google
   GOOGLE_CLIENT_SECRET=your-client-secret-from-google
   ```
4. Set for: **Production**, **Preview**, and **Development**
5. Click **Save**
6. **Redeploy** your application

## Local Development

Update your `.env.local` file:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Testing

### Local
```bash
cd /Users/cedriclajoie/Project/cs50/admin.trilogis.ca
npm run dev
# Visit: http://localhost:3000/login
# Click "Continue with Google"
```

### Production
```
Visit: https://admin-trilogis-ca.vercel.app/login
Click "Continue with Google"
```

## OAuth Flow

1. User clicks "Continue with Google" button
2. Redirected to Google login
3. User authorizes the app
4. Google redirects to Supabase callback: `https://lwtjrizdzrdzkzcwtgfj.supabase.co/auth/v1/callback`
5. Supabase exchanges code for session
6. Supabase redirects to app callback: `/api/auth/callback`
7. App callback handler verifies session
8. User redirected to dashboard: `/dashboard`

## Troubleshooting

### Button Not Showing
- Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
- Check browser console for errors
- Verify the component is imported in `/src/app/login/page.tsx`

### "redirect_uri_mismatch" Error
- Verify all redirect URIs in Google Console match exactly
- No trailing slashes
- Check Supabase project ID is correct

### Session Not Persisting
- Check Supabase Site URL is set correctly
- Verify all redirect URLs are added in Supabase
- Check browser console for CORS errors

### Changes Not Showing on Vercel
- **Redeploy** after adding environment variables
- Check environment variables are set for the correct environment

## Files Modified

- ✅ `src/app/login/page.tsx` - Added Google OAuth button
- ✅ `src/components/auth/GoogleOAuthButton.tsx` - New component
- ✅ `src/app/api/auth/callback/route.ts` - OAuth callback handler

## Next Steps

1. [ ] Complete Google Cloud Console setup
2. [ ] Configure Supabase Google provider
3. [ ] Add environment variables to Vercel
4. [ ] Test locally
5. [ ] Deploy and test on production

---

**Need help?** Check the full guide in the other project or contact your team.
