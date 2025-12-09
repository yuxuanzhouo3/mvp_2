/**
 * 链接验证器
 * 确保所有推荐链接都是真实的、可访问的
 */

/**
 * 链接验证结果
 */
export interface LinkValidationResult {
    isValid: boolean;
    error?: string;
    protocol?: string;
    hostname?: string;
    url?: string;
}

/**
 * 验证链接是否有效
 */
export function validateLink(link: string): LinkValidationResult {
    if (!link) {
        return { isValid: false, error: "Link is empty" };
    }

    try {
        const url = new URL(link);

        // 1. 检查协议
        if (!["http:", "https:"].includes(url.protocol)) {
            return {
                isValid: false,
                error: `Invalid protocol: ${url.protocol}. Only http and https are allowed.`,
                protocol: url.protocol,
            };
        }

        // 2. 检查主机名
        if (!url.hostname) {
            return {
                isValid: false,
                error: "Missing hostname",
                hostname: url.hostname,
            };
        }

        // 3. 禁止示例域名
        const forbiddenDomains = [
            "example.com",
            "test.com",
            "localhost",
            "127.0.0.1",
            "example.org",
            "example.net",
        ];

        if (forbiddenDomains.includes(url.hostname.toLowerCase())) {
            return {
                isValid: false,
                error: `Placeholder/example domain not allowed: ${url.hostname}`,
                hostname: url.hostname,
            };
        }

        // 4. 检查是否是本地或私有地址
        const privateRanges = [
            /^localhost$/i,
            /^127\.0\.0\.\d+$/,
            /^192\.168\.\d+\.\d+$/,
            /^10\.\d+\.\d+\.\d+$/,
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        ];

        if (privateRanges.some((range) => range.test(url.hostname))) {
            return {
                isValid: false,
                error: `Private/local IP address not allowed: ${url.hostname}`,
                hostname: url.hostname,
            };
        }

        // 5. 检查域名格式（至少要有一个点）
        if (!url.hostname.includes(".")) {
            return {
                isValid: false,
                error: `Invalid hostname format: ${url.hostname}. Must include domain extension.`,
                hostname: url.hostname,
            };
        }

        // 6. 禁止生成式URL（常见的AI幻觉）
        const aiHallucinationPatterns = [
            /\/product\/[0-9a-f\-]+\s*$/i, // /product/{id}
            /\/\[.*\]/i, // /[param]
            /\/\{\{.*\}\}/i, // /{{param}}
            /\/\$\{.*\}/i, // /${param}
            /api\.example/i,
            /data\.example/i,
        ];

        if (aiHallucinationPatterns.some((pattern) => pattern.test(link))) {
            return {
                isValid: false,
                error: `Suspicious generated URL pattern detected: ${link}`,
                url: link,
            };
        }

        // 7. 检查URL长度（过长可能是错误）
        if (link.length > 2048) {
            return {
                isValid: false,
                error: `URL too long (${link.length} chars, max 2048)`,
                url: link,
            };
        }

        // 所有检查通过
        return {
            isValid: true,
            protocol: url.protocol,
            hostname: url.hostname,
            url: link,
        };
    } catch (error) {
        return {
            isValid: false,
            error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`,
            url: link,
        };
    }
}

/**
 * 过滤有效链接
 */
export function filterValidLinks<T extends { link: string }>(items: T[]): T[] {
    return items.filter((item) => {
        const validation = validateLink(item.link);
        if (!validation.isValid) {
            console.warn(`[Link Validation] ❌ Link: ${item.link}, Error: ${validation.error}`);
            return false;
        }
        console.log(`[Link Validation] ✅ Valid link: ${validation.url}`);
        return true;
    });
}

/**
 * 批量验证链接
 */
export function validateLinks(links: string[]): { valid: string[]; invalid: Array<{ link: string; error: string }> } {
    const valid: string[] = [];
    const invalid: Array<{ link: string; error: string }> = [];

    for (const link of links) {
        const result = validateLink(link);
        if (result.isValid) {
            valid.push(link);
        } else {
            invalid.push({
                link,
                error: result.error || "Unknown error",
            });
        }
    }

    return { valid, invalid };
}

/**
 * 推荐类型和常见真实链接的映射
 * 用于快速检查推荐是否来自正确的来源
 */
export const KNOWN_PLATFORMS: Record<string, string[]> = {
    book: ["douban.com", "amazon.com", "books.google.com", "zhihu.com"],
    movie: ["douban.com", "imdb.com", "bilibili.com", "qq.com"],
    music: ["163.com", "qq.com", "bilibili.com", "spotify.com"],
    game: ["douban.com", "qq.com", "netease.com", "mihoyo.com"],
    video: ["bilibili.com", "youtube.com", "youku.com", "qq.com"],
    product: ["taobao.com", "jd.com", "amazon.com", "amazon.cn"],
    location: ["amap.com", "baidu.com", "google.com"],
    restaurant: ["amap.com", "dianping.com", "baidu.com"],
    recipe: ["meishichina.com", "xiachufang.com"],
    hotel: ["amap.com", "airbnb.com", "booking.com"],
    course: ["bilibili.com", "qq.com", "udemy.com"],
};

/**
 * 验证推荐是否来自合理的平台
 */
export function isFromKnownPlatform(linkType: string, hostname: string): boolean {
    const platforms = KNOWN_PLATFORMS[linkType] || [];
    return platforms.some((platform) => hostname.toLowerCase().includes(platform.toLowerCase()));
}
