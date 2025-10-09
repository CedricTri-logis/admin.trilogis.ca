"use client"

import { useList } from "@refinedev/core"
import { PlusCircle, Home } from "lucide-react"
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
import { useMemo, useState } from "react"

interface Apartment {
  id: string
  apartment_name: string
  unit_address: string
  unit_number: string | null
  apartment_category: string
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  is_active: boolean | null
  market_rent: number | null
  on_hold: boolean | null
  building_id: string
  buildings?: {
    name: string
  }
}

export default function ApartmentsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const { data, isLoading } = useList<Apartment>({
    resource: "apartments",
    meta: {
      select: "id,apartment_name,unit_address,unit_number,apartment_category,bedrooms,bathrooms,square_feet,is_active,market_rent,on_hold,building_id,buildings(name)",
    },
    filters: [
      {
        field: "is_active",
        operator: "eq",
        value: true,
      },
    ],
    sorters: [
      {
        field: "apartment_name",
        order: "asc",
      },
    ],
  })

  const apartments = data?.data ?? []

  const filteredApartments = useMemo(() => {
    if (selectedCategory === "all") return apartments
    return apartments.filter(apt => apt.apartment_category === selectedCategory)
  }, [apartments, selectedCategory])

  const categories = useMemo(() => {
    const cats = new Set(apartments.map(apt => apt.apartment_category))
    return Array.from(cats).sort()
  }, [apartments])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Apartments
          </CardTitle>
          <CardDescription>
            Manage your rental units and their details.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="whitespace-nowrap">
          <Link href="/propriete/apartments/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Apartment
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {/* Category Filter */}
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({apartments.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat} ({apartments.filter(a => a.apartment_category === cat).length})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Bed/Bath</TableHead>
                <TableHead className="text-center">Sq Ft</TableHead>
                <TableHead className="text-right">Market Rent</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredApartments.length ? (
                filteredApartments.map((apartment) => (
                  <TableRow key={apartment.id}>
                    <TableCell className="font-medium">
                      {apartment.apartment_name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {apartment.buildings?.name ?? "N/A"}
                    </TableCell>
                    <TableCell>
                      {apartment.unit_address}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {apartment.apartment_category}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {apartment.bedrooms && apartment.bathrooms
                        ? `${apartment.bedrooms}bd / ${apartment.bathrooms}ba`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      {apartment.square_feet ?? "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {apartment.market_rent
                        ? `$${apartment.market_rent.toLocaleString()}`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      {apartment.on_hold ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          On Hold
                        </span>
                      ) : apartment.is_active ? (
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
                        <Link href={`/propriete/apartments/edit/${apartment.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {selectedCategory === "all"
                      ? "No apartments found. Click \"Add Apartment\" to create your first unit."
                      : `No apartments found in category "${selectedCategory}".`}
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
