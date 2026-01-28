// app/payment-cancel/page.tsx - 支付取消页面
"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHideSubscriptionUI } from "@/hooks/use-hide-subscription-ui";

export default function PaymentCancelPage() {
  const router = useRouter();
  const hideSubscriptionUI = useHideSubscriptionUI();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <XCircle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-orange-800">
            支付已取消
          </CardTitle>
          <CardDescription>
            {hideSubscriptionUI ? "操作已取消" : "您的支付已被取消，没有任何费用产生"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              {hideSubscriptionUI
                ? "您的操作已被取消。您的账户和数据都保持不变。"
                : "如果您遇到任何问题或改变了主意，可以随时重新尝试支付。您的账户和数据都保持不变。"}
            </p>
          </div>

          <div className="pt-4 space-y-2">
            {!hideSubscriptionUI && (
              <Button onClick={() => router.push("/pro")} className="w-full">
                返回定价页面
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full"
            >
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
