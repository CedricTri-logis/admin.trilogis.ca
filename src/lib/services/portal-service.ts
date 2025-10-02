import { createClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

export type PortalType = 'landlord'

export interface PortalAccess {
  hasLandlord: boolean
  landlordCategories: string[]
}

/**
 * Detect user's landlord portal access
 * Uses service-role client to bypass RLS for system-level auth checks
 */
export async function detectUserPortals(userId: string): Promise<PortalAccess> {
  try {
    const serviceClient = createSupabaseServiceRoleClient()

    console.log('[portal-service] Checking landlord access for user:', userId)

    const { data: landlordAccess, error: accessError } = await serviceClient
      .schema('portal_auth')
      .from('landlord_access')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .maybeSingle()

    if (accessError) {
      console.error('[portal-service] Error querying landlord_access:', accessError)
    } else {
      console.log('[portal-service] Landlord access result:', landlordAccess)
    }

    const { data: categories, error: catError } = await serviceClient
      .schema('portal_auth')
      .from('landlord_categories')
      .select('category')
      .eq('user_id', userId)
      .is('revoked_at', null)

    if (catError) {
      console.error('[portal-service] Error querying landlord_categories:', catError)
    } else {
      console.log('[portal-service] Categories result:', categories)
    }

    const hasLandlord = !!landlordAccess
    const landlordCategories = categories?.map(c => c.category) || []

    console.log('[portal-service] Final result:', { hasLandlord, landlordCategories })

    return {
      hasLandlord,
      landlordCategories
    }
  } catch (error) {
    console.error('[portal-service] Error checking landlord access:', error)
    return {
      hasLandlord: false,
      landlordCategories: []
    }
  }
}

/**
 * Check if user has access to specific landlord category
 */
export async function hasLandlordCategory(
  userId: string,
  category: string
): Promise<boolean> {
  const access = await detectUserPortals(userId)

  if (!access.hasLandlord) return false

  // Wildcard grants all categories
  if (access.landlordCategories.includes('*')) return true

  return access.landlordCategories.includes(category)
}
