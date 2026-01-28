import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MapPin, MessageSquareText, Phone, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSiteInfo } from "@/lib/config/site-info"
import { MarketingShell } from "@/components/marketing/MarketingShell"

export const metadata: Metadata = {
  title: "联系我们",
  description: "联系方式、服务信息与反馈渠道",
}

export default function ContactPage() {
  const site = getSiteInfo()
  const isChina = site.region === "CN"
  const commonBody = isChina
    ? "请描述问题/建议，并尽量提供：账号邮箱、发生时间、页面截图（如有）。"
    : "Please describe your issue/suggestion and include account email, time, and screenshots (if any)."

  const mailto = (subject: string, body: string) => {
    const params = new URLSearchParams({
      subject,
      body,
    })
    return `mailto:${site.contactEmail}?${params.toString()}`
  }

  return (
    <MarketingShell
      backLabel={isChina ? "返回首页" : "Back to Home"}
      title={isChina ? "联系我们" : "Contact"}
      description={
        isChina
          ? "如需客服支持、问题反馈或投诉建议，可通过以下方式联系我们。"
          : "For support, feedback, or complaints, please reach us via the channels below."
      }
      maxWidthClassName="max-w-4xl"
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/privacy">{isChina ? "用户协议与隐私政策" : "Legal & Privacy"}</Link>
          </Button>
          <Button asChild>
            <a href={mailto(isChina ? "客服咨询" : "Support", commonBody)} aria-label={`Email ${site.contactEmail}`}>
              {isChina ? "发送邮件" : "Email Us"}
            </a>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{isChina ? "邮箱" : "Email"}</h2>
              <p className="mt-1 text-sm text-muted-foreground break-all">{site.contactEmail}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button asChild variant="outline" size="sm">
                  <a href={mailto(isChina ? "问题反馈" : "Feedback", commonBody)}>
                    {isChina ? "问题反馈" : "Feedback"}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={mailto(isChina ? "隐私请求（访问/更正/删除）" : "Privacy Request", commonBody)}>
                    {isChina ? "隐私请求" : "Privacy Request"}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={mailto(isChina ? "投诉建议" : "Complaint", commonBody)}>
                    {isChina ? "投诉建议" : "Complaint"}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <MessageSquareText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{isChina ? "联系场景" : "Common Topics"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isChina
                    ? "建议在邮件标题中注明“问题类型”，并附上账号信息与截图，便于快速处理。"
                    : "Please include topic, account info, and screenshots in your email for faster support."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{isChina ? "个人信息权利" : "Privacy Rights"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isChina
                    ? "账号与个人信息相关请求的处理规则与时效，请以《隐私政策》说明为准。"
                    : "For privacy requests and timelines, please refer to our Privacy Policy."}
                </p>
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/privacy">{isChina ? "查看隐私政策" : "View Privacy Policy"}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!!site.contactPhone && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{isChina ? "电话" : "Phone"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{site.contactPhone}</p>
              </div>
            </div>
          </div>
        )}

        {!!site.contactAddress && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{isChina ? "联系地址" : "Address"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{site.contactAddress}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/50 p-6">
          <h2 className="text-lg font-semibold">{isChina ? "处理时效" : "Response Time"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isChina
              ? "我们通常会在 1-3 个工作日内回复邮件。"
              : "We typically respond within 1-3 business days."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/about">{isChina ? "了解产品" : "About the Product"}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/download">{isChina ? "下载客户端" : "Download"}</Link>
            </Button>
          </div>
        </div>
      </div>
    </MarketingShell>
  )
}
