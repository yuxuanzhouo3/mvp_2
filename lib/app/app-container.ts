export function isAppContainer(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  if (search.get("app") === "1") return true;

  const w = window as any;
  if (typeof w.JSBridge?.postMessage === "function") return true;
  if (typeof w.median?.auth?.googleSignIn === "function") return true;
  if (typeof w.gonative?.auth?.googleSignIn === "function") return true;
  if (typeof w.ReactNativeWebView?.postMessage === "function") return true;
  if (typeof w.webkit?.messageHandlers?.wechatLogin?.postMessage === "function") return true;
  if (typeof w.webkit?.messageHandlers?.native?.postMessage === "function") return true;
  if (typeof w.Android?.wechatLogin === "function") return true;
  if (
    typeof w.AndroidWeChatBridge?.startLogin === "function" ||
    typeof w.AndroidWeChatBridge?.loginWithState === "function" ||
    typeof w.AndroidWeChatBridge?.login === "function"
  )
    return true;

  // 检测 Median/GoNative 容器
  const ua = navigator.userAgent || "";
  if (ua.includes("median") || ua.includes("gonative")) return true;

  return false;
}

export function getClientHint(): "app" | "web" {
  return isAppContainer() ? "app" : "web";
}
