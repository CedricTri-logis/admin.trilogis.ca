"use client"

import { useRouter } from "next/navigation"
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

const schema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  category: z
    .string()
    .min(1, "Category name is required")
    .max(120, "Category is too long"),
})

type FormValues = z.infer<typeof schema>

export default function CreateLandlordCategoryPage() {
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    refineCoreProps: {
      resource: "landlord-categories",
      action: "create",
      meta: {
        schema: "portal_auth",
      },
      redirect: "list",
    },
    defaultValues: {
      user_id: "",
      category: "",
    },
  })

  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    control,
  } = form

  const onSubmit = handleSubmit(async (values) => {
    await onFinish(values)
    router.push("/landlord-categories")
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign category access</CardTitle>
        <CardDescription>
          Grant a landlord access to a specific category, property set, or region.
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
                    <Input className="font-mono" placeholder="User UUID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. portfolio-east" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Saving..." : "Create assignment"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/landlord-categories")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Use the wildcard "*" category to grant access to all data.
        </p>
      </CardFooter>
    </Card>
  )
}
