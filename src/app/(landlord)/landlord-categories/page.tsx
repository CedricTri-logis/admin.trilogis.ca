"use client"

import { useList } from "@refinedev/core"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateOnly } from "@/lib/utils"

interface LandlordCategoryRecord {
  id: string
  user_id: string
  category: string
  created_at: string
  revoked_at: string | null
}

export default function LandlordCategoriesList() {
  const { data, isLoading } = useList<LandlordCategoryRecord>({
    resource: "landlord-categories",
    meta: {
      schema: "portal_auth",
      select: "id,user_id,category,created_at,revoked_at",
    },
  })

  const records = data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Landlord categories</CardTitle>
          <CardDescription>
            Control category-level access to assets, regions, or portfolios.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="whitespace-nowrap">
          <Link href="/landlord-categories/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add category access
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">User ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : records.length ? (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs md:text-sm">
                      {record.user_id}
                    </TableCell>
                    <TableCell>{record.category}</TableCell>
                    <TableCell>
                      {new Date(record.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {record.revoked_at
                        ? `Revoked ${formatDateOnly(record.revoked_at)}`
                        : "Active"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/landlord-categories/edit/${record.id}`}>
                          Manage
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No category assignments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
