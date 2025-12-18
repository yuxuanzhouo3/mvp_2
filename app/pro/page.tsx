"use client"

import { useState } from "react"
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
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth"

type PaymentMethod = "stripe" | "paypal"
type Tier = "free" | "pro" | "enterprise"
type BillingCycle = "monthly" | "yearly"

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const t = useTranslations(language)
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("stripe")
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly")
  const [processingPlan, setProcessingPlan] = useState<Tier | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [stripeCheckout, setStripeCheckout] = useState<{
    clientSecret: string
    orderId: string
    amount: number
    currency: string
    planName: string
    billingCycle: BillingCycle
  } | null>(null)
  const [isStripeDialogOpen, setIsStripeDialogOpen] = useState(false)

  const currentTier = user?.subscriptionTier || "free"

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
      // 获取定价信息 - 国际版 (INTL)
      const pricing = {
        pro: { monthly: 2.99, yearly: 29.99 },
        enterprise: { monthly: 6.99, yearly: 69.99 },
      }

      const amount = pricing[tier][billingCycle]
      const currency = "USD"
      const planName =
        tier === "pro"
          ? t.pricing.plans.pro.name
          : tier === "enterprise"
          ? t.pricing.plans.enterprise.name
          : t.pricing.plans.free.name

      const response = await fetchWithAuth("/api/payment/create", {
        method: "POST",
        body: JSON.stringify({
          method: selectedPayment,
          amount,
          currency,
          planType: tier,
          billingCycle,
          description: `${billingCycle === "monthly" ? "1 Month" : "1 Year"} ${tier.charAt(0).toUpperCase() + tier.slice(1)} Membership`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Payment creation failed")
      }

      if (selectedPayment === "paypal" && data.paymentUrl) {
        // 重定向到 PayPal 支付页面
        toast({
          title: "PayPal",
          description: language === "zh" ? "正在跳转到PayPal..." : "Redirecting to PayPal...",
        })
        setProcessingPlan(null)  // 重置processing状态
        window.location.href = data.paymentUrl
      } else if (selectedPayment === "stripe" && data.clientSecret) {
        setProcessingPlan(null)  // 重置processing状态
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
      } else {
        toast({
          title: t.pricing.toast.success,
          description: t.pricing.toast.paymentCompleted,
        })

        setTimeout(() => {
          router.push("/settings")
        }, 2000)
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
      monthlyPrice: 2.99,
      yearlyPrice: 29.99,
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
      monthlyPrice: 6.99,
      yearlyPrice: 69.99,
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
    price: plan.id === "free" ? "$0" : `$${billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}`,
    period: plan.id === "free" ? "" : billingCycle === "monthly" ? "/month" : "/year",
    savings: billingCycle === "yearly" && plan.id !== "free" ? Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100) : 0,
  }))

  const faqItems = [
    { question: t.pricing.faq.switchPlans.question, answer: t.pricing.faq.switchPlans.answer },
    { question: t.pricing.faq.paymentMethods.question, answer: t.pricing.faq.paymentMethods.answer },
    { question: t.pricing.faq.freeTrial.question, answer: t.pricing.faq.freeTrial.answer },
  ]

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
                    {t.pricing.billing.monthly || "Monthly"}
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
                    {t.pricing.billing.yearly || "Yearly"}
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
                    <CardTitle className="text-lg font-semibold">{t.pricing.paymentMethod.title}</CardTitle>
                    <CardDescription>{t.pricing.paymentMethod.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={selectedPayment} onValueChange={(v) => setSelectedPayment(v as PaymentMethod)} className="space-y-3">
                      <div className={cn(
                        "flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200",
                        selectedPayment === "stripe"
                          ? "border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/10"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                      )}>
                        <RadioGroupItem value="stripe" id="stripe" />
                        <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                                <CreditCard className="h-4 w-4 text-white" />
                              </div>
                              <span className="font-semibold">{t.pricing.paymentMethod.stripe}</span>
                            </div>
                            <span className="text-sm text-gray-500">{t.pricing.paymentMethod.creditCard}</span>
                          </div>
                        </Label>
                      </div>
                      <div className={cn(
                        "flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200",
                        selectedPayment === "paypal"
                          ? "border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/10"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                      )}>
                        <RadioGroupItem value="paypal" id="paypal" />
                        <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30">
                                <span className="text-white text-sm font-bold">P</span>
                              </div>
                              <span className="font-semibold">{t.pricing.paymentMethod.paypal}</span>
                            </div>
                            <span className="text-sm text-gray-500">{t.pricing.paymentMethod.paypalAccount}</span>
                          </div>
                        </Label>
                      </div>
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
                              {t.pricing.processing}
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
                              {t.pricing.subscribeWith.replace("{method}", selectedPayment === "stripe" ? "Stripe" : "PayPal")}
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
    </>
  )
}
