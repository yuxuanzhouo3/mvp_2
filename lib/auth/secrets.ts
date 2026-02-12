type RequiredSecretOptions = {
  minLength?: number;
};

const PLACEHOLDER_PATTERNS = [/^your_/i, /^replace[-_]?me$/i, /^changeme$/i];

function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

export function getRequiredSecret(
  envKey: string,
  options: RequiredSecretOptions = {}
): string {
  const rawValue = process.env[envKey];
  const value = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!value) {
    throw new Error(`[Auth] Missing required environment variable: ${envKey}`);
  }

  if (isPlaceholderSecret(value)) {
    throw new Error(`[Auth] Invalid placeholder value for environment variable: ${envKey}`);
  }

  const minLength = options.minLength ?? 1;
  if (value.length < minLength) {
    throw new Error(
      `[Auth] Environment variable ${envKey} must be at least ${minLength} characters`
    );
  }

  return value;
}

export function getJwtSecret(): string {
  return getRequiredSecret("JWT_SECRET", { minLength: 16 });
}

