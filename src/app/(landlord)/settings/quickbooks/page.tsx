"use client"

import { useState, useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCcw, CheckCircle, XCircle, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

type QBToken = {
  realm_id: string
  is_active: boolean
  access_token_expires_at: string
  updated_at: string
}

export default function QuickBooksSettingsPage() {
  const [tokens, setTokens] = useState<QBToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const supabase = createSupabaseBrowserClient()

  const fetchTokens = async () => {
    setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .schema("quickbooks")
        .from("qb_auth_tokens")
        .select("realm_id, is_active, access_token_expires_at, updated_at")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching tokens:", error)
      } else {
        setTokens(data || [])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTokens()
  }, [])

  const handleConnect = () => {
    window.location.href = '/api/quickbooks/auth/connect'
  }

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connexion QuickBooks</CardTitle>
              <CardDescription>
                Gérez vos connexions OAuth QuickBooks
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTokens}
                disabled={isRefreshing}
              >
                <RefreshCcw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Actualiser
              </Button>
              <Button onClick={handleConnect}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connecter QuickBooks
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Aucune connexion QuickBooks trouvée
              </p>
              <Button onClick={handleConnect}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connecter QuickBooks
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => {
                const expired = isTokenExpired(token.access_token_expires_at)
                return (
                  <div
                    key={token.realm_id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Realm ID:</span>
                        <code className="text-sm bg-muted px-2 py-0.5 rounded">
                          {token.realm_id}
                        </code>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Expire:{" "}
                          {formatDistanceToNow(
                            new Date(token.access_token_expires_at),
                            {
                              addSuffix: true,
                              locale: fr,
                            }
                          )}
                        </span>
                        <span>•</span>
                        <span>
                          Mis à jour:{" "}
                          {formatDistanceToNow(new Date(token.updated_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {token.is_active ? (
                        expired ? (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-5 w-5" />
                            <span className="font-medium">Expiré</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Actif</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <XCircle className="h-5 w-5" />
                          <span className="font-medium">Inactif</span>
                        </div>
                      )}
                      {(expired || !token.is_active) && (
                        <Button onClick={handleConnect} size="sm">
                          Reconnecter
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions de connexion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Étape 1: Vérifier l'URL de redirection</h3>
            <p className="text-sm text-muted-foreground">
              Assurez-vous que l'URL de redirection dans votre fichier .env.local correspond à:
            </p>
            <code className="block bg-muted p-2 rounded text-sm">
              QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/auth/callback
            </code>
            <p className="text-sm text-muted-foreground">
              Cette URL doit également être configurée dans votre application QuickBooks sur{" "}
              <a
                href="https://developer.intuit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                developer.intuit.com
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Étape 2: Cliquer sur "Connecter QuickBooks"</h3>
            <p className="text-sm text-muted-foreground">
              Le bouton ci-dessus vous redirigera vers QuickBooks pour autoriser l'accès.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Étape 3: Autoriser l'application</h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez votre compagnie QuickBooks et autorisez l'accès. Vous serez redirigé
              automatiquement vers cette page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
