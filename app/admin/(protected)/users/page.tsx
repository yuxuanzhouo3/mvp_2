"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type UsersSource = "ALL" | "CN" | "INTL";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: "CN" | "INTL";
};

type UsersResponse = {
  items: UserRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sources: Array<{ source: "CN" | "INTL"; ok: boolean; mode: string; message?: string }>;
};

function parseQuery(params: URLSearchParams): {
  source: UsersSource;
  q: string;
  page: number;
  pageSize: number;
} {
  const sourceRaw = String(params.get("source") || "ALL").toUpperCase();
  const source: UsersSource = sourceRaw === "CN" || sourceRaw === "INTL" ? sourceRaw : "ALL";
  const q = String(params.get("q") || "").trim();
  const page = Math.max(1, Math.floor(Number(params.get("page") || 1) || 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(Number(params.get("pageSize") || 50) || 50)));
  return { source, q, page, pageSize };
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
  router.push(`/admin/users?${next.toString()}`);
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

function getSourceView(source: "CN" | "INTL"): { label: string; className: string } {
  if (source === "CN") {
    return {
      label: "CN · CloudBase",
      className: "border border-sky-200 bg-sky-100 text-sky-800",
    };
  }
  return {
    label: "INTL · Supabase",
    className: "border border-pink-200 bg-pink-100 text-pink-800",
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { source, q, page, pageSize } = React.useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => {
    setQDraft(q);
  }, [q]);

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<UsersResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = new URL("/api/admin/users", window.location.origin);
    url.searchParams.set("source", source);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (q) url.searchParams.set("q", q);
    fetch(url.toString(), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
        }
        return (await res.json()) as UsersResponse;
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
  }, [source, q, page, pageSize]);

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

  const region =
    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN" ? "CN" : "INTL";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-sky-50 to-pink-50">
          <CardTitle className="text-lg">用户管理</CardTitle>
          <CardDescription>
            CN 使用 CloudBase 文档库，INTL 使用 Supabase；订单可跨环境聚合查看（需配置跨环境代理）。
          </CardDescription>
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
                <option value="200">200</option>
              </select>
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                updateQuery(router, new URLSearchParams(searchParams.toString()), { q: qDraft.trim() }, true);
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">邮箱搜索</div>
                <Input
                  className="h-9 w-72"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="支持 INTL 模糊匹配；CN 为精确匹配"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                查询
              </Button>
              {q ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => updateQuery(router, new URLSearchParams(searchParams.toString()), { q: null }, true)}
                >
                  清除
                </Button>
              ) : null}
            </form>

            <div className="text-sm text-muted-foreground">
              {loading ? "加载中…" : `筛选结果：${data?.pagination.total ?? 0} 条`}
            </div>
            <div className="text-sm text-muted-foreground">当前部署：{region}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="text-lg">用户列表</CardTitle>
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
                <TableHead>邮箱</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>订阅</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((u) => {
                const view = getSourceView(u.source);
                const email = u.email || "";
                const detailsHref = `/admin/users/${u.source}/${encodeURIComponent(u.id)}`;
                const orderHref = email
                  ? `/admin/orders?source=ALL&email=${encodeURIComponent(email)}`
                  : "";
                return (
                  <TableRow key={`${u.source}-${u.id}`}>
                    <TableCell>
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          view.className,
                        ].join(" ")}
                      >
                        {view.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email || "-"}</TableCell>
                    <TableCell>{u.name || "-"}</TableCell>
                    <TableCell>{u.subscriptionTier || "-"}</TableCell>
                    <TableCell>{u.subscriptionStatus || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {(u.createdAt || "").slice(0, 19).replace("T", " ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={detailsHref}>查看详情</Link>
                        </Button>
                        {orderHref ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={orderHref} target="_blank" rel="noreferrer">
                              查看订单
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            查看订单
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && (data?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
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
                [{s.source}] {s.ok ? `OK (${s.mode})` : `不可用 (${s.mode})`}{s.message ? `：${s.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
