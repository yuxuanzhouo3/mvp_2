"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CreditCard, User, Crown, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"
import { BillingHistory } from "@/components/payment/billing-history"
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth"

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, refresh } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const t = useTranslations(language)

  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [cvv, setCvv] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <p>{t.settingsPage.loading}</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push("/login")
    return null
  }

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast({
      title: t.settingsPage.paymentTab.savedTitle,
      description: t.settingsPage.paymentTab.savedDescription,
    })

    setIsSaving(false)
  }

  const handleRefreshSubscription = async () => {
    setIsRefreshing(true)

    try {
      const response = await fetchWithAuth("/api/auth/refresh-subscription", {
        method: "POST",
      })

      // Check if the response is actually JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned non-JSON response (${response.status}): ${await response.text()}`)
      }

      const data = await response.json()

      if (response.ok && data.success) {
        // 刷新用户认证状态
        await refresh()

        toast({
          title: language === "zh" ? "订阅已更新" : "Subscription Updated",
          description: language === "zh"
            ? `您的订阅状态已更新为：${data.subscriptionPlan === "free" ? "免费版" : "专业版"}`
            : `Your subscription has been updated to: ${data.subscriptionPlan}`,
        })
      } else {
        toast({
          title: language === "zh" ? "更新失败" : "Update Failed",
          description: data.error || (language === "zh" ? "无法更新订阅状态" : "Failed to update subscription"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Refresh subscription error:", error)

      // Provide more specific error messages
      let errorMessage = language === "zh" ? "网络错误，请重试" : "Network error, please try again"
      if (error instanceof Error) {
        if (error.message.includes("502")) {
          errorMessage = language === "zh" ? "服务器暂时不可用，请稍后重试" : "Server temporarily unavailable, please try again later"
        } else if (error.message.includes("non-JSON")) {
          errorMessage = language === "zh" ? "服务器响应异常，请联系技术支持" : "Server response error, please contact support"
        }
      }

      toast({
        title: language === "zh" ? "更新失败" : "Update Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
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
              {t.settingsPage.back}
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{t.settingsPage.title}</h1>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">
              <User className="h-4 w-4 mr-2" />
              {t.settingsPage.tabs.account}
            </TabsTrigger>
            <TabsTrigger value="payment">
              <CreditCard className="h-4 w-4 mr-2" />
              {t.settingsPage.tabs.payment}
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="h-4 w-4 mr-2" />
              {t.settingsPage.tabs.pro}
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settingsPage.account.title}</CardTitle>
                <CardDescription>
                  {t.settingsPage.account.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.settingsPage.account.name}</Label>
                  <Input value={user?.name || t.settingsPage.account.na} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{t.settingsPage.account.email}</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t.settingsPage.account.subscriptionTier}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshSubscription}
                      disabled={isRefreshing}
                    >
                      {isRefreshing
                        ? (language === "zh" ? "刷新中..." : "Refreshing...")
                        : (language === "zh" ? "刷新状态" : "Refresh Status")
                      }
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.subscriptionTier === "enterprise" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-700 font-medium">
                        {t.settingsPage.account.tiers.enterprise}
                      </span>
                    )}
                    {user?.subscriptionTier === "pro" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700 font-medium">
                        {t.settingsPage.account.tiers.pro}
                      </span>
                    )}
                    {(user?.subscriptionTier === "free" || !user?.subscriptionTier) && (
                      <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 font-medium">
                        {t.settingsPage.account.tiers.free}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settingsPage.paymentTab.title}</CardTitle>
                <CardDescription>
                  {t.settingsPage.paymentTab.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">{t.settingsPage.paymentTab.cardNumber}</Label>
                    <Input
                      id="cardNumber"
                      placeholder={t.settingsPage.paymentTab.cardNumberPlaceholder}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardName">{t.settingsPage.paymentTab.cardholderName}</Label>
                    <Input
                      id="cardName"
                      placeholder={t.settingsPage.paymentTab.cardholderNamePlaceholder}
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">{t.settingsPage.paymentTab.expiryDate}</Label>
                      <Input
                        id="expiryDate"
                        placeholder={t.settingsPage.paymentTab.expiryDatePlaceholder}
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                        maxLength={5}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">{t.settingsPage.paymentTab.cvv}</Label>
                      <Input
                        id="cvv"
                        placeholder={t.settingsPage.paymentTab.cvvPlaceholder}
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
                      {t.settingsPage.paymentTab.securityNote}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSaving}>
                    {isSaving ? t.settingsPage.paymentTab.saving : t.settingsPage.paymentTab.saveButton}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.settingsPage.subscription.title}</CardTitle>
                <CardDescription>
                  {t.settingsPage.subscription.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.isPro ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                      <Crown className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t.settingsPage.subscription.youArePro}</h3>
                    <p className="text-gray-600 mb-4">
                      {t.settingsPage.subscription.proDescription}
                    </p>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 mb-3">
                        {language === "zh"
                          ? "如果刚刚完成支付但订阅状态未更新，请点击下方按钮刷新。"
                          : "If you've just completed payment but your subscription hasn't updated, click below to refresh."
                        }
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleRefreshSubscription}
                        disabled={isRefreshing}
                        className="w-full"
                      >
                        {isRefreshing
                          ? (language === "zh" ? "刷新中..." : "Refreshing...")
                          : (language === "zh" ? "刷新订阅状态" : "Refresh Subscription Status")
                        }
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-purple-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">{t.settingsPage.subscription.proPlan}</h3>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600">$9.99</div>
                          <div className="text-sm text-gray-600">{t.settingsPage.subscription.perMonth}</div>
                        </div>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          {t.settingsPage.subscription.features.unlimited}
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          {t.settingsPage.subscription.features.aiPersonalization}
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          {t.settingsPage.subscription.features.favorites}
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          {t.settingsPage.subscription.features.support}
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="mr-2">✓</span>
                          {t.settingsPage.subscription.features.adFree}
                        </li>
                      </ul>
                      <Link href="/pro">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                          {t.settingsPage.subscription.upgradeButton}
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Billing History */}
            <BillingHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
