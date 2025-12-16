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
import { Check, Crown, Zap, Building2, CreditCard, ArrowLeft, Loader2, Settings, Info } from "lucide-react"
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

  return (
    <>
      <div className="min-h-screen bg-[#F7F9FC] p-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.pricing.back}
              </Button>
            </Link>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {t.pricing.title}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t.pricing.subtitle}
            </p>
            {currentTier !== "free" && (
              <Badge className="mt-4" variant="secondary">
                {t.pricing.current}: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Badge>
            )}
          </div>

          {/* Billing Cycle Selector */}
          <div className="max-w-md mx-auto mb-8">
            <Card>
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-lg">{language === "zh" ? "结算周期" : "Billing Cycle"}</CardTitle>
                <CardDescription>
                  {language === "zh" ? "选择您的订阅周期" : "Choose your subscription cycle"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                      billingCycle === "monthly"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {t.pricing.billing.monthly || "Monthly"}
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                      billingCycle === "yearly"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {t.pricing.billing.yearly || "Yearly"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  {language === "zh" ? "年度订阅可节省20%" : "Save 20% with yearly billing"}
                </p>
              </CardContent>
            </Card>
          </div>

        {/* Payment Method Selector */}
        {isAuthenticated && (
          <Card className="max-w-md mx-auto mb-8">
            <CardHeader>
              <CardTitle className="text-lg">{t.pricing.paymentMethod.title}</CardTitle>
              <CardDescription>{t.pricing.paymentMethod.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedPayment} onValueChange={(v) => setSelectedPayment(v as PaymentMethod)}>
                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">{t.pricing.paymentMethod.stripe}</span>
                      </div>
                      <span className="text-sm text-gray-500">{t.pricing.paymentMethod.creditCard}</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="paypal" id="paypal" />
                  <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          P
                        </div>
                        <span className="font-medium">{t.pricing.paymentMethod.paypal}</span>
                      </div>
                      <span className="text-sm text-gray-500">{t.pricing.paymentMethod.paypalAccount}</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = currentTier === plan.id

            return (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-2 shadow-lg scale-105" : "border"} ${plan.borderColor}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className={`${plan.bgColor} pb-8`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-8 w-8 ${plan.color}`} />
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                    {plan.savings > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        Save {plan.savings}%
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleSubscribe(plan.id, billingCycle)}
                    disabled={processingPlan === plan.id || isCurrentPlan}
                    className={`w-full ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        : ""
                    }`}
                    variant={plan.id === "free" ? "outline" : "default"}
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
                    <Link href="/settings?tab=subscription" className="w-full mt-2">
                      <Button variant="outline" size="sm" className="w-full">
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
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t.pricing.faq.title}</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">{t.pricing.faq.switchPlans.question}</h3>
              <p className="text-gray-600">
                {t.pricing.faq.switchPlans.answer}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t.pricing.faq.paymentMethods.question}</h3>
              <p className="text-gray-600">
                {t.pricing.faq.paymentMethods.answer}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t.pricing.faq.freeTrial.question}</h3>
              <p className="text-gray-600">
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
