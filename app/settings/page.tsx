"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CreditCard, User, Crown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [cvv, setCvv] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!session) {
    router.push("/login")
    return null
  }

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast({
      title: "Payment method saved",
      description: "Your payment information has been securely stored.",
    })

    setIsLoading(false)
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ""
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(" ")
    } else {
      return value
    }
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    if (v.length >= 2) {
      return v.slice(0, 2) + "/" + v.slice(2, 4)
    }
    return v
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8 pt-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">
              <User className="h-4 w-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="payment">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="h-4 w-4 mr-2" />
              Pro
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View and manage your account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={(session.user as any)?.name || "N/A"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={session.user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Subscription Tier</Label>
                  <div className="flex items-center gap-2">
                    {(session as any)?.user?.subscriptionTier === "enterprise" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-700 font-medium">
                        Max Enterprise
                      </span>
                    )}
                    {(session as any)?.user?.subscriptionTier === "pro" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700 font-medium">
                        Pro
                      </span>
                    )}
                    {(session as any)?.user?.subscriptionTier === "free" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 font-medium">
                        Free
                      </span>
                    )}
                  </div>
                </div>
                {(session as any)?.user?.paymentMethod && (
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 text-sm rounded-full bg-blue-50 text-blue-700 font-medium capitalize">
                        {(session as any)?.user?.paymentMethod}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>
                  Add or update your payment information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardName">Cardholder Name</Label>
                    <Input
                      id="cardName"
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/YY"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                        maxLength={5}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        type="password"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                      🔒 Your payment information is encrypted and secure. We use industry-standard
                      security measures to protect your data.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Payment Method"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pro Subscription</CardTitle>
                <CardDescription>
                  Upgrade to unlock premium features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(session as any)?.user?.isPro ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                      <Crown className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">You're a Pro!</h3>
                    <p className="text-gray-600 mb-4">
                      Enjoy unlimited recommendations and exclusive features.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-purple-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">Pro Plan</h3>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600">$9.99</div>
                          <div className="text-sm text-gray-600">per month</div>
                        </div>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          Unlimited recommendations
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          Advanced AI personalization
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          Save unlimited favorites
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          Priority support
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          Ad-free experience
                        </li>
                      </ul>
                      <Link href="/pro">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                          Upgrade to Pro
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
