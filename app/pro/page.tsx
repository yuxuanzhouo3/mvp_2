"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Check, Crown, Zap, Building2, CreditCard, ArrowLeft, Loader2, Settings, Info, Sparkles, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { StripeCheckoutDialog } from "@/components/payment/stripe-checkout-dialog"
import { CNPaymentDialog } from "@/components/payment/cn-payment-dialog"
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth"
import { isChinaDeployment } from "@/lib/config/deployment.config"
import { isMiniProgram } from "@/lib/wechat-mp"

type PaymentMethodINTL = "stripe" | "paypal"
type PaymentMethodCN = "wechat" | "alipay"
type PaymentMethod = PaymentMethodINTL | PaymentMethodCN
type Tier = "free" | "pro" | "enterprise"
type BillingCycle = "monthly" | "yearly"

// 获取当前环境
const isCN = isChinaDeployment()

// 定价配置
const PRICING = {
  INTL: {
    pro: { monthly: 2.99, yearly: 29.99 },
    enterprise: { monthly: 6.99, yearly: 69.99 },
    currency: "USD",
    symbol: "$",
  },
  CN: {
    pro: { monthly: 19.9, yearly: 199 },
    enterprise: { monthly: 49.9, yearly: 499 },
    currency: "CNY",
    symbol: "¥",
  },
}

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const t = useTranslations(language)

  // 检测微信小程序环境
  const [isInMiniProgram, setIsInMiniProgram] = useState(false)

  // 根据环境选择默认支付方式
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(
    isCN ? "wechat" : "stripe"
  )
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly")
  const [processingPlan, setProcessingPlan] = useState<Tier | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  
  // INTL Stripe 支付状态
  const [stripeCheckout, setStripeCheckout] = useState<{
    clientSecret: string
    orderId: string
    amount: number
    currency: string
    planName: string
    billingCycle: BillingCycle
  } | null>(null)
  const [isStripeDialogOpen, setIsStripeDialogOpen] = useState(false)

  // CN 支付状态
  const [cnPayment, setCnPayment] = useState<{
    orderId: string
    qrCodeUrl?: string
    paymentUrl?: string
    mode: "qrcode" | "page"
    method: PaymentMethodCN
    amount: number
    currency: string
    planName: string
    billingCycle: BillingCycle
  } | null>(null)
  const [isCNDialogOpen, setIsCNDialogOpen] = useState(false)

  // 覆盖订阅层级（从服务器获取的最新值）
  const [overrideTier, setOverrideTier] = useState<Tier | null>(null)

  // 检测微信小程序环境并调整支付方式
  useEffect(() => {
    const inMiniProgram = isMiniProgram()
    setIsInMiniProgram(inMiniProgram)

    // 如果在小程序环境中，自动切换到微信支付（小程序环境使用 CN 支付方式）
    if (inMiniProgram && (selectedPayment === "stripe" || selectedPayment === "paypal")) {
      setSelectedPayment("wechat")
    }
  }, [])

  // 从服务器获取订阅状态，确保显示最新值
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!isAuthenticated || !user) return

      try {
        const response = await fetchWithAuth("/api/auth/refresh-subscription", {
          method: "POST",
        })

        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) return

        const data = await response.json()
        if (response.ok && data.success) {
          const planFromDb = data.subscription?.plan_type?.toLowerCase() || ""
          const planFromResponse = (data.subscriptionPlan || "").toLowerCase()

          let resolvedPlan: Tier = "free"
          if (planFromDb.includes("enterprise") || planFromResponse.includes("enterprise")) {
            resolvedPlan = "enterprise"
          } else if (planFromDb.includes("pro") || planFromResponse.includes("pro")) {
            resolvedPlan = "pro"
          }

          setOverrideTier(resolvedPlan)

          // 更新本地缓存
          if (isCN) {
            const { getStoredAuthState, saveAuthState } = await import("@/lib/auth/auth-state-manager")
            const authState = getStoredAuthState()
            if (authState && user) {
              const updatedUser = {
                ...authState.user,
                subscription_plan: resolvedPlan,
                subscription_status: data.subscriptionStatus,
              }
              saveAuthState(
                authState.accessToken,
                authState.refreshToken,
                updatedUser,
                authState.tokenMeta
              )
            }
          } else {
            const { saveSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl")
            if (user) {
              saveSupabaseUserCache({
                id: user.id,
                email: user.email || "",
                name: user.name,
                avatar: user.avatar,
                subscription_plan: resolvedPlan,
                subscription_status: data.subscriptionStatus,
              })
            }
          }
        }
      } catch (error) {
        console.error("[Pro Page] Failed to fetch subscription status:", error)
      }
    }

    fetchSubscriptionStatus()
    // 只依赖 user.id 而不是整个 user 对象，避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id])

  const currentTier = overrideTier ?? (user?.subscriptionTier || "free")
  
  // 获取当前定价配置（小程序环境使用 CN 版定价）
  const useCNPayment = isCN || isInMiniProgram
  const pricing = useCNPayment ? PRICING.CN : PRICING.INTL
  const currencySymbol = pricing.symbol

  const handleSubscribe = async (tier: Tier, billingCycle: "monthly" | "yearly" = "monthly") => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (tier === "free") {
      toast({
        title: t.pricing.alreadyOnFree,
        description: t.pricing.alreadyOnFreeDesc,
      })
      return
    }

    setProcessingPlan(tier)

    try {
      const amount = pricing[tier][billingCycle]
      const currency = pricing.currency
      const planName =
        tier === "pro"
          ? t.pricing.plans.pro.name
          : tier === "enterprise"
          ? t.pricing.plans.enterprise.name
          : t.pricing.plans.free.name

      // 根据环境选择不同的API端点（小程序环境使用 CN API）
      const apiEndpoint = useCNPayment ? "/api/payment/cn/create" : "/api/payment/create"

      // 支付宝使用电脑网站支付，微信使用二维码支付
      const paymentMode = selectedPayment === "alipay" ? "page" : "qrcode"

      const response = await fetchWithAuth(apiEndpoint, {
        method: "POST",
        body: JSON.stringify({
          method: selectedPayment,
          mode: paymentMode,
          amount,
          currency,
          planType: tier,
          billingCycle,
          description: `${billingCycle === "monthly" ? "1个月" : "1年"} ${tier.charAt(0).toUpperCase() + tier.slice(1)} 会员`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "支付创建失败")
      }

      if (useCNPayment) {
        // CN 环境或小程序环境 - 根据支付方式处理
        setProcessingPlan(null)

        if (data.paymentUrl) {
          // 电脑网站支付（支付宝）- 打开支付页面弹窗
          setCnPayment({
            orderId: data.orderId,
            paymentUrl: data.paymentUrl,
            mode: "page",
            method: selectedPayment as PaymentMethodCN,
            amount,
            currency,
            planName,
            billingCycle,
          })
          setIsCNDialogOpen(true)
          toast({
            title: "支付宝",
            description: "请在弹出的页面中完成支付",
          })
        } else if (data.qrCodeUrl) {
          // 二维码支付（微信）
          setCnPayment({
            orderId: data.orderId,
            qrCodeUrl: data.qrCodeUrl,
            mode: "qrcode",
            method: selectedPayment as PaymentMethodCN,
            amount,
            currency,
            planName,
            billingCycle,
          })
          setIsCNDialogOpen(true)
          toast({
            title: "微信支付",
            description: "请扫描二维码完成支付",
          })
        }
      } else {
        // INTL 环境
        if (selectedPayment === "paypal" && data.paymentUrl) {
          toast({
            title: "PayPal",
            description: language === "zh" ? "正在跳转到PayPal..." : "Redirecting to PayPal...",
          })
          setProcessingPlan(null)
          window.location.href = data.paymentUrl
        } else if (selectedPayment === "stripe" && data.clientSecret) {
          setProcessingPlan(null)
          setStripeCheckout({
            clientSecret: data.clientSecret,
            orderId: data.orderId || data.paymentIntentId || "",
            amount,
            currency,
            planName,
            billingCycle,
          })
          setIsStripeDialogOpen(true)
          toast({
            title: "Stripe",
            description: language === "zh" ? "请输入卡片信息完成支付" : "Complete your payment securely with Stripe",
          })
        }
      }
    } catch (error: any) {
      console.error("Subscription error:", error)
      toast({
        title: t.pricing.toast.error,
        description: error.message || t.pricing.toast.paymentFailed,
        variant: "destructive",
      })
    } finally {
      setProcessingPlan(null)
    }
  }

  const basePlans = [
    {
      id: "free" as Tier,
      name: t.pricing.plans.free.name,
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Zap,
      gradient: "from-slate-500 to-slate-600",
      lightGradient: "from-slate-50 to-slate-100",
      borderGradient: "from-slate-200 via-slate-300 to-slate-200",
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      features: t.pricing.plans.free.features,
    },
    {
      id: "pro" as Tier,
      name: t.pricing.plans.pro.name,
      monthlyPrice: pricing.pro.monthly,
      yearlyPrice: pricing.pro.yearly,
      icon: Crown,
      gradient: "from-blue-600 via-indigo-600 to-purple-600",
      lightGradient: "from-blue-50 via-indigo-50 to-purple-50",
      borderGradient: "from-blue-400 via-indigo-500 to-purple-500",
      iconBg: "bg-gradient-to-br from-blue-500 to-purple-600",
      iconColor: "text-white",
      popular: true,
      features: t.pricing.plans.pro.features,
    },
    {
      id: "enterprise" as Tier,
      name: t.pricing.plans.enterprise.name,
      monthlyPrice: pricing.enterprise.monthly,
      yearlyPrice: pricing.enterprise.yearly,
      icon: Building2,
      gradient: "from-amber-500 via-orange-500 to-rose-500",
      lightGradient: "from-amber-50 via-orange-50 to-rose-50",
      borderGradient: "from-amber-300 via-orange-400 to-rose-400",
      iconBg: "bg-gradient-to-br from-amber-500 to-rose-500",
      iconColor: "text-white",
      features: t.pricing.plans.enterprise.features,
    },
  ]

  const plans = basePlans.map(plan => ({
    ...plan,
    price: plan.id === "free" ? `${currencySymbol}0` : `${currencySymbol}${billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}`,
    period: plan.id === "free" ? "" : billingCycle === "monthly" ? "/月" : "/年",
    savings: billingCycle === "yearly" && plan.id !== "free" ? Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100) : 0,
  }))

  const faqItems = [
    { question: t.pricing.faq.switchPlans.question, answer: t.pricing.faq.switchPlans.answer },
    { question: t.pricing.faq.paymentMethods.question, answer: t.pricing.faq.paymentMethods.answer },
    { question: t.pricing.faq.freeTrial.question, answer: t.pricing.faq.freeTrial.answer },
  ]

  // 支付方式选项 - CN 版
  const cnPaymentMethods = [
    {
      id: "wechat" as PaymentMethodCN,
      name: "微信支付",
      description: "使用微信扫码支付",
      icon: (
        <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/>
          </svg>
        </div>
      ),
    },
    {
      id: "alipay" as PaymentMethodCN,
      name: "支付宝",
      description: "使用支付宝扫码支付",
      icon: (
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
            <path d="M21.422 15.358c-.598-.191-1.218-.374-1.857-.548a24.57 24.57 0 0 0 1.524-5.31h-4.073v-1.717h5.127V6.333h-5.127V4.25h-2.776v2.083H9.098v1.45h5.142v1.717H9.6v1.45h6.86a21.847 21.847 0 0 1-.917 3.19c-1.925-.433-3.91-.749-5.855-.749-3.178 0-5.117 1.342-5.117 3.408 0 2.066 1.939 3.408 5.117 3.408 2.365 0 4.456-.67 6.203-1.99a44.424 44.424 0 0 0 5.993 2.483l1.538-3.34z"/>
          </svg>
        </div>
      ),
    },
  ]

  // 支付方式选项 - INTL 版
  const intlPaymentMethods = [
    {
      id: "stripe" as PaymentMethodINTL,
      name: "Stripe",
      description: t.pricing.paymentMethod.creditCard,
      icon: (
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
          <CreditCard className="h-4 w-4 text-white" />
        </div>
      ),
    },
    {
      id: "paypal" as PaymentMethodINTL,
      name: "PayPal",
      description: t.pricing.paymentMethod.paypalAccount,
      icon: (
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30">
          <span className="text-white text-sm font-bold">P</span>
        </div>
      ),
    },
  ]

  // 在微信小程序环境中，无论部署区域如何，都使用 CN 支付方式（微信支付、支付宝）
  // 因为小程序不支持 Stripe 的 iframe，且用户在微信环境中使用微信支付更方便
  const paymentMethods = (isCN || isInMiniProgram) ? cnPaymentMethods : intlPaymentMethods

  return (
    <>
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-indigo-400/15 to-blue-400/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="relative z-10 p-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center mb-8">
              <Link href="/">
                <Button variant="ghost" size="sm" className="hover:bg-white/60 backdrop-blur-sm transition-all">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t.pricing.back}
                </Button>
              </Link>
            </div>

            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {language === "zh" ? "升级您的体验" : "Upgrade Your Experience"}
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-purple-900 bg-clip-text text-transparent leading-tight">
                {t.pricing.title}
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                {t.pricing.subtitle}
              </p>
              {currentTier !== "free" && (
                <div className="mt-6">
                  <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1.5 text-sm">
                    {t.pricing.current}: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Billing Cycle Selector */}
            <div className="max-w-sm mx-auto mb-10">
              <div className="relative p-1 rounded-2xl bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 shadow-lg">
                <div className="flex rounded-xl bg-white/90 backdrop-blur-sm p-1 gap-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={cn(
                      "flex-1 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-300",
                      billingCycle === "monthly"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
                    )}
                  >
                    {language === "zh" ? "月付" : "Monthly"}
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={cn(
                      "flex-1 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-300 relative",
                      billingCycle === "yearly"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
                    )}
                  >
                    {language === "zh" ? "年付" : "Yearly"}
                    {billingCycle !== "yearly" && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">
                        -20%
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center mt-3">
                {language === "zh" ? "年度订阅可节省 20% 费用" : "Save 20% with annual billing"}
              </p>
            </div>

            {/* Payment Method Selector */}
            {isAuthenticated && (
              <div className="max-w-md mx-auto mb-12">
                <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-lg font-semibold">
                      {language === "zh" ? "选择支付方式" : "Select Payment Method"}
                    </CardTitle>
                    <CardDescription>
                      {language === "zh" ? "选择您喜欢的支付方式" : "Choose your preferred payment method"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={selectedPayment} onValueChange={(v) => setSelectedPayment(v as PaymentMethod)} className="space-y-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className={cn(
                            "flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200",
                            selectedPayment === method.id
                              ? "border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/10"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                          )}
                        >
                          <RadioGroupItem value={method.id} id={method.id} />
                          <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {method.icon}
                                <span className="font-semibold">{method.name}</span>
                              </div>
                              <span className="text-sm text-gray-500">{method.description}</span>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
              {plans.map((plan, index) => {
                const Icon = plan.icon
                const isCurrentPlan = currentTier === plan.id
                const isPro = plan.popular

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative group",
                      isPro && "md:-mt-4 md:mb-4"
                    )}
                  >
                    {/* Glow Effect for Pro */}
                    {isPro && (
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
                    )}

                    <Card
                      className={cn(
                        "relative overflow-hidden transition-all duration-500 border-0",
                        isPro
                          ? "shadow-2xl shadow-purple-500/20 bg-white"
                          : "shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:-translate-y-1",
                      )}
                    >
                      {/* Popular Badge */}
                      {isPro && (
                        <div className="absolute -top-px left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
                      )}
                      {isPro && (
                        <div className="absolute top-4 right-4">
                          <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 shadow-lg shadow-purple-500/30 px-3 py-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {language === "zh" ? "最受欢迎" : "Most Popular"}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className={cn("pt-8 pb-6", isPro && "pt-10")}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn(
                            "p-3 rounded-2xl shadow-lg",
                            plan.iconBg,
                            !plan.iconBg.includes("gradient") && "shadow-gray-200/50"
                          )}>
                            <Icon className={cn("h-6 w-6", plan.iconColor)} />
                          </div>
                          <div className="flex gap-2">
                            {isCurrentPlan && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                <Check className="h-3 w-3 mr-1" />
                                {language === "zh" ? "当前" : "Current"}
                              </Badge>
                            )}
                            {plan.savings > 0 && (
                              <Badge className="bg-green-500 text-white border-0 shadow-md shadow-green-500/30">
                                {language === "zh" ? `省${plan.savings}%` : `Save ${plan.savings}%`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                        <div className="mt-6 flex items-baseline gap-1">
                          <span className={cn(
                            "text-5xl font-bold",
                            isPro && "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                          )}>
                            {plan.price}
                          </span>
                          {plan.period && (
                            <span className="text-gray-500 text-lg">{plan.period}</span>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pb-6">
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6" />
                        <ul className="space-y-4">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-3 group/item">
                              <div className={cn(
                                "mt-0.5 p-1 rounded-full transition-colors",
                                isPro ? "bg-green-100 group-hover/item:bg-green-200" : "bg-gray-100 group-hover/item:bg-gray-200"
                              )}>
                                <Check className={cn(
                                  "h-3 w-3",
                                  isPro ? "text-green-600" : "text-gray-600"
                                )} />
                              </div>
                              <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter className="flex flex-col gap-3 pb-8">
                        <Button
                          onClick={() => handleSubscribe(plan.id, billingCycle)}
                          disabled={processingPlan === plan.id || isCurrentPlan}
                          className={cn(
                            "w-full h-12 text-base font-semibold rounded-xl transition-all duration-300",
                            isPro
                              ? "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02]"
                              : plan.id === "free"
                                ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border-0"
                                : "bg-gradient-to-r from-amber-500 to-rose-500 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02]"
                          )}
                          variant={plan.id === "free" ? "ghost" : "default"}
                        >
                          {processingPlan === plan.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {language === "zh" ? "处理中..." : "Processing..."}
                            </>
                          ) : isCurrentPlan ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              {t.pricing.currentPlan}
                            </>
                          ) : plan.id === "free" ? (
                            <>
                              <Info className="mr-2 h-4 w-4" />
                              {t.pricing.currentFreePlan}
                            </>
                          ) : (
                            <>
                              <CreditCard className="mr-2 h-4 w-4" />
                              {language === "zh" 
                                ? `使用${selectedPayment === "wechat" ? "微信" : selectedPayment === "alipay" ? "支付宝" : selectedPayment === "stripe" ? "Stripe" : "PayPal"}支付`
                                : t.pricing.subscribeWith.replace("{method}", selectedPayment === "stripe" ? "Stripe" : "PayPal")
                              }
                            </>
                          )}
                        </Button>

                        {isCurrentPlan && plan.id !== "free" && (
                          <Link href="/settings?tab=subscription" className="w-full">
                            <Button variant="outline" size="sm" className="w-full rounded-xl border-2 hover:bg-gray-50">
                              <Settings className="mr-2 h-4 w-4" />
                              {language === "zh" ? "管理订阅" : "Manage Subscription"}
                            </Button>
                          </Link>
                        )}
                      </CardFooter>
                    </Card>
                  </div>
                )
              })}
            </div>

            {/* FAQ Section */}
            <div className="mt-20 max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  {t.pricing.faq.title}
                </h2>
                <p className="text-gray-500 mt-2">
                  {language === "zh" ? "还有其他问题？随时联系我们" : "Have more questions? Feel free to reach out"}
                </p>
              </div>
              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <div
                    key={index}
                    className={cn(
                      "rounded-2xl border-2 transition-all duration-300 overflow-hidden",
                      expandedFaq === index
                        ? "border-blue-200 bg-blue-50/50 shadow-lg shadow-blue-500/10"
                        : "border-gray-200 bg-white/80 hover:border-gray-300"
                    )}
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-gray-900 pr-4">{faq.question}</h3>
                      <ChevronDown className={cn(
                        "h-5 w-5 text-gray-500 transition-transform duration-300 flex-shrink-0",
                        expandedFaq === index && "rotate-180"
                      )} />
                    </button>
                    <div className={cn(
                      "overflow-hidden transition-all duration-300",
                      expandedFaq === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <p className="px-6 pb-5 text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-20 text-center">
              <div className="inline-flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {language === "zh" ? "准备好开始了吗？" : "Ready to get started?"}
                  </span>
                </div>
                <p className="text-gray-600 max-w-md">
                  {language === "zh"
                    ? "立即升级，解锁所有高级功能，享受无限可能"
                    : "Upgrade now to unlock all premium features and endless possibilities"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* INTL Stripe 支付弹窗 */}
      {stripeCheckout && (
        <StripeCheckoutDialog
          open={isStripeDialogOpen}
          clientSecret={stripeCheckout.clientSecret}
          amount={stripeCheckout.amount}
          currency={stripeCheckout.currency}
          planName={stripeCheckout.planName}
          billingCycle={stripeCheckout.billingCycle}
          orderId={stripeCheckout.orderId}
          onClose={() => {
            setIsStripeDialogOpen(false)
            setStripeCheckout(null)
          }}
          onSucceeded={() => {
            setIsStripeDialogOpen(false)
            setStripeCheckout(null)
          }}
        />
      )}
      
      {/* CN 支付弹窗 */}
      {cnPayment && (
        <CNPaymentDialog
          open={isCNDialogOpen}
          orderId={cnPayment.orderId}
          qrCodeUrl={cnPayment.qrCodeUrl}
          paymentUrl={cnPayment.paymentUrl}
          mode={cnPayment.mode}
          method={cnPayment.method}
          amount={cnPayment.amount}
          currency={cnPayment.currency}
          planName={cnPayment.planName}
          billingCycle={cnPayment.billingCycle}
          onClose={() => {
            setIsCNDialogOpen(false)
            setCnPayment(null)
          }}
          onSuccess={() => {
            setIsCNDialogOpen(false)
            setCnPayment(null)
            router.push("/settings?tab=subscription")
          }}
        />
      )}
    </>
  )
}
