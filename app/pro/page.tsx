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
import { Check, Crown, Zap, Building2, CreditCard, ArrowLeft, Loader2, Settings, Info, ShieldCheck, Sparkles } from "lucide-react"
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [hoveredPlan, setHoveredPlan] = useState<Tier | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Tier | null>(null)
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

    setIsProcessing(true)

    try {
      // 获取定价信息
      const pricing = {
        pro: { monthly: 9.99, yearly: 99.99 },
        enterprise: { monthly: 49.99, yearly: 499.99 },
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
        window.location.href = data.paymentUrl
        return
      } else if (selectedPayment === "stripe" && data.clientSecret) {
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
        return
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
      setIsProcessing(false)
    }
  }

  const basePlans = [
    {
      id: "free" as Tier,
      name: t.pricing.plans.free.name,
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Zap,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      features: t.pricing.plans.free.features,
    },
    {
      id: "pro" as Tier,
      name: t.pricing.plans.pro.name,
      monthlyPrice: 9.99,
      yearlyPrice: 99.99,
      icon: Crown,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-300",
      popular: true,
      features: t.pricing.plans.pro.features,
    },
    {
      id: "enterprise" as Tier,
      name: t.pricing.plans.enterprise.name,
      monthlyPrice: 49.99,
      yearlyPrice: 499.99,
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
      features: t.pricing.plans.enterprise.features,
    },
  ]

  const plans = basePlans.map(plan => ({
    ...plan,
    price: plan.id === "free" ? "$0" : `$${billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}`,
    period: plan.id === "free" ? "" : billingCycle === "monthly" ? "/month" : "/year",
    savings: billingCycle === "yearly" && plan.id !== "free" ? Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100) : 0,
  }))
  const proHeroFeatures = t.pricing.plans.pro.features.slice(0, 3)

  return (
    <>
      <style jsx>{`
        @keyframes selectCard {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1.05); }
        }

        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.4); }
          100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
        }

        .card-selected {
          animation: selectCard 0.3s ease-in-out forwards, glow 2s ease-in-out infinite;
        }
      `}</style>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#f7f9ff] via-[#f4f7ff] to-[#eef2ff] px-4 py-8 sm:py-12 md:py-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-6 h-64 w-64 rounded-full bg-gradient-to-br from-blue-200/70 via-blue-100/40 to-transparent blur-3xl" />
          <div className="absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-gradient-to-br from-purple-200/60 via-blue-100/30 to-transparent blur-3xl" />
          <div className="absolute inset-x-4 top-20 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
        </div>
        <div className="relative max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.pricing.back}
              </Button>
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl mb-8 sm:mb-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(109,40,217,0.12),transparent_35%)]" aria-hidden="true" />
            <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1.1fr,0.9fr] items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>{language === "zh" ? "Pro 体验" : "Pro experience"}</span>
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">{t.pricing.title}</h1>
                  <p className="text-base sm:text-lg text-gray-600 max-w-3xl">{t.pricing.subtitle}</p>
                  {currentTier !== "free" && (
                    <Badge className="mt-2" variant="secondary">
                      {t.pricing.current}: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {proHeroFeatures.map((feature, index) => (
                    <span
                      key={`${feature}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs sm:text-sm text-blue-800 shadow-sm"
                    >
                      <Check className="h-3.5 w-3.5 text-blue-600" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-3 md:space-y-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-white/80">{language === "zh" ? "结算周期" : "Billing cycle"}</div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-100 bg-white/10 px-2 py-1 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      {language === "zh" ? "年度立省 20%" : "Save 20% yearly"}
                    </div>
                  </div>
                  <div className="flex rounded-xl bg-white/10 p-1 gap-1">
                    <button
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                        billingCycle === "monthly"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-white/80 hover:bg-white/10"
                      )}
                    >
                      {t.pricing.billing.monthly || "Monthly"}
                    </button>
                    <button
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                        billingCycle === "yearly"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-white/80 hover:bg-white/10"
                  )}
                >
                      {t.pricing.billing.yearly || "Yearly"}
                    </button>
                  </div>
                  <p className="text-xs text-white/70 text-center">
                    {language === "zh" ? "灵活切换，锁定最优价格" : "Switch anytime - keep the best rate."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/70 border border-white/60 rounded-xl px-3 py-2 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>{language === "zh" ? "支付信息已加密传输" : "Payments are encrypted end-to-end"}</span>
                </div>
              </div>
            </div>
          </div>

        {/* Payment Method Selector */}
        {isAuthenticated && (
          <Card className="max-w-2xl mx-auto mb-8 sm:mb-10 bg-white/80 backdrop-blur-xl border-white/70 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.4)] rounded-2xl">
            <CardHeader className="text-center sm:text-left pb-4 sm:pb-5">
              <CardTitle className="text-lg flex items-center gap-2 justify-center sm:justify-start text-gray-900">
                <CreditCard className="h-5 w-5 text-blue-600" />
                {t.pricing.paymentMethod.title}
              </CardTitle>
              <CardDescription className="text-gray-600">{t.pricing.paymentMethod.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <RadioGroup value={selectedPayment} onValueChange={(v) => setSelectedPayment(v as PaymentMethod)}>
                <div
                  className={cn(
                    "flex items-center space-x-3 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all",
                    selectedPayment === "stripe"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                  )}
                  onClick={() => setSelectedPayment("stripe")}
                >
                  <RadioGroupItem value="stripe" id="stripe" className="sr-only" />
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                    selectedPayment === "stripe"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  )}>
                    {selectedPayment === "stripe" && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-6 sm:w-12 sm:h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
                          <span className="text-white font-bold text-xs sm:text-sm">STRIPE</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{t.pricing.paymentMethod.stripe}</p>
                          <p className="text-xs text-gray-500 hidden sm:block">{t.pricing.paymentMethod.creditCard}</p>
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
                <div
                  className={cn(
                    "flex items-center space-x-3 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all",
                    selectedPayment === "paypal"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                  )}
                  onClick={() => setSelectedPayment("paypal")}
                >
                  <RadioGroupItem value="paypal" id="paypal" className="sr-only" />
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                    selectedPayment === "paypal"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  )}>
                    {selectedPayment === "paypal" && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-6 sm:w-12 sm:h-8 bg-gradient-to-r from-blue-500 to-blue-700 rounded flex items-center justify-center">
                          <span className="text-white font-bold text-xs sm:text-sm">P</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{t.pricing.paymentMethod.paypal}</p>
                          <p className="text-xs text-gray-500 hidden sm:block">{t.pricing.paymentMethod.paypalAccount}</p>
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = currentTier === plan.id

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative transition-all duration-500 overflow-hidden cursor-pointer rounded-2xl bg-white/85 backdrop-blur-xl",
                  "border border-white/70 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.4)] hover:-translate-y-2",
                  plan.popular
                    ? "lg:scale-105 ring-1 ring-blue-200 shadow-blue-100/50"
                    : "ring-1 ring-slate-100",
                  hoveredPlan === plan.id ? "-translate-y-2" : "",
                  selectedPlan === plan.id ? "ring-2 ring-blue-500 shadow-xl scale-[1.02]" : "",
                  selectedPlan === plan.id && "card-selected",
                  isCurrentPlan && "ring-2 ring-green-500"
                )}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                onClick={() => setSelectedPlan(plan.id === selectedPlan ? null : plan.id)}
              >
                {/* Animated gradient overlay for selected card */}
                {selectedPlan === plan.id && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 animate-pulse pointer-events-none" />
                )}
                {plan.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                    <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 shadow-lg text-sm">
                      {t.pricing.mostPopular}
                    </Badge>
                  </div>
                )}
                {selectedPlan === plan.id && !isCurrentPlan && (
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                    <Badge className="bg-blue-600 text-white animate-pulse shadow-lg text-xs">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Selected
                      </span>
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-xs">
                      {t.pricing.current}
                    </Badge>
                  </div>
                )}
                <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-blue-500/70 via-purple-500/40 to-transparent opacity-80" />
                <CardHeader className={`${plan.bgColor} pb-6 sm:pb-8 relative rounded-t-2xl`}>
                  {plan.savings > 0 && (
                    <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        Save {plan.savings}%
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2 mt-6 sm:mt-8">
                    <Icon
                      className={cn(
                        "h-8 w-8 sm:h-10 sm:w-10 transition-all duration-300",
                        plan.color,
                        selectedPlan === plan.id && "animate-bounce scale-110"
                      )}
                    />
                    {plan.id === "pro" && (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg key={star} className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        ))}
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-5xl font-bold">{plan.price}</span>
                      <span className="text-lg sm:text-xl text-gray-600">{plan.period}</span>
                    </div>
                    {plan.id !== "free" && billingCycle === "monthly" && (
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Or ${plan.yearlyPrice}/year (save ${plan.savings}%)
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6">
                  <ul className="space-y-3 sm:space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 sm:gap-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 sm:gap-3 pt-4 sm:pt-6">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSubscribe(plan.id, billingCycle)
                    }}
                    disabled={isProcessing || isCurrentPlan}
                    className={cn(
                      "w-full font-semibold py-2 sm:py-3 transition-all duration-300 text-sm sm:text-base",
                      "transform hover:scale-105 active:scale-95",
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl"
                        : plan.id === "free"
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-800"
                        : "bg-gray-900 hover:bg-gray-800 text-white",
                      selectedPlan === plan.id && !isCurrentPlan && "bg-blue-600 hover:bg-blue-700 text-white shadow-xl animate-pulse",
                      isCurrentPlan && "bg-green-600 hover:bg-green-700 text-white"
                    )}
                    size="lg"
                  >
                    {isProcessing ? (
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
                    <Link href="/settings?tab=subscription">
                      <Button variant="outline" size="sm" className="w-full text-sm">
                        <Settings className="mr-2 h-4 w-4" />
                        Manage Subscription
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-12 sm:mt-16 max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 text-gray-900">{t.pricing.faq.title}</h2>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-1 lg:grid-cols-3">
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] border border-white/70">
              <h3 className="font-semibold mb-3 text-lg text-gray-900">{t.pricing.faq.switchPlans.question}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t.pricing.faq.switchPlans.answer}
              </p>
            </div>
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] border border-white/70">
              <h3 className="font-semibold mb-3 text-lg text-gray-900">{t.pricing.faq.paymentMethods.question}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t.pricing.faq.paymentMethods.answer}
              </p>
            </div>
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] border border-white/70">
              <h3 className="font-semibold mb-3 text-lg text-gray-900">{t.pricing.faq.freeTrial.question}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t.pricing.faq.freeTrial.answer}
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
