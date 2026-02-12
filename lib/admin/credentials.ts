import { getRequiredSecret } from "@/lib/auth/secrets";

const ADMIN_USERNAME = getRequiredSecret("ADMIN_USERNAME", { minLength: 3 });
const ADMIN_PASSWORD = getRequiredSecret("ADMIN_PASSWORD", { minLength: 8 });

export function getAdminUsername(): string {
  return ADMIN_USERNAME;
}

export function getAdminPassword(): string {
  return ADMIN_PASSWORD;
}

export function isValidAdminCredential(input: {
  username: string;
  password: string;
}): boolean {
  return (
    input.username === getAdminUsername() && input.password === getAdminPassword()
  );
}
