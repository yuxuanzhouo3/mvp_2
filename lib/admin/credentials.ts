import { getRequiredSecret } from "@/lib/auth/secrets";

export function getAdminUsername(): string {
  return getRequiredSecret("ADMIN_USERNAME", { minLength: 3 });
}

export function getAdminPassword(): string {
  return getRequiredSecret("ADMIN_PASSWORD", { minLength: 8 });
}

export function isValidAdminCredential(input: {
  username: string;
  password: string;
}): boolean {
  return (
    input.username === getAdminUsername() && input.password === getAdminPassword()
  );
}
