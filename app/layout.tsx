import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import AuthProvider from "@/components/auth-provider"
import { LanguageProvider } from "@/components/language-provider"
import { Toaster } from "@/components/ui/toaster"
import { MpLinkInterceptor } from "@/components/mp-link-interceptor"

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
        <LanguageProvider>
          <AuthProvider>
            {/* 微信小程序外部链接拦截器 - 仅 CN 环境启用 */}
            {isCN && <MpLinkInterceptor />}
            <div className="min-h-screen bg-[#F7F9FC]">{children}</div>
            <Toaster />
            {/* CN环境页脚备案信息 */}
            {isCN && (
              <footer className="w-full py-4 px-4 text-center text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                <p>本页面含AI生成的内容，请仔细辨别</p>
                <p className="mt-1">
                  <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-600 transition-colors"
                  >
                    粤ICP备2024281756号-3
                  </a>
                </p>
              </footer>
            )}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
