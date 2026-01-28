import { currentRegion } from "./deployment.config"

export type SiteRegion = "CN" | "INTL"

export interface SiteInfo {
  region: SiteRegion
  appName: string
  ownerName: string
  contactEmail: string
  contactPhone?: string
  contactAddress?: string
  icpBeian?: string
  copyright?: string
}

const cnDefaults: SiteInfo = {
  region: "CN",
  appName: "辰汇个性推荐",
  ownerName: "辰汇个性推荐",
  contactEmail: "mornscience@gmail.com",
  contactPhone: "",
  contactAddress: "",
  icpBeian: "粤ICP备2024281756号-3",
  copyright: `© ${new Date().getFullYear()} 辰汇个性推荐`,
}

const intlDefaults: SiteInfo = {
  region: "INTL",
  appName: "RandomLife-DailyDiscovory",
  ownerName: "RandomLife-DailyDiscovory",
  contactEmail: "mornscience@gmail.com",
  contactPhone: "",
  contactAddress: "",
  icpBeian: "",
  copyright: `© ${new Date().getFullYear()} RandomLife-DailyDiscovory`,
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

function applyEnvOverrides(base: SiteInfo): SiteInfo {
  const ownerName = normalizeOptional(process.env.NEXT_PUBLIC_SITE_OWNER_NAME) ?? base.ownerName
  const contactEmail =
    normalizeOptional(process.env.NEXT_PUBLIC_SITE_CONTACT_EMAIL) ?? base.contactEmail
  const contactPhone = normalizeOptional(process.env.NEXT_PUBLIC_SITE_CONTACT_PHONE)
  const contactAddress = normalizeOptional(process.env.NEXT_PUBLIC_SITE_CONTACT_ADDRESS)
  const icpBeian = normalizeOptional(process.env.NEXT_PUBLIC_SITE_ICP_BEIAN) ?? base.icpBeian
  const copyright = normalizeOptional(process.env.NEXT_PUBLIC_SITE_COPYRIGHT) ?? base.copyright

  return {
    ...base,
    ownerName,
    contactEmail,
    contactPhone,
    contactAddress,
    icpBeian,
    copyright,
  }
}

export function getSiteInfo(): SiteInfo {
  const region: SiteRegion = currentRegion === "CN" ? "CN" : "INTL"
  const base = region === "CN" ? cnDefaults : intlDefaults
  return applyEnvOverrides(base)
}
