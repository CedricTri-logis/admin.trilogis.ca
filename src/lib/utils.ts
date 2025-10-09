import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string from Supabase (YYYY-MM-DD) without timezone conversion.
 *
 * Problem: When Supabase returns a `date` type (not timestamptz), it comes as "YYYY-MM-DD".
 * Using `new Date("YYYY-MM-DD")` treats it as UTC midnight, which gets shifted to the
 * previous day in timezones west of UTC (e.g., EST).
 *
 * Solution: Parse the date string directly and format it without timezone conversion.
 *
 * @param dateString - Date string in YYYY-MM-DD format from Supabase
 * @param locale - Locale for formatting (default: 'fr-CA' for YYYY-MM-DD format)
 * @returns Formatted date string or "—" if null/invalid
 *
 * @example
 * formatDateOnly("2025-01-01") // returns "2025-01-01" (not "2024-12-31")
 */
export function formatDateOnly(
  dateString: string | null | undefined,
  locale: string = 'fr-CA'
): string {
  if (!dateString) return "—"

  // Parse the date string manually to avoid timezone issues
  const parts = dateString.split('T')[0].split('-')
  if (parts.length !== 3) return "—"

  const [year, month, day] = parts.map(p => parseInt(p, 10))
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "—"

  // Create date in local timezone (not UTC)
  const date = new Date(year, month - 1, day)

  return date.toLocaleDateString(locale)
}
