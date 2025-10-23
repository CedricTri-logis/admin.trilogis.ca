import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectUserPortals } from '@/lib/services/portal-service'
import { DashboardShell } from '@/components/landlord/DashboardShell'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const portalAccess = await detectUserPortals(user.id)

  if (!portalAccess?.hasLandlord) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl">Access denied</CardTitle>
            <CardDescription>
              Your account does not have landlord permissions for this portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact an administrator to
              request access.
            </p>
            <Button asChild variant="outline">
              <a href="mailto:support@tri-logis.ca">Contact administrator</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <DashboardShell email={user.email} categories={portalAccess.landlordCategories}>
        {children}
      </DashboardShell>
      <Toaster />
    </>
  )
}
