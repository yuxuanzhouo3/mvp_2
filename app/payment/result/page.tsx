"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchParamsBoundary } from "@/components/search-params-boundary"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useHideSubscriptionUI } from "@/hooks/use-hide-subscription-ui"

type PaymentStatus = "loading" | "success" | "failed" | "unknown"

function PaymentResultContent() {
  const router = useRouter()
  const hideSubscriptionUI = useHideSubscriptionUI()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<PaymentStatus>("loading")
  const [message, setMessage] = useState("正在验证支付结果...")
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string
    amount?: string
    tradeNo?: string
  }>({})

  // 刷新用户订阅状态
  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      // 尝试刷新用户资料以获取最新订阅状态
      const response = await fetch("/api/profile")
      if (response.ok) {
        const profile = await response.json()
        // 更新本地存储的用户状态
        if (typeof window !== "undefined") {
          try {
            const authState = localStorage.getItem("app-auth-state")
            if (authState) {
              const state = JSON.parse(authState)
              if (state.user) {
                state.user.metadata = {
                  ...state.user.metadata,
                  pro: profile.pro || profile.subscription?.status === "active",
                  plan: profile.plan || profile.subscription?.plan_type || "free",
                  plan_exp: profile.plan_exp || profile.subscription?.subscription_end,
                }
                localStorage.setItem("app-auth-state", JSON.stringify(state))
              }
            }
          } catch (e) {
            console.warn("更新本地订阅状态失败:", e)
          }
        }
      }
    } catch (error) {
      console.error("刷新订阅状态失败:", error)
    }
  }, [])

  useEffect(() => {
    // 从 URL 参数中获取支付宝返回的信息
    const outTradeNo = searchParams.get("out_trade_no")
    const tradeNo = searchParams.get("trade_no")
    const totalAmount = searchParams.get("total_amount")
    const method = searchParams.get("method")

    setOrderInfo({
      orderId: outTradeNo || undefined,
      amount: totalAmount || undefined,
      tradeNo: tradeNo || undefined,
    })

    // 判断支付结果
    // 支付宝同步回调的 method 参数为 alipay.trade.page.pay.return 表示支付完成
    if (method === "alipay.trade.page.pay.return" && outTradeNo && tradeNo) {
      // 支付成功（同步回调只能初步判断，实际以异步通知为准）
      setStatus("success")
      setMessage(hideSubscriptionUI ? "支付成功！感谢您的支持" : "支付成功！感谢您的订阅")

      // 刷新用户订阅状态
      refreshSubscriptionStatus()
    } else if (!outTradeNo) {
      // 没有订单号，可能是直接访问此页面
      setStatus("unknown")
      setMessage("未找到支付信息")
    } else {
      // 其他情况，可能支付未完成
      setStatus("failed")
      setMessage("支付未完成或已取消")
    }
  }, [hideSubscriptionUI, refreshSubscriptionStatus, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {status === "loading" && (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            {(status === "failed" || status === "unknown") && (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === "loading" && "处理中..."}
            {status === "success" && "支付成功"}
            {status === "failed" && "支付未完成"}
            {status === "unknown" && "未知状态"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 订单信息 */}
          {orderInfo.orderId && (
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">订单号</span>
                <span className="font-mono">{orderInfo.orderId}</span>
              </div>
              {orderInfo.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">支付金额</span>
                  <span className="font-semibold">¥{orderInfo.amount}</span>
                </div>
              )}
              {orderInfo.tradeNo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">交易号</span>
                  <span className="font-mono text-xs">{orderInfo.tradeNo}</span>
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={() => router.push("/")} className="w-full">
              返回首页
            </Button>
            {status === "success" && !hideSubscriptionUI && (
              <Button
                variant="outline"
                onClick={() => router.push("/settings")}
                className="w-full"
              >
                查看订阅详情
              </Button>
            )}
            {status === "failed" && !hideSubscriptionUI && (
              <Button
                variant="outline"
                onClick={() => router.push("/pricing")}
                className="w-full"
              >
                重新订阅
              </Button>
            )}
          </div>

          {/* 提示信息 */}
          {status === "success" && !hideSubscriptionUI && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              订阅状态可能需要几分钟更新，如有问题请联系客服
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentResultPage() {
  return (
    <SearchParamsBoundary>
      <PaymentResultContent />
    </SearchParamsBoundary>
  )
}
