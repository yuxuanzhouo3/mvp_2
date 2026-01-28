"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/language-provider";
import { useHideSubscriptionUI } from "@/hooks/use-hide-subscription-ui";

interface PaymentFormProps {
  planId: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  description: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

type PaymentMethod = "stripe" | "paypal";

export function PaymentForm({
  planId,
  billingCycle,
  amount,
  currency,
  description,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const hideSubscriptionUI = useHideSubscriptionUI();

  const paymentMethods = [
    {
      id: "stripe" as PaymentMethod,
      name: "Stripe",
      description: language === "zh" ? "信用卡支付" : "Credit Card Payment",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      id: "paypal" as PaymentMethod,
      name: "PayPal",
      description: language === "zh" ? "PayPal 账户支付" : "PayPal Account Payment",
      icon: (
        <div className="h-5 w-5 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          P
        </div>
      ),
    },
  ];

  const handlePayment = async () => {
    if (!selectedMethod || !user?.id) {
      onError("Please select a payment method");
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: selectedMethod,
          amount,
          currency,
          planType: planId,
          billingCycle,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment creation failed");
      }

      if (selectedMethod === "paypal" && data.paymentUrl) {
        // 重定向到 PayPal 支付页面
        window.location.href = data.paymentUrl;
      } else if (selectedMethod === "stripe" && data.clientSecret) {
        // 处理 Stripe 支付（这里可以集成 Stripe Elements）
        toast({
          title: "Payment Initiated",
          description: "Redirecting to secure payment...",
        });
        // 这里可以集成 Stripe Elements 或重定向到专门的 Stripe 支付页面
        setTimeout(() => {
          onSuccess(data);
        }, 2000);
      } else {
        onSuccess(data);
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      onError(error.message || "Payment failed");
      toast({
        title: "Payment Error",
        description: error.message || "Payment failed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: currency.toLowerCase(),
    }).format(amount);
  };

  if (hideSubscriptionUI) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{language === "zh" ? "功能不可用" : "Not available"}</CardTitle>
          <CardDescription>
            {language === "zh" ? "当前设备暂不支持该功能" : "This feature is not available on this device."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {language === "zh" ? "选择支付方式" : "Select Payment Method"}
        </CardTitle>
        <CardDescription>
          {language === "zh" ? "完成您的订阅支付" : "Complete your subscription payment"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 订单摘要 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">
            {language === "zh" ? "订单摘要" : "Order Summary"}
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{description}</span>
              <span className="font-medium">{formatAmount(amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{language === "zh" ? "账单周期" : "Billing Cycle"}</span>
              <span>{billingCycle === "monthly" ? (language === "zh" ? "月付" : "Monthly") : (language === "zh" ? "年付" : "Yearly")}</span>
            </div>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-medium">
            <span>{language === "zh" ? "总计" : "Total"}</span>
            <span>{formatAmount(amount, currency)}</span>
          </div>
        </div>

        {/* 支付方式选择 */}
        <div>
          <h3 className="font-medium mb-3">
            {language === "zh" ? "支付方式" : "Payment Method"}
          </h3>
          <RadioGroup value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as PaymentMethod)}>
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <RadioGroupItem value={method.id} id={method.id} />
                <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {method.icon}
                      <div>
                        <div className="font-medium">{method.name}</div>
                        <div className="text-sm text-gray-500">{method.description}</div>
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* 支付按钮 */}
        <Button
          onClick={handlePayment}
          disabled={isProcessing || !selectedMethod}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === "zh" ? "处理中..." : "Processing..."}
            </>
          ) : (
            <>
              {language === "zh" ? "立即支付" : "Pay Now"} {formatAmount(amount, currency)}
            </>
          )}
        </Button>

        {/* 安全提示 */}
        <div className="text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              🔒 SSL 加密保护
            </Badge>
            <Badge variant="outline" className="text-xs">
              💳 安全支付
            </Badge>
          </div>
          <p className="mt-2">
            {language === "zh"
              ? "您的支付信息安全加密，不会存储在我们的服务器上"
              : "Your payment information is securely encrypted and never stored on our servers"
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
