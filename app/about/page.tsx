import type { Metadata } from "next"
import Link from "next/link"
import { Shield, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSiteInfo } from "@/lib/config/site-info"
import { MarketingShell } from "@/components/marketing/MarketingShell"

export const metadata: Metadata = {
  title: "关于我们",
  description: "应用介绍、功能说明与运营主体信息",
}

export default function AboutPage() {
  const site = getSiteInfo()
  const isChina = site.region === "CN"

  return (
    <MarketingShell
      backLabel={isChina ? "返回首页" : "Back to Home"}
      title={isChina ? "关于我们" : "About"}
      description={
        isChina
          ? `欢迎使用 ${site.appName}。我们致力于为用户提供 AI 驱动的个性化推荐服务。`
          : `Welcome to ${site.appName}. We provide AI-powered personalized recommendation experiences.`
      }
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/privacy">{isChina ? "用户协议与隐私政策" : "Legal & Privacy"}</Link>
          </Button>
          <Button asChild>
            <Link href="/contact">{isChina ? "联系我们" : "Contact"}</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-10">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{isChina ? "产品定位" : "Product"}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isChina
                ? "通过 AI 推荐与多场景分类，帮助用户更高效地发现有价值的信息与服务。"
                : "Help users discover valuable content and services via AI recommendations and multi-category scenarios."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{isChina ? "适用人群" : "Audience"}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isChina
                ? "希望获得个性化推荐、减少决策成本、提升体验的用户。"
                : "Users who want personalized recommendations, lower decision cost, and a smoother experience."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{isChina ? "安全与合规" : "Security"}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isChina
                ? "我们重视个人信息保护与服务安全，详细规则请见《隐私政策》《服务条款》。"
                : "We take privacy and service security seriously. Please refer to our Privacy Policy and Terms."}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{isChina ? "应用介绍" : "Introduction"}</h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="font-medium">{isChina ? "核心能力" : "Core Capabilities"}</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
                <li>{isChina ? "AI 个性化推荐" : "AI personalized recommendations"}</li>
                <li>{isChina ? "多类别场景（娱乐/购物/美食/旅行/健身等）" : "Multi-category scenarios"}</li>
                <li>{isChina ? "历史记录与偏好管理" : "History and preference management"}</li>
                <li>{isChina ? "用户画像与持续优化" : "User profiling and continuous improvement"}</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">{isChina ? "基础信息" : "Basic Info"}</h3>
              <dl className="text-sm grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                  <dt className="font-medium text-muted-foreground">{isChina ? "应用名称" : "App Name"}</dt>
                  <dd className="break-words">{site.appName}</dd>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                  <dt className="font-medium text-muted-foreground">{isChina ? "版权所有者/运营者" : "Owner/Operator"}</dt>
                  <dd className="break-words">{site.ownerName}</dd>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
                  <dt className="font-medium text-muted-foreground">{isChina ? "联系方式" : "Contact"}</dt>
                  <dd className="break-all">{site.contactEmail}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{isChina ? "产品展示" : "Product Showcase"}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isChina
              ? "以下为产品功能与服务内容的概览（具体以实际版本为准）："
              : "Below is an overview of features and service content (subject to the current product version):"}
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <h3 className="font-medium">{isChina ? "分类推荐" : "Category Recommendations"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isChina
                  ? "在多个类别中提供每日推荐，帮助你快速探索新内容。"
                  : "Daily recommendations across categories to help you explore faster."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <h3 className="font-medium">{isChina ? "偏好与画像" : "Preferences & Profile"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isChina
                  ? "通过偏好设置与画像完善，让推荐更贴近你的需求。"
                  : "Improve personalization via preference settings and profile completeness."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <h3 className="font-medium">{isChina ? "历史记录" : "History"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isChina
                  ? "查看与管理历史推荐，便于回溯与对比。"
                  : "Review and manage recommendation history for tracking and comparison."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <h3 className="font-medium">{isChina ? "客户端下载" : "Client Download"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isChina ? "提供多平台客户端下载入口，提升使用体验。" : "Download links for multiple platforms to improve experience."}
              </p>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/download">{isChina ? "前往下载" : "Download"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  )
}
