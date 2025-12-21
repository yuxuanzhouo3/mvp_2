import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/auth-provider"
import { LanguageProvider } from "@/components/language-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

// 根据部署环境动态设置网站名称和图标
const isCN = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN"

export const metadata: Metadata = {
  title: isCN ? "辰汇个性推荐平台" : "RandomLife-DailyDiscovory",
  description: isCN
    ? "辰汇个性推荐平台 - AI驱动的个性化推荐服务"
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
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          <AuthProvider>
            <div className="min-h-screen bg-[#F7F9FC]">{children}</div>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
