"use client"

import { useState, useEffect, useMemo } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCcw, Plus, X, Settings, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PAGE_SIZE = 50

const DEFAULT_CATEGORIES = [
  "loyer",
  "bail",
  "reparation",
  "expulsion",
  "autre",
]

const FILTER_OPTIONS = [
  { value: "all", label: "Tous les recours" },
  { value: "uncategorized", label: "Non catégorisés" },
  { value: "categorized", label: "Catégorisés" },
]

type RecoursRow = {
  id: string
  recours: string
  category: string | null
  count: number
  created_at: string
  updated_at: string
}

export default function TalRecoursPage() {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<RecoursRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [newCategory, setNewCategory] = useState("")

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Load categories from localStorage on mount
  useEffect(() => {
    const savedCategories = localStorage.getItem("tal_recours_categories")
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories)
        // Ensure all categories are strings (filter out old object format)
        const validCategories = Array.isArray(parsed)
          ? parsed.filter(c => typeof c === 'string')
          : DEFAULT_CATEGORIES
        setCategories(validCategories.length > 0 ? validCategories : DEFAULT_CATEGORIES)
      } catch (e) {
        console.error("Failed to load categories", e)
        setCategories(DEFAULT_CATEGORIES)
      }
    }
  }, [])

  const saveCategories = (newCategories: string[]) => {
    setCategories(newCategories)
    localStorage.setItem("tal_recours_categories", JSON.stringify(newCategories))
  }

  const addCategory = () => {
    if (!newCategory) return

    const exists = categories.includes(newCategory)
    if (exists) {
      alert("Cette catégorie existe déjà!")
      return
    }

    const newCategories = [...categories, newCategory]
    saveCategories(newCategories)
    setNewCategory("")
  }

  const removeCategory = (category: string) => {
    // Don't allow removing if it's in use
    const inUse = rows.some(r => r.category === category)
    if (inUse) {
      alert("Impossible de supprimer cette catégorie car elle est utilisée!")
      return
    }

    const newCategories = categories.filter(c => c !== category)
    saveCategories(newCategories)
  }

  const fetchData = async () => {
    setIsFetching(true)
    try {
      let query = supabase
        .schema("integration")
        .from("tal_recours")
        .select("*", { count: "exact" })
        .order("count", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filter === "uncategorized") {
        query = query.is("category", null)
      } else if (filter === "categorized") {
        query = query.not("category", "is", null)
      }

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter)
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching recours:", error)
        setRows([])
        setTotal(0)
      } else {
        setRows((data || []) as RecoursRow[])
        setTotal(count || 0)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setRows([])
      setTotal(0)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, categoryFilter])

  const handleCategoryChange = async (id: string, category: string) => {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .schema("integration")
        .from("tal_recours")
        .update({ category, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) {
        console.error("Error updating category:", error)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setUpdatingId(null)
    }
  }

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Gestion des Recours TAL</CardTitle>
            <CardDescription>
              Catégorisez les différents types de recours du Tribunal administratif du logement.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isManagingCategories} onOpenChange={setIsManagingCategories}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Gérer les catégories
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Gérer les catégories</DialogTitle>
                  <DialogDescription>
                    Ajoutez ou supprimez des catégories pour classifier les recours.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Ajouter une nouvelle catégorie</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nom de la catégorie (ex: loyer)"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                      <Button onClick={addCategory} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Catégories existantes</Label>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {categories.map((category) => (
                        <div
                          key={category}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="font-medium">{category}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCategory(category)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={isFetching}
            >
              <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")}
                aria-label="Refresh"
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filter} onValueChange={(value) => {
              setFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer les recours" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(value) => {
              setCategoryFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {[...categories].sort((a, b) => a.localeCompare(b)).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {total} recours • Page {page} of {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[500px]">Recours</TableHead>
                  <TableHead className="w-[200px]">Catégorie</TableHead>
                  <TableHead className="w-[100px]">Occurences</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(10)].map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-9 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.recours}</TableCell>
                      <TableCell>
                        <Select
                          value={row.category || "none"}
                          onValueChange={(value) => handleCategoryChange(row.id, value === "none" ? null : value)}
                          disabled={updatingId === row.id}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non catégorisé</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">{row.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Aucun recours trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${(page - 1) * PAGE_SIZE + rows.length} sur ${total} recours`
                : "Affichage de 0 sur 0 recours"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!canPrevious || isFetching}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => canNext && setPage((prev) => prev + 1)}
                disabled={!canNext || isFetching}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
