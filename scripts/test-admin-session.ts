import { createAdminSessionToken, verifyAdminSessionToken } from "../lib/admin/session";

async function main() {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.ADMIN_SESSION_DAYS = "1";

  const token = await createAdminSessionToken("admin");
  const payload = await verifyAdminSessionToken(token);
  if (!payload) throw new Error("verifyAdminSessionToken returned null");
  if (payload.u !== "admin") throw new Error("username mismatch");
  if (payload.exp <= payload.iat) throw new Error("exp should be after iat");

  const bad = await verifyAdminSessionToken(token + "x");
  if (bad) throw new Error("expected tampered token to be rejected");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

