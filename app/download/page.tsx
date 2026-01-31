"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, ArrowLeft, Smartphone, Laptop, Apple } from "lucide-react";
import {
  getDownloadConfig,
  detectUserPlatform,
  PlatformType,
  DownloadItem,
} from "@/lib/config/download.config";
import { isChinaDeployment } from "@/lib/config/deployment.config";

export default function DownloadPage() {
  const [isChina, setIsChina] = useState(false);
  const [userPlatform, setUserPlatform] = useState<PlatformType | null>(null);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  useEffect(() => {
    // 检测部署区域
    const china = isChinaDeployment();
    setIsChina(china);

    // 获取下载配置
    const config = getDownloadConfig(china ? "CN" : "INTL");
    setDownloads(config.downloads);

    // 检测用户设备
    const platform = detectUserPlatform();
    setUserPlatform(platform);
  }, []);

  /**
   * 生成下载链接
   */
  const getDownloadLink = (download: DownloadItem): string => {
    if (isChina && download.fileID) {
      // CN环境: 调用API下载
      const params = new URLSearchParams({
        platform: download.platform,
        region: "CN",
      });
      if (download.arch) {
        params.append("arch", download.arch);
      }
      return `/api/downloads?${params.toString()}`;
    }

    // INTL环境: 检查URL类型
    if (!isChina && download.url) {
      // 如果是Supabase Storage路径,通过API路由下载
      if (download.url.startsWith("supabase://")) {
        const params = new URLSearchParams({
          platform: download.platform,
          region: "INTL",
        });
        if (download.arch) {
          params.append("arch", download.arch);
        }
        return `/api/downloads?${params.toString()}`;
      }
      // 外部URL直接返回
      return download.url;
    }

    return "#";
  };

  /**
   * 获取平台图标
   */
  const getPlatformIcon = (platform: PlatformType) => {
    switch (platform) {
      case "android":
        return <Smartphone className="w-12 h-12" />;
      case "ios":
        return <Apple className="w-12 h-12" />;
      case "windows":
        return <Laptop className="w-12 h-12" />;
      case "macos":
        return <Apple className="w-12 h-12" />;
      case "linux":
        return <Laptop className="w-12 h-12" />;
      default:
        return <Download className="w-12 h-12" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* 顶部导航 */}
      <div className="container mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isChina ? "返回首页" : "Back to Home"}</span>
        </Link>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* 标题部分 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
            <Download className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {isChina ? "下载客户端" : "Download Client"}
          </h1>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            {isChina
              ? "下载辰汇个性推荐客户端，享受更流畅的AI推荐体验"
              : "Download RandomLife client for a better AI recommendation experience"}
          </p>
        </motion.div>

        {/* 平台下载卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {downloads.map((download, index) => {
            const isUserPlatform =
              download.platform === userPlatform &&
              (download.platform !== "macos" || !download.arch);
            const isAvailable = download.available !== false; // 默认为可用

            return (
              <motion.div
                key={`${download.platform}-${download.arch || "default"}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {isAvailable ? (
                  <a
                    href={getDownloadLink(download)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      block p-6 rounded-xl border-2 transition-all duration-300
                      hover:shadow-lg hover:scale-105 hover:border-blue-500
                      ${isUserPlatform
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                      }
                    `}
                  >
                    {/* 图标 */}
                    <div
                      className={`
                      flex items-center justify-center mb-4
                      ${isUserPlatform ? "text-blue-600" : "text-gray-700"}
                    `}
                    >
                      {getPlatformIcon(download.platform, download.arch)}
                    </div>

                    {/* 平台名称 */}
                    <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                      {download.label}
                    </h3>

                    {/* 推荐标签 */}
                    {isUserPlatform && (
                      <div className="flex justify-center mb-3">
                        <span className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
                          {isChina ? "推荐" : "Recommended"}
                        </span>
                      </div>
                    )}

                    {/* 下载按钮 */}
                    <div className="flex items-center justify-center gap-2 text-blue-600 font-medium">
                      <Download className="w-4 h-4" />
                      <span>{isChina ? "立即下载" : "Download Now"}</span>
                    </div>
                  </a>
                ) : (
                  <div
                    className={`
                      block p-6 rounded-xl border-2 cursor-not-allowed
                      border-gray-300 bg-gray-50 opacity-75
                    `}
                  >
                    {/* 图标 */}
                    <div className="flex items-center justify-center mb-4 text-gray-400">
                      {getPlatformIcon(download.platform, download.arch)}
                    </div>

                    {/* 平台名称 */}
                    <h3 className="text-xl font-semibold text-gray-500 text-center mb-2">
                      {download.label}
                    </h3>

                    {/* 尚未上线提示 */}
                    <div className="flex justify-center mb-3">
                      <span className="px-3 py-1 text-xs font-medium bg-gray-400 text-white rounded-full">
                        {isChina ? "尚未上线" : "Coming Soon"}
                      </span>
                    </div>

                    {/* 敬请期待 */}
                    <div className="flex items-center justify-center gap-2 text-gray-500 font-medium">
                      <span>{isChina ? "敬请期待！" : "Stay Tuned!"}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 更新日志 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 bg-white rounded-xl border border-gray-200 p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isChina ? "最新更新" : "Latest Updates"}
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isChina ? "版本 1.0.0" : "Version 1.0.0"}
              </h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>
                  {isChina
                    ? "全新的AI推荐引擎，更智能的个性化推荐"
                    : "New AI recommendation engine with smarter personalization"}
                </li>
                <li>
                  {isChina
                    ? "支持多平台同步，无缝切换设备"
                    : "Multi-platform sync for seamless device switching"}
                </li>
                <li>
                  {isChina
                    ? "优化界面设计，提升用户体验"
                    : "Improved UI design for better user experience"}
                </li>
                <li>
                  {isChina
                    ? "修复已知问题，提升稳定性"
                    : "Bug fixes and stability improvements"}
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 系统要求 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>
            {isChina
              ? "系统要求：Android 8.0+, iOS 13+, Windows 10+, macOS 10.15+, Ubuntu 20.04+"
              : "System Requirements: Android 8.0+, iOS 13+, Windows 10+, macOS 10.15+, Ubuntu 20.04+"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
