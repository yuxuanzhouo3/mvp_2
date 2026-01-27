"use client";

import { useContext } from "react";
import { DeviceContext } from "@/components/device-provider";

export function useDevice() {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice must be used within DeviceProvider");
  return value;
}

export function useIsIPhone() {
  return useDevice().isIPhone;
}
