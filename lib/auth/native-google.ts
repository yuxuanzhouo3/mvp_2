import { isAppContainer } from "@/lib/app/app-container"
import { saveSupabaseUserCache } from "@/lib/auth/auth-state-manager-intl"
import { supabase } from "@/lib/integrations/supabase"

type NativeGoogleAccount = {
  idToken?: string
  email?: string
  displayName?: string
}

type NativeGoogleSignInResult = {
  success?: boolean
  status?: string
  errorCode?: string
  errorMessage?: string
  idToken?: string
  account?: NativeGoogleAccount
}

type NativeGoogleSignOutResult = {
  success?: boolean
  status?: string
  errorCode?: string
  errorMessage?: string
}

type NativeGoogleSignInParams = {
  serverClientId: string
}

type NativeGoogleSignOutParams = {
  revokeAccess?: boolean
}

type NativeGoogleSignInFn = (
  params: NativeGoogleSignInParams
) => Promise<NativeGoogleSignInResult>

type NativeGoogleSignOutFn = (
  params?: NativeGoogleSignOutParams
) => Promise<NativeGoogleSignOutResult>

type MedianLikeAuth = {
  auth?: {
    googleSignIn?: NativeGoogleSignInFn
    googleSignOut?: NativeGoogleSignOutFn
  }
}

declare global {
  interface Window {
    median?: MedianLikeAuth
    gonative?: MedianLikeAuth
  }
}

function getNativeGoogleSignInFn(): NativeGoogleSignInFn | null {
  if (typeof window === "undefined") return null

  const medianSignIn = window.median?.auth?.googleSignIn
  if (typeof medianSignIn === "function") return medianSignIn

  const goNativeSignIn = window.gonative?.auth?.googleSignIn
  if (typeof goNativeSignIn === "function") return goNativeSignIn

  return null
}

function getNativeGoogleSignOutFn(): NativeGoogleSignOutFn | null {
  if (typeof window === "undefined") return null

  const medianSignOut = window.median?.auth?.googleSignOut
  if (typeof medianSignOut === "function") return medianSignOut

  const goNativeSignOut = window.gonative?.auth?.googleSignOut
  if (typeof goNativeSignOut === "function") return goNativeSignOut

  return null
}

function isNativeGoogleSignInEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENABLE_NATIVE_GOOGLE_SIGN_IN
  if (!raw) return true

  const value = raw.trim().toLowerCase()
  return !(
    value === "0" ||
    value === "false" ||
    value === "off" ||
    value === "no"
  )
}

function getGoogleServerClientId(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_SERVER_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ""
  ).trim()
}

function extractIdToken(result: NativeGoogleSignInResult): string {
  const token = result.idToken || result.account?.idToken || ""
  return token.trim()
}

function getNativeErrorMessage(
  result: NativeGoogleSignInResult | NativeGoogleSignOutResult,
  fallbackMessage: string
): string {
  return (
    result.errorMessage ||
    result.errorCode ||
    fallbackMessage
  )
}

export function canUseNativeGoogleSignIn(): boolean {
  return (
    isNativeGoogleSignInEnabled() &&
    isAppContainer() &&
    Boolean(getNativeGoogleSignInFn())
  )
}

export async function signInWithNativeGoogleForSupabase(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Native Google sign-in is only available in browser runtime")
  }

  if (!isAppContainer()) {
    throw new Error("Native Google sign-in is only available inside the app")
  }

  const nativeSignIn = getNativeGoogleSignInFn()
  if (!nativeSignIn) {
    throw new Error("App native bridge is unavailable for Google sign-in")
  }

  const serverClientId = getGoogleServerClientId()
  if (!serverClientId) {
    throw new Error(
      "Missing NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID for native Google sign-in"
    )
  }

  const nativeResult = await nativeSignIn({ serverClientId })

  if (
    !nativeResult ||
    nativeResult.success === false ||
    nativeResult.status === "error"
  ) {
    throw new Error(
      getNativeErrorMessage(
        nativeResult || {},
        "Google sign-in failed inside the app"
      )
    )
  }

  const idToken = extractIdToken(nativeResult)
  if (!idToken) {
    throw new Error("Native Google sign-in did not return an ID token")
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  })

  if (error || !data.session?.access_token) {
    throw new Error(error?.message || "Failed to create Supabase session")
  }

  try {
    const profileResponse = await fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    })

    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as {
        id?: string
        email?: string
        name?: string
        avatar?: string
        subscription_plan?: string
        subscription_status?: string
        membership_expires_at?: string
      }

      if (profile.id && profile.email) {
        saveSupabaseUserCache({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          subscription_plan: profile.subscription_plan,
          subscription_status: profile.subscription_status,
          membership_expires_at: profile.membership_expires_at,
        })
      }
    }
  } catch (error) {
    console.warn("[native-google] failed to refresh profile cache:", error)
  }
}

export async function signOutFromNativeGoogle(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  if (!isAppContainer()) {
    return false
  }

  const nativeSignOut = getNativeGoogleSignOutFn()
  if (!nativeSignOut) {
    return false
  }

  try {
    const nativeResult = await nativeSignOut()

    if (
      nativeResult &&
      (nativeResult.success === false || nativeResult.status === "error")
    ) {
      console.warn(
        "[native-google] native Google sign-out returned an error:",
        getNativeErrorMessage(
          nativeResult,
          "Google sign-out failed inside the app"
        )
      )
      return false
    }

    return true
  } catch (error) {
    console.warn("[native-google] native Google sign-out failed:", error)
    return false
  }
}
