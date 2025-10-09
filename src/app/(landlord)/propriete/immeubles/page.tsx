"use client"

import { useList } from "@refinedev/core"
import { PlusCircle, Building2 } from "lucide-react"
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
import Link from "next/link"

interface Building {
  id: string
  name: string
  address: string
  city: string
  state: string | null
  zip_code: string | null
  total_units: number | null
  year_built: number | null
  is_active: boolean | null
  created_at: string
}

export default function ImmeublesPage() {
  const { data, isLoading } = useList<Building>({
    resource: "buildings",
    meta: {
      select: "id,name,address,city,state,zip_code,total_units,year_built,is_active,created_at",
    },
    sorters: [
      {
        field: "name",
        order: "asc",
      },
    ],
  })

  const buildings = data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Immeubles
          </CardTitle>
          <CardDescription>
            Manage your property buildings and their information.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="whitespace-nowrap">
          <Link href="/propriete/immeubles/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Building
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-center">Year Built</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : buildings.length ? (
                buildings.map((building) => (
                  <TableRow key={building.id}>
                    <TableCell className="font-medium">
                      {building.name}
                    </TableCell>
                    <TableCell>
                      {building.address}
                    </TableCell>
                    <TableCell>
                      {building.city}
                    </TableCell>
                    <TableCell className="text-center">
                      {building.total_units ?? 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {building.year_built ?? "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      {building.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/propriete/immeubles/edit/${building.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No buildings found. Click "Add Building" to create your first property.
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
