"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { PaymentSourceChart } from "@/components/admin/payment-source-chart";

type PaymentsSource = "ALL" | "CN" | "INTL";
type PaymentsStatus = "all" | "pending" | "completed" | "failed" | "refunded";
type DataSource = "CN" | "INTL";

type PaymentRow = {
  id: string;
  userId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  source: DataSource;
};

type DailyPoint = {
  date: string;
  revenue: number;
  paidCount: number;
};

type PaymentsResponse = {
  items: PaymentRow[];
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
  charts: Partial<Record<DataSource, DailyPoint[]>>;
  sources: Array<{ source: DataSource; ok: boolean; mode: string; message?: string }>;
};

function parseQuery(params: URLSearchParams): {
  source: PaymentsSource;
  status: PaymentsStatus;
  page: number;
  pageSize: number;
  method: string;
  q: string;
} {
  const sourceRaw = String(params.get("source") || "ALL").toUpperCase();
  const source: PaymentsSource = sourceRaw === "CN" || sourceRaw === "INTL" ? sourceRaw : "ALL";

  const statusRaw = String(params.get("status") || "all").toLowerCase();
  const status: PaymentsStatus =
    statusRaw === "pending" ||
    statusRaw === "completed" ||
    statusRaw === "failed" ||
    statusRaw === "refunded"
      ? statusRaw
      : "all";

  const page = Math.max(1, Math.floor(Number(params.get("page") || 1) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.get("pageSize") || 20) || 20)));
  const method = String(params.get("method") || "").trim();
  const q = String(params.get("q") || "").trim();

  return { source, status, page, pageSize, method, q };
}

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
  router.push(`/admin/payments?${next.toString()}`);
}

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

export default function AdminPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { source, status, page, pageSize, method, q } = React.useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const [methodDraft, setMethodDraft] = React.useState(method);
  React.useEffect(() => {
    setMethodDraft(method);
  }, [method]);

  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => {
    setQDraft(q);
  }, [q]);

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<PaymentsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = new URL("/api/admin/payments", window.location.origin);
    url.searchParams.set("source", source);
    url.searchParams.set("status", status);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (method) url.searchParams.set("method", method);
    if (q) url.searchParams.set("q", q);

    fetch(url.toString(), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
        }
        return (await res.json()) as PaymentsResponse;
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
  }, [source, status, page, pageSize, method, q]);

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

  const cnChart = data?.charts?.CN || [];
  const intlChart = data?.charts?.INTL || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>支付分析</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">来源</div>
              <select
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                value={source}
                onChange={(e) =>
                  updateQuery(router, new URLSearchParams(searchParams.toString()), { source: e.target.value }, true)
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
                  updateQuery(router, new URLSearchParams(searchParams.toString()), { status: e.target.value }, true)
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
                  updateQuery(router, new URLSearchParams(searchParams.toString()), { pageSize: e.target.value }, true)
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
                updateQuery(router, new URLSearchParams(searchParams.toString()), { method: methodDraft.trim() }, true);
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">渠道</div>
                <Input className="h-9 w-56" value={methodDraft} onChange={(e) => setMethodDraft(e.target.value)} />
              </div>
              <button className="h-9 rounded-md border px-3 text-sm">查询</button>
              {method ? (
                <button
                  type="button"
                  className="h-9 rounded-md border px-3 text-sm"
                  onClick={() =>
                    updateQuery(router, new URLSearchParams(searchParams.toString()), { method: null }, true)
                  }
                >
                  清除
                </button>
              ) : null}
            </form>

            <div className="text-sm text-muted-foreground">
              {loading ? "加载中…" : `筛选结果：${data?.pagination.total ?? 0} 条`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">支付总量（全部状态）</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.stats.totalAll ?? (loading ? "…" : 0)}</CardContent>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {source !== "INTL" ? (
          <PaymentSourceChart title="近 30 天支付（CN）" data={cnChart} />
        ) : null}

        {source !== "CN" ? (
          <PaymentSourceChart title="近 30 天支付（INTL）" data={intlChart} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>支付列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {sourceNotice ? (
            <div className={`text-sm ${sourceNotice.tone === "error" ? "text-red-600" : "text-amber-700"}`}>
              {sourceNotice.text}
            </div>
          ) : null}

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateQuery(router, new URLSearchParams(searchParams.toString()), { q: qDraft.trim() }, true);
            }}
          >
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">搜索订单</div>
              <Input
                className="h-9 w-80"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="支付ID / 交易号 / 用户ID"
              />
            </div>
            <button className="h-9 rounded-md border px-3 text-sm">搜索</button>
            {q ? (
              <button
                type="button"
                className="h-9 rounded-md border px-3 text-sm"
                onClick={() => updateQuery(router, new URLSearchParams(searchParams.toString()), { q: null }, true)}
              >
                清除
              </button>
            ) : null}
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>来源</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>完成时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((p) => (
                <TableRow key={`${p.source}-${p.id}`}>
                  <TableCell>{p.source}</TableCell>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-mono text-xs">{p.userId || "-"}</TableCell>
                  <TableCell>{p.amount ?? "-"}</TableCell>
                  <TableCell>{p.currency ?? "-"}</TableCell>
                  <TableCell>{p.status ?? "-"}</TableCell>
                  <TableCell>{p.paymentMethod ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {(p.createdAt || "").slice(0, 19).replace("T", " ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {(p.completedAt || "").slice(0, 19).replace("T", " ")}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (data?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
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
                      updateQuery(router, new URLSearchParams(searchParams.toString()), { page: String(page - 1) }, false);
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
                          updateQuery(router, new URLSearchParams(searchParams.toString()), { page: String(it) }, false);
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
                      updateQuery(router, new URLSearchParams(searchParams.toString()), { page: String(page + 1) }, false);
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
                [{s.source}] {s.ok ? `OK (${s.mode})` : `不可用 (${s.mode})`}
                {s.message ? `：${s.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
