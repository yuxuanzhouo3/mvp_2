"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
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
  freeTierConfig?: {
    assistantModel: CnRuntimeModel;
    assistantTokenLimit: number;
    recommendationModel: CnRuntimeModel;
    recommendationTokenLimit: number;
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

const DEFAULT_FREE_TIER_TOKEN_LIMIT = 100000;

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
  const [freeTierUpdatedAt, setFreeTierUpdatedAt] = React.useState<string | null>(null);
  const [freeTierSource, setFreeTierSource] = React.useState<"default" | "storage">("default");
  const [freeAssistantCnModel, setFreeAssistantCnModel] = React.useState<CnRuntimeModel>(
    DEFAULT_CN_ASSISTANT_MODEL
  );
  const [freeRecommendationCnModel, setFreeRecommendationCnModel] = React.useState<CnRuntimeModel>(
    DEFAULT_CN_RECOMMENDATION_MODEL
  );
  const [freeAssistantTokenLimit, setFreeAssistantTokenLimit] = React.useState(
    String(DEFAULT_FREE_TIER_TOKEN_LIMIT)
  );
  const [freeRecommendationTokenLimit, setFreeRecommendationTokenLimit] = React.useState(
    String(DEFAULT_FREE_TIER_TOKEN_LIMIT)
  );

  const isZh = region === "CN";
  const t = {
    title: isZh ? "AI 配置" : "AI Config",
    save: isZh ? "保存配置" : "Save Config",
    saving: isZh ? "保存中..." : "Saving...",
    loadError: isZh ? "加载 AI 配置失败" : "Failed to load AI config",
    saveError: isZh ? "保存 AI 配置失败" : "Failed to save AI config",
    saveOk: isZh ? "AI 配置已保存并立即生效" : "AI config saved and applied immediately",

    usageTitle: isZh ? "助手使用额度" : "Assistant Usage Limits",
    shakeTitle: isZh ? "AI 推荐使用额度" : "Recommendation Usage Limits",
    regionLabel: isZh ? "部署区域" : "Deployment Region",
    sourceLabel: isZh ? "数据来源" : "Source",
    sourceStorage: isZh ? "数据库" : "Database",
    sourceDefault: isZh ? "默认值" : "Default",
    updatedAtLabel: isZh ? "最后更新时间" : "Last Updated",
    freeDailyLabel: isZh ? "免费用户每日使用次数" : "Free Users Daily Usage Count",
    freeMonthlyLabel: isZh ? "免费用户每月使用次数" : "Free Users Monthly Usage Count",
    vipLabel: isZh ? "VIP 用户每日使用次数" : "VIP Users Daily Usage Count",
    enterpriseHint: isZh
      ? "Enterprise 用户保持无限制，不受本页配置影响。"
      : "Enterprise users remain unlimited and are not affected by this page.",
    shakeHint: isZh
      ? "AI 推荐仍按次数限额控制，保存后立即生效。"
      : "Recommendation keeps the existing count-based quota and applies immediately after save.",
    shakeFreeMonthlyLabel: isZh ? "免费用户每月推荐次数" : "Free Users Monthly Recommendation Limit",
    shakeVipDailyLabel: isZh ? "VIP 用户每日推荐次数" : "VIP Users Daily Recommendation Limit",
    shakeEnterpriseHint: isZh
      ? "Enterprise 用户的 AI 推荐保持无限制。"
      : "Enterprise users remain unlimited for recommendation.",

    modelTitle: isZh ? "CN 运行时模型切换" : "CN Runtime Model Switching",
    modelHint: isZh
      ? "仅作用于 CN 区域的非免费用户，保存后立即生效，无需重启。"
      : "Applies to non-free users in CN and takes effect immediately with no restart required.",
    recommendationModelLabel: isZh ? "AI 推荐模型" : "Recommendation Model",
    assistantModelLabel: isZh ? "AI 助手模型" : "Assistant Model",
    cnOnlyHint: isZh ? "在线模型切换仅在 CN 区域可用。" : "Online model switching is only available in CN.",

    freeDailyError: isZh ? "免费用户每日次数必须是大于等于 0 的整数" : "Free daily limit must be an integer >= 0",
    freeMonthlyError: isZh ? "免费用户每月次数必须是大于等于 0 的整数" : "Free monthly limit must be an integer >= 0",
    freeMonthlyLessThanDaily: isZh
      ? "免费用户每月次数必须大于或等于每日次数"
      : "Free monthly limit must be greater than or equal to free daily limit",
    vipError: isZh ? "VIP 用户每日次数必须是大于等于 0 的整数" : "VIP daily limit must be an integer >= 0",
    shakeFreeMonthlyError: isZh
      ? "免费用户每月推荐次数必须是大于等于 0 的整数"
      : "Free monthly recommendation limit must be an integer >= 0",
    shakeVipDailyError: isZh
      ? "VIP 用户每日推荐次数必须是大于等于 0 的整数"
      : "VIP daily recommendation limit must be an integer >= 0",
    freeTierTitle: isZh ? "免费用户模型与 Token 配额" : "Free User Models & Token Quotas",
    freeTierHint: isZh
      ? "仅限 CN 区域，保存后立即生效。AI 推荐与 AI 助手分别使用独立的免费模型和总 Token 配额。"
      : "CN only. Changes apply immediately. Recommendation and Assistant use separate free-tier models and total token quotas.",
    freeAssistantModelLabel: isZh ? "免费助手模型" : "Free Assistant Model",
    freeRecommendationModelLabel: isZh ? "免费推荐模型" : "Free Recommendation Model",
    freeAssistantTokenLabel: isZh ? "免费助手 Token 配额" : "Free Assistant Token Limit",
    freeRecommendationTokenLabel: isZh ? "免费推荐 Token 配额" : "Free Recommendation Token Limit",
    freeAssistantModelError: isZh ? "免费助手模型不能为空" : "Free assistant model is required",
    freeRecommendationModelError: isZh ? "免费推荐模型不能为空" : "Free recommendation model is required",
    freeAssistantTokenError: isZh ? "免费助手 Token 配额必须是大于等于 0 的整数" : "Free assistant token limit must be an integer >= 0",
    freeRecommendationTokenError: isZh ? "免费推荐 Token 配额必须是大于等于 0 的整数" : "Free recommendation token limit must be an integer >= 0",
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

      if (data.region === "CN" && data.freeTierConfig) {
        setFreeAssistantCnModel(data.freeTierConfig.assistantModel);
        setFreeRecommendationCnModel(data.freeTierConfig.recommendationModel);
        setFreeAssistantTokenLimit(String(data.freeTierConfig.assistantTokenLimit));
        setFreeRecommendationTokenLimit(String(data.freeTierConfig.recommendationTokenLimit));
        setFreeTierUpdatedAt(data.freeTierConfig.updatedAt || null);
        setFreeTierSource(data.freeTierConfig.source);
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
    const freeAssistantTokens = Number(freeAssistantTokenLimit);
    const freeRecommendationTokens = Number(freeRecommendationTokenLimit);

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

    const trimmedAssistantCnModel = assistantCnModel.trim();
    const trimmedRecommendationCnModel = recommendationCnModel.trim();
    const trimmedFreeAssistantCnModel = freeAssistantCnModel.trim();
    const trimmedFreeRecommendationCnModel = freeRecommendationCnModel.trim();

    if (region === "CN" && !trimmedRecommendationCnModel) {
      setError(isZh ? "AI 推荐模型不能为空" : "Recommendation model is required");
      return;
    }

    if (region === "CN" && !trimmedAssistantCnModel) {
      setError(isZh ? "AI 助手模型不能为空" : "Assistant model is required");
      return;
    }

    if (region === "CN" && !trimmedFreeAssistantCnModel) {
      setError(t.freeAssistantModelError);
      return;
    }

    if (region === "CN" && !trimmedFreeRecommendationCnModel) {
      setError(t.freeRecommendationModelError);
      return;
    }

    if (region === "CN" && (!Number.isInteger(freeAssistantTokens) || freeAssistantTokens < 0)) {
      setError(t.freeAssistantTokenError);
      return;
    }

    if (region === "CN" && (!Number.isInteger(freeRecommendationTokens) || freeRecommendationTokens < 0)) {
      setError(t.freeRecommendationTokenError);
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
                assistantCnModel: trimmedAssistantCnModel,
                recommendationCnModel: trimmedRecommendationCnModel,
                freeAssistantCnModel: trimmedFreeAssistantCnModel,
                freeRecommendationCnModel: trimmedFreeRecommendationCnModel,
                freeAssistantTokenLimit: freeAssistantTokens,
                freeRecommendationTokenLimit: freeRecommendationTokens,
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

      if (data.region === "CN" && data.freeTierConfig) {
        setFreeAssistantCnModel(data.freeTierConfig.assistantModel);
        setFreeRecommendationCnModel(data.freeTierConfig.recommendationModel);
        setFreeAssistantTokenLimit(String(data.freeTierConfig.assistantTokenLimit));
        setFreeRecommendationTokenLimit(String(data.freeTierConfig.recommendationTokenLimit));
        setFreeTierUpdatedAt(data.freeTierConfig.updatedAt || new Date().toISOString());
        setFreeTierSource(data.freeTierConfig.source);
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
                <label className="text-sm font-medium" htmlFor="recommendationCnModel">
                  {t.recommendationModelLabel}
                </label>
                <Input
                  id="recommendationCnModel"
                  type="text"
                  value={recommendationCnModel}
                  onChange={(e) => setRecommendationCnModel(e.target.value)}
                  disabled={loading || saving}
                  placeholder={DEFAULT_CN_RECOMMENDATION_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="assistantCnModel">
                  {t.assistantModelLabel}
                </label>
                <Input
                  id="assistantCnModel"
                  type="text"
                  value={assistantCnModel}
                  onChange={(e) => setAssistantCnModel(e.target.value)}
                  disabled={loading || saving}
                  placeholder={DEFAULT_CN_ASSISTANT_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{t.cnOnlyHint}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.freeTierTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {region === "CN" ? (
            <>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>
                  {t.sourceLabel}: {freeTierSource === "storage" ? t.sourceStorage : t.sourceDefault}
                </div>
                <div>
                  {t.updatedAtLabel}: {toLocalTime(freeTierUpdatedAt)}
                </div>
                <div>{t.freeTierHint}</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="freeRecommendationCnModel">
                  {t.freeRecommendationModelLabel}
                </label>
                <Input
                  id="freeRecommendationCnModel"
                  type="text"
                  value={freeRecommendationCnModel}
                  onChange={(e) => setFreeRecommendationCnModel(e.target.value)}
                  disabled={loading || saving}
                  placeholder={DEFAULT_CN_RECOMMENDATION_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="freeRecommendationTokenLimit">
                  {t.freeRecommendationTokenLabel}
                </label>
                <Input
                  id="freeRecommendationTokenLimit"
                  type="number"
                  min={0}
                  step={1}
                  value={freeRecommendationTokenLimit}
                  onChange={(e) => setFreeRecommendationTokenLimit(e.target.value)}
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="freeAssistantCnModel">
                  {t.freeAssistantModelLabel}
                </label>
                <Input
                  id="freeAssistantCnModel"
                  type="text"
                  value={freeAssistantCnModel}
                  onChange={(e) => setFreeAssistantCnModel(e.target.value)}
                  disabled={loading || saving}
                  placeholder={DEFAULT_CN_ASSISTANT_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="freeAssistantTokenLimit">
                  {t.freeAssistantTokenLabel}
                </label>
                <Input
                  id="freeAssistantTokenLimit"
                  type="number"
                  min={0}
                  step={1}
                  value={freeAssistantTokenLimit}
                  onChange={(e) => setFreeAssistantTokenLimit(e.target.value)}
                  disabled={loading || saving}
                />
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

