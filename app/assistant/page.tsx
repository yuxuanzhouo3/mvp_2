"use client";

/**
 * AI 超级助手页面
 *
 * 功能描述：会员专属 AI 助手的入口页面
 * - 鉴权检查（未登录引导登录）
 * - 加载聊天界面组件
 * - 返回首页导航
 *
 * 路由: /assistant
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/components/language-provider";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import ChatInterface from "@/components/assistant/ChatInterface";

export default function AssistantPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { language } = useLanguage();
  const isCN = isChinaDeployment();
  const locale = language as "zh" | "en";
  const region = isCN ? "CN" : "INTL";

  // 未登录时引导登录
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center animate-pulse">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-gray-400">
            {locale === "zh" ? "加载中..." : "Loading..."}
          </p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {locale === "zh" ? "需要登录" : "Login Required"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {locale === "zh"
              ? "AI 超级助手是会员专属功能，请先登录"
              : "AI Super Assistant is a member-exclusive feature. Please log in first."}
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white"
          >
            {locale === "zh" ? "去登录" : "Go to Login"}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-md mx-auto flex flex-col h-screen">
        {/* 顶部导航栏 */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-800 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-500" />
              {locale === "zh" ? "AI 超级助手" : "AI Super Assistant"}
            </h1>
            <p className="text-[11px] text-gray-400">
              {locale === "zh"
                ? "用一句话搞定地图、外卖、购物、本地生活"
                : "Maps, delivery, shopping, local life - in one sentence"}
            </p>
          </div>
        </div>

        {/* 聊天界面 */}
        <div className="flex-1 px-2 pb-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full">
            <ChatInterface
              locale={locale}
              region={region}
              planType={user.subscriptionTier || "free"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
