# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials (same as tenant portal):

```env
NEXT_PUBLIC_SUPABASE_URL=https://lwtjrizdzrdzkzcwtgfj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Testing Authentication

### Prerequisites

You need a user with landlord access in the database:

1. **User must exist in `auth.users`** (via Supabase Auth)
2. **User must have landlord access** in `portal_auth.landlord_access`:

```sql
-- Grant landlord access
INSERT INTO portal_auth.landlord_access (user_id, granted_at)
VALUES ('user-uuid-here', NOW());

-- Add categories (optional, use '*' for all)
INSERT INTO portal_auth.landlord_categories (user_id, category)
VALUES ('user-uuid-here', '*');
```

### Test Login

1. Go to http://localhost:3000
2. You'll be redirected to `/login`
3. Enter email/password
4. If landlord access exists → Dashboard
5. If no landlord access → "Access Denied"

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/app/login/page.tsx` | Login page (email/password) |
| `src/app/dashboard/layout.tsx` | Auth guard + landlord access check |
| `src/app/dashboard/page.tsx` | Main dashboard |
| `src/lib/services/portal-service.ts` | Checks landlord_access table |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client |

---

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)

# Production
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
```

---

## 🛠️ Database Schema Required

This app requires the following tables in Supabase:

### portal_auth.landlord_access

```sql
CREATE TABLE portal_auth.landlord_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

### portal_auth.landlord_categories

```sql
CREATE TABLE portal_auth.landlord_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  category TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

### portal_auth.profiles

```sql
CREATE TABLE portal_auth.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 🚨 Troubleshooting

### "Access Denied" after login

Check database:

```sql
SELECT * FROM portal_auth.landlord_access
WHERE user_id = 'your-user-uuid';
```

If empty, grant access:

```sql
INSERT INTO portal_auth.landlord_access (user_id)
VALUES ('your-user-uuid');
```

### Environment variables not loading

- Ensure `.env.local` exists
- Restart dev server after changing env vars
- Check variable names match exactly (including NEXT_PUBLIC_ prefix)

### Build errors

```bash
rm -rf .next node_modules
npm install
npm run build
```

---

## 📝 Next Steps

1. **Customize Dashboard**: Edit `src/app/dashboard/page.tsx`
2. **Add Pages**: Create new routes in `src/app/dashboard/`
3. **Add API Routes**: Create in `src/app/api/`
4. **Deploy**: Follow `DEPLOYMENT-GUIDE.md`

---

## 📚 Documentation

- **Full Deployment**: See `DEPLOYMENT-GUIDE.md`
- **Project Overview**: See `README.md`
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Next.js**: https://nextjs.org/docs
