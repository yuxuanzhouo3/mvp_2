import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";

export function DashboardModuleTile({
  href,
  label,
  description,
  icon: Icon,
  lines,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  lines: string[];
}) {
  return (
    <Link href={href} className="group">
      <div className="h-full rounded-xl border bg-card text-card-foreground shadow-sm transition-colors group-hover:bg-accent/40">
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="font-semibold">{label}</div>
            </div>
            <Badge variant="outline" className="text-xs">
              进入
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
          <div className="pt-2 border-t space-y-1 text-sm">
            {lines.map((line) => (
              <div key={line} className="text-slate-700 dark:text-slate-200">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

