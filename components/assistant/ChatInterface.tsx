"use client";

/**
 * AI 超级助手 - 聊天界面组件
 *
 * 功能描述：会员专属 AI 助手的主聊天界面
 * - 消息输入和发送
 * - 对话历史展示
 * - 结构化结果渲染（计划、候选结果卡片、动作按钮）
 * - 追问建议
 * - 使用次数显示
 * - 位置获取
 *
 * @param locale - 语言 zh|en
 * @param region - 区域 CN|INTL
 * @param userId - 用户 ID
 * @param planType - 用户计划类型
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MapPin,
  Loader2,
  Mic,
  MicOff,
  Bot,
  User,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Phone,
  Copy,
  Star,
  Clock,
  Navigation,
  AlertCircle,
  Bookmark,
  CreditCard,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useTencentASR } from "@/hooks/useTencentASR";
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth";
import type {
  ChatMessage,
  AssistantResponse,
  AssistantUsageStats,
  CandidateResult,
  AssistantAction,
  PlanStep,
  FollowUpSuggestion,
} from "@/lib/assistant/types";

interface ChatInterfaceProps {
  locale: "zh" | "en";
  region: "CN" | "INTL";
  planType: "free" | "pro" | "enterprise";
}

function detectClientType(): "app" | "web" {
  if (typeof window === "undefined") return "web";
  const search = new URLSearchParams(window.location.search);
  if (search.get("app") === "1") return "app";
  const w = window as any;
  if (typeof w.ReactNativeWebView?.postMessage === "function") return "app";
  if (typeof w.webkit?.messageHandlers?.native?.postMessage === "function") return "app";
  if (typeof w.Android?.wechatLogin === "function") return "app";
  if (typeof w.AndroidWeChatBridge?.startLogin === "function") return "app";
  const ua = navigator.userAgent || "";
  if (ua.includes("median") || ua.includes("gonative")) return "app";
  return "web";
}

/**
 * 生成唯一消息 ID
 * @returns 唯一 ID 字符串
 */
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatCoordinates(lat: number, lng: number, locale: "zh" | "en"): string {
  const roundedLat = lat.toFixed(5);
  const roundedLng = lng.toFixed(5);

  if (locale === "zh") {
    return `纬度 ${roundedLat}，经度 ${roundedLng}`;
  }

  return `lat ${roundedLat}, lng ${roundedLng}`;
}

function normalizeVoiceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function mergeVoicePrompt(baseText: string, nextText: string): string {
  const base = baseText.trim();
  const next = normalizeVoiceText(nextText);

  if (!next) {
    return base;
  }

  if (!base) {
    return next;
  }

  if (base.endsWith(next)) {
    return base;
  }

  const maxOverlap = Math.min(base.length, next.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (base.slice(-overlap) === next.slice(0, overlap)) {
      return `${base}${next.slice(overlap)}`;
    }
  }

  const hasCjk = /[\u4e00-\u9fff]/.test(base + next);
  if (hasCjk) {
    return `${base}${next}`;
  }

  return `${base} ${next}`;
}

export default function ChatInterface({
  locale,
  region,
  planType,
}: ChatInterfaceProps) {
  const effectiveLocale: "zh" | "en" = region === "INTL" ? "en" : locale;
  const isZh = effectiveLocale === "zh";
  const isCnRegion = region === "CN";
  const { toast } = useToast();

  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<AssistantUsageStats | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isRealtimeVoiceInputActive, setIsRealtimeVoiceInputActive] = useState(false);
  const [interimVoiceText, setInterimVoiceText] = useState("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputValueRef = useRef("");
  const voiceCommittedInputRef = useRef("");

  const composedInputValue = interimVoiceText
    ? mergeVoicePrompt(input, interimVoiceText)
    : input;
  const canSendText = composedInputValue.trim().length > 0;

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  useEffect(() => {
    if (!isRealtimeVoiceInputActive) {
      voiceCommittedInputRef.current = input;
    }
  }, [isRealtimeVoiceInputActive, input]);

  // 初始化：获取使用统计 + 加载历史
  useEffect(() => {
    fetchUsage();
    loadHistory();
    // 尝试从缓存获取位置
    const cached = localStorage.getItem("geo-coords");
    if (cached) {
      try {
        const coords = JSON.parse(cached);
        if (coords.lat && coords.lng) {
          setLocation(coords);
          setLocationName(formatCoordinates(coords.lat, coords.lng, effectiveLocale));
          void fetchLocationName(coords.lat, coords.lng);
        }
      } catch { /* 忽略 */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 获取使用统计
   */
  async function fetchUsage() {
    try {
      const res = await fetchWithAuth("/api/assistant/usage");
      const data = await res.json();
      if (data.success) setUsage(data.usage);
    } catch { /* 忽略 */ }
  }

  /**
   * 加载对话历史
   */
  async function loadHistory() {
    if (historyLoaded) return;
    try {
      const res = await fetchWithAuth("/api/assistant/conversations?limit=20");
      const data = await res.json();
      if (data.success && data.conversations?.length > 0) {
        const restored: ChatMessage[] = data.conversations.map(
          (c: { id: string; role: "user" | "assistant"; content: string; structuredResponse?: AssistantResponse; createdAt: string }) => ({
            id: c.id || generateId(),
            role: c.role,
            content: c.content,
            structuredResponse: c.structuredResponse,
            createdAt: c.createdAt,
          })
        );
        setMessages(
          [...restored].sort((left, right) => {
            const leftTime = Date.parse(left.createdAt);
            const rightTime = Date.parse(right.createdAt);

            const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
            const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
            if (normalizedLeftTime !== normalizedRightTime) {
              return normalizedLeftTime - normalizedRightTime;
            }

            if (left.role !== right.role) {
              return left.role === "user" ? -1 : 1;
            }

            return left.id.localeCompare(right.id);
          })
        );
      }
    } catch { /* 忽略 */ }
    setHistoryLoaded(true);
  }

  /**
   * 清除对话历史
   */
  async function clearHistory() {
    try {
      await fetchWithAuth("/api/assistant/conversations", { method: "DELETE" });
      setMessages([]);
      toast({
        title: isZh ? "已清除" : "Cleared",
        description: isZh ? "对话历史已清除" : "Conversation history cleared",
      });
    } catch { /* 忽略 */ }
  }

  /**
   * 调用反向地理编码 API，将经纬度转换为可读位置名称
   */
  async function fetchLocationName(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch("/api/assistant/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, locale: effectiveLocale, region }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.success && data.displayName) {
        setLocationName(data.displayName);
        return data.displayName;
      }
    } catch {
      console.warn("[ChatInterface] Reverse geocode failed");
    }

    return null;
  }

  /**
   * 获取用户位置
   */
  async function requestLocation() {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const fallbackLocation = formatCoordinates(coords.lat, coords.lng, effectiveLocale);

      setLocation(coords);
      setLocationName(fallbackLocation);
      localStorage.setItem("geo-coords", JSON.stringify(coords));
      const resolvedLocation = await fetchLocationName(coords.lat, coords.lng);

      toast({
        title: isZh ? "定位成功" : "Location obtained",
        description: isZh
          ? `当前位置：${resolvedLocation || fallbackLocation}`
          : `Current location: ${resolvedLocation || fallbackLocation}`,
      });
    } catch {
      toast({
        title: isZh ? "定位失败" : "Location failed",
        description: isZh ? "请检查位置权限设置" : "Please check location permissions",
        variant: "destructive",
      });
    }
    setLocationLoading(false);
  }

  /**
   * 发送消息
   */
  const getRealtimeVoiceInputErrorMessage = useCallback((errorType: string) => {
    switch (errorType) {
      case "network":
        return isZh
          ? "实时语音服务不可用（network），请检查网络或使用 HTTPS / localhost。"
          : "Realtime voice service unavailable (network). Check your connection and use HTTPS / localhost.";
      case "not-allowed":
      case "service-not-allowed":
        return isZh
          ? "麦克风权限被拒绝，请在浏览器中开启麦克风权限后重试。"
          : "Microphone permission denied. Please allow microphone access and try again.";
      case "audio-capture":
        return isZh ? "未检测到可用麦克风设备。" : "No available microphone device was detected.";
      default:
        return isZh ? `实时语音输入失败：${errorType}` : `Realtime voice input failed: ${errorType}`;
    }
  }, [isZh]);

  const {
    isActive: isTencentAsrActive,
    start: startTencentAsr,
    stop: stopTencentAsr,
  } = useTencentASR({
    onTranscript: useCallback((text: string, isFinal: boolean) => {
      const normalized = normalizeVoiceText(text);
      if (!normalized) {
        return;
      }

      if (isFinal) {
        const mergedInput = mergeVoicePrompt(voiceCommittedInputRef.current, normalized);
        voiceCommittedInputRef.current = mergedInput;
        inputValueRef.current = mergedInput;
        setInput(mergedInput);
        setInterimVoiceText("");
      } else {
        setInterimVoiceText(normalized);
      }
    }, []),
    onError: useCallback((error: string) => {
      toast({
        title: isZh ? "语音输入失败" : "Voice input failed",
        description: getRealtimeVoiceInputErrorMessage(error),
        variant: "destructive",
      });
    }, [getRealtimeVoiceInputErrorMessage, isZh, toast]),
    language: effectiveLocale === "zh" ? "zh-CN" : "en-US",
  });

  const stopRealtimeVoiceInput = useCallback(() => {
    if (!isCnRegion) return;

    stopTencentAsr();
    setIsRealtimeVoiceInputActive(false);

    const finalInput = mergeVoicePrompt(voiceCommittedInputRef.current, interimVoiceText);
    setInterimVoiceText("");
    inputValueRef.current = finalInput;
    voiceCommittedInputRef.current = finalInput;
    setInput(finalInput);
  }, [interimVoiceText, isCnRegion, stopTencentAsr]);

  const startRealtimeVoiceInput = useCallback(() => {
    if (!isCnRegion || isLoading) return;

    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (!window.isSecureContext && !isLocalhost) {
        toast({
          title: isZh ? "无法启动语音输入" : "Failed to start voice input",
          description: isZh
            ? "实时语音输入需要在 HTTPS 或 localhost 环境下使用。"
            : "Realtime voice input requires HTTPS or localhost.",
          variant: "destructive",
        });
        return;
      }
    }

    voiceCommittedInputRef.current = inputValueRef.current;
    setInterimVoiceText("");
    setIsRealtimeVoiceInputActive(true);
    void startTencentAsr();
  }, [isCnRegion, isLoading, isZh, startTencentAsr, toast]);

  useEffect(() => {
    if (!isCnRegion) return;
    setIsRealtimeVoiceInputActive(isTencentAsrActive);
  }, [isCnRegion, isTencentAsrActive]);

  useEffect(() => {
    return () => {
      stopTencentAsr();
    };
  }, [stopTencentAsr]);

  async function sendMessage(text?: string) {
    const rawMessageText = typeof text === "string" ? text : composedInputValue;
    const messageText = rawMessageText.trim();
    if (!messageText || isLoading) return;

    if (isRealtimeVoiceInputActive) {
      stopRealtimeVoiceInput();
    }

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };

    // 添加加载占位
    const loadingMsg: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      isLoading: true,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setInterimVoiceText("");
    inputValueRef.current = "";
    voiceCommittedInputRef.current = "";
    setIsLoading(true);

    try {
      // 构建历史
      const history = messages
        .filter((m) => !m.isLoading)
        .slice(-10)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await fetchWithAuth("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message: messageText,
          history,
          location,
          locale: effectiveLocale,
          region,
          client: detectClientType(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        // 处理限制错误
        if (res.status === 403) {
          const errorMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: "",
            structuredResponse: {
              type: "error",
              message:
                data.error === "monthly_limit_reached" || data.error === "free_limit_reached"
                  ? isZh
                    ? "本月免费使用次数已达上限，开通 VIP 可获得更多使用次数。"
                    : "Your free monthly limit has been reached. Subscribe to VIP for more usage."
                  : data.error === "daily_limit_reached"
                    ? isZh
                      ? "今日使用次数已达上限，明天再来吧！"
                      : "Daily limit reached. Come back tomorrow!"
                    : (data.error || (isZh ? "请求失败" : "Request failed")),
            },
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev.slice(0, -1), errorMsg]);
        } else {
          throw new Error(data.error);
        }
      } else {
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: data.response?.message || "",
          structuredResponse: data.response,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);

        if (data.usage) setUsage(data.usage);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: isZh ? "抱歉，处理请求时出错了。请稍后再试。" : "Sorry, an error occurred. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);
    }

    setIsLoading(false);
  }

  /**
   * 处理键盘事件
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /**
   * 复制文本到剪贴板
   */
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: isZh ? "已复制" : "Copied",
      description: text.length > 30 ? text.substring(0, 30) + "..." : text,
    });
  }

  // ====== 渲染函数 ======

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* 使用次数状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700">
            {isZh ? "AI 超级助手" : "AI Super Assistant"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-gray-400 hover:text-red-400 transition-colors p-1"
              title={isZh ? "清除对话" : "Clear chat"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {usage && (
            <div className="flex items-center gap-1.5 text-xs">
              {usage.remaining === -1 ? (
                <span className="text-green-600 font-medium">
                  {isZh ? "无限次" : "Unlimited"}
                </span>
              ) : (
                <>
                  <span className={`font-medium ${usage.remaining <= 1 ? "text-red-500" : "text-purple-600"}`}>
                    {usage.remaining}
                  </span>
                  <span className="text-gray-500">
                    / {usage.limit} {isZh
                      ? usage.periodType === "daily"
                        ? "次/日"
                        : "次/月"
                      : usage.periodType === "daily"
                        ? "/day"
                        : "/month"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 欢迎消息 */}
        {messages.length === 0 && (
          <WelcomeMessage isZh={isZh} location={location} onRequestLocation={requestLocation} locationLoading={locationLoading} onSendExample={sendMessage} />
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.role === "user" ? (
                <UserBubble content={msg.content} />
              ) : msg.isLoading ? (
                <LoadingBubble isZh={isZh} />
              ) : (
                <AssistantBubble
                  message={msg}
                  isZh={isZh}
                  onSendFollowUp={sendMessage}
                  onCopy={copyToClipboard}
                  planType={planType}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 位置状态 + 输入框 */}
      <div className="border-t bg-white/80 backdrop-blur px-4 pt-2 pb-3 rounded-b-xl">
        {/* 位置标签 */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={requestLocation}
            disabled={locationLoading}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors max-w-[200px] ${
              location
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-purple-50 hover:text-purple-500 hover:border-purple-200"
            }`}
          >
            {locationLoading ? (
              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
            ) : (
              <MapPin className="h-3 w-3 flex-shrink-0" />
            )}
            <span className="truncate">
              {location
                ? (isZh ? "已定位" : "Located")
                : (isZh ? "点击定位" : "Get location")
              }
            </span>
          </button>

          {location && locationName && (
            <span className="text-[11px] text-gray-500 break-all">
              {locationName}
            </span>
          )}
        </div>

        {/* 输入框 */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={composedInputValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              setInput(nextValue);
              inputValueRef.current = nextValue;
              if (isRealtimeVoiceInputActive) {
                setInterimVoiceText("");
                voiceCommittedInputRef.current = nextValue;
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isZh
                ? "输入你想做的事，比如「帮我找附近的 Mac 电脑店」..."
                : "Tell me what you need, like 'Find Mac computer stores nearby'..."
            }
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent min-h-[56px] max-h-[120px]"
            rows={2}
            disabled={isLoading}
          />
          {isCnRegion && (
            <Button
              onClick={() => {
                if (isRealtimeVoiceInputActive) {
                  stopRealtimeVoiceInput();
                } else {
                  startRealtimeVoiceInput();
                }
              }}
              disabled={isLoading}
              size="icon"
              variant="outline"
              title={
                isRealtimeVoiceInputActive
                  ? (isZh ? "停止语音输入" : "Stop voice input")
                  : (isZh ? "实时语音输入" : "Realtime voice input")
              }
              className={`h-[56px] w-[56px] rounded-xl border ${
                isRealtimeVoiceInputActive
                  ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {isRealtimeVoiceInputActive ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !canSendText}
            size="icon"
            className="h-[56px] w-[56px] rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 子组件
// ==========================================

/**
 * 欢迎消息
 */
function WelcomeMessage({
  isZh,
  location,
  onRequestLocation,
  locationLoading,
  onSendExample,
}: {
  isZh: boolean;
  location: { lat: number; lng: number } | null;
  onRequestLocation: () => void;
  locationLoading: boolean;
  onSendExample: (text: string) => void;
}) {
  const examples = isZh
    ? [
        "帮我找 10 公里以内出售 Mac 电脑的店",
        "我今晚想吃麻辣烫，离我近点，能 30 分钟送到",
        "附近有没有评分 4.5 以上的健身房",
        "帮我把上次的筛选条件记住，下次直接用",
      ]
    : [
        "Find Mac computer stores within 10km",
        "I want spicy hotpot tonight, close by, delivered in 30 min",
        "Any gyms nearby rated 4.5+?",
        "Save my last filter preferences for next time",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-8"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center mb-4 shadow-lg">
        <Bot className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        {isZh ? "AI 超级助手" : "AI Super Assistant"}
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-[260px]">
        {isZh
          ? "用一句话描述你的需求，我来帮你搞定"
          : "Describe what you need in one sentence, I'll handle the rest"}
      </p>

      {!location && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestLocation}
          disabled={locationLoading}
          className="mb-4 gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          {locationLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {isZh ? "开启定位获取更精准的结果" : "Enable location for better results"}
        </Button>
      )}

      <div className="w-full space-y-2">
        <p className="text-xs text-gray-400 mb-2">
          {isZh ? "试试这样说：" : "Try saying:"}
        </p>
        {examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => onSendExample(ex)}
            className="w-full text-left text-sm px-4 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition-colors text-gray-600 hover:text-purple-700"
          >
            <span className="text-purple-400 mr-1.5">✦</span>
            {ex}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * 用户消息气泡
 */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {content}
        </div>
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

/**
 * 加载中气泡
 */
function LoadingBubble({ isZh }: { isZh: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isZh ? "思考中..." : "Thinking..."}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AI 助手消息气泡 - 含结构化渲染
 */
function AssistantBubble({
  message,
  isZh,
  onSendFollowUp,
  onCopy,
  planType,
}: {
  message: ChatMessage;
  isZh: boolean;
  onSendFollowUp: (text: string) => void;
  onCopy: (text: string) => void;
  planType: string;
}) {
  const sr = message.structuredResponse;

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[90%] w-full">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 space-y-2">
          {/* 错误消息特殊样式 */}
          {sr?.type === "error" ? (
            <ErrorCard message={sr.message} isZh={isZh} planType={planType} />
          ) : (
            <>
              {/* 文本消息 */}
              {(message.content || sr?.message) && (
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-700">
                  {sr?.message || message.content}
                </div>
              )}

              {sr?.thinking && sr.thinking.length > 0 && (
                <ThinkingPanel thinking={sr.thinking} isZh={isZh} />
              )}

              {/* 执行计划 */}
              {sr?.plan && sr.plan.length > 0 && (
                <PlanSteps steps={sr.plan} isZh={isZh} />
              )}

              {/* 候选结果 */}
              {sr?.candidates && sr.candidates.length > 0 && (
                <CandidateCards
                  candidates={sr.candidates}
                  actions={sr.actions || []}
                  isZh={isZh}
                  onCopy={onCopy}
                />
              )}

              {/* 澄清问题 */}
              {sr?.clarifyQuestions && sr.clarifyQuestions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                  <div className="flex items-center gap-1.5 text-amber-700 font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {isZh ? "需要更多信息" : "Need more information"}
                  </div>
                  <ul className="space-y-1 text-amber-600">
                    {sr.clarifyQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 追问建议 */}
              {sr?.followUps && sr.followUps.length > 0 && (
                <FollowUps
                  suggestions={sr.followUps}
                  onSelect={(text) => onSendFollowUp(text)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingPanel({
  thinking,
  isZh,
}: {
  thinking: string[];
  isZh: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full inline-flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              thinking
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
            <p className="text-[11px] text-slate-500">
              {isZh ? "AI 处理过程摘要" : "AI reasoning summary"}
            </p>
            {thinking.map((step, index) => (
              <p
                key={`${index}-${step}`}
                className="text-xs text-slate-600 leading-relaxed"
              >
                {index + 1}. {step}
              </p>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * 执行计划步骤展示
 */
function PlanSteps({ steps, isZh }: { steps: PlanStep[]; isZh: boolean }) {
  return (
    <div className="bg-blue-50/80 border border-blue-100 rounded-xl px-4 py-3 text-sm">
      <div className="text-xs text-blue-500 font-medium mb-2">
        {isZh ? "执行计划" : "Execution Plan"}
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={step.step} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                step.status === "done"
                  ? "bg-green-100 text-green-600"
                  : step.status === "running"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {step.status === "done" ? "✓" : step.step}
            </span>
            <span className={step.status === "done" ? "text-gray-600" : "text-gray-500"}>
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 候选结果卡片列表
 */
function CandidateCards({
  candidates,
  actions,
  isZh,
  onCopy,
}: {
  candidates: CandidateResult[];
  actions: AssistantAction[];
  isZh: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="space-y-2 max-w-full overflow-hidden">
      <div className="text-xs text-gray-400 px-1">
        {isZh ? `找到 ${candidates.length} 个候选` : `Found ${candidates.length} candidates`}
      </div>
      {candidates.map((c, idx) => {
        // 找到对应的 open_app action
        const openAction = actions.find(
          (a) => a.type === "open_app" && a.candidateId === c.id
        ) || actions.find(
          (a) => a.type === "open_app" && a.providerId === c.platform
        );
        const callAction = actions.find(
          (a) => a.type === "call_phone" && a.payload === c.phone
        );

        return (
          <Card
            key={c.id || idx}
            className="p-2 border border-gray-100 hover:border-purple-200 transition-colors overflow-hidden break-words"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-purple-500">#{idx + 1}</span>
                  <h4 className="text-xs font-medium text-gray-800 truncate">
                    {c.name}
                  </h4>
                </div>
                <p className="text-[11px] text-gray-500 mb-2 line-clamp-2">
                  {c.description}
                </p>
                <p className="text-[10px] text-purple-600/80 mb-2 break-all">
                  {isZh ? "搜索词：" : "Search:"}
                  {(c.searchQuery || c.name).trim()}
                </p>

                {/* 元数据标签 */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {c.distance && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-blue-50 text-blue-600 rounded">
                      <Navigation className="h-2.5 w-2.5" />
                      {c.distance}
                    </span>
                  )}
                  {c.rating && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-yellow-50 text-yellow-600 rounded">
                      <Star className="h-2.5 w-2.5" />
                      {c.rating}
                    </span>
                  )}
                  {c.estimatedTime && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-green-50 text-green-600 rounded">
                      <Clock className="h-2.5 w-2.5" />
                      {c.estimatedTime}
                    </span>
                  )}
                  {c.priceRange && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-50 text-purple-600 rounded">
                      {c.priceRange}
                    </span>
                  )}
                  {c.platform && (
                    <span className="px-1 py-0.5 bg-gray-50 text-gray-500 rounded">
                      {c.platform}
                    </span>
                  )}
                </div>

                {/* 地址 */}
                {c.address && (
                  <p className="text-[10px] text-gray-400 mt-1.5 flex items-start gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span className="break-words">{c.address}</span>
                  </p>
                )}

                {/* 营业时间 */}
                {c.businessHours && (
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    {c.businessHours}
                  </p>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-50">
              {openAction && (
                <a
                  href={openAction.payload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg px-2 py-1 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {isZh ? "打开查看" : "Open"}
                </a>
              )}
              {callAction && (
                <a
                  href={`tel:${callAction.payload}`}
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg px-2 py-1 transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  {isZh ? "拨打" : "Call"}
                </a>
              )}
              {c.phone && (
                <button
                  onClick={() => onCopy(c.phone!)}
                  className="inline-flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 rounded-lg p-1.5 transition-colors"
                  title={isZh ? "复制电话" : "Copy phone"}
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
              {c.address && (
                <button
                  onClick={() => onCopy(c.address!)}
                  className="inline-flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 rounded-lg p-1.5 transition-colors"
                  title={isZh ? "复制地址" : "Copy address"}
                >
                  <Bookmark className="h-3 w-3" />
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * 追问建议按钮组
 */
function FollowUps({
  suggestions,
  onSelect,
}: {
  suggestions: FollowUpSuggestion[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.text)}
          className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
          {s.text}
        </button>
      ))}
    </div>
  );
}

/**
 * 错误/限制提示卡片
 */
function ErrorCard({
  message,
  isZh,
  planType,
}: {
  message: string;
  isZh: boolean;
  planType: string;
}) {
  return (
    <div className="bg-red-50/80 border border-red-100 rounded-xl px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-red-600">{message}</p>
          {planType === "free" && (
            <a
              href="/pro"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full px-3 py-1.5 transition-colors"
            >
              <CreditCard className="h-3 w-3" />
              {isZh ? "开通会员" : "Subscribe Now"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
