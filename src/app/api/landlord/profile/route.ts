import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile from portal_auth schema
    const { data: profile, error: profileError } = await supabase
      .schema('portal_auth')
      .from('profiles')
      .select('first_name, last_name, email, phone')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[landlord/profile] Failed to load profile:', profileError)
      return NextResponse.json({
        firstName: user.user_metadata?.first_name ?? '',
        lastName: user.user_metadata?.last_name ?? '',
        email: user.email ?? '',
      })
    }

    return NextResponse.json({
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      email: profile?.email ?? user.email ?? '',
      phone: profile?.phone ?? user.phone ?? '',
    })
  } catch (error) {
    console.error('[landlord/profile] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
