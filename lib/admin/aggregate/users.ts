import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  CloudBaseCollections,
  getCloudBaseDatabase,
} from "@/lib/database/cloudbase-client";
import type { AdminDataError, AdminListParams, AdminSourceFilter } from "./types";

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: "CN" | "INTL";
};

export type ListAdminUsersParams = AdminListParams & {
  emailQuery?: string;
};

export async function listAdminUsers(
  params: ListAdminUsersParams
): Promise<{ data: AdminUserRow[]; errors: AdminDataError[] }> {
  const errors: AdminDataError[] = [];
  const tasks: Array<Promise<AdminUserRow[]>> = [];

  const includeCN: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "CN";
  const includeINTL: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "INTL";

  if (includeCN) {
    tasks.push(
      (async () => {
        try {
          const db = getCloudBaseDatabase();
          const collection = db.collection(CloudBaseCollections.USERS);
          let query: any = collection;
          if (params.emailQuery) {
            query = query.where({ email: params.emailQuery });
          }
          let result;
          try {
            result = await query
              .orderBy("createdAt", "desc")
              .skip(params.offset)
              .limit(params.limit)
              .get();
          } catch {
            result = await query
              .orderBy("created_at", "desc")
              .skip(params.offset)
              .limit(params.limit)
              .get();
          }

          return (result.data || []).map((u: any) => ({
            id: String(u._id),
            email: u.email ?? null,
            name: u.name ?? null,
            subscriptionTier: u.subscription_plan ?? "free",
            subscriptionStatus: u.subscription_status ?? "active",
            createdAt: u.createdAt ?? u.created_at ?? null,
            updatedAt: u.updatedAt ?? u.updated_at ?? null,
            source: "CN",
          }));
        } catch (e: any) {
          errors.push({
            source: "CN",
            message: e?.message ? String(e.message) : "CloudBase 查询失败",
          });
          return [];
        }
      })()
    );
  }

  if (includeINTL) {
    tasks.push(
      (async () => {
        try {
          const supabase = getSupabaseAdmin();
          let query = supabase
            .from("user_profiles")
            .select(
              "id,email,full_name,subscription_tier,subscription_status,created_at,updated_at"
            )
            .order("created_at", { ascending: false })
            .range(params.offset, params.offset + params.limit - 1);

          if (params.emailQuery) {
            query = query.ilike("email", `%${params.emailQuery}%`);
          }

          const { data, error } = await query;
          if (error) throw error;

          return (data || []).map((u: any) => ({
            id: String(u.id),
            email: u.email ?? null,
            name: u.full_name ?? null,
            subscriptionTier: u.subscription_tier ?? "free",
            subscriptionStatus: u.subscription_status ?? "active",
            createdAt: u.created_at ?? null,
            updatedAt: u.updated_at ?? null,
            source: "INTL",
          }));
        } catch (e: any) {
          errors.push({
            source: "INTL",
            message: e?.message ? String(e.message) : "Supabase 查询失败",
          });
          return [];
        }
      })()
    );
  }

  const results = await Promise.all(tasks);
  const combined = results.flat();
  combined.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return { data: combined, errors };
}
