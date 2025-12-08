"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Language } from "@/lib/i18n";
import { isChinaDeployment } from "@/lib/config/deployment.config";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const STORAGE_KEY = "preferred-language";
const STORAGE_REGION_KEY = "deployment-region-version";

/**
 * 语言提供者组件
 * Language Provider Component
 *
 * 功能：
 * 1. 管理全局语言状态
 * 2. 持久化到 localStorage
 * 3. 根据部署区域自动设置默认语言（中国区域=中文，国际区域=英文）
 * 4. 允许用户手动切换语言偏好
 * 5. 提供语言切换功能
 * 6. 部署区域变更时自动重置语言选择
 *
 * 优先级：
 * 1. 检查部署区域是否变更，如有变更则重置为新区域默认语言
 * 2. localStorage 中的用户选择（若未变更）
 * 3. 部署区域设置（DEPLOYMENT_REGION）
 *    - 中国区域 (CN)：默认中文
 *    - 国际区域 (INTL)：默认英文
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  // 默认使用英文（国际版默认）
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  // 初始化语言
  useEffect(() => {
    setMounted(true);

    // 根据部署区域获取期望的默认语言
    const isChinaRegion = isChinaDeployment();
    const expectedLanguage: Language = isChinaRegion ? "zh" : "en";
    const currentRegion = isChinaRegion ? "CN" : "INTL";

    console.log("=== LanguageProvider Init ===");
    console.log("Current deployment region:", currentRegion);
    console.log("Expected language:", expectedLanguage);

    // 检查部署区域是否变更
    const savedRegion = localStorage.getItem(STORAGE_REGION_KEY);
    const regionChanged = savedRegion && savedRegion !== currentRegion;

    console.log("Saved region in storage:", savedRegion);
    console.log("Region changed:", regionChanged);

    // 如果部署区域变更，重置语言为新区域的默认语言
    if (regionChanged) {
      console.log("Region changed from", savedRegion, "to", currentRegion, "- resetting language to", expectedLanguage);
      setLanguageState(expectedLanguage);
      localStorage.setItem(STORAGE_KEY, expectedLanguage);
      localStorage.setItem(STORAGE_REGION_KEY, currentRegion);
      return;
    }

    // 优先级1: 从 localStorage 读取用户选择（如果区域未变更）
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    console.log("Saved language from localStorage:", saved);

    if (saved && (saved === "zh" || saved === "en")) {
      console.log("Using saved language from localStorage:", saved);
      setLanguageState(saved);
      localStorage.setItem(STORAGE_REGION_KEY, currentRegion);
      return;
    }

    // 优先级2: 根据部署区域推断默认语言（首次访问或存储损坏）
    console.log("Setting language to", expectedLanguage, "(deployment region:", currentRegion, ")");
    setLanguageState(expectedLanguage);
    localStorage.setItem(STORAGE_KEY, expectedLanguage);
    localStorage.setItem(STORAGE_REGION_KEY, currentRegion);
  }, []);

  // 设置语言（带持久化）
  const setLanguage = (lang: Language) => {
    console.log("setLanguage called with:", lang);
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  // 切换语言（中英文互换）
  const toggleLanguage = () => {
    const newLang: Language = language === "zh" ? "en" : "zh";
    setLanguage(newLang);
    console.log("Toggle language to:", newLang);
  };

  // 避免服务端渲染不匹配
  if (!mounted) {
    return (
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: () => {},
          toggleLanguage: () => {},
        }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * 使用语言的 Hook
 * Use Language Hook
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
