const ADMIN_OWNER_BYPASS_PERMISSION_KEYS = new Set<string>([
  // Add explicit permission keys here when admin bypass is required.
]);

const ADMIN_OWNER_BYPASS_USER_IDS = new Set(
  (process.env.ADMIN_OWNER_BYPASS_USER_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

export function getAuthUserId(authResult: { user?: { id?: unknown } } | null): string | null {
  const userId = authResult?.user?.id;
  if (typeof userId !== "string") return null;

  const normalized = userId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function hasOwnershipAccess(input: {
  actorUserId: string;
  targetUserId: string;
  permissionKey: string;
}): boolean {
  if (input.actorUserId === input.targetUserId) {
    return true;
  }

  if (!ADMIN_OWNER_BYPASS_PERMISSION_KEYS.has(input.permissionKey)) {
    return false;
  }

  return ADMIN_OWNER_BYPASS_USER_IDS.has(input.actorUserId);
}

