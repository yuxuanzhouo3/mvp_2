/**
 * 下载配置文件
 * 支持CN环境（腾讯云CloudBase）和INTL环境（Supabase Storage）
 */

export type PlatformType =
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "linux";

export type MacOSArchType = "intel" | "apple-silicon";

export interface DownloadItem {
  platform: PlatformType;
  label: string;
  icon: string;
  // CN环境: 使用CloudBase fileID
  fileID?: string;
  fileName?: string;
  // INTL环境: 使用Supabase Storage路径或外部URL
  url?: string;
  // macOS可能有不同架构
  arch?: MacOSArchType;
  // 是否可用（如果为false，则显示"尚未上线"）
  available?: boolean;
}

export interface RegionDownloadConfig {
  region: "CN" | "INTL";
  downloads: DownloadItem[];
}

/**
 * CN版本下载配置（国内）
 * 文件存储在腾讯云CloudBase
 */
const chinaDownloads: RegionDownloadConfig = {
  region: "CN",
  downloads: [
    {
      platform: "android",
      label: "Android 应用",
      icon: "📱",
      fileID:
        process.env.CN_ANDROID_FILE_ID ||
        "cloud://your-bucket/downloads/android-app.apk",
      fileName: "RandomLife-Android.apk",
    },
    {
      platform: "ios",
      label: "iOS 应用",
      icon: "🍎",
      fileID:
        process.env.CN_IOS_FILE_ID ||
        "cloud://your-bucket/downloads/ios-app.ipa",
      fileName: "RandomLife-iOS.ipa",
      available: false, // 尚未上线
    },
    {
      platform: "windows",
      label: "Windows 客户端",
      icon: "🪟",
      fileID:
        process.env.CN_WINDOWS_FILE_ID ||
        "cloud://your-bucket/downloads/windows-app.msi",
      fileName: "辰汇个性推荐.msi",
    },
    {
      platform: "macos",
      label: "macOS (Intel)",
      icon: "💻",
      fileID:
        process.env.CN_MACOS_INTEL_FILE_ID ||
        "cloud://your-bucket/downloads/macos-intel-app.dmg",
      fileName: "辰汇个性推荐.dmg",
      arch: "intel",
      available: false, // 已下线
    },
    {
      platform: "macos",
      label: "macOS (Apple Silicon)",
      icon: "💻",
      fileID:
        process.env.CN_MACOS_APPLE_SILICON_FILE_ID ||
        "cloud://your-bucket/downloads/macos-arm-app.dmg",
      fileName: "RandomLife-macOS-AppleSilicon.dmg",
      arch: "apple-silicon",
    },
    {
      platform: "linux",
      label: "Linux 客户端",
      icon: "🐧",
      fileID:
        process.env.CN_LINUX_FILE_ID ||
        "cloud://your-bucket/downloads/linux-app.AppImage",
      fileName: "RandomLife-Linux.AppImage",
      available: false, // 尚未上线
    },
  ],
};

/**
 * INTL版本下载配置（国际）
 * 文件存储在Supabase Storage或外部链接
 */
const internationalDownloads: RegionDownloadConfig = {
  region: "INTL",
  downloads: [
    {
      platform: "android",
      label: "Android App",
      icon: "📱",
      url:
        process.env.NEXT_PUBLIC_INTL_ANDROID_URL ||
        "https://play.google.com/store/apps/details?id=com.randomlife.app",
    },
    {
      platform: "ios",
      label: "iOS App",
      icon: "🍎",
      url:
        process.env.NEXT_PUBLIC_INTL_IOS_URL ||
        "https://apps.apple.com/app/randomlife/id123456789",
      available: false, // Coming Soon
    },
    {
      platform: "windows",
      label: "Windows Client",
      icon: "🪟",
      url:
        process.env.NEXT_PUBLIC_INTL_WINDOWS_URL ||
        "supabase://downloads/Windows/Recommend.msi",
      fileName: "Recommend.msi",
    },
    {
      platform: "macos",
      label: "macOS (Intel)",
      icon: "💻",
      url:
        process.env.NEXT_PUBLIC_INTL_MACOS_INTEL_URL ||
        "supabase://downloads/macOS/MornRandomLife.dmg",
      arch: "intel",
      fileName: "MornRandomLife.dmg",
      available: false, // 已下线
    },
    {
      platform: "macos",
      label: "macOS (Apple Silicon)",
      icon: "💻",
      url:
        process.env.NEXT_PUBLIC_INTL_MACOS_APPLE_SILICON_URL ||
        "https://github.com/randomlife/releases/latest/download/RandomLife-macOS-AppleSilicon.dmg",
      arch: "apple-silicon",
    },
    {
      platform: "linux",
      label: "Linux Client",
      icon: "🐧",
      url:
        process.env.NEXT_PUBLIC_INTL_LINUX_URL ||
        "https://github.com/randomlife/releases/latest/download/RandomLife-Linux.AppImage",
      available: false, // Coming Soon
    },
  ],
};

/**
 * 获取下载配置（根据部署区域）
 */
export function getDownloadConfig(region: "CN" | "INTL"): RegionDownloadConfig {
  return region === "CN" ? chinaDownloads : internationalDownloads;
}

/**
 * 检测用户设备平台
 */
export function detectUserPlatform(): PlatformType | null {
  if (typeof window === "undefined") return null;

  const userAgent = window.navigator.userAgent.toLowerCase();

  if (/android/.test(userAgent)) {
    return "android";
  }
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "ios";
  }
  if (/windows/.test(userAgent)) {
    return "windows";
  }
  if (/macintosh|mac os x/.test(userAgent)) {
    return "macos";
  }
  if (/linux/.test(userAgent)) {
    return "linux";
  }

  return null;
}

/**
 * 获取特定平台的下载链接
 */
export function getDownloadUrl(
  platform: PlatformType,
  isChina: boolean,
  arch?: MacOSArchType
): string {
  const config = getDownloadConfig(isChina ? "CN" : "INTL");
  const download = config.downloads.find((d) => {
    if (platform === "macos" && arch) {
      return d.platform === platform && d.arch === arch;
    }
    return d.platform === platform && !d.arch;
  });

  if (!download) {
    return "#";
  }

  // CN环境使用API路由下载
  if (isChina && download.fileID) {
    const params = new URLSearchParams({
      platform: download.platform,
      region: "CN",
    });
    if (arch) {
      params.append("arch", arch);
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
      if (arch) {
        params.append("arch", arch);
      }
      return `/api/downloads?${params.toString()}`;
    }
    // 外部URL直接返回
    return download.url;
  }

  return "#";
}
