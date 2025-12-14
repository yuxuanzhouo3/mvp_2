"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { isChinaRegion } from "@/lib/config/region"

type AuthStatus = "loading" | "success" | "error"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const redirectPath = searchParams.get("redirect") || searchParams.get("next") || "/"

  const [status, setStatus] = useState<AuthStatus>("loading")
  const [message, setMessage] = useState("正在完成登录，请稍候...")

  useEffect(() => {
    let cancelled = false

    const completeOAuth = async () => {
      if (isChinaRegion()) {
        router.replace("/login")
        return
      }

      try {
        const [{ supabase }, { saveSupabaseUserCache }] = await Promise.all([
          import("@/lib/integrations/supabase"),
          import("@/lib/auth/auth-state-manager-intl"),
        ])

        // Try to reuse an existing session first
        let {
          data: { session },
        } = await supabase.auth.getSession()

        // Exchange the code for a session if none exists yet
        if (!session) {
          if (!code) {
            throw new Error("Missing OAuth code in callback URL")
          }
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            throw error
          }
          session = data.session
        }

        if (!session?.access_token) {
          throw new Error("No Supabase session found after OAuth callback")
        }

        // Fetch and cache the enriched profile for the app
        try {
          const profileResponse = await fetch("/api/profile", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          })

          if (profileResponse.ok) {
            const profile = await profileResponse.json()
            saveSupabaseUserCache(profile)
          } else {
            console.warn("[Auth Callback] Failed to refresh profile:", profileResponse.status)
          }
        } catch (profileError) {
          console.warn("[Auth Callback] Profile refresh error:", profileError)
        }

        if (!cancelled) {
          setStatus("success")
          setMessage("登录成功，正在跳转...")
          setTimeout(() => router.replace(redirectPath || "/"), 200)
        }
      } catch (error) {
        console.error("[Auth Callback] OAuth exchange failed:", error)
        if (!cancelled) {
          setStatus("error")
          setMessage("登录失败，请重试。")
          setTimeout(() => router.replace("/login"), 1200)
        }
      }
    }

    completeOAuth()

    return () => {
      cancelled = true
    }
  }, [code, redirectPath, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>正在完成登录</CardTitle>
          <CardDescription>We are finalizing your sign-in, please wait.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <LoadingSpinner />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {status === "error" && (
            <Button variant="outline" onClick={() => router.replace("/login")}>
              返回登录
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
