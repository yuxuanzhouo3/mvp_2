import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  CloudBaseCollections,
  getCloudBaseDatabase,
  getDbCommand,
} from "@/lib/database/cloudbase-client";
import type { AdminDataError, AdminListParams, AdminSourceFilter } from "./types";

export type AdminPaymentRow = {
  id: string;
  userId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  source: "CN" | "INTL";
};

export type ListAdminPaymentsParams = AdminListParams & {
  status?: string;
  paymentMethod?: string;
};

export async function listAdminPayments(
  params: ListAdminPaymentsParams
): Promise<{ data: AdminPaymentRow[]; errors: AdminDataError[] }> {
  const errors: AdminDataError[] = [];
  const tasks: Array<Promise<AdminPaymentRow[]>> = [];

  const includeCN: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "CN";
  const includeINTL: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "INTL";

  if (includeCN) {
    tasks.push(
      (async () => {
        try {
          const db = getCloudBaseDatabase();
          const cmd = getDbCommand();
          const collection = db.collection(CloudBaseCollections.PAYMENTS);
          let query: any = collection;
          const where: any = {};
          if (params.status) {
            if (params.status === "completed") {
              where.status = cmd.in(["completed", "success"]);
            } else {
              where.status = params.status;
            }
          }
          if (params.paymentMethod) where.payment_method = params.paymentMethod;
          if (Object.keys(where).length > 0) query = query.where(where);

          let result;
          try {
            result = await query
              .orderBy("created_at", "desc")
              .skip(params.offset)
              .limit(params.limit)
              .get();
          } catch {
            result = await query
              .orderBy("createdAt", "desc")
              .skip(params.offset)
              .limit(params.limit)
              .get();
          }

          return (result.data || []).map((p: any) => ({
            id: String(p._id),
            userId: p.user_id ?? null,
            amount: typeof p.amount === "number" ? p.amount : Number(p.amount),
            currency: p.currency ?? null,
            status: p.status ?? null,
            paymentMethod: p.payment_method ?? null,
            transactionId: p.transaction_id ?? null,
            createdAt: p.created_at ?? p.createdAt ?? null,
            completedAt: p.completed_at ?? p.completedAt ?? null,
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
            .from("payments")
            .select(
              "id,user_id,amount,currency,status,payment_method,transaction_id,created_at,completed_at"
            )
            .order("created_at", { ascending: false })
            .range(params.offset, params.offset + params.limit - 1);

          if (params.status) {
            if (params.status === "completed") {
              query = query.in("status", ["completed", "success"]);
            } else {
              query = query.eq("status", params.status);
            }
          }
          if (params.paymentMethod)
            query = query.eq("payment_method", params.paymentMethod);

          const { data, error } = await query;
          if (error) throw error;

          return (data || []).map((p: any) => ({
            id: String(p.id),
            userId: p.user_id ?? null,
            amount: p.amount ?? null,
            currency: p.currency ?? null,
            status: p.status ?? null,
            paymentMethod: p.payment_method ?? null,
            transactionId: p.transaction_id ?? null,
            createdAt: p.created_at ?? null,
            completedAt: p.completed_at ?? null,
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

export type PaymentDailyStat = {
  date: string;
  revenue: number;
  paidCount: number;
};

export async function getPaymentStats(params: {
  source: AdminSourceFilter;
  days: number;
}): Promise<{ byDay: PaymentDailyStat[]; errors: AdminDataError[] }> {
  const errors: AdminDataError[] = [];
  const includeCN: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "CN";
  const includeINTL: boolean =
    params.source === "ALL" || (params.source as AdminSourceFilter) === "INTL";

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - Math.max(1, params.days) + 1);
  const startIso = start.toISOString();

  const dayKey = (iso: string): string => iso.slice(0, 10);
  const map = new Map<string, PaymentDailyStat>();
  for (let i = 0; i < params.days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, revenue: 0, paidCount: 0 });
  }

  const tasks: Array<Promise<void>> = [];

  if (includeCN) {
    tasks.push(
      (async () => {
        try {
          const db = getCloudBaseDatabase();
          const cmd = getDbCommand();
          const collection = db.collection(CloudBaseCollections.PAYMENTS);
          let res: any;
          try {
            res = await collection.where({ created_at: cmd.gte(startIso) }).get();
          } catch {
            res = await collection.where({ createdAt: cmd.gte(startIso) }).get();
          }
          for (const p of res.data || []) {
            if (p.status !== "completed" && p.status !== "success") continue;
            const key = dayKey(String(p.created_at || p.createdAt || ""));
            const item = map.get(key);
            if (!item) continue;
            const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
            item.revenue += Number.isFinite(amt) ? amt : 0;
            item.paidCount += 1;
          }
        } catch (e: any) {
          errors.push({
            source: "CN",
            message: e?.message ? String(e.message) : "CloudBase 统计失败",
          });
        }
      })()
    );
  }

  if (includeINTL) {
    tasks.push(
      (async () => {
        try {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("payments")
            .select("amount,created_at,status")
            .gte("created_at", startIso);
          if (error) throw error;
          for (const p of data || []) {
            if (p.status !== "completed" && p.status !== "success") continue;
            const key = dayKey(String(p.created_at || ""));
            const item = map.get(key);
            if (!item) continue;
            const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
            item.revenue += Number.isFinite(amt) ? amt : 0;
            item.paidCount += 1;
          }
        } catch (e: any) {
          errors.push({
            source: "INTL",
            message: e?.message ? String(e.message) : "Supabase 统计失败",
          });
        }
      })()
    );
  }

  await Promise.all(tasks);
  const byDay = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { byDay, errors };
}
