"use client"

import { useIsIPhone } from "@/hooks/use-device"

export function useHideSubscriptionUI() {
  return useIsIPhone()
}
