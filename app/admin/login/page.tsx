"use client";

import { useFormState, useFormStatus } from "react-dom";
import { adminLogin, type AdminLoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "登录中…" : "登录"}
    </Button>
  );
}

export default function AdminLoginPage() {
  const [state, formAction] = useFormState<AdminLoginState, FormData>(
    adminLogin,
    {}
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">账号</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state.error ? (
              <div className="text-sm text-destructive">{state.error}</div>
            ) : null}
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

