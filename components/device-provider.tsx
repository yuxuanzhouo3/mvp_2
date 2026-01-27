"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DeviceContextValue = {
  isIPhone: boolean;
};

export const DeviceContext = createContext<DeviceContextValue | undefined>(
  undefined
);

export function DeviceProvider({
  children,
  initialIsIPhone,
}: {
  children: ReactNode;
  initialIsIPhone: boolean;
}) {
  const [isIPhone, setIsIPhone] = useState(initialIsIPhone);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const clientIsIPhone = /iphone/i.test(ua);
    if (clientIsIPhone !== isIPhone) setIsIPhone(clientIsIPhone);
  }, [isIPhone]);

  const value = useMemo(() => ({ isIPhone }), [isIPhone]);

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
