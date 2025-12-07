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
import { Check, Crown, Zap, Building2, CreditCard, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"

type PaymentMethod = "stripe" | "paypal"
type Tier = "free" | "pro" | "enterprise"

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const t = useTranslations(language)
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("stripe")
  const [isProcessing, setIsProcessing] = useState(false)

  const currentTier = user?.subscriptionTier || "free"

  const handleSubscribe = async (tier: Tier) => {
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
      const endpoint = selectedPayment === "stripe"
        ? "/api/stripe/create-checkout"
        : "/api/paypal/create-subscription"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      })

      const data = await response.json()

      if (data.url || data.approvalUrl) {
        // Simulate payment success for demo
        toast({
          title: `${selectedPayment === "stripe" ? "Stripe" : "PayPal"} Checkout`,
          description: data.message || t.pricing.toast.redirecting,
        })

        // In production, redirect to actual payment URL
        // window.location.href = data.url || data.approvalUrl

        setTimeout(() => {
          router.push("/settings")
        }, 2000)
      }
    } catch (error) {
      toast({
        title: t.pricing.toast.error,
        description: t.pricing.toast.paymentFailed,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const plans = [
    {
      id: "free" as Tier,
      name: t.pricing.plans.free.name,
      price: "$0",
      icon: Zap,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      features: t.pricing.plans.free.features,
    },
    {
      id: "pro" as Tier,
      name: t.pricing.plans.pro.name,
      price: "$9.99",
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
      price: "$49.99",
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
      features: t.pricing.plans.enterprise.features,
    },
  ]

  return (
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
                    <Badge className="bg-blue-600 text-white">{t.pricing.mostPopular}</Badge>
                  </div>
                )}
                <CardHeader className={`${plan.bgColor} pb-8`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-8 w-8 ${plan.color}`} />
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="text-xs">{t.pricing.current}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.id !== "free" && <span className="text-gray-600">{t.pricing.perMonth}</span>}
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
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isProcessing || isCurrentPlan}
                    className={`w-full ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        : ""
                    }`}
                    variant={plan.id === "free" ? "outline" : "default"}
                  >
                    {isCurrentPlan
                      ? t.pricing.currentPlan
                      : isProcessing
                      ? t.pricing.processing
                      : plan.id === "free"
                      ? t.pricing.currentFreePlan
                      : t.pricing.subscribeWith.replace("{method}", selectedPayment === "stripe" ? "Stripe" : "PayPal")}
                  </Button>
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
  )
}
