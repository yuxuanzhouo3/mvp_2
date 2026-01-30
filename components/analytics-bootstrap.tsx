"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ensureSessionStarted, trackClientEvent } from "@/lib/analytics/client";

export default function AnalyticsBootstrap() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    ensureSessionStarted({ userId: user?.id, path: pathname });
  }, [user?.id, pathname]);

  useEffect(() => {
    trackClientEvent({ eventType: "page_view", userId: user?.id, path: pathname });
  }, [user?.id, pathname]);

  return null;
}

