import { createClient } from '@supabase/supabase-js'

type ServiceClientOptions = {
  supabaseUrl?: string
  schema?: string
}

/**
 * Creates a Supabase client authenticated with the service-role key.
 * Only import this helper from server-side contexts (API routes, server actions, cron jobs).
 */
export function createSupabaseServiceRoleClient(options: ServiceClientOptions = {}) {
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseUrl = options.supabaseUrl || envSupabaseUrl
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: options.schema ? { schema: options.schema } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
