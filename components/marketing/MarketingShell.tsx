import type React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function MarketingShell({
  backHref = "/",
  backLabel,
  title,
  description,
  actions,
  children,
  maxWidthClassName = "max-w-5xl",
}: {
  backHref?: string
  backLabel: string
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  maxWidthClassName?: string
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className={`container mx-auto px-4 pb-16 ${maxWidthClassName}`}>
        <div className="pt-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="px-6 py-10 sm:px-10 bg-gradient-to-br from-muted/50 via-background to-muted/30">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="mt-3 text-base sm:text-lg text-muted-foreground">{description}</p> : null}
            {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
          </div>
          <Separator />
          <div className="px-6 py-10 sm:px-10">{children}</div>
        </div>
      </div>
    </div>
  )
}

