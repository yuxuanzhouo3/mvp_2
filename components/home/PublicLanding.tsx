"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Download,
  FileText,
  Globe,
  Mail,
  Shield,
  Sparkles,
  Users,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"
import { getSiteInfo } from "@/lib/config/site-info"

export function PublicLanding() {
  const site = getSiteInfo()
  const isChina = site.region === "CN"
  const { language, toggleLanguage } = useLanguage()
  const t = useTranslations(language)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-20 pt-3 pb-5 bg-gradient-to-br from-gray-50/95 via-white/95 to-gray-50/95 backdrop-blur">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/85 backdrop-blur-sm shadow-sm">
            <div
              className="pointer-events-none absolute inset-0 border border-white/60 rounded-2xl"
              aria-hidden="true"
            />
            <div className="px-4 pt-3 pb-2 flex justify-center">
              <div className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/30 w-full max-w-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors"
                  onClick={toggleLanguage}
                  title={t.header.switchLanguage}
                >
                  <Globe className="h-4 w-4 text-gray-600" />
                </Button>

                <Link href="/download">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors"
                    title={t.header.download || "Download"}
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                  </Button>
                </Link>

                <Link href="/login">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-shrink-0 text-gray-600 hover:text-gray-800 hover:bg-white/30 transition-all"
                  >
                    {isChina ? "登录" : t.auth.login}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="flex-shrink-0 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-all"
                  >
                    {isChina ? "开始使用" : t.auth.register}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="px-5 py-4">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-sm flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                  </span>
                  <div className="min-w-0 text-center">
                    <h1 className="text-2xl font-bold text-gray-800">{site.appName}</h1>
                    <p className="text-gray-600 text-sm">
                      {isChina
                        ? "AI 驱动的个性化推荐服务"
                        : "AI-powered personalized recommendations"}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-sm flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex-1 h-px bg-gray-200" />
          <p className="text-gray-500 text-sm font-light tracking-wide px-2 bg-gradient-to-br from-gray-50 via-white to-gray-50">
            {isChina ? "了解产品与服务信息" : "Product & Service Info"}
          </p>
          <div className="flex-1 h-px bg-gray-200" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div id="features" className="grid grid-cols-1 gap-4">
            <Card className="p-6 border-0 overflow-hidden relative hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 border border-gray-200 shadow-sm">
                  <Users className="h-5 w-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-800">{isChina ? "多场景推荐" : "Multi-scenarios"}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isChina
                      ? "覆盖娱乐、购物、美食、旅行、健身等常用场景，快速找到更合适的选择。"
                      : "Entertainment, shopping, food, travel, fitness and more."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 overflow-hidden relative hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 border border-gray-200 shadow-sm">
                  <Sparkles className="h-5 w-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-800">{isChina ? "个性化画像" : "Personalization"}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isChina
                      ? "基于偏好与使用数据持续优化推荐结果，让内容更贴近你。"
                      : "Continuously improves recommendations based on preferences and usage."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 overflow-hidden relative hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-teal-400 opacity-10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 border border-gray-200 shadow-sm">
                  <Shield className="h-5 w-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-800">{isChina ? "合规与安全" : "Compliance"}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isChina
                      ? "我们重视个人信息保护与服务安全，相关规则在法律与政策页面公开展示。"
                      : "We take privacy and security seriously. Policies are publicly available."}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6 border-0 overflow-hidden relative">
            <div className="relative">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{isChina ? "基础服务信息" : "Service Info"}</h2>
              <dl className="text-sm text-gray-600 grid grid-cols-1 gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                  <dt className="font-medium text-gray-800">{isChina ? "版权所有者/运营者" : "Owner/Operator"}</dt>
                  <dd className="break-words">{site.ownerName}</dd>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                  <dt className="font-medium text-gray-800">{isChina ? "联系邮箱" : "Email"}</dt>
                  <dd className="break-all">{site.contactEmail}</dd>
                </div>
                {isChina && site.icpBeian ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                    <dt className="font-medium text-gray-800">{isChina ? "网站备案" : "ICP"}</dt>
                    <dd>
                      <a
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {site.icpBeian}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link href="/privacy">
                    {isChina ? "用户协议/隐私政策" : "Legal"} <FileText className="w-4 h-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/contact">
                    {isChina ? "联系我们" : "Contact"} <Mail className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-0">
            <div id="faq" className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">FAQ</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isChina ? "常见问题" : "Common questions"}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>{isChina ? "这是一个什么产品？" : "What is this product?"}</AccordionTrigger>
                  <AccordionContent className="text-gray-600">
                    {isChina
                      ? "这是一个 AI 驱动的个性化推荐服务平台，围绕不同生活场景提供推荐内容，帮助用户降低决策成本。"
                      : "An AI-powered personalized recommendation service across multiple scenarios."}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>{isChina ? "如何查看用户协议与隐私政策？" : "Where are the legal policies?"}</AccordionTrigger>
                  <AccordionContent className="text-gray-600">
                    <Link href="/privacy" className="text-blue-600 hover:text-blue-700 transition-colors">
                      {isChina ? "点击进入《法律与政策》页面" : "Open Legal & Policies"}
                    </Link>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>{isChina ? "如何联系客服/提交投诉？" : "How to contact support?"}</AccordionTrigger>
                  <AccordionContent className="text-gray-600">
                    <Link href="/contact" className="text-blue-600 hover:text-blue-700 transition-colors">
                      {isChina ? "点击进入《联系我们》页面" : "Open Contact"}
                    </Link>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>{isChina ? "如何删除账号或个人信息？" : "How to delete account/data?"}</AccordionTrigger>
                  <AccordionContent className="text-gray-600">
                    {isChina
                      ? "请参见《隐私政策》中“您的权利”章节说明，或通过“联系我们”页面提交删除/注销请求。"
                      : "Refer to the Privacy Policy and contact support for deletion requests."}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
