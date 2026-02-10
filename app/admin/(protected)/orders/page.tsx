"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OrdersSource = "ALL" | "CN" | "INTL";
type OrdersStatus = "all" | "pending" | "completed" | "failed" | "refunded";
type OrdersMutableStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";

type OrderRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  source: "CN" | "INTL";
};

type OrdersResponse = {
  items: OrderRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalAll: number;
    byStatus: {
      pending: number;
      completed: number;
      failed: number;
      refunded: number;
      other: number;
    };
    revenue30dCny: number;
    revenue30dUsd: number;
  };
  sources: Array<{ source: "CN" | "INTL"; ok: boolean; mode: string; message?: string }>;
};

type OrderPatchResponse = {
  success: boolean;
  source: "CN" | "INTL";
  mode: "direct" | "proxy" | "missing";
  item: OrderRow | null;
};

/**
 * 解析 query 参数，返回受控的 source/status/page/pageSize。
 */
function parseQuery(params: URLSearchParams): {
  source: OrdersSource;
  status: OrdersStatus;
  page: number;
  pageSize: number;
  email: string;
  userId: string;
} {
  const sourceRaw = String(params.get("source") || "ALL").toUpperCase();
  const source: OrdersSource = sourceRaw === "CN" || sourceRaw === "INTL" ? sourceRaw : "ALL";

  const statusRaw = String(params.get("status") || "all").toLowerCase();
  const status: OrdersStatus =
    statusRaw === "pending" ||
    statusRaw === "completed" ||
    statusRaw === "failed" ||
    statusRaw === "refunded"
      ? statusRaw
      : "all";

  const page = Math.max(1, Math.floor(Number(params.get("page") || 1) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.get("pageSize") || 20) || 20)));
  const email = String(params.get("email") || "").trim();
  const userId = String(params.get("userId") || "").trim();

  return { source, status, page, pageSize, email, userId };
}

/**
 * 更新 URL query（并自动重置 page=1）。
 */
function updateQuery(
  router: ReturnType<typeof useRouter>,
  current: URLSearchParams,
  patch: Record<string, string | null>,
  resetPage: boolean
) {
  const next = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  if (resetPage) next.set("page", "1");
  router.push(`/admin/orders?${next.toString()}`);
}

/**
 * 构造分页条的页码（含省略号）。
 */
function buildPageItems(totalPages: number, current: number): Array<number | "…"> {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages.values()).sort((a, b) => a - b);
  const items: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const prev = sorted[i - 1];
    if (i > 0 && prev != null && p - prev > 1) items.push("…");
    items.push(p);
  }
  return items;
}

/**
 * 将 status 显示为中文并给出 Badge 变体。
 */
function getStatusView(status: string | null): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  const s = (status || "").toLowerCase();
  if (s === "completed") return { label: "已完成", variant: "default" };
  if (s === "pending") return { label: "待支付", variant: "secondary" };
  if (s === "refunded") return { label: "已退款", variant: "outline" };
  if (s === "failed") return { label: "失败", variant: "destructive" };
  if (!s) return { label: "-", variant: "secondary" };
  return { label: s, variant: "secondary" };
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { source, status, page, pageSize, email, userId } = React.useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const [emailDraft, setEmailDraft] = React.useState(email);
  React.useEffect(() => {
    setEmailDraft(email);
  }, [email]);

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<OrdersResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = new URL("/api/admin/orders", window.location.origin);
    url.searchParams.set("source", source);
    url.searchParams.set("status", status);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (email) url.searchParams.set("email", email);
    if (userId) url.searchParams.set("userId", userId);
    fetch(url.toString(), {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
        }
        return (await res.json()) as OrdersResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ? String(e.message) : "加载失败");
        setData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, status, page, pageSize, email, userId]);

  const totalPages = data?.pagination.totalPages || 0;
  const items = buildPageItems(Math.max(1, totalPages || 1), page);
  const sourceStates = data?.sources || [];
  const failedSources = sourceStates.filter((s) => !s.ok);
  const hasAnyOkSource = sourceStates.some((s) => s.ok);
  const sourceNotice =
    !loading && !error && failedSources.length
      ? hasAnyOkSource
        ? {
            tone: "warn" as const,
            text: `部分数据源不可用：${failedSources
              .map((s) => `${s.source}(${s.mode}${s.message ? `:${s.message}` : ""})`)
              .join("；")}`,
          }
        : {
            tone: "error" as const,
            text: `所有数据源不可用：${failedSources
              .map((s) => `${s.source}(${s.mode}${s.message ? `:${s.message}` : ""})`)
              .join("；")}`,
          }
      : null;

  const patchOrderStatus = async (order: OrderRow, nextStatus: OrdersMutableStatus) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(`${order.source}:${order.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: order.source, id: order.id, status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
      }

      const json = (await res.json()) as OrderPatchResponse;
      if (!json?.item) {
        throw new Error("更新返回为空");
      }

      const key = `${order.source}:${order.id}`;
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((it) => (`${it.source}:${it.id}` === key ? json.item! : it));
        return { ...prev, items: nextItems };
      });
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "更新订单状态失败");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>订单管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">来源</div>
              <select
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                value={source}
                onChange={(e) =>
                  updateQuery(
                    router,
                    new URLSearchParams(searchParams.toString()),
                    { source: e.target.value },
                    true
                  )
                }
              >
                <option value="ALL">ALL</option>
                <option value="CN">CN</option>
                <option value="INTL">INTL</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">状态</div>
              <select
                className="h-9 w-32 rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(e) =>
                  updateQuery(
                    router,
                    new URLSearchParams(searchParams.toString()),
                    { status: e.target.value },
                    true
                  )
                }
              >
                <option value="all">全部</option>
                <option value="pending">待支付</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
                <option value="refunded">已退款</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">每页</div>
              <select
                className="h-9 w-24 rounded-md border bg-background px-3 text-sm"
                value={String(pageSize)}
                onChange={(e) =>
                  updateQuery(
                    router,
                    new URLSearchParams(searchParams.toString()),
                    { pageSize: e.target.value },
                    true
                  )
                }
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                updateQuery(
                  router,
                  new URLSearchParams(searchParams.toString()),
                  { email: emailDraft.trim() },
                  true
                );
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">邮箱</div>
                <Input
                  className="h-9 w-64"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                查询
              </Button>
              {email ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateQuery(router, new URLSearchParams(searchParams.toString()), { email: null }, true)
                  }
                >
                  清除
                </Button>
              ) : null}
            </form>

            <div className="text-sm text-muted-foreground">
              {loading ? "加载中…" : `筛选结果：${data?.pagination.total ?? 0} 条`}
            </div>
          </div>
        </CardContent>
      </Card>

      {!email && !userId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">订单总量（全部状态）</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data?.stats.totalAll ?? (loading ? "…" : 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">已完成 / 待支付</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(data?.stats.byStatus.completed ?? 0)}/{(data?.stats.byStatus.pending ?? 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">失败 / 已退款</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(data?.stats.byStatus.failed ?? 0)}/{(data?.stats.byStatus.refunded ?? 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">近30天收入（CNY / USD）</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              ￥{(data?.stats.revenue30dCny ?? 0).toFixed(2)}/${(data?.stats.revenue30dUsd ?? 0).toFixed(2)}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {sourceNotice ? (
            <div className={`text-sm ${sourceNotice.tone === "error" ? "text-red-600" : "text-amber-700"}`}>
              {sourceNotice.text}
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>来源</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>状态操作</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>完成时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((o) => {
                const view = getStatusView(o.status);
                const rowKey = `${o.source}:${o.id}`;
                const rowUpdating = updatingOrderId === rowKey;
                return (
                  <TableRow key={`${o.source}-${o.id}`}>
                    <TableCell>{o.source}</TableCell>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell className="font-mono text-xs">{o.userId || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{o.userEmail || "-"}</TableCell>
                    <TableCell>{o.amount ?? "-"}</TableCell>
                    <TableCell>{o.currency ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={view.variant}>{view.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={
                          (() => {
                            const normalized = (o.status || "").toLowerCase();
                            if (
                              normalized === "pending" ||
                              normalized === "completed" ||
                              normalized === "failed" ||
                              normalized === "refunded" ||
                              normalized === "cancelled"
                            ) {
                              return normalized;
                            }
                            return "pending";
                          })()
                        }
                        disabled={rowUpdating || loading}
                        onChange={(e) => {
                          const value = String(e.target.value).toLowerCase();
                          if (
                            value === "pending" ||
                            value === "completed" ||
                            value === "failed" ||
                            value === "refunded" ||
                            value === "cancelled"
                          ) {
                            patchOrderStatus(o, value);
                          }
                        }}
                      >
                        <option value="pending">待支付</option>
                        <option value="completed">已完成</option>
                        <option value="failed">失败</option>
                        <option value="refunded">已退款</option>
                        <option value="cancelled">已取消</option>
                      </select>
                    </TableCell>
                    <TableCell>{o.paymentMethod ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {(o.createdAt || "").slice(0, 19).replace("T", " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(o.completedAt || "").slice(0, 19).replace("T", " ")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && (data?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page <= 1) return;
                      updateQuery(
                        router,
                        new URLSearchParams(searchParams.toString()),
                        { page: String(page - 1) },
                        false
                      );
                    }}
                  />
                </PaginationItem>

                {items.map((it, idx) =>
                  it === "…" ? (
                    <PaginationItem key={`e-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={it}>
                      <PaginationLink
                        href="#"
                        isActive={it === page}
                        onClick={(e) => {
                          e.preventDefault();
                          updateQuery(
                            router,
                            new URLSearchParams(searchParams.toString()),
                            { page: String(it) },
                            false
                          );
                        }}
                      >
                        {it}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page >= totalPages) return;
                      updateQuery(
                        router,
                        new URLSearchParams(searchParams.toString()),
                        { page: String(page + 1) },
                        false
                      );
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </CardContent>
      </Card>

      {data?.sources?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>数据源状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.sources.map((s) => (
              <div key={s.source}>
                [{s.source}] {s.ok ? `OK (${s.mode})` : `不可用 (${s.mode})`}{s.message ? `：${s.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
