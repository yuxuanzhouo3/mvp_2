import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import Script from "next/script"
import { headers } from "next/headers"
import "./globals.css"
import AuthProvider from "@/components/auth-provider"
import { DeviceProvider } from "@/components/device-provider"
import { LanguageProvider } from "@/components/language-provider"
import { Toaster } from "@/components/ui/toaster"
import { MpLinkInterceptor } from "@/components/mp-link-interceptor"
import { getSiteInfo } from "@/lib/config/site-info"

const inter = Inter({ subsets: ["latin"] })

// 根据部署环境动态设置网站名称和图标
const isCN = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN"

export const metadata: Metadata = {
  title: isCN ? "辰汇个性推荐" : "RandomLife-DailyDiscovory",
  description: isCN
    ? "辰汇个性推荐 - AI驱动的个性化推荐服务"
    : "Discover something new every day with AI-powered recommendations",
  generator: 'v0.dev',
  icons: {
    icon: isCN ? '/logo1.png' : '/logo0.png',
    apple: isCN ? '/logo1.png' : '/logo0.png',
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userAgent = headers().get("user-agent") ?? ""
  const initialIsIPhone = /iphone/i.test(userAgent)
  const site = getSiteInfo()

  return (
    <html lang="en">
      <head>
        {/* 微信 JSSDK - 用于小程序 WebView 中调用 wx.miniProgram API */}
        {isCN && (
          <Script
            src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className={inter.className}>
        <DeviceProvider initialIsIPhone={initialIsIPhone}>
          <LanguageProvider>
            <AuthProvider>
              {/* 微信小程序外部链接拦截器 - 仅 CN 环境启用 */}
              {isCN && <MpLinkInterceptor />}
              <div className="min-h-screen bg-[#F7F9FC]">{children}</div>
              <Toaster />
              {isCN && (
                <footer className="w-full py-5 px-4 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                  <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Link href="/privacy" className="hover:text-foreground transition-colors">
                        法律与政策
                      </Link>
                      <Link href="/about" className="hover:text-foreground transition-colors">
                        关于我们
                      </Link>
                      <Link href="/contact" className="hover:text-foreground transition-colors">
                        联系我们
                      </Link>
                      {site.icpBeian && (
                        <a
                          href="https://beian.miit.gov.cn/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground transition-colors"
                        >
                          {site.icpBeian}
                        </a>
                      )}
                    </div>

                    <div className="text-muted-foreground/70 flex flex-col gap-1 sm:items-end">
                      <span>本页面含AI生成的内容，请仔细辨别</span>
                      {site.copyright && <span>{site.copyright}</span>}
                    </div>
                  </div>
                </footer>
              )}
            </AuthProvider>
          </LanguageProvider>
        </DeviceProvider>
      </body>
    </html>
  )
}
