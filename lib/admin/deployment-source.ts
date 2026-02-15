export type AdminDeploymentSource = "CN" | "INTL";

export function getDeploymentAdminSource(): AdminDeploymentSource {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN" ? "CN" : "INTL";
}

export function getDeploymentAdminProviderName(
  source: AdminDeploymentSource = getDeploymentAdminSource()
): string {
  return source === "CN" ? "CloudBase" : "Supabase";
}

export function normalizeAdminSourceToDeployment(
  _source: string | null | undefined
): AdminDeploymentSource {
  return getDeploymentAdminSource();
}

export function isAdminSourceAllowedInDeployment(
  source: string | null | undefined
): boolean {
  return String(source || "").toUpperCase() === getDeploymentAdminSource();
}
