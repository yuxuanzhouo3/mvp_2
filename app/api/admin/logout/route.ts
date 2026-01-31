import { NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

const isProduction = process.env.NODE_ENV === "production";

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set(getAdminSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });
  return response;
}
