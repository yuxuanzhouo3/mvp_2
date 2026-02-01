"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LocationPermissionDialog(props: {
  open: boolean;
  locale: "zh" | "en";
  onAllow: () => void;
  onDeny: () => void;
}) {
  const { open, locale, onAllow, onDeny } = props;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onDeny() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {locale === "zh" ? "是否获取当前位置？" : "Allow location access?"}
          </DialogTitle>
          <DialogDescription>
            {locale === "zh"
              ? "用于推荐附近更合适的餐厅/健身房，并生成更精准的地图跳转。你也可以选择暂不获取。"
              : "Used to recommend nearby places and generate more accurate map links. You can skip this."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button onClick={onAllow}>
            {locale === "zh" ? "允许获取" : "Allow"}
          </Button>
          <Button variant="secondary" onClick={onDeny}>
            {locale === "zh" ? "暂不获取" : "Not now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

