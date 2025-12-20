"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { isChinaRegion } from "@/lib/config/region"
import { SearchParamsBoundary } from "@/components/search-params-boundary"

type AuthStatus = "loading" | "success" | "error"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const errorParam = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const redirectPath = searchParams.get("redirect") || searchParams.get("next") || "/"

  const [status, setStatus] = useState<AuthStatus>("loading")
  const [message, setMessage] = useState("正在完成登录，请稍候...")

  useEffect(() => {
    let cancelled = false

    const completeOAuth = async () => {
      // 中国区域：处理微信 OAuth 回调
      if (isChinaRegion()) {
        try {
          // 如果有错误参数
          if (errorParam) {
            const displayError = errorDescription || "微信授权失败"
            setStatus("error")
            setMessage(displayError)
            setTimeout(() => router.replace("/login"), 1500)
            return
          }

          // 如果没有授权码
          if (!code) {
            setStatus("error")
            setMessage("缺少微信授权码")
            setTimeout(() => router.replace("/login"), 1500)
            return
          }

          console.log("[WeChat Callback] Processing code:", code.substring(0, 10) + "...")

          // 解析 state 参数获取 next 路径
          let nextTarget = "/"
          if (stateParam) {
            try {
              const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString())
              nextTarget = stateData.next || "/"
            } catch (e) {
              console.warn("[WeChat Callback] Failed to parse state:", e)
            }
          }

          // 调用后端 API 完成微信登录
          const response = await fetch("/api/auth/wechat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, state: stateParam }),
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            console.error("[WeChat Callback] Login failed:", data)
            setStatus("error")
            setMessage(data.error || "微信登录失败，请重试")
            setTimeout(() => router.replace("/login"), 1500)
            return
          }

          console.log("[WeChat Callback] Login successful, user:", data.user?.id)

          // 保存认证状态到 localStorage
          if (data.accessToken && data.user) {
            try {
              const { saveAuthState } = await import("@/lib/auth/auth-state-manager")
              saveAuthState(
                data.accessToken,
                data.refreshToken || data.accessToken,
                data.user,
                data.tokenMeta || {
                  accessTokenExpiresIn: 3600,
                  refreshTokenExpiresIn: 604800,
                }
              )
            } catch (error) {
              console.error("[WeChat Callback] Failed to save auth state:", error)
            }
          }

          if (!cancelled) {
            setStatus("success")
            setMessage("登录成功，正在跳转...")
            setTimeout(() => router.replace(nextTarget), 200)
          }
        } catch (error) {
          console.error("[WeChat Callback] Error:", error)
          if (!cancelled) {
            setStatus("error")
            setMessage("登录失败，请重试。")
            setTimeout(() => router.replace("/login"), 1200)
          }
        }
        return
      }

      // 国际区域：处理 Supabase OAuth 回调
      try {
        if (errorParam) {
          const displayError =
            errorDescription ||
            searchParams.get("error_code") ||
            "Authentication failed";
          setStatus("error");
          setMessage(displayError);
          setTimeout(() => router.replace("/login"), 1500);
          return;
        }

        const [{ supabase }, { saveSupabaseUserCache }] = await Promise.all([
          import("@/lib/integrations/supabase"),
          import("@/lib/auth/auth-state-manager-intl"),
        ])

        // Try to reuse an existing session first
        let {
          data: { session },
        } = await supabase.auth.getSession()

        // If still no session, handle hash-based tokens or explicit code exchange
        if (!session) {
          // Handle implicit flow fragments if present
          if (typeof window !== "undefined" && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.slice(1))
            const accessToken = hashParams.get("access_token")
            const refreshToken = hashParams.get("refresh_token")

            if (accessToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || "",
              })
              if (error) throw error
              session = data.session
            }
          }

          // If no hash tokens, try code exchange (default PKCE flow)
          if (!session) {
            if (!code) {
              throw new Error("Missing OAuth code or access token in callback URL")
            }
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              throw error
            }
            session = data.session
          }
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
  }, [code, stateParam, redirectPath, router, errorParam, errorDescription, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>正在完成登录</CardTitle>
          <CardDescription>We are finalizing your sign-in, please wait.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status === "loading" && <LoadingSpinner />}
            {status === "success" && <SuccessIcon />}
            {status === "error" && <ErrorIcon />}
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

function SuccessIcon() {
  return (
    <svg
      className="h-4 w-4 text-green-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg
      className="h-4 w-4 text-red-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

export default function AuthCallbackPage() {
  return (
    <SearchParamsBoundary>
      <AuthCallbackContent />
    </SearchParamsBoundary>
  );
}
