"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions, StripeElementLocale } from "@stripe/stripe-js";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";
import { getStripePromise } from "@/lib/stripe-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";

interface StripeCheckoutDialogProps {
  open: boolean;
  clientSecret: string | null;
  amount: number;
  currency: string;
  planName: string;
  billingCycle: BillingCycle;
  orderId?: string | null;
  onClose: () => void;
  onSucceeded?: (paymentIntentId: string) => void;
}

export function StripeCheckoutDialog({
  open,
  clientSecret,
  amount,
  currency,
  planName,
  billingCycle,
  orderId,
  onClose,
  onSucceeded,
}: StripeCheckoutDialogProps) {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const options: StripeElementsOptions | undefined = useMemo(() => {
    if (!clientSecret) return undefined;

    const locale: StripeElementLocale = language === "zh" ? "zh" : "en";

    return {
      clientSecret,
      locale,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#2563EB",
        },
      },
    };
  }, [clientSecret, language]);

  const stripePromise = useMemo(() => getStripePromise(), []);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            {language === "zh" ? "安全结账" : "Secure checkout"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {language === "zh"
              ? "您的支付信息会通过 Stripe 安全加密处理"
              : "Your payment details are encrypted and handled by Stripe"}
          </DialogDescription>
        </DialogHeader>

        {!clientSecret ? (
          <Alert variant="destructive">
            <AlertDescription>
              {language === "zh"
                ? "未能创建 Stripe 支付意向，请稍后再试。"
                : "Unable to start Stripe checkout right now. Please try again."}
            </AlertDescription>
          </Alert>
        ) : !publishableKey ? (
          <Alert variant="destructive">
            <AlertDescription>
              {language === "zh"
                ? "缺少 Stripe 公钥，请检查 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 配置。"
                : "Stripe publishable key is missing. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === "zh" ? "计划" : "Plan"}
                </span>
                <span className="font-medium">{planName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === "zh" ? "账单周期" : "Billing cycle"}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {billingCycle}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {language === "zh" ? "应付金额" : "Amount due"}
                </span>
                <span className="text-lg font-semibold">
                  {new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
                    style: "currency",
                    currency,
                  }).format(amount)}
                </span>
              </div>
            </div>

            <div className="rounded-lg border p-3 sm:p-4">
              {options && (
                <Elements stripe={stripePromise} options={options}>
                  <StripePaymentForm
                    clientSecret={clientSecret}
                    orderId={orderId}
                    onSucceeded={onSucceeded}
                  />
                </Elements>
              )}
            </div>
          </>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            {t.pricing.back}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StripePaymentFormProps {
  clientSecret: string;
  orderId?: string | null;
  onSucceeded?: (paymentIntentId: string) => void;
}

function StripePaymentForm({ clientSecret, orderId, onSucceeded }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setMessage(
        language === "zh"
          ? "Stripe 尚未加载，请稍候重试。"
          : "Stripe is still loading. Please try again."
      );
      return;
    }

    setMessage(null);
    setIsSubmitting(true);

    try {
      const encodedOrderId = encodeURIComponent(orderId ?? "");
      const returnUrl = `${window.location.origin}/payment-success?provider=stripe&orderId=${encodedOrderId}&payment_intent_client_secret=${encodeURIComponent(clientSecret)}`;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (error) {
        setMessage(error.message || t.pricing.toast.paymentFailed);
        setIsSubmitting(false);
        return;
      }

      if (paymentIntent) {
        if (paymentIntent.status === "succeeded") {
          onSucceeded?.(paymentIntent.id);
          router.push(returnUrl);
          return;
        }

        const redirectUrl = paymentIntent.next_action?.redirect_to_url?.url;
        if (paymentIntent.status === "requires_action" && redirectUrl) {
          // Some payment methods need an extra redirect step.
          window.location.href = redirectUrl;
          return;
        }

        if (paymentIntent.status === "processing") {
          router.push(returnUrl);
          return;
        }
      }

      setIsSubmitting(false);
    } catch (err: any) {
      setMessage(err?.message || t.pricing.toast.paymentFailed);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {message && (
        <Alert variant="destructive" className="text-sm">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          className={cn("w-full sm:w-auto", isSubmitting && "cursor-wait")}
          onClick={handleSubmit}
          disabled={isSubmitting || !stripe || !elements}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.pricing.processing}
            </>
          ) : (
            t.pricing.paymentMethod?.stripe || "Pay with Stripe"
          )}
        </Button>
      </div>
    </div>
  );
}
