export function isAppContainer(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  if (search.get("app") === "1") return true;

  const w = window as any;
  if (typeof w.ReactNativeWebView?.postMessage === "function") return true;
  if (typeof w.webkit?.messageHandlers?.wechatLogin?.postMessage === "function") return true;
  if (typeof w.webkit?.messageHandlers?.native?.postMessage === "function") return true;
  if (typeof w.Android?.wechatLogin === "function") return true;

  return false;
}

export function getClientHint(): "app" | "web" {
  return isAppContainer() ? "app" : "web";
}
