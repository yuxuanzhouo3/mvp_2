export type ParsedUserAgent = {
  device: string | null;
  os: string | null;
  browser: string | null;
};

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const value = (ua || "").toLowerCase();

  const device =
    value.includes("iphone") || value.includes("ipad")
      ? "ios"
      : value.includes("android")
      ? "android"
      : value.includes("mobile")
      ? "mobile"
      : value
      ? "desktop"
      : null;

  const os =
    value.includes("windows")
      ? "windows"
      : value.includes("mac os") || value.includes("macintosh")
      ? "mac"
      : value.includes("android")
      ? "android"
      : value.includes("iphone") || value.includes("ipad") || value.includes("ios")
      ? "ios"
      : value.includes("linux")
      ? "linux"
      : null;

  const browser =
    value.includes("edg/")
      ? "edge"
      : value.includes("chrome/") && !value.includes("edg/")
      ? "chrome"
      : value.includes("safari/") && !value.includes("chrome/")
      ? "safari"
      : value.includes("firefox/")
      ? "firefox"
      : null;

  return { device, os, browser };
}

