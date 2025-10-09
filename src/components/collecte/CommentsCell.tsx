"use client"

import { useState, useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MessageSquare, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

type Comment = {
  id: string
  comment: string
  created_at: string
  created_by: string
  user_email?: string
}

interface CommentsCellProps {
  collecteId: string
}

export function CommentsCell({ collecteId }: CommentsCellProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createSupabaseBrowserClient()

  const fetchComments = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .schema("integration")
        .from("collecte_comments")
        .select(`
          id,
          comment,
          created_at,
          created_by
        `)
        .eq("collecte_id", collecteId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching comments:", error)
        return
      }

      // For now, just display user IDs. In production, you'd fetch user profiles
      // from a profiles table or use an API route to get user emails
      setComments(data || [])
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchComments()
    }
  }, [isOpen, collecteId])

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error("Error getting user:", userError)
        setError("Erreur d'authentification. Veuillez actualiser et réessayer.")
        return
      }

      if (!user) {
        console.error("No user found")
        setError("Vous devez être connecté pour ajouter des commentaires.")
        return
      }

      console.log("Attempting to insert comment for user:", user.id)

      const { data, error: insertError } = await supabase
        .schema("integration")
        .from("collecte_comments")
        .insert({
          collecte_id: collecteId,
          comment: newComment.trim(),
          created_by: user.id
        })
        .select()

      if (insertError) {
        console.error("Error adding comment:", insertError)
        setError(`Échec de l'ajout du commentaire : ${insertError.message}`)
        return
      }

      console.log("Comment added successfully:", data)
      setNewComment("")
      setError(null)
      await fetchComments()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Une erreur inattendue s'est produite. Veuillez réessayer.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <MessageSquare className="h-4 w-4" />
          {comments.length > 0 && (
            <span className="ml-1 text-xs">{comments.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Commentaires</h4>
            <span className="text-xs text-muted-foreground">
              {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Comment List */}
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Chargement...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Aucun commentaire pour l'instant
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border-b pb-3 last:border-b-0">
                  <div className="text-sm">{comment.comment}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{comment.user_email || (comment.created_by ? `Utilisateur ${comment.created_by.substring(0, 8)}...` : "Inconnu")}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: fr
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Comment */}
          <div className="space-y-2 pt-2 border-t">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Cmd/Ctrl + Entrée pour envoyer
              </span>
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSaving}
              >
                <Send className="h-3 w-3 mr-1" />
                {isSaving ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
