// app/payment-success/page.tsx - 支付成功页面
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchParamsBoundary } from "@/components/search-params-boundary";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  const provider = searchParams.get("provider") || "unknown";
  const orderId = searchParams.get("orderId") || searchParams.get("token") || "unknown";

  useEffect(() => {
    // 模拟支付确认过程
    const confirmPayment = async () => {
      try {
        if (provider === "paypal" && orderId && orderId !== "unknown") {
          // PayPal 支付确认
          console.log(`[DEBUG] Starting PayPal capture for orderId: ${orderId}`);

          const response = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId }),
          });

          console.log(`[DEBUG] Response status: ${response.status}, ok: ${response.ok}`);
          console.log(`[DEBUG] Response headers:`, Object.fromEntries(response.headers.entries()));

          // 检查响应内容类型
          const contentType = response.headers.get('content-type');
          console.log(`[DEBUG] Response content-type: ${contentType}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DEBUG] Error response text:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          let result;
          try {
            const responseText = await response.text();
            console.log(`[DEBUG] Raw response text:`, responseText);

            if (!responseText || responseText.trim() === '') {
              throw new Error('Empty response from server');
            }

            result = JSON.parse(responseText);
            console.log(`[DEBUG] Parsed result:`, result);
          } catch (jsonError) {
            console.error(`[DEBUG] JSON parse error:`, jsonError);
            console.error(`[DEBUG] Response was not valid JSON`);
            throw new Error(`Invalid JSON response: ${jsonError.message}`);
          }

          if (result.success) {
            console.log(`[DEBUG] Payment capture successful:`, result);
            setPaymentDetails(result);

            // 支付成功后，刷新用户订阅状态
            try {
              const refreshResponse = await fetch("/api/auth/refresh-subscription", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (refreshResponse.ok) {
                console.log("User subscription refreshed successfully");
                // 清除本地缓存，强制前端重新获取用户状态
                localStorage.removeItem("supabase-user-cache");
                // 触发自定义事件通知其他组件
                window.dispatchEvent(new CustomEvent('supabase-user-changed'));
              } else {
                console.error("Failed to refresh subscription:", await refreshResponse.text());
              }
            } catch (refreshError) {
              console.error("Error refreshing subscription:", refreshError);
            }
          } else {
            console.error(`[DEBUG] Payment capture failed:`, result);
            throw new Error(result.error || 'Payment capture failed');
          }
        } else if (provider === "stripe") {
          // Stripe 支付通常通过 webhook 处理，这里可以查询状态
          console.log("Stripe payment confirmation handled via webhook");

          // 对于 Stripe，也尝试刷新订阅状态
          try {
            const refreshResponse = await fetch("/api/auth/refresh-subscription", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (refreshResponse.ok) {
              console.log("User subscription refreshed successfully for Stripe");
              localStorage.removeItem("supabase-user-cache");
              window.dispatchEvent(new CustomEvent('supabase-user-changed'));
            }
          } catch (refreshError) {
            console.error("Error refreshing Stripe subscription:", refreshError);
          }
        } else if (orderId === "unknown" || !orderId) {
          console.error("No valid order ID found in URL parameters");
          throw new Error("Missing order ID. Please check your payment status.");
        }
      } catch (error) {
        console.error("Payment confirmation error:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    // 延迟执行以确保 webhook 已处理
    const timer = setTimeout(confirmPayment, 2000);
    return () => clearTimeout(timer);
  }, [provider, orderId]);

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
                </>
              )}

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-600">订阅状态</div>
                <div className="font-medium text-blue-800">已激活</div>
                <div className="text-xs text-blue-600 mt-1">
                  您现在可以享受所有高级功能
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
