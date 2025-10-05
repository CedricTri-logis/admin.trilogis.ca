"use client"

import { PropsWithChildren, useMemo } from "react"
import { Refine, type AuthBindings, type IResourceItem } from "@refinedev/core"
import routerProvider from "@refinedev/nextjs-router/app"
import {
  dataProvider as supabaseDataProvider,
  liveProvider as supabaseLiveProvider,
} from "@refinedev/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function RefineProvider({ children }: PropsWithChildren) {
  const router = useRouter()

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const dataProvider = useMemo(() => supabaseDataProvider(supabase as SupabaseClient), [supabase])
  const liveProvider = useMemo(() => supabaseLiveProvider(supabase as SupabaseClient), [supabase])

  const resources: IResourceItem[] = useMemo(
    () => [
      {
        name: "dashboard",
        list: "/dashboard",
        meta: {
          label: "Dashboard",
        },
      },
      {
        name: "landlord-access",
        list: "/landlord-access",
        create: "/landlord-access/create",
        edit: "/landlord-access/edit/:id",
        meta: {
          label: "Landlord Access",
          schema: "portal_auth",
          canDelete: true,
        },
      },
      {
        name: "landlord-categories",
        list: "/landlord-categories",
        create: "/landlord-categories/create",
        edit: "/landlord-categories/edit/:id",
        meta: {
          label: "Landlord Categories",
          schema: "portal_auth",
          canDelete: true,
        },
      },
      {
        name: "apartments_tal_dossiers",
        list: "/integration/apartments-tal-dossiers",
        meta: {
          label: "TAL Dossiers",
          schema: "integration",
        },
      },
      {
        name: "tal_recours",
        list: "/integration/tal-recours",
        meta: {
          label: "TAL Recours",
          schema: "integration",
        },
      },
    ],
    []
  )

  const authProvider: AuthBindings = useMemo(() => ({
    login: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return {
          success: false,
          error: {
            name: "LoginError",
            message: error.message,
          },
        }
      }

      if (data?.user) {
        router.push("/dashboard")
        router.refresh()
      }

      return {
        success: true,
        redirectTo: "/dashboard",
      }
    },
    register: async ({ email, password }) => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        return {
          success: false,
          error: {
            name: "RegisterError",
            message: error.message,
          },
        }
      }
      return {
        success: true,
        redirectTo: "/dashboard",
      }
    },
    updatePassword: async ({ password }) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        return {
          success: false,
          error: {
            name: "UpdatePasswordError",
            message: error.message,
          },
        }
      }

      return {
        success: true,
      }
    },
    forgotPassword: async ({ email }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) {
        return {
          success: false,
          error: {
            name: "ForgotPasswordError",
            message: error.message,
          },
        }
      }

      return {
        success: true,
      }
    },
    logout: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) {
        return {
          success: false,
          error: {
            name: "LogoutError",
            message: error.message,
          },
        }
      }

      router.push("/login")
      router.refresh()

      return {
        success: true,
        redirectTo: "/login",
      }
    },
    check: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        return {
          authenticated: false,
          error,
        }
      }

      return {
        authenticated: !!data.session,
      }
    },
    getPermissions: async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        const role = data.user.app_metadata?.role
        return role ? [role].flat() : []
      }
      return []
    },
    getIdentity: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        return null
      }
      const { user } = data
      return {
        id: user.id,
        name: user.email ?? user.id,
        avatar: undefined,
        email: user.email ?? undefined,
      }
    },
    onError: async (error) => {
      console.error("[RefineAuth]", error)
      return { error }
    },
  }), [router, supabase])

  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      liveProvider={liveProvider}
      authProvider={authProvider}
      resources={resources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      {children}
    </Refine>
  )
}
