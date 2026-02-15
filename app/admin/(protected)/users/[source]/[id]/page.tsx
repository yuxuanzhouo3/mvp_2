"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getDeploymentAdminSource } from "@/lib/admin/deployment-source";

type DataSource = "CN" | "INTL";
const DEPLOYMENT_SOURCE: DataSource = getDeploymentAdminSource();

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

type UserPatchResponse = {
  success: boolean;
  source: DataSource;
  mode: "direct" | "proxy" | "missing";
  item: UserRow | null;
};

function getSourceView(source: DataSource): { label: string; className: string } {
  if (source === "CN") {
    return {
      label: "CN · 腾讯云 CloudBase 文档型数据库",
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
  const id = String(params.id || "");
  const typedSource: DataSource = DEPLOYMENT_SOURCE;

  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<UserRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<UsersResponse["sources"]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [nameDraft, setNameDraft] = React.useState("");
  const [tierDraft, setTierDraft] = React.useState("");
  const [statusDraft, setStatusDraft] = React.useState("");

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
        const first = (json.items || [])[0] || null;
        setUser(first);
        setNameDraft(first?.name || "");
        setTierDraft(first?.subscriptionTier || "");
        setStatusDraft(first?.subscriptionStatus || "");
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

  const backHref = `/admin/users?source=${encodeURIComponent(typedSource)}`;
  const email = user?.email || "";
  const ordersHref = email ? `/admin/orders?source=${typedSource}&email=${encodeURIComponent(email)}` : "";

  const canEdit = Boolean(user && typedSource && !loading);

  const onSave = async () => {
    if (!user || !typedSource || saving) return;
    setSaveMessage(null);
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        source: typedSource,
        id: user.id,
      };

      const normalizedName = nameDraft.trim();
      const normalizedTier = tierDraft.trim().toLowerCase();
      const normalizedStatus = statusDraft.trim().toLowerCase();

      if (normalizedName !== (user.name || "")) {
        body.name = normalizedName;
      }
      if (normalizedTier !== (user.subscriptionTier || "").toLowerCase()) {
        body.subscriptionTier = normalizedTier;
      }
      if (normalizedStatus !== (user.subscriptionStatus || "").toLowerCase()) {
        body.subscriptionStatus = normalizedStatus;
      }

      if (Object.keys(body).length <= 2) {
        setSaveMessage("未检测到变更");
        return;
      }

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${bodyText ? `: ${bodyText}` : ""}`);
      }

      const json = (await res.json()) as UserPatchResponse;
      if (!json?.item) throw new Error("更新返回为空");
      setUser(json.item);
      setNameDraft(json.item.name || "");
      setTierDraft(json.item.subscriptionTier || "");
      setStatusDraft(json.item.subscriptionStatus || "");
      setSaveMessage(`保存成功（${json.mode}）`);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "保存失败");
    } finally {
      setSaving(false);
    }
  };

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
          <Button onClick={onSave} disabled={!canEdit || saving}>
            {saving ? "保存中…" : "保存修改"}
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
          {saveMessage ? <div className="text-sm text-emerald-600">{saveMessage}</div> : null}
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
                  <TableCell>
                    <input
                      className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      disabled={!canEdit || saving}
                      placeholder="姓名（可留空）"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">订阅</TableCell>
                  <TableCell>
                    <input
                      className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
                      value={tierDraft}
                      onChange={(e) => setTierDraft(e.target.value)}
                      disabled={!canEdit || saving}
                      placeholder="如 free / pro / enterprise"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">订阅状态</TableCell>
                  <TableCell>
                    <input
                      className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      disabled={!canEdit || saving}
                      placeholder="如 active / cancelled / expired"
                    />
                  </TableCell>
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
                  查看该用户订单（当前来源）
                </Link>
              </Button>
            ) : (
              <Button disabled>查看该用户订单（当前来源）</Button>
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
