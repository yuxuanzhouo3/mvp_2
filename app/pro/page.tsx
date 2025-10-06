"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Check, Crown, Zap, Building2, CreditCard, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type PaymentMethod = "stripe" | "paypal"
type Tier = "free" | "pro" | "enterprise"

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("stripe")
  const [isProcessing, setIsProcessing] = useState(false)

  const currentTier = (session as any)?.user?.subscriptionTier || "free"

  const handleSubscribe = async (tier: Tier) => {
    if (!session) {
      router.push("/login")
      return
    }

    if (tier === "free") {
      toast({
        title: "Already on free tier",
        description: "You're currently using the free plan.",
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
          description: data.message || "Redirecting to payment...",
        })

        // In production, redirect to actual payment URL
        // window.location.href = data.url || data.approvalUrl

        setTimeout(() => {
          router.push("/settings")
        }, 2000)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const plans = [
    {
      id: "free" as Tier,
      name: "Free",
      price: "$0",
      icon: Zap,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      features: [
        "5 recommendations per day",
        "Basic categories",
        "Local history (3 items)",
        "Community support",
      ],
    },
    {
      id: "pro" as Tier,
      name: "Pro",
      price: "$9.99",
      icon: Crown,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-300",
      popular: true,
      features: [
        "Unlimited recommendations",
        "All categories",
        "Advanced AI personalization",
        "Save unlimited favorites",
        "Priority email support",
        "Ad-free experience",
        "Custom preferences",
      ],
    },
    {
      id: "enterprise" as Tier,
      name: "Max Enterprise",
      price: "$49.99",
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
      features: [
        "Everything in Pro",
        "API access",
        "White-label options",
        "Dedicated account manager",
        "24/7 phone support",
        "Custom integrations",
        "Advanced analytics",
        "Team collaboration (up to 10 users)",
        "SLA guarantee",
      ],
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
              Back
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Unlock the full power of RandomLife with premium features
          </p>
          {currentTier !== "free" && (
            <Badge className="mt-4" variant="secondary">
              Current: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </Badge>
          )}
        </div>

        {/* Payment Method Selector */}
        {session && (
          <Card className="max-w-md mx-auto mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
              <CardDescription>Choose how you'd like to pay</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedPayment} onValueChange={(v) => setSelectedPayment(v as PaymentMethod)}>
                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">Stripe</span>
                      </div>
                      <span className="text-sm text-gray-500">Credit Card</span>
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
                        <span className="font-medium">PayPal</span>
                      </div>
                      <span className="text-sm text-gray-500">PayPal Account</span>
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
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.id !== "free" && <span className="text-gray-600">/month</span>}
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
                      ? "Current Plan"
                      : isProcessing
                      ? "Processing..."
                      : plan.id === "free"
                      ? "Current Free Plan"
                      : `Subscribe with ${selectedPayment === "stripe" ? "Stripe" : "PayPal"}`}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I switch plans anytime?</h3>
              <p className="text-gray-600">
                Yes! You can upgrade, downgrade, or cancel your subscription at any time from your settings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We accept all major credit cards through Stripe, as well as PayPal payments.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-gray-600">
                The free plan lets you try our service with no credit card required. Upgrade anytime to unlock more features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
