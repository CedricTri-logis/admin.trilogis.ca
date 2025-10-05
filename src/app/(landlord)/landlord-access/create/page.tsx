"use client"

import { useForm } from "@refinedev/react-hook-form"
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
import { useRouter } from "next/navigation"

const schema = z.object({
  user_id: z.string().min(1, "User ID is required"),
})

type FormValues = z.infer<typeof schema>

export default function CreateLandlordAccessPage() {
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    refineCoreProps: {
      resource: "landlord-access",
      action: "create",
      meta: {
        schema: "portal_auth",
      },
      redirect: "list",
    },
    defaultValues: {
      user_id: "",
    },
  })

  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    control,
  } = form

  const onSubmit = handleSubmit(async (values) => {
    await onFinish(values)
    router.push("/landlord-access")
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant landlord access</CardTitle>
        <CardDescription>
          Provide a Supabase user ID to grant access to the landlord portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="UUID of the Supabase auth user"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Saving..." : "Grant access"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/landlord-access")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Access can be revoked at any time from the list view.
        </p>
      </CardFooter>
    </Card>
  )
}
