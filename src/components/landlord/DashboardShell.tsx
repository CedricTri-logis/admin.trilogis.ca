"use client"

import { type PropsWithChildren, useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FileText, House, LogOut, Menu, ShieldCheck, ChevronRight, ChevronDown, FolderOpen, Building2, DollarSign, BarChart3, FileWarning } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLogout } from "@refinedev/core"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type DashboardShellProps = PropsWithChildren<{
  email?: string | null
  categories?: string[]
}>

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/accounting", label: "Accounting", icon: BarChart3 },
  { href: "/landlord-access", label: "Access", icon: ShieldCheck },
  { href: "/landlord-categories", label: "Categories", icon: ShieldCheck },
] as const

const TAL_SUBITEMS = [
  { href: "/integration/apartments-tal-dossiers", label: "Dossiers" },
  { href: "/integration/tal-recours", label: "Recours" },
  { href: "/integration/tal-audience", label: "Audience" },
] as const

const QUICKBOOKS_SUBITEMS = [
  { href: "/integration/quickbooks", label: "Reconciliation" },
  { href: "/integration/quickbooks/invoices", label: "Invoices" },
] as const

const COLLECTE_SUBITEMS = [
  { href: "/collecte/actuel", label: "Actuel" },
  { href: "/collecte/ancien", label: "Ancien" },
] as const

const PROPRIETE_SUBITEMS = [
  { href: "/propriete/immeubles", label: "Immeubles" },
  { href: "/propriete/apartments", label: "Apartments" },
  { href: "/propriete/photo", label: "Photo" },
] as const

const BAUX_SUBITEMS = [
  { href: "/integration/lease-discrepancies", label: "Discordances" },
] as const

export function DashboardShell({ email, categories = [], children }: DashboardShellProps) {
  const { mutate: logout } = useLogout()
  const pathname = usePathname()
  const [isTalExpanded, setIsTalExpanded] = useState(true)
  const [isQuickBooksExpanded, setIsQuickBooksExpanded] = useState(true)
  const [isCollecteExpanded, setIsCollecteExpanded] = useState(true)
  const [isProprieteExpanded, setIsProprieteExpanded] = useState(true)
  const [isBauxExpanded, setIsBauxExpanded] = useState(true)
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0)
  const [leaseDiscrepancyCount, setLeaseDiscrepancyCount] = useState<number>(0)

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  useEffect(() => {
    const fetchUncategorizedCount = async () => {
      const { count } = await supabase
        .schema("integration")
        .from("tal_recours")
        .select("*", { count: "exact", head: true })
        .is("category", null)

      setUncategorizedCount(count || 0)
    }

    const fetchLeaseDiscrepancyCount = async () => {
      const { count } = await supabase
        .schema("integration")
        .from("all_lease_discrepancies")
        .select("*", { count: "exact", head: true })
        .or("severity.ilike.CRITICAL%,severity.ilike.HIGH%")

      setLeaseDiscrepancyCount(count || 0)
    }

    fetchUncategorizedCount()
    fetchLeaseDiscrepancyCount()
  }, [supabase])

  const initials = useMemo(() => {
    if (!email) {
      return "LL"
    }
    const name = email.split("@")[0] ?? "LL"
    return name.slice(0, 2).toUpperCase()
  }, [email])

  const categoryLabel = categories.length > 0 ? categories.join(", ") : "No category assigned"

  const isTalActive = pathname?.startsWith("/integration/apartments-tal-dossiers") ||
                       pathname?.startsWith("/integration/tal-recours") ||
                       pathname?.startsWith("/integration/tal-audience")
  const isQuickBooksActive = pathname?.startsWith("/integration/quickbooks")
  const isCollecteActive = pathname?.startsWith("/collecte/")
  const isProprieteActive = pathname?.startsWith("/propriete/")
  const isBauxActive = pathname?.startsWith("/integration/lease-discrepancies")

  const DesktopNav = (
    <nav className="hidden w-64 flex-col border-r bg-card p-4 md:flex">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <House className="h-5 w-5" />
        Tri-Logis Admin
      </div>
      <div className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.startsWith(item.href)
          return (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn("w-full justify-start", isActive && "bg-muted")}
            >
              <Link href={item.href}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          )
        })}

        {/* TAL Parent Menu */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => setIsTalExpanded(!isTalExpanded)}
            className={cn("w-full justify-start", isTalActive && "bg-muted")}
          >
            {isTalExpanded ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            <FileText className="mr-2 h-4 w-4" />
            TAL
          </Button>

          {isTalExpanded && (
            <div className="ml-6 space-y-1">
              {TAL_SUBITEMS.map((item) => {
                const isActive = pathname === item.href
                const showCount = item.href === "/integration/tal-recours" && uncategorizedCount > 0
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild
                    size="sm"
                    className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                  >
                    <Link href={item.href}>
                      {item.label}
                      {showCount && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({uncategorizedCount})
                        </span>
                      )}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {/* QuickBooks Parent Menu */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => setIsQuickBooksExpanded(!isQuickBooksExpanded)}
            className={cn("w-full justify-start", isQuickBooksActive && "bg-muted")}
          >
            {isQuickBooksExpanded ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            <DollarSign className="mr-2 h-4 w-4" />
            QuickBooks
          </Button>

          {isQuickBooksExpanded && (
            <div className="ml-6 space-y-1">
              {QUICKBOOKS_SUBITEMS.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild
                    size="sm"
                    className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                  >
                    <Link href={item.href}>
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {/* Collecte Parent Menu */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => setIsCollecteExpanded(!isCollecteExpanded)}
            className={cn("w-full justify-start", isCollecteActive && "bg-muted")}
          >
            {isCollecteExpanded ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            <FolderOpen className="mr-2 h-4 w-4" />
            Collecte
          </Button>

          {isCollecteExpanded && (
            <div className="ml-6 space-y-1">
              {COLLECTE_SUBITEMS.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild
                    size="sm"
                    className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                  >
                    <Link href={item.href}>
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {/* Propriete Parent Menu */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => setIsProprieteExpanded(!isProprieteExpanded)}
            className={cn("w-full justify-start", isProprieteActive && "bg-muted")}
          >
            {isProprieteExpanded ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            <Building2 className="mr-2 h-4 w-4" />
            Propriete
          </Button>

          {isProprieteExpanded && (
            <div className="ml-6 space-y-1">
              {PROPRIETE_SUBITEMS.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild
                    size="sm"
                    className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                  >
                    <Link href={item.href}>
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {/* Baux Parent Menu */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => setIsBauxExpanded(!isBauxExpanded)}
            className={cn("w-full justify-start", isBauxActive && "bg-muted")}
          >
            {isBauxExpanded ? (
              <ChevronDown className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            <FileWarning className="mr-2 h-4 w-4" />
            Baux
          </Button>

          {isBauxExpanded && (
            <div className="ml-6 space-y-1">
              {BAUX_SUBITEMS.map((item) => {
                const isActive = pathname === item.href
                const showCount = item.href === "/integration/lease-discrepancies" && leaseDiscrepancyCount > 0
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild
                    size="sm"
                    className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                  >
                    <Link href={item.href}>
                      {item.label}
                      {showCount && (
                        <span className="ml-1 text-xs text-red-600 font-semibold">
                          ({leaseDiscrepancyCount})
                        </span>
                      )}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-auto rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Landlord Categories</p>
        <p>{categoryLabel}</p>
      </div>
    </nav>
  )

  const MobileNav = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <div className="space-y-1 pt-8">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname?.startsWith(item.href)
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                asChild
                className="w-full justify-start"
              >
                <Link href={item.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            )
          })}

          {/* TAL Parent Menu */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setIsTalExpanded(!isTalExpanded)}
              className={cn("w-full justify-start", isTalActive && "bg-muted")}
            >
              {isTalExpanded ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <FileText className="mr-2 h-4 w-4" />
              TAL
            </Button>

            {isTalExpanded && (
              <div className="ml-6 space-y-1">
                {TAL_SUBITEMS.map((item) => {
                  const isActive = pathname === item.href
                  const showCount = item.href === "/integration/tal-recours" && uncategorizedCount > 0
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      size="sm"
                      className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                    >
                      <Link href={item.href}>
                        {item.label}
                        {showCount && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({uncategorizedCount})
                          </span>
                        )}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* QuickBooks Parent Menu */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setIsQuickBooksExpanded(!isQuickBooksExpanded)}
              className={cn("w-full justify-start", isQuickBooksActive && "bg-muted")}
            >
              {isQuickBooksExpanded ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <DollarSign className="mr-2 h-4 w-4" />
              QuickBooks
            </Button>

            {isQuickBooksExpanded && (
              <div className="ml-6 space-y-1">
                {QUICKBOOKS_SUBITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      size="sm"
                      className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                    >
                      <Link href={item.href}>
                        {item.label}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Collecte Parent Menu */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setIsCollecteExpanded(!isCollecteExpanded)}
              className={cn("w-full justify-start", isCollecteActive && "bg-muted")}
            >
              {isCollecteExpanded ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <FolderOpen className="mr-2 h-4 w-4" />
              Collecte
            </Button>

            {isCollecteExpanded && (
              <div className="ml-6 space-y-1">
                {COLLECTE_SUBITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      size="sm"
                      className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                    >
                      <Link href={item.href}>
                        {item.label}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Propriete Parent Menu */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setIsProprieteExpanded(!isProprieteExpanded)}
              className={cn("w-full justify-start", isProprieteActive && "bg-muted")}
            >
              {isProprieteExpanded ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <Building2 className="mr-2 h-4 w-4" />
              Propriete
            </Button>

            {isProprieteExpanded && (
              <div className="ml-6 space-y-1">
                {PROPRIETE_SUBITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      size="sm"
                      className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                    >
                      <Link href={item.href}>
                        {item.label}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Baux Parent Menu */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setIsBauxExpanded(!isBauxExpanded)}
              className={cn("w-full justify-start", isBauxActive && "bg-muted")}
            >
              {isBauxExpanded ? (
                <ChevronDown className="mr-2 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              <FileWarning className="mr-2 h-4 w-4" />
              Baux
            </Button>

            {isBauxExpanded && (
              <div className="ml-6 space-y-1">
                {BAUX_SUBITEMS.map((item) => {
                  const isActive = pathname === item.href
                  const showCount = item.href === "/integration/lease-discrepancies" && leaseDiscrepancyCount > 0
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      size="sm"
                      className={cn("w-full justify-start text-sm", isActive && "bg-muted")}
                    >
                      <Link href={item.href}>
                        {item.label}
                        {showCount && (
                          <span className="ml-1 text-xs text-red-600 font-semibold">
                            ({leaseDiscrepancyCount})
                          </span>
                        )}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Landlord Categories</p>
          <p>{categoryLabel}</p>
        </div>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {DesktopNav}
      <div className="flex flex-1 flex-col">
        <header className="border-b bg-background">
          <div className="flex h-16 items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2">
              {MobileNav}
              <div className="text-base font-semibold md:text-lg">Landlord Portal</div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Signed in as
                </DropdownMenuLabel>
                <DropdownMenuItem className="text-sm font-medium">
                  {email ?? "Unknown"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
