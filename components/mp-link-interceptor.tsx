"use client";

import { useEffect, useCallback } from "react";
import { isMiniProgram, getWxMiniProgram } from "@/lib/wechat-mp";

/**
 * 微信小程序外部链接拦截器
 * 在微信小程序环境下拦截外部链接，跳转到小程序链接复制页面
 */
export function MpLinkInterceptor() {
  // 判断是否为外部链接
  const isExternalUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    if (url.startsWith("javascript:")) return false;
    if (url.startsWith("#")) return false;
    if (url.startsWith("mailto:")) return false;
    if (url.startsWith("tel:")) return false;

    try {
      const link = new URL(url, window.location.href);
      return link.host !== window.location.host;
    } catch {
      return false;
    }
  }, []);

  // 跳转到小程序链接复制页面
  const navigateToQrcodePage = useCallback((url: string) => {
    const mp = getWxMiniProgram();
    if (!mp || typeof mp.navigateTo !== "function") {
      console.warn("[mp-link-interceptor] navigateTo not available");
      return;
    }

    // 跳转到小程序的链接复制页面，通过 URL 参数传递链接
    const qrcodePageUrl = "/pages/qrcode/qrcode?url=" + encodeURIComponent(url);
    console.log("[mp-link-interceptor] 跳转到链接复制页面:", qrcodePageUrl);
    mp.navigateTo({ url: qrcodePageUrl });
  }, []);

  useEffect(() => {
    // 仅在微信小程序环境下启用拦截
    if (!isMiniProgram()) {
      console.log("[mp-link-interceptor] 非小程序环境，跳过");
      return;
    }

    console.log("[mp-link-interceptor] 外部链接拦截器已启用");

    // 拦截所有链接点击
    const handleClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;

      // 向上查找 <a> 标签
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      const href = anchor.href;

      if (!href) return;

      // 检查是否为外部链接
      if (isExternalUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        console.log("[mp-link-interceptor] 拦截外部链接:", href);
        navigateToQrcodePage(href);
      }
    };

    // 使用捕获阶段监听，确保在其他事件处理器之前拦截
    document.addEventListener("click", handleClick, true);

    // 拦截 window.open
    const originalOpen = window.open;
    window.open = function (url?: string | URL, ...args) {
      const urlStr = url?.toString() || "";
      if (isExternalUrl(urlStr)) {
        console.log("[mp-link-interceptor] 拦截 window.open:", urlStr);
        navigateToQrcodePage(urlStr);
        return null;
      }
      return originalOpen.call(this, url, ...args);
    };

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.open = originalOpen;
    };
  }, [isExternalUrl, navigateToQrcodePage]);

  // 不需要渲染任何内容
  return null;
}
