// app/api/paypal/webhook/route.ts - PayPal Webhook handling with signature verification
import { NextRequest, NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/lib/payment/webhook-handler";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  status?: number;
  rawResponse?: any;
};

const REQUIRED_HEADERS = [
  "paypal-transmission-id",
  "paypal-transmission-time",
  "paypal-cert-url",
  "paypal-auth-algo",
  "paypal-transmission-sig",
];

function isProductionPaypalEnv() {
  const env =
    (process.env.PAYPAL_ENVIRONMENT || process.env.NODE_ENV || "").toLowerCase();
  return env === "production";
}

function getPaypalApiBaseUrl() {
  return isProductionPaypalEnv()
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function verifyPaypalWebhookSignature(
  request: NextRequest,
  webhookEvent: any
): Promise<VerificationResult> {
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !request.headers.get(header)
  );

  if (missingHeaders.length) {
    return {
      verified: false,
      reason: `Missing PayPal webhook headers: ${missingHeaders.join(", ")}`,
    };
  }

  const transmissionId = request.headers.get("paypal-transmission-id")!;
  const transmissionTime = request.headers.get("paypal-transmission-time")!;
  const certUrl = request.headers.get("paypal-cert-url")!;
  const authAlgo = request.headers.get("paypal-auth-algo")!;
  const transmissionSig = request.headers.get("paypal-transmission-sig")!;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!webhookId) {
    return { verified: false, reason: "PAYPAL_WEBHOOK_ID is not configured" };
  }

  if (
    !clientId ||
    !clientSecret ||
    clientId === "demo_client_id" ||
    clientSecret === "demo_client_secret"
  ) {
    return { verified: false, reason: "PayPal client credentials are missing" };
  }

  try {
    const baseUrl = getPaypalApiBaseUrl();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));
    const accessToken = tokenJson?.access_token as string | undefined;

    if (!tokenRes.ok || !accessToken) {
      return {
        verified: false,
        reason: `Failed to fetch PayPal access token (${tokenRes.status})`,
        rawResponse: tokenJson,
        status: tokenRes.status,
      };
    }

    const verifyRes = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: webhookEvent,
        }),
      }
    );

    const verifyJson = await verifyRes.json().catch(() => ({}));

    const verified =
      verifyRes.ok && verifyJson?.verification_status === "SUCCESS";

    return {
      verified,
      reason: verified
        ? undefined
        : verifyJson?.verification_status ||
          verifyJson?.name ||
          "Webhook signature verification failed",
      rawResponse: verifyJson,
      status: verifyRes.status,
    };
  } catch (error: any) {
    console.error("PayPal webhook verification error:", error);
    return {
      verified: false,
      reason: error?.message || "Unexpected error during verification",
    };
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let body: any;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.error("Invalid PayPal webhook payload:", error);
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const eventType = body.event_type || "unknown";
  const enforceVerification = isProductionPaypalEnv();

  console.log(`[PayPal Webhook] Received event ${eventType}`, {
    enforceVerification,
  });

  const verification = await verifyPaypalWebhookSignature(request, body);

  if (!verification.verified) {
    if (enforceVerification) {
      console.error("[PayPal Webhook] Signature verification failed", {
        reason: verification.reason,
        status: verification.status,
      });
      return NextResponse.json(
        { success: false, error: "Invalid PayPal webhook signature" },
        { status: 400 }
      );
    } else {
      console.warn("[PayPal Webhook] Signature not verified (non-production)", {
        reason: verification.reason,
      });
    }
  }

  const webhookData = {
    type: body.event_type,
    data: body.resource,
    paymentMethod: "paypal",
  };

  try {
    await handlePayPalWebhook(webhookData);

    console.log(`[PayPal Webhook] Processed event ${eventType}`, {
      verified: verification.verified,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
