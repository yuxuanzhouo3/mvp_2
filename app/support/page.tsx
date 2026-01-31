import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getSupportInfo } from "@/lib/config/support-info"
import { currentRegion } from "@/lib/config/deployment.config"
import { getTranslations, type Language } from "@/lib/i18n"

export function generateMetadata(): Metadata {
  const support = getSupportInfo()
  return {
    title: `Support - ${support.appName}`,
  }
}

function resolveLanguage(lang: unknown): Language {
  if (lang === "zh" || lang === "en") return lang
  return currentRegion === "CN" ? "zh" : "en"
}

export default function SupportPage({
  searchParams,
}: {
  searchParams?: { lang?: string }
}) {
  const language = resolveLanguage(searchParams?.lang)
  const supportInfo = getSupportInfo()
  const t = getTranslations(language).support

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src={supportInfo.logoPath}
              alt={`${supportInfo.appName} Logo`}
              width={40}
              height={40}
              priority
              className="rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {supportInfo.appName} {t.title}
              </h1>
              <p className="text-sm text-muted-foreground">{t.intro}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/support?lang=zh"
              className={
                language === "zh"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              中文
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href="/support?lang=en"
              className={
                language === "en"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              EN
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-card text-card-foreground rounded-lg shadow-sm p-6 border border-border">
          <h2 className="text-lg font-semibold">{t.contact.title}</h2>
          <div className="mt-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-medium text-foreground">{t.contact.emailLabel}:</span>
              <a
                href={`mailto:${supportInfo.supportEmail}`}
                className="text-primary hover:opacity-90 transition-opacity break-all"
              >
                {supportInfo.supportEmail}
              </a>
            </div>
            <p className="mt-2 text-muted-foreground">{t.contact.responseTime}</p>
          </div>
        </div>

        <div className="mt-6 bg-card text-card-foreground rounded-lg shadow-sm p-6 border border-border">
          <h2 className="text-lg font-semibold">{t.faq.title}</h2>
          <div className="mt-4 space-y-4 text-sm">
            {t.faq.items.map((item) => (
              <div key={item.q} className="rounded-md border border-border p-4 bg-muted/30">
                <p className="font-medium text-foreground">Q: {item.q}</p>
                <p className="mt-2 text-muted-foreground">A: {item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
