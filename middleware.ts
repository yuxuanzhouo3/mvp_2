import { NextRequest, NextResponse } from "next/server";
import { geoRouter } from "@/lib/architecture-modules/core/geo-router";
import { RegionType } from "@/lib/architecture-modules/core/types";
import { csrfProtection } from "@/lib/security/csrf";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

const GEO_IP_DEBUG = String(process.env.GEO_IP_DEBUG || "").toLowerCase() === "true";
const DEFAULT_API_POST_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
const DEFAULT_RELEASE_UPLOAD_BODY_LIMIT_BYTES = 512 * 1024 * 1024;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getApiPostBodyLimit(pathname: string): number {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/api/admin/releases/upload") {
    return parsePositiveInt(
      process.env.ADMIN_RELEASE_UPLOAD_BODY_LIMIT_BYTES,
      DEFAULT_RELEASE_UPLOAD_BODY_LIMIT_BYTES
    );
  }
  return parsePositiveInt(
    process.env.API_POST_BODY_LIMIT_BYTES,
    DEFAULT_API_POST_BODY_LIMIT_BYTES
  );
}

function formatMiB(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  if (!Number.isFinite(mib) || mib <= 0) return "0MB";
  return Number.isInteger(mib) ? `${mib}MB` : `${mib.toFixed(1)}MB`;
}

function logGeoDebug(message: string, payload: Record<string, unknown>): void {
  if (!GEO_IP_DEBUG || process.env.NODE_ENV === "test") {
    return;
  }

  console.info(message, payload);
}

function maskIp(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }

  if (value.includes(":")) {
    const parts = value.split(":").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts.slice(0, 2).join(":")}::****`;
    }
  }

  return "***";
}

function buildIpHeaderSnapshot(request: NextRequest): Record<string, unknown> {
  return {
    xRealIp: maskIp(request.headers.get("x-real-ip")),
    xForwardedFor: (request.headers.get("x-forwarded-for") || "")
      .split(",")
      .map((ip) => maskIp(ip))
      .filter(Boolean),
    xClientIp: maskIp(request.headers.get("x-client-ip")),
    forwarded: request.headers.get("forwarded") || null,
    cfConnectingIp: maskIp(request.headers.get("cf-connecting-ip")),
    trueClientIp: maskIp(request.headers.get("true-client-ip")),
    requestIp: maskIp(request.ip || null),
  };
}

/**
 * Middleware responsibilities:
 * 1. Handle CORS preflight and response headers for API routes.
 * 2. Protect admin routes with session validation.
 * 3. Detect client region from IP and attach geo headers.
 * 4. Enforce region block policy for INTL deployment.
 * 5. Apply CSRF protection.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Deployment region mode.
  const deploymentRegion = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION || "INTL";
  const isInternationalDeployment = deploymentRegion === "INTL";

  // =====================
  // CORS handling for /api routes.
  // Allowed origins are read from ALLOWED_ORIGINS.
  // =====================
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    // Handle preflight request.
    if (request.method === "OPTIONS") {
      if (isAllowedOrigin) {
        return new NextResponse(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      }

      // Reject unknown origin preflight.
      return new NextResponse(null, {
        status: 403,
        headers: {
          "Access-Control-Allow-Origin": "null",
        },
      });
    }
  }

  // Skip static assets and Next.js internals.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    (pathname.includes(".") && !pathname.startsWith("/api/"))
  ) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    const token = request.cookies.get(getAdminSessionCookieName())?.value;
    const session = await verifyAdminSessionToken(token);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Limit API POST body size (default 10MB, configurable, with route-specific overrides).
  if (pathname.startsWith("/api/") && request.method === "POST") {
    const contentLength = request.headers.get("content-length");
    const maxBodyBytes = getApiPostBodyLimit(pathname);
    const requestBodyBytes = contentLength ? Number.parseInt(contentLength, 10) : NaN;
    if (Number.isFinite(requestBodyBytes) && requestBodyBytes > maxBodyBytes) {
      return new NextResponse(
        JSON.stringify({
          error: "Request body too large",
          message: `Maximum request size is ${formatMiB(maxBodyBytes)}`,
          maxBytes: maxBodyBytes,
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  try {
    // Read debug flag from query string.
    const debugParam = searchParams.get("debug");
    const isDevelopment = process.env.NODE_ENV === "development";

    // Block debug mode in production.
    if (debugParam && !isDevelopment) {
      console.warn(
        `[GeoMiddleware] Blocked debug query param in production: ${debugParam}`
      );
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Debug mode is not allowed in production.",
          code: "DEBUG_MODE_BLOCKED",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Blocked": "true",
          },
        }
      );
    }

    // Block debug mode if it appears in referer query for API calls.
    if (pathname.startsWith("/api/") && !isDevelopment) {
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const refererDebug = refererUrl.searchParams.get("debug");

          if (refererDebug) {
            console.warn(
              `[GeoMiddleware] Blocked debug param from referer in production: ${refererDebug}`
            );
            return new NextResponse(
              JSON.stringify({
                error: "Access Denied",
                message: "Debug mode is not allowed in production.",
                code: "DEBUG_MODE_BLOCKED",
              }),
              {
                status: 403,
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Blocked": "true",
                },
              }
            );
          }
        } catch {
          // Ignore malformed referer URLs.
        }
      }
    }

    let geoResult;

    // In development, allow debug geo override.
    if (debugParam && isDevelopment) {
      console.log(`[GeoMiddleware] Debug mode enabled: ${debugParam}`);

      // Map debug values to fixed geo regions.
      switch (debugParam.toLowerCase()) {
        case "china":
          geoResult = {
            region: RegionType.CHINA,
            countryCode: "CN",
            currency: "CNY",
          };
          break;
        case "usa":
        case "us":
          geoResult = {
            region: RegionType.USA,
            countryCode: "US",
            currency: "USD",
          };
          break;
        case "europe":
        case "eu":
          geoResult = {
            region: RegionType.EUROPE,
            countryCode: "DE",
            currency: "EUR",
          };
          break;
        default:
          // Unknown debug value: fallback to IP-based detection.
          const clientIP = getClientIP(request);
          logGeoDebug("[GeoMiddleware] Debug mode fallback IP detection", {
            pathname,
            clientIP: maskIp(clientIP),
            headers: buildIpHeaderSnapshot(request),
          });
          geoResult = await geoRouter.detect(clientIP || "");
      }
    } else {
      // Detect geo by IP in normal flow.
      const clientIP = getClientIP(request);
      logGeoDebug("[GeoMiddleware] Client IP detection", {
        pathname,
        clientIP: maskIp(clientIP),
        headers: buildIpHeaderSnapshot(request),
      });

      if (!clientIP) {
        console.warn("Unable to resolve client IP, fallback to default geo detection");
        // Empty IP lets geoRouter apply its default behavior.
        geoResult = await geoRouter.detect("");
      } else {
        geoResult = await geoRouter.detect(clientIP);
      }
    }

    console.log(
      `[GeoMiddleware] Geo detection result - Country: ${geoResult.countryCode}, Region: ${geoResult.region}${
        debugParam && isDevelopment ? " (debug override)" : ""
      }`
    );
    logGeoDebug("[GeoMiddleware] Geo detect result", {
      pathname,
      region: geoResult.region,
      countryCode: geoResult.countryCode,
      currency: geoResult.currency,
      debugMode: Boolean(debugParam && isDevelopment),
    });

    // Region policy: block EU access for INTL deployment.
    if (
      isInternationalDeployment &&
      geoResult.region === RegionType.EUROPE &&
      !(debugParam && isDevelopment)
    ) {
      console.log(
        `[GeoMiddleware] Request blocked by region policy: ${geoResult.countryCode}`
      );
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message:
            "This service is not available in your region due to regulatory requirements.",
          code: "REGION_BLOCKED",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Apply CORS headers for API responses.
    if (pathname.startsWith("/api/")) {
      const origin = request.headers.get("origin") || "";
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        response.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        );
        response.headers.set("Access-Control-Allow-Credentials", "true");
      }
    }

    response.headers.set("X-User-Region", geoResult.region);
    response.headers.set("X-User-Country", geoResult.countryCode);
    response.headers.set("X-User-Currency", geoResult.currency);

    // Expose debug mode to response headers in development only.
    if (debugParam && isDevelopment) {
      response.headers.set("X-Debug-Mode", debugParam);
    }

    // Apply CSRF protection.
    const csrfResponse = await csrfProtection(request, response);
    if (csrfResponse.status !== 200) {
      return csrfResponse;
    }

    return response;
  } catch (error) {
    console.error("[GeoMiddleware] Middleware execution failed", error);
    logGeoDebug("[GeoMiddleware] Middleware error context", {
      pathname: request.nextUrl.pathname,
      headers: buildIpHeaderSnapshot(request),
    });

    // Fail open to avoid breaking non-critical traffic; mark the response.
    const response = NextResponse.next();
    response.headers.set("X-Geo-Error", "true");

    return response;
  }
}

/**
 * Resolve client IP from common proxy headers.
 */
function getClientIP(request: NextRequest): string | null {
  // Priority: X-Real-IP > X-Forwarded-For > other headers > request.ip

  // 1. Direct proxy header.
  const realIP = request.headers.get("x-real-ip");
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  // 2. First valid IP from chain.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // 3. Other possible vendor headers.
  const possibleHeaders = [
    "x-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "cf-connecting-ip", // Cloudflare
    "true-client-ip", // Akamai
  ];

  for (const header of possibleHeaders) {
    const ip = request.headers.get(header);
    if (ip && isValidIP(ip)) {
      return ip;
    }
  }

  // 4. Next.js fallback.
  const fallbackIp = request.ip;
  if (fallbackIp && isValidIP(fallbackIp)) {
    return fallbackIp;
  }

  return null;
}

/**
 * Validate IPv4 or IPv6 format.
 */
function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  // IPv6 (full form)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

export const config = {
  matcher: [
    /*
     * Match all routes except static/internal resources.
     * - Exclude Next.js internals (`/_next/...`)
     * - Exclude `favicon.ico`
     */
    "/((?!_next/|favicon.ico).*)",
  ],
};
