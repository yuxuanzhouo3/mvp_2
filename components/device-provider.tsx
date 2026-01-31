"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DeviceContextValue = {
  isIPhone: boolean;
  isMac: boolean;
  isAndroid: boolean;
  isMobile: boolean;
};

export const DeviceContext = createContext<DeviceContextValue | undefined>(
  undefined
);

export function DeviceProvider({
  children,
  initialIsIPhone,
  initialIsMac,
  initialIsAndroid,
}: {
  children: ReactNode;
  initialIsIPhone: boolean;
  initialIsMac: boolean;
  initialIsAndroid: boolean;
}) {
  const [isIPhone, setIsIPhone] = useState(initialIsIPhone);
  const [isMac, setIsMac] = useState(initialIsMac);
  const [isAndroid, setIsAndroid] = useState(initialIsAndroid);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const clientIsIPhone = /iphone|ipad|ipod/i.test(ua);
    const clientIsMac = !clientIsIPhone && /macintosh|mac os x/i.test(ua);
    const clientIsAndroid = /android/i.test(ua);
    if (clientIsIPhone !== isIPhone) setIsIPhone(clientIsIPhone);
    if (clientIsMac !== isMac) setIsMac(clientIsMac);
    if (clientIsAndroid !== isAndroid) setIsAndroid(clientIsAndroid);
  }, [isIPhone, isMac, isAndroid]);

  const value = useMemo(
    () => ({ isIPhone, isMac, isAndroid, isMobile: isIPhone || isAndroid }),
    [isIPhone, isMac, isAndroid]
  );

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
