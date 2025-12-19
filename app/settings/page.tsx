"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CreditCard, User, Crown, History, Edit2, Save, X } from "lucide-react"
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
  const [overridePlan, setOverridePlan] = useState<"free" | "pro" | "enterprise" | null>(null)
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  const normalizePlan = (plan?: string | null) => {
    const val = (plan || "").toLowerCase()
    if (val.includes("enterprise")) return "enterprise"
    if (val.includes("pro")) return "pro"
    return "free"
  }

  const currentPlan = overridePlan ?? (user?.subscriptionTier ? normalizePlan(user.subscriptionTier) : "free")
  const isEnterprise = currentPlan === "enterprise"
  const isPro = currentPlan === "pro"
  const subscriptionTitle = isEnterprise
    ? t.settingsPage.subscription.enterprisePlan || t.settingsPage.subscription.title
    : t.settingsPage.subscription.title
  const subscriptionSubtitle = isEnterprise
    ? t.settingsPage.subscription.enterpriseDescription || t.settingsPage.subscription.subtitle
    : t.settingsPage.subscription.subtitle

  // Fetch subscription info on mount for paid users
  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      if (!isAuthenticated || !user) return

      const plan = user?.subscriptionTier ? normalizePlan(user.subscriptionTier) : "free"
      if (plan === "free") return

      try {
        const response = await fetchWithAuth("/api/auth/refresh-subscription", {
          method: "POST",
        })

        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) return

        const data = await response.json()
        if (response.ok && data.success) {
          const planFromDb = normalizePlan(data.subscription?.plan_type)
          const resolvedPlan = planFromDb !== "free" ? planFromDb : normalizePlan(data.subscriptionPlan)
          setOverridePlan(resolvedPlan)

          if (data.subscription?.subscription_end) {
            setSubscriptionEnd(data.subscription.subscription_end)
          }
        }
      } catch (error) {
        console.error("Failed to fetch subscription info:", error)
      }
    }

    fetchSubscriptionInfo()
  }, [isAuthenticated, user])

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
        const planFromDb = normalizePlan(data.subscription?.plan_type)
        const resolvedPlan = planFromDb !== "free" ? planFromDb : normalizePlan(data.subscriptionPlan)
        setOverridePlan(resolvedPlan)

        // 保存订阅到期时间
        if (data.subscription?.subscription_end) {
          setSubscriptionEnd(data.subscription.subscription_end)
        }

        // 更新本地缓存
        const { updateSupabaseUserCache, clearSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl")
        
        // 先清除缓存，确保获取最新数据
        clearSupabaseUserCache()
        
        // 更新缓存中的订阅信息
        if (user) {
          const { saveSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl")
          saveSupabaseUserCache({
            id: user.id,
            email: user.email || "",
            name: user.name,
            avatar: user.avatar,
            subscription_plan: resolvedPlan,
            subscription_status: data.subscriptionStatus,
          })
        }

        // 刷新用户认证状态
        await refresh()

        const planLabel = resolvedPlan === "enterprise" 
          ? (language === "zh" ? "企业版" : "Enterprise")
          : resolvedPlan === "pro"
          ? (language === "zh" ? "专业版" : "Pro")
          : (language === "zh" ? "免费版" : "Free")

        toast({
          title: language === "zh" ? "订阅已更新" : "Subscription Updated",
          description: language === "zh"
            ? `您的订阅状态已更新为：${planLabel}`
            : `Your subscription has been updated to: ${planLabel}`,
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

  const handleEditName = () => {
    setEditedName(user?.name || "")
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditedName("")
  }

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast({
        title: language === "zh" ? "错误" : "Error",
        description: language === "zh" ? "姓名不能为空" : "Name cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingName(true)

    try {
      const response = await fetchWithAuth("/api/profile/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: editedName.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update name")
      }

      const data = await response.json()

      if (data.success) {
        // Update local state
        if (user) {
          user.name = editedName.trim()
        }

        // Update user cache
        try {
          const { updateSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl")
          updateSupabaseUserCache({
            ...user,
            name: editedName.trim(),
          })
        } catch (error) {
          console.error("Failed to update user cache:", error)
        }

        setIsEditingName(false)
        setEditedName("")

        toast({
          title: language === "zh" ? "更新成功" : "Success",
          description: language === "zh" ? "姓名已更新" : "Name updated successfully",
        })
      }
    } catch (error) {
      console.error("Update name error:", error)
      toast({
        title: language === "zh" ? "更新失败" : "Update Failed",
        description: error instanceof Error ? error.message : (language === "zh" ? "请重试" : "Please try again"),
        variant: "destructive",
      })
    } finally {
      setIsUpdatingName(false)
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
                  <div className="flex items-center justify-between">
                    <Label>{t.settingsPage.account.name}</Label>
                    {!isEditingName && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditName}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder={language === "zh" ? "输入您的姓名" : "Enter your name"}
                        className="flex-1"
                        disabled={isUpdatingName}
                        maxLength={100}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveName}
                        disabled={isUpdatingName || !editedName.trim()}
                        className="px-3"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEditName}
                        disabled={isUpdatingName}
                        className="px-3"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Input value={user?.name || t.settingsPage.account.na} disabled />
                  )}
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
                    {currentPlan === "enterprise" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-700 font-medium">
                        {t.settingsPage.account.tiers.enterprise}
                      </span>
                    )}
                    {currentPlan === "pro" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700 font-medium">
                        {t.settingsPage.account.tiers.pro}
                      </span>
                    )}
                    {currentPlan === "free" && (
                      <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 font-medium">
                        {t.settingsPage.account.tiers.free}
                      </span>
                    )}
                  </div>
                  {/* Subscription Expiry Date */}
                  {(currentPlan === "pro" || currentPlan === "enterprise") && (
                    <div className="text-sm text-gray-600 mt-2">
                      {subscriptionEnd ? (
                        <span>
                          {language === "zh" ? "到期时间：" : "Expires: "}
                          {new Date(subscriptionEnd).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          {language === "zh" ? "点击\"刷新状态\"查看到期时间" : "Click \"Refresh Status\" to see expiry date"}
                        </span>
                      )}
                    </div>
                  )}
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
                <CardTitle>{subscriptionTitle}</CardTitle>
                <CardDescription>
                  {subscriptionSubtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEnterprise ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                      <Crown className="h-8 w-8 text-purple-700" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {t.settingsPage.subscription.youAreEnterprise || t.settingsPage.subscription.youArePro}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {t.settingsPage.subscription.enterpriseDescription || t.settingsPage.subscription.proDescription}
                    </p>
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-bold text-purple-800">
                          {t.settingsPage.subscription.enterprisePlan || t.settingsPage.subscription.proPlan}
                        </h4>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-700">$6.99</div>
                          <div className="text-sm text-purple-600">{t.settingsPage.subscription.perMonth}</div>
                        </div>
                      </div>
                      <ul className="space-y-2 text-left text-sm text-purple-800">
                        <li>✓ {t.settingsPage.subscription.features.unlimited}</li>
                        <li>✓ {t.settingsPage.subscription.features.aiPersonalization}</li>
                        <li>✓ {t.settingsPage.subscription.features.favorites}</li>
                        <li>✓ {t.settingsPage.subscription.features.support}</li>
                        <li>✓ {t.settingsPage.subscription.features.adFree}</li>
                      </ul>
                      <Button
                        variant="outline"
                        onClick={handleRefreshSubscription}
                        disabled={isRefreshing}
                        className="w-full mt-4"
                      >
                        {t.settingsPage.subscription.manageButton || t.settingsPage.subscription.upgradeButton}
                      </Button>
                    </div>
                  </div>
                ) : isPro ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                      <Crown className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t.settingsPage.subscription.youArePro}</h3>
                    <p className="text-gray-600 mb-4">
                      {t.settingsPage.subscription.proDescription}
                    </p>
                    {/* Current Plan Details */}
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-bold text-green-800">
                          {t.settingsPage.subscription.proPlan}
                        </h4>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-700">$2.99</div>
                          <div className="text-sm text-green-600">{t.settingsPage.subscription.perMonth}</div>
                        </div>
                      </div>
                      {subscriptionEnd && (
                        <div className="text-sm text-green-800 mb-3 p-2 bg-green-100 rounded">
                          {language === "zh" ? "到期时间：" : "Expires: "}
                          <span className="font-semibold">
                            {new Date(subscriptionEnd).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <ul className="space-y-2 text-left text-sm text-green-800">
                        <li>✓ {t.settingsPage.subscription.features.unlimited}</li>
                        <li>✓ {t.settingsPage.subscription.features.aiPersonalization}</li>
                        <li>✓ {t.settingsPage.subscription.features.favorites}</li>
                        <li>✓ {t.settingsPage.subscription.features.support}</li>
                        <li>✓ {t.settingsPage.subscription.features.adFree}</li>
                      </ul>
                    </div>
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
                          <div className="text-3xl font-bold text-blue-600">$2.99</div>
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
