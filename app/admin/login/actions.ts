"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidAdminCredential } from "@/lib/admin/credentials";
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
} from "@/lib/admin/session";

export type AdminLoginState = { error?: string };

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  if (!username || !password) return { error: "请输入账号与密码" };
  if (!isValidAdminCredential({ username, password })) {
    return { error: "账号或密码错误" };
  }

  const token = await createAdminSessionToken(username);
  cookies().set(getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionMaxAgeSeconds(),
  });

  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  cookies().set(getAdminSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}

