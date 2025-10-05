"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  category: z.string().min(1, "Category is required"),
  is_revoked: z.boolean().default(false),
})

type FormValues = z.infer<typeof schema>

export default function EditLandlordCategoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    refineCoreProps: {
      resource: "landlord-categories",
      id: params.id,
      action: "edit",
      meta: {
        schema: "portal_auth",
        select: "id,user_id,category,revoked_at",
      },
      redirect: "list",
    },
    defaultValues: {
      user_id: "",
      category: "",
      is_revoked: false,
    },
  })

  const {
    refineCore: { onFinish, queryResult, formLoading },
    handleSubmit,
    control,
    setValue,
  } = form

  useEffect(() => {
    const record = queryResult?.data?.data
    if (record) {
      setValue("is_revoked", !!record.revoked_at)
    }
  }, [queryResult?.data?.data, setValue])

  const onSubmit = handleSubmit(async (values) => {
    await onFinish({
      user_id: values.user_id,
      category: values.category,
      revoked_at: values.is_revoked ? new Date().toISOString() : null,
    })
    router.push("/landlord-categories")
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit category assignment</CardTitle>
        <CardDescription>
          Adjust the assigned category or revoke access for this landlord.
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
                    <Input className="font-mono" {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="is_revoked"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-medium">
                      Revoke access
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Revoked assignments remain in the system for historical
                      auditing.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Saving..." : "Save changes"}
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
          Use the wildcard "*" category to maintain universal access while
          individual assignments are revoked.
        </p>
      </CardFooter>
    </Card>
  )
}
