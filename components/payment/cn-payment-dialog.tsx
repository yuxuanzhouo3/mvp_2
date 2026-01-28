"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth";
import { cn } from "@/lib/utils";
import { useHideSubscriptionUI } from "@/hooks/use-hide-subscription-ui";

type PaymentMethodCN = "wechat" | "alipay";
type PaymentModeCN = "qrcode" | "page";
type PaymentStatus = "pending" | "completed" | "failed" | "cancelled" | "expired";

interface CNPaymentDialogProps {
  open: boolean;
  orderId: string;
  qrCodeUrl?: string;
  paymentUrl?: string;
  mode: PaymentModeCN;
  method: PaymentMethodCN;
  amount: number;
  currency: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  onClose: () => void;
  onSuccess: () => void;
}

// 支付方式配置
const PAYMENT_CONFIG = {
  wechat: {
    name: "微信支付",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89h-.001a.457.457 0 0 1-.055-.002 8.467 8.467 0 0 0-.35-.031zm-2.153 3.122c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.274 0c.536 0 .97.44.97.982a.976.976 0 0 1-.97.983.976.976 0 0 1-.969-.983c0-.542.433-.982.97-.982z"/>
      </svg>
    ),
    bgColor: "bg-green-500",
    textColor: "text-green-600",
    borderColor: "border-green-500",
    bgGradient: "from-green-500 to-green-600",
  },
  alipay: {
    name: "支付宝",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M21.422 15.358c-.598-.191-1.218-.374-1.857-.548a24.57 24.57 0 0 0 1.524-5.31h-4.073v-1.717h5.127V6.333h-5.127V4.25h-2.776v2.083H9.098v1.45h5.142v1.717H9.6v1.45h6.86a21.847 21.847 0 0 1-.917 3.19c-1.925-.433-3.91-.749-5.855-.749-3.178 0-5.117 1.342-5.117 3.408 0 2.066 1.939 3.408 5.117 3.408 2.365 0 4.456-.67 6.203-1.99a44.424 44.424 0 0 0 5.993 2.483l1.538-3.34zm-11.88 2.692c-1.54 0-2.346-.621-2.346-1.408 0-.787.806-1.408 2.346-1.408 1.29 0 2.672.213 4.082.603-1.163 1.416-2.653 2.213-4.082 2.213z"/>
        <path d="M21.6 0H2.4A2.4 2.4 0 0 0 0 2.4v19.2A2.4 2.4 0 0 0 2.4 24h19.2a2.4 2.4 0 0 0 2.4-2.4V2.4A2.4 2.4 0 0 0 21.6 0z" fillOpacity="0"/>
      </svg>
    ),
    bgColor: "bg-blue-500",
    textColor: "text-blue-600",
    borderColor: "border-blue-500",
    bgGradient: "from-blue-500 to-blue-600",
  },
};

export function CNPaymentDialog({
  open,
  orderId,
  qrCodeUrl,
  paymentUrl,
  mode,
  method,
  amount,
  planName,
  billingCycle,
  onClose,
  onSuccess,
}: CNPaymentDialogProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [isPolling, setIsPolling] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5分钟超时
  const { toast } = useToast();
  const hideSubscriptionUI = useHideSubscriptionUI();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [hasTriedOpen, setHasTriedOpen] = useState(false);

  const config = PAYMENT_CONFIG[method];

  // 电脑网站支付模式：显示提示，不自动打开（避免被浏览器拦截）
  useEffect(() => {
    if (open && mode === "page" && paymentUrl && !hasTriedOpen) {
      // 提示用户点击按钮打开支付页面
      toast({
        title: "请点击按钮打开支付页面",
        description: `将跳转到${config.name}完成支付`,
      });
    }
  }, [open, mode, paymentUrl, hasTriedOpen, toast, config.name]);

  // 生成二维码图片（仅扫码模式）
  useEffect(() => {
    if (mode === "qrcode" && qrCodeUrl) {
      QRCode.toDataURL(qrCodeUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrCodeImage(url))
        .catch((err) => {
          console.error("生成二维码失败:", err);
          toast({
            title: "错误",
            description: "生成二维码失败",
            variant: "destructive",
          });
        });
    }
  }, [qrCodeUrl, mode, toast]);

  // 轮询检查支付状态
  const checkPaymentStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth(
        `/api/payment/cn/query?orderId=${orderId}&method=${method}`
      );
      const data = await response.json();

      if (data.success) {
        if (data.status === "completed") {
          setStatus("completed");
          setIsPolling(false);

          toast({
            title: "支付成功",
            description: "您的订阅已激活",
          });

          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else if (data.status === "failed" || data.status === "cancelled") {
          setStatus(data.status);
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error("查询支付状态失败:", error);
    }
  }, [orderId, method, toast, onSuccess]);

  // 开始轮询
  useEffect(() => {
    if (open && status === "pending") {
      setIsPolling(true);

      // 每3秒查询一次
      pollingRef.current = setInterval(() => {
        checkPaymentStatus();
      }, 3000);

      // 倒计时
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setStatus("expired");
            setIsPolling(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [open, status, checkPaymentStatus]);

  // 关闭时清理
  useEffect(() => {
    if (!open) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsPolling(false);
    }
  }, [open]);

  // 刷新二维码
  const handleRefresh = () => {
    setStatus("pending");
    setCountdown(300);
    setIsPolling(true);
  };

  // 打开支付链接（电脑网站支付模式）
  const handleOpenPaymentUrl = () => {
    if (paymentUrl) {
      setHasTriedOpen(true);
      // 使用 window.open 打开支付页面，用户主动点击触发不会被拦截
      const newWindow = window.open(paymentUrl, "_blank");
      if (!newWindow || newWindow.closed) {
        // 如果弹窗被拦截，提示用户
        toast({
          title: "弹窗被拦截",
          description: "请允许弹窗或点击下方链接手动打开",
          variant: "destructive",
        });
      }
    }
  };

  // 直接跳转到支付页面（备用方案）
  const handleRedirectToPayment = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl;
    }
  };

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        {hideSubscriptionUI ? (
          <>
            <DialogHeader>
              <DialogTitle>{"功能不可用"}</DialogTitle>
              <DialogDescription>{"当前设备暂不支持该功能"}</DialogDescription>
            </DialogHeader>
            <div className="py-6 text-sm text-gray-600">
              {"请在非 iPhone 设备或桌面浏览器中打开。"}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {"返回"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg text-white", config.bgColor)}>{config.icon}</div>
                <span>{config.name}</span>
                {mode === "page" && (
                  <Badge variant="secondary" className="ml-2">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    网站支付
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {mode === "qrcode" ? `请使用${config.name}扫描下方二维码完成支付` : `请在打开的${config.name}页面中完成支付`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center space-y-6 py-4">
              <div className="w-full bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">订阅计划</span>
                  <span className="font-medium">{planName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">账单周期</span>
                  <span>{billingCycle === "yearly" ? "年付" : "月付"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">订单号</span>
                  <span className="font-mono text-xs">{orderId}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">支付金额</span>
                    <span className={cn("text-xl font-bold", config.textColor)}>{formatAmount(amount)}</span>
                  </div>
                </div>
              </div>

              {mode === "qrcode" ? (
                <div
                  className={cn("relative p-4 rounded-xl border-2", status === "pending" ? config.borderColor : "border-gray-200")}
                >
                  {status === "pending" && qrCodeImage ? (
                    <>
                      <img src={qrCodeImage} alt="支付二维码" className="w-48 h-48" />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <Badge variant="secondary" className="whitespace-nowrap">
                          <Smartphone className="w-3 h-3 mr-1" />
                          打开{config.name}扫一扫
                        </Badge>
                      </div>
                    </>
                  ) : status === "completed" ? (
                    <div className="w-48 h-48 flex flex-col items-center justify-center text-green-500">
                      <CheckCircle2 className="w-16 h-16 mb-2" />
                      <span className="font-medium">支付成功</span>
                    </div>
                  ) : status === "failed" || status === "cancelled" ? (
                    <div className="w-48 h-48 flex flex-col items-center justify-center text-red-500">
                      <XCircle className="w-16 h-16 mb-2" />
                      <span className="font-medium">{status === "failed" ? "支付失败" : "订单已取消"}</span>
                    </div>
                  ) : status === "expired" ? (
                    <div className="w-48 h-48 flex flex-col items-center justify-center text-gray-400">
                      <XCircle className="w-16 h-16 mb-2" />
                      <span className="font-medium">二维码已过期</span>
                      <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        刷新二维码
                      </Button>
                    </div>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={cn("relative p-6 rounded-xl border-2 w-full", status === "pending" ? config.borderColor : "border-gray-200")}
                >
                  {status === "pending" ? (
                    <div className="flex flex-col items-center space-y-4">
                      <div className={cn("p-4 rounded-full", config.bgColor)}>
                        <ExternalLink className="w-8 h-8 text-white" />
                      </div>
                      {!hasTriedOpen ? (
                        <>
                          <p className="text-center text-gray-600 font-medium">点击下方按钮打开{config.name}支付</p>
                          <Button className={cn("w-full bg-gradient-to-r text-white", `${config.bgGradient}`)} size="lg" onClick={handleOpenPaymentUrl}>
                            <ExternalLink className="w-5 h-5 mr-2" />
                            打开{config.name}支付
                          </Button>
                          <p className="text-center text-xs text-gray-400">
                            如按钮无响应，
                            <button className="text-blue-500 underline hover:text-blue-600" onClick={handleRedirectToPayment}>
                              点此直接跳转
                            </button>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-center text-gray-600">已打开{config.name}支付页面</p>
                          <p className="text-center text-sm text-gray-400">请在支付页面完成付款后返回</p>
                          <Button variant="outline" onClick={handleOpenPaymentUrl} className="mt-2">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            重新打开支付页面
                          </Button>
                        </>
                      )}
                    </div>
                  ) : status === "completed" ? (
                    <div className="flex flex-col items-center justify-center text-green-500 py-4">
                      <CheckCircle2 className="w-16 h-16 mb-2" />
                      <span className="font-medium">支付成功</span>
                    </div>
                  ) : status === "failed" || status === "cancelled" ? (
                    <div className="flex flex-col items-center justify-center text-red-500 py-4">
                      <XCircle className="w-16 h-16 mb-2" />
                      <span className="font-medium">{status === "failed" ? "支付失败" : "订单已取消"}</span>
                    </div>
                  ) : status === "expired" ? (
                    <div className="flex flex-col items-center justify-center text-gray-400 py-4">
                      <XCircle className="w-16 h-16 mb-2" />
                      <span className="font-medium">订单已过期</span>
                      <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新创建订单
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              )}

              {status === "pending" && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {isPolling && (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>等待支付中... {formatCountdown(countdown)}</span>
                    </>
                  )}
                </div>
              )}

              {status === "completed" && <div className="text-green-600 font-medium">订阅已激活，正在跳转...</div>}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                取消支付
              </Button>
              {status === "pending" && (
                <Button className={cn("flex-1 bg-gradient-to-r text-white", `${config.bgGradient}`)} onClick={checkPaymentStatus}>
                  我已完成支付
                </Button>
              )}
            </div>

            <div className="text-center text-xs text-gray-400 mt-2">
              <span>🔒 安全支付由{config.name}提供</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CNPaymentDialog;
