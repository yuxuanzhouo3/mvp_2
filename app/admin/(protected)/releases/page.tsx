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

type DataSource = "CN" | "INTL";
type ReleasesSource = "ALL" | DataSource;

type ReleaseRow = {
  id: string;
  version: string;
  platform: string;
  arch: string | null;
  fileName: string | null;
  fileSize: number | null;
  sha256: string | null;
  storageRef: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: DataSource;
};

type ReleasesResponse = {
  items: ReleaseRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  sources: Array<{ source: DataSource; ok: boolean; mode: string; message?: string }>;
};

type UploadReleaseResponse = {
  ok: boolean;
  source: DataSource;
  id: string;
  version: string;
  platform: string;
  fileName?: string | null;
};

function parseQuery(params: URLSearchParams): {
  source: ReleasesSource;
  platform: string;
  q: string;
  page: number;
  pageSize: number;
} {
  const sourceRaw = String(params.get("source") || "ALL").toUpperCase();
  const source: ReleasesSource = sourceRaw === "CN" || sourceRaw === "INTL" ? sourceRaw : "ALL";
  const platform = String(params.get("platform") || "").trim();
  const q = String(params.get("q") || "").trim();
  const page = Math.max(1, Math.floor(Number(params.get("page") || 1) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.get("pageSize") || 20) || 20)));
  return { source, platform, q, page, pageSize };
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
  router.push(`/admin/releases?${next.toString()}`);
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

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export default function AdminReleasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { source, platform, q, page, pageSize } = React.useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ReleasesResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => setQDraft(q), [q]);

  const [uploadSource, setUploadSource] = React.useState<DataSource>("CN");
  const [uploadVersion, setUploadVersion] = React.useState("");
  const [uploadPlatform, setUploadPlatform] = React.useState("windows");
  const [uploadArch, setUploadArch] = React.useState("");
  const [uploadNotes, setUploadNotes] = React.useState("");
  const [uploadActive, setUploadActive] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const [highlightRowKey, setHighlightRowKey] = React.useState<string | null>(null);
  const highlightTimerRef = React.useRef<number | null>(null);
  const highlightScrolledKeyRef = React.useRef<string | null>(null);

  const reload = React.useCallback(() => {
    const url = new URL("/api/admin/releases", window.location.origin);
    url.searchParams.set("source", source);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (platform) url.searchParams.set("platform", platform);
    if (q) url.searchParams.set("q", q);
    setLoading(true);
    setError(null);
    fetch(url.toString(), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
        }
        return (await res.json()) as ReleasesResponse;
      })
      .then((json) => setData(json))
      .catch((e: any) => {
        setError(e?.message ? String(e.message) : "加载失败");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, platform, q, source]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    if (!highlightRowKey) {
      highlightScrolledKeyRef.current = null;
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      return;
    }

    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightRowKey(null);
    }, 8000);

    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [highlightRowKey]);

  React.useEffect(() => {
    if (!highlightRowKey) return;
    if (highlightScrolledKeyRef.current === highlightRowKey) return;

    const row = rowRefs.current[highlightRowKey];
    if (!row) return;

    highlightScrolledKeyRef.current = highlightRowKey;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data, highlightRowKey]);

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

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0] || null;
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("source", uploadSource);
      fd.set("version", uploadVersion.trim());
      fd.set("platform", uploadPlatform.trim());
      fd.set("arch", uploadArch.trim());
      fd.set("notes", uploadNotes.trim());
      fd.set("active", uploadActive ? "true" : "false");
      fd.set("file", f);
      const res = await fetch("/api/admin/releases/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
      }

      const uploaded = (await res.json()) as UploadReleaseResponse;
      const uploadedSource: DataSource = uploaded?.source === "INTL" ? "INTL" : "CN";
      const uploadedPlatform = String(uploaded?.platform || uploadPlatform).trim();
      const uploadedVersion = String(uploaded?.version || uploadVersion).trim();
      const uploadedFileName = String(uploaded?.fileName || f.name || "").trim();
      const uploadedId = String(uploaded?.id || "").trim();

      if (uploadedId) {
        setHighlightRowKey(`${uploadedSource}-${uploadedId}`);
      }

      const normalizedQ = q.trim().toLowerCase();
      const qExcluded =
        !!normalizedQ &&
        !uploadedVersion.toLowerCase().includes(normalizedQ) &&
        !uploadedFileName.toLowerCase().includes(normalizedQ);

      const patch: Record<string, string | null> = {};
      if (source !== "ALL" && source !== uploadedSource) patch.source = uploadedSource;
      if (platform && platform !== uploadedPlatform) patch.platform = uploadedPlatform;
      if (qExcluded) patch.q = null;

      const needResetPage = page !== 1;
      const needQueryUpdate = needResetPage || Object.keys(patch).length > 0;

      if (fileRef.current) fileRef.current.value = "";
      setUploadVersion("");
      setUploadNotes("");

      if (needQueryUpdate) {
        updateQuery(router, new URLSearchParams(searchParams.toString()), patch, true);
      } else {
        reload();
      }
    } catch (err: any) {
      setError(err?.message ? String(err.message) : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const setActive = async (row: ReleaseRow, nextActive: boolean) => {
    setError(null);
    const res = await fetch("/api/admin/releases/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: row.source, id: row.id, active: nextActive }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      setError(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
      return;
    }
    reload();
  };

  const deleteRow = async (row: ReleaseRow) => {
    setError(null);
    const url = new URL("/api/admin/releases", window.location.origin);
    url.searchParams.set("source", row.source);
    url.searchParams.set("id", row.id);
    const res = await fetch(url.toString(), { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      setError(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
      return;
    }
    reload();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>版本管理</CardTitle>
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
              <div className="text-xs text-muted-foreground">平台</div>
              <select
                className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
                value={platform}
                onChange={(e) =>
                  updateQuery(
                    router,
                    new URLSearchParams(searchParams.toString()),
                    { platform: e.target.value },
                    true
                  )
                }
              >
                <option value="">全部</option>
                <option value="windows">Windows</option>
                <option value="mac">Mac</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="linux">Linux</option>
                <option value="web">Web</option>
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
                <div className="text-xs text-muted-foreground">搜索</div>
                <Input
                  className="h-9 w-64"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="version / fileName"
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

            <div className="text-sm text-muted-foreground">
              {loading ? "加载中…" : `筛选结果：${data?.pagination.total ?? 0} 条`}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>上传安装包</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap gap-3 items-end" onSubmit={onUpload}>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">目标来源</div>
              <select
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value as DataSource)}
              >
                <option value="CN">CN</option>
                <option value="INTL">INTL</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">Version</div>
              <Input
                className="h-9 w-40"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="例如 1.2.3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">平台</div>
              <select
                className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
                value={uploadPlatform}
                onChange={(e) => setUploadPlatform(e.target.value)}
              >
                <option value="windows">Windows</option>
                <option value="mac">Mac</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="linux">Linux</option>
                <option value="web">Web</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">Arch</div>
              <Input
                className="h-9 w-32"
                value={uploadArch}
                onChange={(e) => setUploadArch(e.target.value)}
                placeholder="x64 / arm64"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-56">
              <div className="text-xs text-muted-foreground">Notes</div>
              <Input
                className="h-9"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="可选"
              />
            </div>

            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-background">
              <input
                id="upload-active"
                type="checkbox"
                checked={uploadActive}
                onChange={(e) => setUploadActive(e.target.checked)}
              />
              <label htmlFor="upload-active" className="text-sm">
                设为生效版本
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">文件</div>
              <input ref={fileRef} type="file" className="h-9 w-72 text-sm" />
            </div>

            <Button type="submit" disabled={uploading} variant="default" size="sm">
              {uploading ? "上传中…" : "上传"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>版本列表</CardTitle>
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
                <TableHead>Version</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>Arch</TableHead>
                <TableHead>文件</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>生效</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((r) => {
                const rowKey = `${r.source}-${r.id}`;
                const highlighted = highlightRowKey === rowKey;
                return (
                <TableRow
                  key={rowKey}
                  ref={(node) => {
                    rowRefs.current[rowKey] = node;
                  }}
                  className={
                    highlighted
                      ? "bg-emerald-50/90 dark:bg-emerald-900/20 transition-colors"
                      : undefined
                  }
                >
                  <TableCell>{r.source}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="inline-flex items-center gap-2">
                      <span>{r.version || "-"}</span>
                      {highlighted ? (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">
                          NEW
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.platform || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.arch || "-"}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[320px] truncate" title={r.fileName || ""}>
                    {r.fileName || "-"}
                  </TableCell>
                  <TableCell>{formatBytes(r.fileSize)}</TableCell>
                  <TableCell>
                    {r.active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {(r.createdAt || "").slice(0, 19).replace("T", " ")}
                  </TableCell>
                  <TableCell className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setActive(r, !r.active)}
                      disabled={loading}
                    >
                      {r.active ? "取消生效" : "设为生效"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteRow(r)}
                      disabled={loading}
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
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
                [{s.source}] {s.ok ? `OK (${s.mode})` : `不可用 (${s.mode})`}{s.message ? `：${s.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
