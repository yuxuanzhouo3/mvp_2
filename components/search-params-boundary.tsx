"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

interface SearchParamsBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SearchParamsBoundary({
  children,
  fallback = (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}: SearchParamsBoundaryProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}