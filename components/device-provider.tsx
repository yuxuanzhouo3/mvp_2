"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DeviceContextValue = {
  isIPhone: boolean;
  isMac: boolean;
};

export const DeviceContext = createContext<DeviceContextValue | undefined>(
  undefined
);

export function DeviceProvider({
  children,
  initialIsIPhone,
  initialIsMac,
}: {
  children: ReactNode;
  initialIsIPhone: boolean;
  initialIsMac: boolean;
}) {
  const [isIPhone, setIsIPhone] = useState(initialIsIPhone);
  const [isMac, setIsMac] = useState(initialIsMac);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const clientIsIPhone = /iphone|ipad|ipod/i.test(ua);
    const clientIsMac = !clientIsIPhone && /macintosh|mac os x/i.test(ua);
    if (clientIsIPhone !== isIPhone) setIsIPhone(clientIsIPhone);
    if (clientIsMac !== isMac) setIsMac(clientIsMac);
  }, [isIPhone, isMac]);

  const value = useMemo(() => ({ isIPhone, isMac }), [isIPhone, isMac]);

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
