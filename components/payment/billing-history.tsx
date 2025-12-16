"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, RefreshCw, CreditCard, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

interface BillingRecord {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
  paymentMethod: string;
  invoiceUrl?: string;
}

export function BillingHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslations(language);

  useEffect(() => {
    const fetchBillingHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadingText(language === "zh" ? "正在加载账单记录..." : "Loading billing records...");

        const { fetchWithAuth } = await import("@/lib/auth/fetch-with-auth");

        let allRecords: BillingRecord[] = [];
        let page = 1;
        const pageSize = 50;
        let hasMore = true;

        console.log("[BillingHistory] Fetching billing history for user:", user.id);

        // Fetch all pages
        while (hasMore) {
          if (page > 1) {
            setLoadingText(language === "zh"
              ? `正在加载账单记录... (第 ${page} 页)`
              : `Loading billing records... (Page ${page})`);
          }

          const resp = await fetchWithAuth(`/api/payment/history?page=${page}&pageSize=${pageSize}`);

          if (!resp.ok) {
            const errorText = await resp.text();
            console.error("[BillingHistory] API error:", resp.status, errorText);
            throw new Error("Failed to fetch billing history");
          }

          const apiData = await resp.json();
          const pageRecords = apiData.records || [];

          console.log(`[BillingHistory] Page ${page}: received ${pageRecords.length} records`, pageRecords);

          allRecords = [...allRecords, ...pageRecords];

          // If we got fewer records than pageSize, we've reached the end
          if (pageRecords.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }

        console.log("[BillingHistory] Total records loaded:", allRecords.length, allRecords);
        setRecords(allRecords);
        setError(null);
      } catch (err) {
        console.error("Billing history error:", err);
        setError("Failed to load billing history");
      } finally {
        setLoading(false);
        setLoadingText("");
      }
    };

    fetchBillingHistory();
  }, [user?.id, language, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const getStatusBadge = (status: BillingRecord["status"]) => {
    const statusConfig = {
      paid: {
        variant: "default" as const,
        text: language === "zh" ? "已支付" : "Paid",
        className: "bg-green-100 text-green-800 hover:bg-green-100",
      },
      pending: {
        variant: "secondary" as const,
        text: language === "zh" ? "待支付" : "Pending",
        className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      },
      failed: {
        variant: "destructive" as const,
        text: language === "zh" ? "已取消" : "Cancelled",
        className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
      },
      refunded: {
        variant: "outline" as const,
        text: language === "zh" ? "已退款" : "Refunded",
        className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      },
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      language === "zh" ? "zh-CN" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  // 取消订单
  const handleCancelOrder = async (recordId: string) => {
    setProcessingId(recordId);
    try {
      const { fetchWithAuth } = await import("@/lib/auth/fetch-with-auth");

      const response = await fetchWithAuth(`/api/payment/cancel`, {
        method: "POST",
        body: JSON.stringify({ paymentId: recordId }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel order");
      }

      toast({
        title: "Success",
        description: "Payment cancelled successfully",
      });

      // 刷新账单列表
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, status: "failed" as const } : r
        )
      );
    } catch (error) {
      console.error("Cancel order error:", error);
      toast({
        title: "Error",
        description: "Failed to cancel payment",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            {loadingText || (language === "zh" ? "加载中..." : "Loading...")}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const visibleRecords = records.filter((record) => record.status !== "pending");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {language === "zh" ? "账单历史" : "Billing History"}
            </CardTitle>
            <CardDescription>
              {language === "zh"
                ? "查看和管理您的支付记录"
                : "View and manage your payment records"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {language === "zh" ? "刷新" : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {visibleRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "zh" ? "暂无账单记录" : "No billing records found"}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 显示记录总数 */}
            <div className="text-sm text-muted-foreground">
              {language === "zh"
                ? `共 ${visibleRecords.length} 条记录`
                : `${visibleRecords.length} record${visibleRecords.length > 1 ? "s" : ""} found`}
            </div>

            {/* 表格容器，添加最大高度和滚动 */}
            <div className="max-h-[500px] overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>{language === "zh" ? "日期" : "Date"}</TableHead>
                    <TableHead>
                      {language === "zh" ? "描述" : "Description"}
                    </TableHead>
                    <TableHead>{language === "zh" ? "金额" : "Amount"}</TableHead>
                    <TableHead>
                      {language === "zh" ? "支付方式" : "Payment Method"}
                    </TableHead>
                    <TableHead>{language === "zh" ? "状态" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.description}</TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(record.amount, record.currency)}
                      </TableCell>
                      <TableCell>{record.paymentMethod}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
