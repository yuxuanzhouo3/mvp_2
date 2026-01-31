import { currentRegion } from "./deployment.config"

export interface SupportInfo {
  appName: string
  logoPath: string
  supportEmail: string
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

export function getSupportInfo(): SupportInfo {
  const defaultLogoPath = currentRegion === "CN" ? "/logo1.png" : "/logo0.png"

  const appName = normalizeOptional(process.env.NEXT_PUBLIC_SUPPORT_APP_NAME) ?? "MultiGPT"
  const logoPath = normalizeOptional(process.env.NEXT_PUBLIC_SUPPORT_LOGO) ?? defaultLogoPath
  const supportEmail =
    normalizeOptional(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) ?? "support@mornscience.top"

  return {
    appName,
    logoPath,
    supportEmail,
  }
}
