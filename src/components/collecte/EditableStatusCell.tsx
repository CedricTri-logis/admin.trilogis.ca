"use client"

import { useState, useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditableStatusCellProps {
  collecteId: string
  currentStatus: string | null
  onStatusUpdate?: (newStatus: string | null) => void
}

export function EditableStatusCell({
  collecteId,
  currentStatus,
  onStatusUpdate,
}: EditableStatusCellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [newStatusInput, setNewStatusInput] = useState("")
  const [existingStatuses, setExistingStatuses] = useState<string[]>([])
  const [isUpdating, setIsUpdating] = useState(false)

  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    fetchExistingStatuses()
  }, [])

  const fetchExistingStatuses = async () => {
    const { data, error } = await supabase
      .schema("integration")
      .from("collecte")
      .select("status")
      .not("status", "is", null)

    if (!error && data) {
      const uniqueStatuses = Array.from(new Set(data.map(d => d.status).filter(Boolean))) as string[]
      setExistingStatuses(uniqueStatuses.sort())
    }
  }

  const updateStatus = async (newStatus: string | null) => {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .schema("integration")
        .from("collecte")
        .update({ status: newStatus })
        .eq("id", collecteId)

      if (error) {
        console.error("Error updating status:", error)
        alert("Failed to update status")
      } else {
        setStatus(newStatus)
        setIsOpen(false)
        if (onStatusUpdate) {
          onStatusUpdate(newStatus)
        }
        // Refresh existing statuses list
        await fetchExistingStatuses()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to update status")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSelectStatus = (selectedStatus: string) => {
    updateStatus(selectedStatus)
  }

  const handleCreateNewStatus = () => {
    const trimmedStatus = newStatusInput.trim()
    if (trimmedStatus) {
      updateStatus(trimmedStatus)
      setNewStatusInput("")
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-between"
          disabled={isUpdating}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <span className="truncate">
            {status || "—"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[200px]"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Existing statuses */}
        {existingStatuses.length > 0 && (
          <>
            {existingStatuses.map((existingStatus) => (
              <DropdownMenuItem
                key={existingStatus}
                onClick={() => handleSelectStatus(existingStatus)}
                className="cursor-pointer"
              >
                <span className="flex-1">{existingStatus}</span>
                {status === existingStatus && (
                  <Check className="h-4 w-4 ml-2" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Create new status */}
        <div className="space-y-2 p-2" onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder="Nouveau statut..."
            value={newStatusInput}
            onChange={(e) => setNewStatusInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateNewStatus()
              }
              e.stopPropagation()
            }}
            className="h-8 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleCreateNewStatus}
              disabled={!newStatusInput.trim()}
              className="flex-1 h-7 text-xs"
            >
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(null)}
              className="flex-1 h-7 text-xs"
            >
              Effacer
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
