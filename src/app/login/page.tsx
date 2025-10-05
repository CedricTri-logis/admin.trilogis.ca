"use client"

import { useState } from "react"
import { useLogin } from "@refinedev/core"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export default function LoginPage() {
  const { mutateAsync: login } = useLogin<{ email: string; password: string }>()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setError(null)
    try {
      const result = await login({
        email: values.email,
        password: values.password,
      })

      if (!result?.success) {
        setError(result?.error?.message ?? "Unable to sign in")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in")
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Tri-Logis Landlord Portal
            </CardTitle>
            <CardDescription>
              Sign in to access your landlord dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="Your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className={cn("w-full")}
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter>
            <p className="w-full text-center text-xs text-muted-foreground">
              Need access? Contact an administrator.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
