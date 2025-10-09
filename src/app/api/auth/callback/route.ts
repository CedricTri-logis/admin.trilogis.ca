import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  // Get origin
  let origin = requestUrl.origin

  // Handle localhost/0.0.0.0 conversion
  if (origin.includes("0.0.0.0")) {
    origin = origin.replace("0.0.0.0", "localhost")
  }

  // Use NEXT_PUBLIC_APP_URL in development for consistent redirects
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_APP_URL) {
    origin = process.env.NEXT_PUBLIC_APP_URL
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
      )
    }

    // Success - redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", origin))
  }

  // No code provided
  return NextResponse.redirect(new URL("/login", origin))
}
