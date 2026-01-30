"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

type DataSource = "CN" | "INTL";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: DataSource;
};

type UsersResponse = {
  items: UserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  sources: Array<{ source: DataSource; ok: boolean; mode: string; message?: string }>;
};

function getSourceView(source: DataSource): { label: string; className: string } {
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

function formatTime(value: string | null): string {
  return (value || "").slice(0, 19).replace("T", " ") || "-";
}

export default function AdminUserDetailPage({
  params,
}: {
  params: { source: string; id: string };
}) {
  const router = useRouter();
  const source = String(params.source || "").toUpperCase();
  const id = String(params.id || "");
  const typedSource: DataSource | null = source === "CN" || source === "INTL" ? (source as DataSource) : null;

  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<UserRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<UsersResponse["sources"]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!typedSource) {
      setError("无效的来源参数");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const url = new URL("/api/admin/users", window.location.origin);
    url.searchParams.set("source", typedSource);
    url.searchParams.set("id", id);
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
        setSources(json.sources || []);
        setUser((json.items || [])[0] || null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ? String(e.message) : "加载失败");
        setUser(null);
        setSources([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typedSource, id]);

  const backHref = `/admin/users?source=${encodeURIComponent(typedSource || "ALL")}`;
  const email = user?.email || "";
  const ordersHref = email ? `/admin/orders?source=ALL&email=${encodeURIComponent(email)}` : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">用户详情</div>
          <div className="font-mono text-xs text-muted-foreground">{id}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={backHref}>返回用户列表</Link>
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>基础信息</span>
            {typedSource ? (
              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  getSourceView(typedSource).className,
                ].join(" ")}
              >
                {getSourceView(typedSource).label}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {loading ? <div className="text-sm text-muted-foreground">加载中…</div> : null}
          {!loading && !error && !user ? (
            <div className="text-sm text-muted-foreground">未找到该用户</div>
          ) : null}

          {user ? (
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">来源</TableCell>
                  <TableCell>{getSourceView(user.source).label}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">用户 ID</TableCell>
                  <TableCell className="font-mono text-xs">{user.id}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">邮箱</TableCell>
                  <TableCell className="font-mono text-xs">{user.email || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">姓名</TableCell>
                  <TableCell>{user.name || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">订阅</TableCell>
                  <TableCell>{user.subscriptionTier || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">订阅状态</TableCell>
                  <TableCell>{user.subscriptionStatus || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">创建时间</TableCell>
                  <TableCell className="font-mono text-xs">{formatTime(user.createdAt)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">更新时间</TableCell>
                  <TableCell className="font-mono text-xs">{formatTime(user.updatedAt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : null}

          <div className="flex items-center gap-2">
            {ordersHref ? (
              <Button asChild>
                <Link href={ordersHref} target="_blank" rel="noreferrer">
                  查看该用户订单（CN+INTL）
                </Link>
              </Button>
            ) : (
              <Button disabled>查看该用户订单（CN+INTL）</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {sources.length ? (
        <Card>
          <CardHeader>
            <CardTitle>数据源状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sources.map((s) => (
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

