"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AdminAiConfigResponse = {
  success: boolean;
  error?: string;
  region?: "CN" | "INTL";
  config?: {
    freeDailyLimit: number;
    freeMonthlyLimit: number;
    vipDailyLimit: number;
    enterpriseDailyLimit: number;
    updatedAt: string | null;
    source: "default" | "storage";
  };
};

function toLocalTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

const DEFAULT_REGION: "CN" | "INTL" =
  process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN" ? "CN" : "INTL";

export default function AdminAiConfigPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [region, setRegion] = React.useState<"CN" | "INTL">(DEFAULT_REGION);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<"default" | "storage">("default");
  const [freeDailyLimit, setFreeDailyLimit] = React.useState("6");
  const [freeMonthlyLimit, setFreeMonthlyLimit] = React.useState("23");
  const [vipDailyLimit, setVipDailyLimit] = React.useState("10");
  const isZh = region === "CN";

  const t = {
    loadError: isZh ? "加载 AI 配置失败" : "Failed to load AI config",
    freeDailyError: isZh
      ? "免费用户每日次数必须是大于等于 0 的整数"
      : "Free daily limit must be an integer >= 0",
    freeMonthlyError: isZh
      ? "免费用户每月次数必须是大于等于 0 的整数"
      : "Free monthly limit must be an integer >= 0",
    freeMonthlyLessThanDaily: isZh
      ? "免费用户每月次数不能小于每日次数"
      : "Free monthly limit must be greater than or equal to free daily limit",
    vipError: isZh
      ? "VIP 用户每日次数必须是大于等于 0 的整数"
      : "VIP user daily limit must be an integer >= 0",
    saveOk: isZh ? "AI 配置已保存" : "AI config saved",
    saveError: isZh ? "保存 AI 配置失败" : "Failed to save AI config",
    title: "AI config",
    regionLabel: isZh ? "部署环境" : "Deployment region",
    sourceLabel: isZh ? "配置来源" : "Source",
    sourceValueStorage: isZh ? "数据库" : "database",
    sourceValueDefault: isZh ? "默认值" : "default",
    updatedAtLabel: isZh ? "最近更新时间" : "Last updated",
    freeDailyLabel: isZh ? "免费用户每日可用次数" : "Free users daily usage count",
    freeMonthlyLabel: isZh ? "免费用户每月可用次数" : "Free users monthly usage count",
    vipLabel: isZh ? "VIP 用户每日可用次数" : "VIP users daily usage count",
    enterpriseHint: isZh
      ? "Enterprise 用户保持无限次，不受本页面配置影响。"
      : "Enterprise users stay unlimited and are not changed by this page.",
    saving: isZh ? "保存中..." : "Saving...",
    save: isZh ? "保存配置" : "Save config",
  };

  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ai-config", { cache: "no-store" });
      const data = (await res.json()) as AdminAiConfigResponse;

      if (!res.ok || !data.success || !data.config || !data.region) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setRegion(data.region);
      setFreeDailyLimit(String(data.config.freeDailyLimit));
      setFreeMonthlyLimit(String(data.config.freeMonthlyLimit));
      setVipDailyLimit(String(data.config.vipDailyLimit));
      setUpdatedAt(data.config.updatedAt || null);
      setSource(data.config.source);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const freeDaily = Number(freeDailyLimit);
    const freeMonthly = Number(freeMonthlyLimit);
    const vip = Number(vipDailyLimit);

    if (!Number.isInteger(freeDaily) || freeDaily < 0) {
      setError(t.freeDailyError);
      return;
    }
    if (!Number.isInteger(freeMonthly) || freeMonthly < 0) {
      setError(t.freeMonthlyError);
      return;
    }
    if (freeMonthly < freeDaily) {
      setError(t.freeMonthlyLessThanDaily);
      return;
    }
    if (!Number.isInteger(vip) || vip < 0) {
      setError(t.vipError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          freeDailyLimit: freeDaily,
          freeMonthlyLimit: freeMonthly,
          vipDailyLimit: vip,
        }),
      });

      const data = (await res.json()) as AdminAiConfigResponse;
      if (!res.ok || !data.success || !data.config || !data.region) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setRegion(data.region);
      setFreeDailyLimit(String(data.config.freeDailyLimit));
      setFreeMonthlyLimit(String(data.config.freeMonthlyLimit));
      setVipDailyLimit(String(data.config.vipDailyLimit));
      setUpdatedAt(data.config.updatedAt || new Date().toISOString());
      setSource(data.config.source);
      setMessage(t.saveOk);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t.regionLabel}: {region} | {t.sourceLabel}:{" "}
            {source === "storage" ? t.sourceValueStorage : t.sourceValueDefault}
          </div>
          <div className="text-sm text-muted-foreground">
            {t.updatedAtLabel}: {toLocalTime(updatedAt)}
          </div>

          <form className="space-y-4" onSubmit={onSave}>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="freeDailyLimit">
                {t.freeDailyLabel}
              </label>
              <Input
                id="freeDailyLimit"
                type="number"
                min={0}
                step={1}
                value={freeDailyLimit}
                onChange={(e) => setFreeDailyLimit(e.target.value)}
                disabled={loading || saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="freeMonthlyLimit">
                {t.freeMonthlyLabel}
              </label>
              <Input
                id="freeMonthlyLimit"
                type="number"
                min={0}
                step={1}
                value={freeMonthlyLimit}
                onChange={(e) => setFreeMonthlyLimit(e.target.value)}
                disabled={loading || saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="vipDailyLimit">
                {t.vipLabel}
              </label>
              <Input
                id="vipDailyLimit"
                type="number"
                min={0}
                step={1}
                value={vipDailyLimit}
                onChange={(e) => setVipDailyLimit(e.target.value)}
                disabled={loading || saving}
              />
            </div>

            <div className="text-sm text-muted-foreground">{t.enterpriseHint}</div>

            <Button type="submit" disabled={loading || saving}>
              {saving ? t.saving : t.save}
            </Button>
          </form>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {message ? <div className="text-sm text-emerald-600">{message}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

