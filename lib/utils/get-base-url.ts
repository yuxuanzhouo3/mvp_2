/**
 * 获取当前环境的基础 URL
 * 优先级：
 * 1. NEXT_PUBLIC_APP_URL - 公开的站点 URL（前端和后端通用）
 * 2. VERCEL_URL - Vercel 部署的 URL
 * 3. NEXTAUTH_URL - NextAuth 的 URL（主要用于认证）
 * 4. localhost:3000 - 开发环境默认值
 */
export function getBaseUrl(): string {
  // 1. 优先使用公开的站点 URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // 2. Vercel 部署环境
  if (process.env.VERCEL_URL) {
    const protocol = process.env.VERCEL_ENV === 'production' ? 'https' : 'http'
    return `${protocol}://${process.env.VERCEL_URL}`
  }

  // 3. NextAuth URL（主要用于认证回调）
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }

  // 4. 开发环境默认值
  return 'http://localhost:3000'
}

/**
 * 获取完整的 URL 路径
 * @param path 相对路径，例如 /api/payment/create
 */
export function getFullUrl(path: string): string {
  const baseUrl = getBaseUrl()
  // 确保路径以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  // 确保 baseUrl 没有 / 结尾
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${normalizedBaseUrl}${normalizedPath}`
}