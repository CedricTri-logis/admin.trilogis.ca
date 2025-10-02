# Tri-Logis Landlord Portal

Admin portal for Tri-Logis property management - landlord access only.

## Features

- **Landlord Authentication**: Secure login using Supabase Auth with `portal_auth.landlord_access` verification
- **Role-Based Access**: Checks `landlord_access` and `landlord_categories` tables for permissions
- **Same Tech Stack**: Uses the same Supabase instance and authentication as the tenant portal

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- npm 9+
- Access to Supabase project (same as tenant portal)

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd admin.trilogis.ca
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Update `.env.local` with your Supabase credentials (same as tenant portal):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Production Build

```bash
npm run build
npm start
```

## Authentication Flow

1. User logs in with email/password via Supabase Auth
2. `portal-service.ts` checks `portal_auth.landlord_access` table
3. User must have active (non-revoked) landlord access
4. Categories are loaded from `portal_auth.landlord_categories`
5. If no landlord access → "Access Denied" page

## Database Tables Used

- `portal_auth.landlord_access` - Grants landlord access
- `portal_auth.landlord_categories` - Defines what categories user can access
- `portal_auth.profiles` - User profile information

## Project Structure

```
admin.trilogis.ca/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── landlord/
│   │   │       └── profile/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx       # Auth guard + layout
│   │   │   └── page.tsx          # Dashboard home
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css
│   │   └── page.tsx              # Redirect to dashboard
│   ├── components/
│   │   └── providers/
│   │       └── SessionProvider.tsx
│   ├── lib/
│   │   ├── services/
│   │   │   └── portal-service.ts  # Landlord access checks
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── server.ts
│   │       └── service-role-client.ts
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Deployment

### Option 1: Manual Server Deployment

See the comprehensive deployment guide in the parent directory for:
- Setting up the server (admin.trilogis.ca)
- Nginx configuration
- SSL/TLS setup
- PM2 process management
- Automated backups
- CI/CD pipeline

### Option 2: Vercel/Netlify

```bash
# Build command
npm run build

# Output directory
.next

# Environment variables (add in dashboard)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Security

- All routes except `/login` require authentication
- Landlord access verified on every page load
- Service role key stored securely (never exposed to client)
- RLS policies enforced at database level

## Development Notes

- This portal shares the same Supabase instance as the tenant portal
- Authentication system is identical to tenant portal
- Only difference: checks `landlord_access` instead of allowing all authenticated users

## Support

For issues or questions, contact the development team.
