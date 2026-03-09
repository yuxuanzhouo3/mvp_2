"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CN_RUNTIME_MODEL_OPTIONS,
  DEFAULT_CN_ASSISTANT_MODEL,
  DEFAULT_CN_RECOMMENDATION_MODEL,
  type CnRuntimeModel,
} from "@/lib/ai/runtime-models";

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
  cnRuntimeConfig?: {
    assistantModel: CnRuntimeModel;
    recommendationModel: CnRuntimeModel;
    updatedAt: string | null;
    source: "default" | "storage";
  };
  recommendationUsageConfig?: {
    freeMonthlyLimit: number;
    vipDailyLimit: number;
    enterpriseDailyLimit: number;
    updatedAt: string | null;
    source: "default" | "storage";
  };
};

function toLocalTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

const DEFAULT_REGION: "CN" | "INTL" =
  process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN" ? "CN" : "INTL";

export default function AdminAiConfigPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [region, setRegion] = React.useState<"CN" | "INTL">(DEFAULT_REGION);

  const [usageUpdatedAt, setUsageUpdatedAt] = React.useState<string | null>(null);
  const [usageSource, setUsageSource] = React.useState<"default" | "storage">("default");
  const [freeDailyLimit, setFreeDailyLimit] = React.useState("6");
  const [freeMonthlyLimit, setFreeMonthlyLimit] = React.useState("23");
  const [vipDailyLimit, setVipDailyLimit] = React.useState("10");

  const [shakeUpdatedAt, setShakeUpdatedAt] = React.useState<string | null>(null);
  const [shakeSource, setShakeSource] = React.useState<"default" | "storage">("default");
  const [shakeFreeMonthlyLimit, setShakeFreeMonthlyLimit] = React.useState("30");
  const [shakeVipDailyLimit, setShakeVipDailyLimit] = React.useState("30");

  const [modelUpdatedAt, setModelUpdatedAt] = React.useState<string | null>(null);
  const [modelSource, setModelSource] = React.useState<"default" | "storage">("default");
  const [assistantCnModel, setAssistantCnModel] = React.useState<CnRuntimeModel>(DEFAULT_CN_ASSISTANT_MODEL);
  const [recommendationCnModel, setRecommendationCnModel] = React.useState<CnRuntimeModel>(
    DEFAULT_CN_RECOMMENDATION_MODEL
  );

  const isZh = region === "CN";
  const t = {
    title: isZh ? "AI 配置" : "AI Config",
    save: isZh ? "保存配置" : "Save Config",
    saving: isZh ? "保存中..." : "Saving...",
    loadError: isZh ? "加载 AI 配置失败" : "Failed to load AI config",
    saveError: isZh ? "保存 AI 配置失败" : "Failed to save AI config",
    saveOk: isZh ? "AI 配置已保存并立即生效" : "AI config saved and applied immediately",

    usageTitle: isZh ? "助手额度配置" : "Assistant Usage Limits",
    shakeTitle: isZh ? "摇一摇次数配置" : "Shake Usage Limits",
    regionLabel: isZh ? "部署环境" : "Deployment Region",
    sourceLabel: isZh ? "配置来源" : "Source",
    sourceStorage: isZh ? "数据库" : "Database",
    sourceDefault: isZh ? "默认值" : "Default",
    updatedAtLabel: isZh ? "最近更新时间" : "Last Updated",
    freeDailyLabel: isZh ? "免费用户每日可用次数" : "Free Users Daily Usage Count",
    freeMonthlyLabel: isZh ? "免费用户每月可用次数" : "Free Users Monthly Usage Count",
    vipLabel: isZh ? "VIP 用户每日可用次数" : "VIP Users Daily Usage Count",
    enterpriseHint: isZh
      ? "Enterprise 用户仍保持无限次数，不受本页额度配置影响。"
      : "Enterprise users remain unlimited and are not affected by this page.",
    shakeHint: isZh
      ? "摇一摇本质上是 AI 推荐请求。保存后，摇一摇剩余次数与超限提示会立即按新配置生效。"
      : "Shake uses the recommendation quota and applies immediately after save.",
    shakeFreeMonthlyLabel: isZh ? "免费用户每月可摇次数" : "Free Users Monthly Shake Limit",
    shakeVipDailyLabel: isZh ? "VIP 用户每日可摇次数" : "VIP Users Daily Shake Limit",
    shakeEnterpriseHint: isZh
      ? "Enterprise 用户摇一摇仍保持无限次数。"
      : "Enterprise users remain unlimited for Shake.",

    modelTitle: isZh ? "CN 底层模型切换" : "CN Runtime Model Switching",
    modelHint: isZh
      ? "保存后立即生效，无需重启服务。AI 推荐与 AI 超级助手将按此配置读取底层模型。"
      : "Changes apply immediately after saving with no restart required.",
    recommendationModelLabel: isZh ? "AI 推荐底层模型" : "Recommendation Model",
    assistantModelLabel: isZh ? "AI 超级助手底层模型" : "Assistant Model",
    cnOnlyHint: isZh ? "当前仅 CN 环境支持在线切换底层模型。" : "Online model switching is only available in CN.",

    freeDailyError: isZh ? "免费用户每日次数必须是大于等于 0 的整数" : "Free daily limit must be an integer >= 0",
    freeMonthlyError: isZh
      ? "免费用户每月次数必须是大于等于 0 的整数"
      : "Free monthly limit must be an integer >= 0",
    freeMonthlyLessThanDaily: isZh
      ? "免费用户每月次数不能小于每日次数"
      : "Free monthly limit must be greater than or equal to free daily limit",
    vipError: isZh ? "VIP 用户每日次数必须是大于等于 0 的整数" : "VIP daily limit must be an integer >= 0",
    shakeFreeMonthlyError: isZh
      ? "免费用户每月可摇次数必须是大于等于 0 的整数"
      : "Free monthly shake limit must be an integer >= 0",
    shakeVipDailyError: isZh
      ? "VIP 用户每日可摇次数必须是大于等于 0 的整数"
      : "VIP daily shake limit must be an integer >= 0",
  };

  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai-config", { cache: "no-store" });
      const data = (await response.json()) as AdminAiConfigResponse;

      if (!response.ok || !data.success || !data.config || !data.region) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setRegion(data.region);
      setFreeDailyLimit(String(data.config.freeDailyLimit));
      setFreeMonthlyLimit(String(data.config.freeMonthlyLimit));
      setVipDailyLimit(String(data.config.vipDailyLimit));
      setUsageUpdatedAt(data.config.updatedAt || null);
      setUsageSource(data.config.source);

      if (data.recommendationUsageConfig) {
        setShakeFreeMonthlyLimit(String(data.recommendationUsageConfig.freeMonthlyLimit));
        setShakeVipDailyLimit(String(data.recommendationUsageConfig.vipDailyLimit));
        setShakeUpdatedAt(data.recommendationUsageConfig.updatedAt || null);
        setShakeSource(data.recommendationUsageConfig.source);
      }

      if (data.region === "CN" && data.cnRuntimeConfig) {
        setAssistantCnModel(data.cnRuntimeConfig.assistantModel);
        setRecommendationCnModel(data.cnRuntimeConfig.recommendationModel);
        setModelUpdatedAt(data.cnRuntimeConfig.updatedAt || null);
        setModelSource(data.cnRuntimeConfig.source);
      }
    } catch (err: any) {
      setError(err?.message ? String(err.message) : t.loadError);
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
    const shakeFreeMonthly = Number(shakeFreeMonthlyLimit);
    const shakeVipDaily = Number(shakeVipDailyLimit);

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
    if (!Number.isInteger(shakeFreeMonthly) || shakeFreeMonthly < 0) {
      setError(t.shakeFreeMonthlyError);
      return;
    }
    if (!Number.isInteger(shakeVipDaily) || shakeVipDaily < 0) {
      setError(t.shakeVipDailyError);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          freeDailyLimit: freeDaily,
          freeMonthlyLimit: freeMonthly,
          vipDailyLimit: vip,
          shakeFreeMonthlyLimit: shakeFreeMonthly,
          shakeVipDailyLimit: shakeVipDaily,
          ...(region === "CN"
            ? {
                assistantCnModel,
                recommendationCnModel,
              }
            : {}),
        }),
      });

      const data = (await response.json()) as AdminAiConfigResponse;
      if (!response.ok || !data.success || !data.config || !data.region) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setRegion(data.region);
      setFreeDailyLimit(String(data.config.freeDailyLimit));
      setFreeMonthlyLimit(String(data.config.freeMonthlyLimit));
      setVipDailyLimit(String(data.config.vipDailyLimit));
      setUsageUpdatedAt(data.config.updatedAt || new Date().toISOString());
      setUsageSource(data.config.source);

      if (data.recommendationUsageConfig) {
        setShakeFreeMonthlyLimit(String(data.recommendationUsageConfig.freeMonthlyLimit));
        setShakeVipDailyLimit(String(data.recommendationUsageConfig.vipDailyLimit));
        setShakeUpdatedAt(data.recommendationUsageConfig.updatedAt || new Date().toISOString());
        setShakeSource(data.recommendationUsageConfig.source);
      }

      if (data.region === "CN" && data.cnRuntimeConfig) {
        setAssistantCnModel(data.cnRuntimeConfig.assistantModel);
        setRecommendationCnModel(data.cnRuntimeConfig.recommendationModel);
        setModelUpdatedAt(data.cnRuntimeConfig.updatedAt || new Date().toISOString());
        setModelSource(data.cnRuntimeConfig.source);
      }

      setMessage(t.saveOk);
    } catch (err: any) {
      setError(err?.message ? String(err.message) : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSave}>
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            {t.regionLabel}: {region}
          </div>
          <div>
            {t.sourceLabel}: {usageSource === "storage" ? t.sourceStorage : t.sourceDefault}
          </div>
          <div>
            {t.updatedAtLabel}: {toLocalTime(usageUpdatedAt)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.usageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.shakeTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {region === "CN" ? (
            <>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>
                  {t.sourceLabel}: {shakeSource === "storage" ? t.sourceStorage : t.sourceDefault}
                </div>
                <div>
                  {t.updatedAtLabel}: {toLocalTime(shakeUpdatedAt)}
                </div>
                <div>{t.shakeHint}</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="shakeFreeMonthlyLimit">
                  {t.shakeFreeMonthlyLabel}
                </label>
                <Input
                  id="shakeFreeMonthlyLimit"
                  type="number"
                  min={0}
                  step={1}
                  value={shakeFreeMonthlyLimit}
                  onChange={(e) => setShakeFreeMonthlyLimit(e.target.value)}
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="shakeVipDailyLimit">
                  {t.shakeVipDailyLabel}
                </label>
                <Input
                  id="shakeVipDailyLimit"
                  type="number"
                  min={0}
                  step={1}
                  value={shakeVipDailyLimit}
                  onChange={(e) => setShakeVipDailyLimit(e.target.value)}
                  disabled={loading || saving}
                />
              </div>

              <div className="text-sm text-muted-foreground">{t.shakeEnterpriseHint}</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{t.cnOnlyHint}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.modelTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {region === "CN" ? (
            <>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>
                  {t.sourceLabel}: {modelSource === "storage" ? t.sourceStorage : t.sourceDefault}
                </div>
                <div>
                  {t.updatedAtLabel}: {toLocalTime(modelUpdatedAt)}
                </div>
                <div>{t.modelHint}</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t.recommendationModelLabel}</label>
                <Select
                  value={recommendationCnModel}
                  onValueChange={(value) => setRecommendationCnModel(value as CnRuntimeModel)}
                  disabled={loading || saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.recommendationModelLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {CN_RUNTIME_MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t.assistantModelLabel}</label>
                <Select
                  value={assistantCnModel}
                  onValueChange={(value) => setAssistantCnModel(value as CnRuntimeModel)}
                  disabled={loading || saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.assistantModelLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {CN_RUNTIME_MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{t.cnOnlyHint}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || saving}>
          {saving ? t.saving : t.save}
        </Button>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {message ? <div className="text-sm text-emerald-600">{message}</div> : null}
      </div>
    </form>
  );
}
