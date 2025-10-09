"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { cn, formatDateOnly } from "@/lib/utils"
import { fr } from "date-fns/locale"

interface EditableDueDateCellProps {
  invoiceId: string
  qbId: string
  currentDueDate: string | null
  onDueDateUpdate?: (newDueDate: string) => void
}

export function EditableDueDateCell({
  invoiceId,
  qbId,
  currentDueDate,
  onDueDateUpdate,
}: EditableDueDateCellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dueDate, setDueDate] = useState<Date | undefined>(
    currentDueDate ? new Date(currentDueDate) : undefined
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return

    setIsUpdating(true)
    setError(null)

    try {
      // Format date as YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0]

      // Call API to update QuickBooks invoice due date
      const response = await fetch('/api/quickbooks/update-invoice-due-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId,
          qbId,
          dueDate: formattedDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Échec de la mise à jour de la date d'échéance")
      }

      const result = await response.json()
      console.log("Due date updated successfully:", result)

      // Update local state
      setDueDate(date)
      setIsOpen(false)

      // Notify parent component
      if (onDueDateUpdate) {
        onDueDateUpdate(formattedDate)
      }
    } catch (err) {
      console.error("Error updating due date:", err)
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-full justify-start text-left font-normal",
            !dueDate && "text-muted-foreground"
          )}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mise à jour...
            </>
          ) : (
            <>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? formatDateOnly(dueDate.toISOString()) : "—"}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="space-y-2 p-3">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          <Calendar
            mode="single"
            selected={dueDate}
            onSelect={handleDateSelect}
            locale={fr}
            initialFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
