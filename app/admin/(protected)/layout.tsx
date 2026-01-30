import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminLogout } from "../login/actions";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin/session";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.u} logoutAction={adminLogout}>
      {children}
    </AdminShell>
  );
}
