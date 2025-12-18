/**
 * Locale utilities
 * 地区工具函数
 */

export type Locale = 'zh' | 'en';

/**
 * 获取当前地区设置
 * Get current locale based on deployment region
 * 
 * INTL = English (default)
 * CN = Chinese
 */
export function getLocale(): Locale {
  // 优先从环境变量获取
  const region = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION;

  if (region === 'CN') {
    return 'zh';
  }

  // INTL or default = English
  return 'en';
}

/**
 * 获取客户端地区设置
 * Get client-side locale
 * 
 * INTL = English (default)
 * CN = Chinese
 */
export function getClientLocale(): Locale {
  // 服务器端获取的环境变量在客户端也可以访问
  const region = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION;

  if (region === 'CN') {
    return 'zh';
  }

  // INTL or default = English
  return 'en';
}

/**
 * 根据地区获取货币符号
 * Get currency symbol based on locale
 */
export function getCurrencySymbol(locale?: Locale): string {
  const currentLocale = locale || getLocale();
  return currentLocale === 'zh' ? '¥' : '$';
}

/**
 * 格式化数字
 * Format number based on locale
 */
export function formatNumber(num: number, locale?: Locale): string {
  const currentLocale = locale || getLocale();
  const localeString = currentLocale === 'zh' ? 'zh-CN' : 'en-US';

  return new Intl.NumberFormat(localeString).format(num);
}

/**
 * 格式化货币
 * Format currency based on locale
 */
export function formatCurrency(
  amount: number,
  currency: 'CNY' | 'USD' = 'CNY',
  locale?: Locale
): string {
  const currentLocale = locale || getLocale();
  const localeString = currentLocale === 'zh' ? 'zh-CN' : 'en-US';

  return new Intl.NumberFormat(localeString, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * 格式化日期
 * Format date based on locale
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  const currentLocale = locale || getLocale();
  const localeString = currentLocale === 'zh' ? 'zh-CN' : 'en-US';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(localeString, options || defaultOptions).format(dateObj);
}

/**
 * 获取相对时间格式化函数
 * Get relative time formatter
 */
export function getRelativeTimeFormatter(locale?: Locale): Intl.RelativeTimeFormat {
  const currentLocale = locale || getLocale();
  const localeString = currentLocale === 'zh' ? 'zh-CN' : 'en-US';

  return new Intl.RelativeTimeFormat(localeString, {
    numeric: 'auto',
  });
}