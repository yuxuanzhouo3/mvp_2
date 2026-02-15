"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Activity,
  Bot,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  Package,
  ShoppingCart,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/stats", label: "数据统计", icon: BarChart3 },
  { href: "/admin/device-stats", label: "设备统计", icon: MonitorSmartphone },
  { href: "/admin/orders", label: "交易订单", icon: ShoppingCart },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/ai-config", label: "AI config", icon: Bot },
  { href: "/admin/payments", label: "支付分析", icon: CreditCard },
  { href: "/admin/releases", label: "版本管理", icon: Package },
  { href: "/admin/analytics", label: "行为分析", icon: Activity },
];

const ADMIN_BLUE_THEME_STYLE: React.CSSProperties = {
  ["--background" as string]: "210 100% 97%",
  ["--foreground" as string]: "216 40% 18%",
  ["--card" as string]: "210 100% 99%",
  ["--card-foreground" as string]: "216 40% 18%",
  ["--popover" as string]: "210 100% 99%",
  ["--popover-foreground" as string]: "216 40% 18%",
  ["--primary" as string]: "206 100% 46%",
  ["--primary-foreground" as string]: "0 0% 100%",
  ["--secondary" as string]: "208 100% 93%",
  ["--secondary-foreground" as string]: "214 56% 24%",
  ["--muted" as string]: "210 80% 94%",
  ["--muted-foreground" as string]: "215 22% 42%",
  ["--accent" as string]: "206 100% 92%",
  ["--accent-foreground" as string]: "214 56% 24%",
  ["--border" as string]: "208 45% 84%",
  ["--input" as string]: "208 45% 84%",
  ["--ring" as string]: "206 100% 46%",
};

const ADMIN_BLUE_THEME_DARK_STYLE = `
.admin-blue-theme.dark {
  --background: 214 30% 11%;
  --foreground: 210 40% 96%;
  --card: 214 28% 14%;
  --card-foreground: 210 40% 96%;
  --popover: 214 28% 14%;
  --popover-foreground: 210 40% 96%;
  --primary: 202 100% 70%;
  --primary-foreground: 214 45% 14%;
  --secondary: 214 25% 20%;
  --secondary-foreground: 210 40% 92%;
  --muted: 214 22% 19%;
  --muted-foreground: 213 17% 74%;
  --accent: 206 42% 24%;
  --accent-foreground: 210 40% 96%;
  --border: 214 24% 25%;
  --input: 214 24% 25%;
  --ring: 202 100% 70%;
}
`;

export function AdminShell({
  username,
  logoutAction,
  children,
}: {
  username: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [logoutPending, setLogoutPending] = React.useState(false);
  const logoutFormRef = React.useRef<HTMLFormElement>(null);

  const handleLogout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      const res = await fetch("/api/admin/logout", { method: "POST" });
      if (res.ok) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }
    } catch {
    } finally {
      setLogoutPending(false);
    }
    logoutFormRef.current?.requestSubmit();
  };

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname?.startsWith(href);
  };

  return (
    <div className="admin-blue-theme min-h-screen bg-background text-foreground" style={ADMIN_BLUE_THEME_STYLE}>
      <style>{ADMIN_BLUE_THEME_DARK_STYLE}</style>
      <header className="fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-b border-border z-50">
        <div className="h-full flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/admin/stats" className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="text-base sm:text-lg font-semibold">后台管理</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{username}</span>
            </div>
            <form ref={logoutFormRef} action={logoutAction}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary hover:bg-accent"
                onClick={handleLogout}
                disabled={logoutPending}
              >
                退出登录
              </Button>
            </form>
          </div>
        </div>
      </header>

      <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-64 bg-card border-r border-border flex-col">
        <nav className="flex-1 p-3 md:p-4 space-y-4 overflow-y-auto overscroll-contain mt-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-colors",
                    active
                      ? "bg-primary/12 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm md:text-base">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {mobileOpen ? (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-16 bottom-16 w-72 bg-card border-r border-border flex flex-col z-50 animate-in slide-in-from-left duration-200 shadow-xl">
            <nav className="flex-1 p-3 md:p-4 space-y-4 overflow-y-auto overscroll-contain mt-4">
              <div className="flex items-center justify-between px-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  菜单
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="关闭菜单"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-colors",
                        active
                          ? "bg-primary/12 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm md:text-base">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>
      ) : null}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50">
        <div className="flex items-center justify-around h-full px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:bg-accent"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                <span className={cn("text-xs", active && "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="pt-16 md:pl-64 pb-20 md:pb-0">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
