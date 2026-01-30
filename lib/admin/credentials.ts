export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "Zyx!213416";
}

export function isValidAdminCredential(input: {
  username: string;
  password: string;
}): boolean {
  return (
    input.username === getAdminUsername() && input.password === getAdminPassword()
  );
}

