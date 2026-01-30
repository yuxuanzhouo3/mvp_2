import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdminDataSource = "CN" | "INTL";

export function sourceBadgeClasses(source: AdminDataSource) {
  return source === "CN"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-purple-200 bg-purple-50 text-purple-700";
}

export function SourceBadge({
  source,
  className,
  children,
}: {
  source: AdminDataSource;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Badge variant="outline" className={cn(sourceBadgeClasses(source), className)}>
      {children ?? source}
    </Badge>
  );
}

