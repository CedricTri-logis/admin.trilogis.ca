"use client";

import { useGetIdentity } from "@refinedev/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Building2, Users } from "lucide-react";
import Link from "next/link";

const QUICK_ACTIONS = [
  {
    title: "Accounting Dashboard",
    description: "View revenue analytics and QuickBooks income data.",
    href: "/accounting",
    icon: BarChart3,
  },
  {
    title: "Manage properties",
    description: "Review units, lease terms, and occupancy details.",
    href: "/landlord-access",
    icon: Building2,
  },
  {
    title: "Tenant directory",
    description: "Locate tenant contact information and history.",
    href: "/landlord-categories",
    icon: Users,
  },
];

export default function DashboardPage() {
  const identityResult = useGetIdentity();
  const identityData = identityResult?.data as { email?: unknown } | undefined;
  const email = typeof identityData?.email === "string" ? identityData.email : undefined;
  const greeting = email ? `, ${email}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {`Welcome back${greeting}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your centralized view of landlord operations, analytics, and tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.title} className="group border-border/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {action.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 text-sm">
                  {action.description}
                </CardDescription>
                <Button asChild variant="secondary" size="sm" className="group-hover:bg-primary/10">
                  <Link href={action.href}>
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Keep track of changes across your portfolio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>No activity yet. Connect ingestion scripts or enable audit logging to populate this feed.</p>
        </CardContent>
      </Card>
    </div>
  );
}
