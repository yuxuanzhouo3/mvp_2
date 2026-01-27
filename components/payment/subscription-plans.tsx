"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Building2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsIPhone } from "@/hooks/use-device";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  currency: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

interface SubscriptionPlansProps {
  onSelectPlan: (planId: string, billingCycle: "monthly" | "yearly") => void;
  currentPlan?: string;
}

export function SubscriptionPlans({
  onSelectPlan,
  currentPlan,
}: SubscriptionPlansProps) {
  const { user } = useAuth();
  const isIPhone = useIsIPhone();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans: SubscriptionPlan[] = [
    {
      id: "free",
      name: language === "zh" ? "免费版" : "Free",
      description: language === "zh" ? "适合个人使用" : "Perfect for individuals",
      price: { monthly: 0, yearly: 0 },
      currency: "USD",
      features: [
        language === "zh" ? "基础功能" : "Basic features",
        language === "zh" ? "每月 100 次请求" : "100 requests per month",
        language === "zh" ? "社区支持" : "Community support",
      ],
      icon: <Zap className="h-6 w-6" />,
    },
    {
      id: "pro",
      name: language === "zh" ? "专业版" : "Pro",
      description: language === "zh" ? "适合专业用户" : "Perfect for professionals",
      price: { monthly: 9.99, yearly: 99.99 },
      currency: "USD",
      features: [
        language === "zh" ? "所有基础功能" : "All basic features",
        language === "zh" ? "无限请求次数" : "Unlimited requests",
        language === "zh" ? "优先支持" : "Priority support",
        language === "zh" ? "高级 AI 模型" : "Advanced AI models",
      ],
      popular: true,
      icon: <Crown className="h-6 w-6" />,
    },
    {
      id: "enterprise",
      name: language === "zh" ? "企业版" : "Enterprise",
      description: language === "zh" ? "适合企业团队" : "Perfect for teams",
      price: { monthly: 49.99, yearly: 499.99 },
      currency: "USD",
      features: [
        language === "zh" ? "所有专业功能" : "All pro features",
        language === "zh" ? "团队协作" : "Team collaboration",
        language === "zh" ? "企业级安全" : "Enterprise security",
        language === "zh" ? "专属支持" : "Dedicated support",
        language === "zh" ? "自定义集成" : "Custom integrations",
      ],
      icon: <Building2 className="h-6 w-6" />,
    },
  ];

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: currency.toLowerCase(),
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    return currentPlan === planId;
  };

  return (
    <div className="space-y-6">
      {/* 账单周期选择 */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {language === "zh" ? "月付" : "Monthly"}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
              billingCycle === "yearly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {language === "zh" ? "年付" : "Yearly"}
            <Badge variant="secondary" className="ml-2 text-xs">
              {language === "zh" ? "省20%" : "Save 20%"}
            </Badge>
          </button>
        </div>
      </div>

      {/* 价格卡片 */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.popular
                ? "border-2 border-blue-500 shadow-lg scale-105"
                : "border border-gray-200"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <Badge className="bg-blue-600 text-white">
                  {language === "zh" ? "最受欢迎" : "Most Popular"}
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2">
                <div className={`p-3 rounded-full ${
                  plan.popular ? "bg-blue-100" : "bg-gray-100"
                }`}>
                  {plan.icon}
                </div>
              </div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>

              <div className="mt-4">
                <div className="text-3xl font-bold">
                  {plan.price[billingCycle] === 0
                    ? (language === "zh" ? "免费" : "Free")
                    : formatPrice(plan.price[billingCycle], plan.currency)
                  }
                </div>
                {plan.price[billingCycle] > 0 && (
                  <div className="text-sm text-gray-600">
                    {billingCycle === "monthly"
                      ? (language === "zh" ? "每月" : "per month")
                      : (language === "zh" ? "每年" : "per year")
                    }
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {(!isIPhone || plan.id === "free") && (
                <Button
                  onClick={() => onSelectPlan(plan.id, billingCycle)}
                  disabled={isCurrentPlan(plan.id)}
                  className={`w-full ${
                    plan.popular
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      : ""
                  }`}
                  variant={plan.id === "free" ? "outline" : "default"}
                >
                  {isCurrentPlan(plan.id)
                    ? (language === "zh" ? "当前计划" : "Current Plan")
                    : plan.id === "free"
                    ? (language === "zh" ? "当前免费计划" : "Current Free Plan")
                    : (language === "zh" ? "选择此计划" : "Select This Plan")
                  }
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
