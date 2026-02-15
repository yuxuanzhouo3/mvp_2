"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getDeploymentAdminSource } from "@/lib/admin/deployment-source";

type OrdersSource = "CN" | "INTL";
type OrdersStatus = "all" | "pending" | "completed" | "failed" | "refunded";
type OrdersMutableStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";

const DEPLOYMENT_SOURCE = getDeploymentAdminSource();

type OrdersStatusText = {
  all: string;
  pending: string;
  completed: string;
  failed: string;
  refunded: string;
  cancelled: string;
};

type OrdersUiText = {
  title: string;
  subtitle: string;
  sourceLabel: string;
  sourceDisplay: string;
  statusLabel: string;
  pageSizeLabel: string;
  emailLabel: string;
  searchButton: string;
  clearButton: string;
  loadingText: string;
  resultText: (total: number) => string;
  totalOrdersTitle: string;
  completedPendingTitle: string;
  failedRefundedTitle: string;
  revenueTitle: (currency: string) => string;
  orderListTitle: string;
  tableHeaders: {
    source: string;
    id: string;
    userId: string;
    userEmail: string;
    amount: string;
    currency: string;
    status: string;
    statusAction: string;
    paymentMethod: string;
    createdAt: string;
    completedAt: string;
  };
  noDataText: string;
  sourceStatusTitle: string;
  sourceUnavailable: string;
  sourceNoticePartial: (items: string) => string;
  sourceNoticeAll: (items: string) => string;
  status: OrdersStatusText;
};

const ORDERS_UI_TEXT: Record<OrdersSource, OrdersUiText> = {
  CN: {
    title: "订单管理",
    subtitle: "仅展示腾讯云 CloudBase 文档型数据库中的订单数据",
    sourceLabel: "来源",
    sourceDisplay: "CN · 腾讯云 CloudBase",
    statusLabel: "状态",
    pageSizeLabel: "每页",
    emailLabel: "邮箱",
    searchButton: "查询",
    clearButton: "清除",
    loadingText: "加载中…",
    resultText: (total) => `筛选结果：${total} 条`,
    totalOrdersTitle: "订单总量（全部状态）",
    completedPendingTitle: "已完成 / 待支付",
    failedRefundedTitle: "失败 / 已退款",
    revenueTitle: (currency) => `近30天收入（${currency}）`,
    orderListTitle: "订单列表",
    tableHeaders: {
      source: "来源",
      id: "ID",
      userId: "用户",
      userEmail: "邮箱",
      amount: "金额",
      currency: "币种",
      status: "状态",
      statusAction: "状态操作",
      paymentMethod: "渠道",
      createdAt: "创建时间",
      completedAt: "完成时间",
    },
    noDataText: "暂无数据",
    sourceStatusTitle: "数据源状态（CloudBase）",
    sourceUnavailable: "不可用",
    sourceNoticePartial: (items) => `当前数据源部分不可用：${items}`,
    sourceNoticeAll: (items) => `当前数据源不可用：${items}`,
    status: {
      all: "全部",
      pending: "待支付",
      completed: "已完成",
      failed: "失败",
      refunded: "已退款",
      cancelled: "已取消",
    },
  },
  INTL: {
    title: "Order Management",
    subtitle: "Showing orders from Supabase only",
    sourceLabel: "Source",
    sourceDisplay: "INTL · Supabase",
    statusLabel: "Status",
    pageSizeLabel: "Per page",
    emailLabel: "Email",
    searchButton: "Search",
    clearButton: "Clear",
    loadingText: "Loading...",
    resultText: (total) => `${total} results`,
    totalOrdersTitle: "Total orders (all statuses)",
    completedPendingTitle: "Completed / Pending",
    failedRefundedTitle: "Failed / Refunded",
    revenueTitle: (currency) => `Revenue (last 30 days, ${currency})`,
    orderListTitle: "Orders",
    tableHeaders: {
      source: "Source",
      id: "ID",
      userId: "User",
      userEmail: "Email",
      amount: "Amount",
      currency: "Currency",
      status: "Status",
      statusAction: "Update Status",
      paymentMethod: "Method",
      createdAt: "Created At",
      completedAt: "Completed At",
    },
    noDataText: "No data",
    sourceStatusTitle: "Data Source Status (Supabase)",
    sourceUnavailable: "Unavailable",
    sourceNoticePartial: (items) => `Current source partially unavailable: ${items}`,
    sourceNoticeAll: (items) => `Current source unavailable: ${items}`,
    status: {
      all: "All",
      pending: "Pending",
      completed: "Completed",
      failed: "Failed",
      refunded: "Refunded",
      cancelled: "Cancelled",
    },
  },
};

function getSourceDisplay(source: "CN" | "INTL"): string {
  if (source === "CN") {
    return "CN · CloudBase";
  }
  return "INTL · Supabase";
}

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
  const source: OrdersSource = DEPLOYMENT_SOURCE;

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
function getStatusView(
  status: string | null,
  statusText: OrdersStatusText
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  const s = (status || "").toLowerCase();
  if (s === "completed") return { label: statusText.completed, variant: "default" };
  if (s === "pending") return { label: statusText.pending, variant: "secondary" };
  if (s === "refunded") return { label: statusText.refunded, variant: "outline" };
  if (s === "failed") return { label: statusText.failed, variant: "destructive" };
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
  const uiText = ORDERS_UI_TEXT[source];

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
            text: uiText.sourceNoticePartial(
              failedSources
                .map((s) => `${getSourceDisplay(s.source)}(${s.mode}${s.message ? `: ${s.message}` : ""})`)
                .join("; ")
            ),
          }
        : {
            tone: "error" as const,
            text: uiText.sourceNoticeAll(
              failedSources
                .map((s) => `${getSourceDisplay(s.source)}(${s.mode}${s.message ? `: ${s.message}` : ""})`)
                .join("; ")
            ),
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
          <CardTitle>{uiText.title}</CardTitle>
          <CardDescription>{uiText.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">{uiText.sourceLabel}</div>
              <div className="h-9 min-w-44 rounded-md border bg-background px-3 text-sm inline-flex items-center">
                {uiText.sourceDisplay}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">{uiText.statusLabel}</div>
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
                <option value="all">{uiText.status.all}</option>
                <option value="pending">{uiText.status.pending}</option>
                <option value="completed">{uiText.status.completed}</option>
                <option value="failed">{uiText.status.failed}</option>
                <option value="refunded">{uiText.status.refunded}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">{uiText.pageSizeLabel}</div>
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
                <div className="text-xs text-muted-foreground">{uiText.emailLabel}</div>
                <Input
                  className="h-9 w-64"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                {uiText.searchButton}
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
                  {uiText.clearButton}
                </Button>
              ) : null}
            </form>

            <div className="text-sm text-muted-foreground">
              {loading ? uiText.loadingText : uiText.resultText(data?.pagination.total ?? 0)}
            </div>
          </div>
        </CardContent>
      </Card>

      {!email && !userId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{uiText.totalOrdersTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data?.stats.totalAll ?? (loading ? "…" : 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{uiText.completedPendingTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(data?.stats.byStatus.completed ?? 0)}/{(data?.stats.byStatus.pending ?? 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{uiText.failedRefundedTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {(data?.stats.byStatus.failed ?? 0)}/{(data?.stats.byStatus.refunded ?? 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{uiText.revenueTitle(source === "CN" ? "CNY" : "USD")}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {source === "CN"
                ? `￥${(data?.stats.revenue30dCny ?? 0).toFixed(2)}`
                : `$${(data?.stats.revenue30dUsd ?? 0).toFixed(2)}`}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{uiText.orderListTitle}</CardTitle>
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
                <TableHead>{uiText.tableHeaders.source}</TableHead>
                <TableHead>{uiText.tableHeaders.id}</TableHead>
                <TableHead>{uiText.tableHeaders.userId}</TableHead>
                <TableHead>{uiText.tableHeaders.userEmail}</TableHead>
                <TableHead>{uiText.tableHeaders.amount}</TableHead>
                <TableHead>{uiText.tableHeaders.currency}</TableHead>
                <TableHead>{uiText.tableHeaders.status}</TableHead>
                <TableHead>{uiText.tableHeaders.statusAction}</TableHead>
                <TableHead>{uiText.tableHeaders.paymentMethod}</TableHead>
                <TableHead>{uiText.tableHeaders.createdAt}</TableHead>
                <TableHead>{uiText.tableHeaders.completedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((o) => {
                const view = getStatusView(o.status, uiText.status);
                const rowKey = `${o.source}:${o.id}`;
                const rowUpdating = updatingOrderId === rowKey;
                return (
                  <TableRow key={`${o.source}-${o.id}`}>
                    <TableCell>{getSourceDisplay(o.source)}</TableCell>
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
                        <option value="pending">{uiText.status.pending}</option>
                        <option value="completed">{uiText.status.completed}</option>
                        <option value="failed">{uiText.status.failed}</option>
                        <option value="refunded">{uiText.status.refunded}</option>
                        <option value="cancelled">{uiText.status.cancelled}</option>
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
                    {uiText.noDataText}
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
            <CardTitle>{uiText.sourceStatusTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.sources.map((s) => (
              <div key={s.source}>
                [{getSourceDisplay(s.source)}] {s.ok ? `OK (${s.mode})` : `${uiText.sourceUnavailable} (${s.mode})`}
                {s.message ? `: ${s.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
