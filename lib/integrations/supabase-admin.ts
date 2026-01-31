import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role for RLS-protected operations
// IMPORTANT: Do NOT import this file in client components. Server-only usage.

// 延迟初始化 Supabase 管理员客户端
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  // 延迟到运行时才读取环境变量
  // 优先使用服务端专用 SUPABASE_URL，其次用公开 URL
  const supabaseUrl = (
    process.env["SUPABASE_URL"] ||
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ||
    ""
  ).trim();
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || "";

  const isProduction = process.env.NODE_ENV === "production";
  const isPlaceholderUrl =
    supabaseUrl.includes("placeholder.supabase.co") || supabaseUrl.includes("build-placeholder");

  if (isProduction && (!supabaseUrl || isPlaceholderUrl)) {
    throw new Error(
      "❌ Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in production (or still using placeholder). " +
        "Please set real Supabase URL in runtime environment variables."
    );
  }

  // 在生产环境中，强制要求服务角色密钥
  if (!serviceRoleKey) {
    if (isProduction) {
      throw new Error(
        "❌ SUPABASE_SERVICE_ROLE_KEY is required in production. " +
        "Please set it in your environment variables."
      );
    } else {
      console.warn(
        "⚠️  SUPABASE_SERVICE_ROLE_KEY is not set. Using ANON_KEY for admin operations. " +
        "This may cause permission issues in production."
      );
    }
  }

  supabaseAdminInstance = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    serviceRoleKey || anonKey || "placeholder-key",
    {
      auth: { persistSession: false },
    }
  );

  return supabaseAdminInstance;
}

// 向后兼容：导出默认的 supabaseAdmin 客户端（使用 getter）
export const supabaseAdmin = new Proxy({} as any, {
  get: (target, prop) => {
    const admin = getSupabaseAdmin();
    return admin[prop as keyof typeof admin];
  },
});
