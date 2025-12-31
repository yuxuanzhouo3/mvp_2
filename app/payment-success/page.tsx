// app/payment-success/page.tsx - 支付成功页面
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchParamsBoundary } from "@/components/search-params-boundary";
import { isChinaDeployment } from "@/lib/config/deployment.config";
// 只在 INTL 环境才可能需要 Stripe，CN 环境完全不导入
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth";

// CN 环境标记
const isCN = isChinaDeployment();

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const provider = searchParams.get("provider") || "unknown";
  const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret") || "";
  const orderId =
    searchParams.get("payment_intent") ||
    searchParams.get("orderId") ||
    searchParams.get("token") ||
    "unknown";

  const refreshSubscription = useCallback(async () => {
    try {
      const refreshResponse = await fetchWithAuth("/api/auth/refresh-subscription", {
        method: "POST",
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        console.log("User subscription refreshed:", data);
        
        // 清除旧缓存并更新
        const { clearSupabaseUserCache, saveSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl");
        clearSupabaseUserCache();
        
        // 如果有订阅数据，更新缓存
        if (data.success && data.subscriptionPlan) {
          // 获取当前用户基本信息
          const { auth } = await import("@/lib/auth/client");
          const { data: userData } = await auth.getUser();
          
          if (userData?.user) {
            saveSupabaseUserCache({
              id: userData.user.id,
              email: userData.user.email || "",
              name: userData.user.user_metadata?.full_name,
              avatar: userData.user.user_metadata?.avatar_url,
              subscription_plan: data.subscriptionPlan,
              subscription_status: data.subscriptionStatus || "active",
            });
          }
        }
        
        window.dispatchEvent(new CustomEvent("supabase-user-changed"));
      } else {
        console.error("Failed to refresh subscription:", await refreshResponse.text());
      }
    } catch (refreshError) {
      console.error("Error refreshing subscription:", refreshError);
    }
  }, []);

  useEffect(() => {
    const confirmPayment = async () => {
      setErrorMessage(null);

      try {
        if (provider === "paypal" && orderId && orderId !== "unknown") {
          console.log(`[DEBUG] Starting PayPal capture for orderId: ${orderId}`);

          const response = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const text = await response.text();
          if (!text || text.trim() === "") {
            throw new Error("Empty response from server");
          }

          const result = JSON.parse(text);

          if (result.success) {
            setPaymentDetails(result);
            await refreshSubscription();
          } else {
            throw new Error(result.error || "Payment capture failed");
          }
        } else if (provider === "stripe") {
          // CN 环境不支持 Stripe，直接返回错误
          if (isCN) {
            setErrorMessage("Stripe payment is not supported in this region.");
            setIsProcessing(false);
            return;
          }

          if (!paymentIntentClientSecret) {
            setErrorMessage("Stripe return data missing. Please retry from the pricing page.");
            return;
          }

          // INTL 环境动态导入 Stripe SDK
          const { getStripePromise } = await import("@/lib/stripe-client");
          const stripe = await getStripePromise();
          if (!stripe) {
            setErrorMessage("Stripe is not configured in this environment.");
            return;
          }

          const { paymentIntent, error } = await stripe.retrievePaymentIntent(paymentIntentClientSecret);

          if (error) {
            setErrorMessage(error.message || "Unable to verify Stripe payment.");
            return;
          }

          if (!paymentIntent) {
            setErrorMessage("No payment intent found. Please try again.");
            return;
          }

          const totalAmount =
            (paymentIntent as { amount_received?: number }).amount_received ??
            paymentIntent.amount ??
            0;

          setPaymentDetails({
            amount: totalAmount / 100,
            currency: (paymentIntent.currency || "usd").toUpperCase(),
            captureId: paymentIntent.id,
            status: paymentIntent.status,
          });

          if (paymentIntent.status === "succeeded") {
            // 调用备用确认 API 确保数据库状态正确更新
            // 这解决了 webhook 可能失败的问题
            try {
              console.log("[PaymentSuccess] Calling confirm API for payment:", paymentIntent.id);
              const confirmResponse = await fetchWithAuth("/api/payment/confirm", {
                method: "POST",
                body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
              });

              if (confirmResponse.ok) {
                const confirmResult = await confirmResponse.json();
                console.log("[PaymentSuccess] Payment confirmed:", confirmResult);
              } else {
                console.error("[PaymentSuccess] Confirm API failed:", await confirmResponse.text());
              }
            } catch (confirmError) {
              console.error("[PaymentSuccess] Error calling confirm API:", confirmError);
              // 不阻止用户流程，因为 webhook 可能已经处理成功
            }

            await refreshSubscription();
          } else if (paymentIntent.status === "requires_payment_method") {
            setErrorMessage("Payment was not completed. Please try again with a different card.");
          }
        } else if (orderId === "unknown" || !orderId) {
          setErrorMessage("Missing order ID. Please check your payment status.");
          console.error("No valid order ID found in URL parameters");
        }
      } catch (error: any) {
        console.error("Payment confirmation error:", error);
        setErrorMessage(error?.message || "Unable to confirm payment.");
      } finally {
        setIsProcessing(false);
      }
    };

    confirmPayment();
  }, [provider, orderId, paymentIntentClientSecret, refreshSubscription]);

  const subscriptionStatusLabel =
    isProcessing
      ? "确认中"
      : errorMessage
      ? "待确认"
      : paymentDetails?.status && paymentDetails.status !== "succeeded"
      ? "处理中"
      : "已激活";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-800">
            支付成功！
          </CardTitle>
          <CardDescription>
            感谢您的购买，您的订阅已激活
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && !isProcessing && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          {isProcessing ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">正在处理您的支付...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">支付方式</div>
                <div className="font-medium capitalize">{provider}</div>
              </div>

              {paymentDetails && (
                <>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">订单金额</div>
                    <div className="font-medium">
                      ${paymentDetails.amount} {paymentDetails.currency}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">交易ID</div>
                    <div className="font-mono text-xs break-all">
                      {paymentDetails.captureId || orderId}
                    </div>
                  </div>
                  {paymentDetails.status && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600">支付状态</div>
                      <div className="font-medium capitalize">{paymentDetails.status}</div>
                    </div>
                  )}
                </>
              )}

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-600">订阅状态</div>
                <div className="font-medium text-blue-800">
                  {subscriptionStatusLabel}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {paymentDetails?.status
                    ? `支付状态：${paymentDetails.status}`
                    : errorMessage
                    ? "支付还未完成，请稍后重试或联系我们支持。"
                    : "您现在可以享受所有高级功能"}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 space-y-2">
            <Button
              onClick={() => router.push("/settings")}
              className="w-full"
              disabled={isProcessing}
            >
              查看订阅详情
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full"
              disabled={isProcessing}
            >
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <SearchParamsBoundary>
      <PaymentSuccessContent />
    </SearchParamsBoundary>
  );
}
