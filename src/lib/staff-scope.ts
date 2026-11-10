// Shared staff checks for server function handlers. Reads roles as the signed-in user (RLS applies).
import type { AppRole } from "./identity";

export type Ctx = { supabase: any; userId: string };
export type StaffScope = { role: AppRole; facilityId: number | null };

export async function staffScope(ctx: Ctx): Promise<StaffScope | null> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role, facility_id")
    .eq("user_id", ctx.userId);
  const rows = (data ?? []) as { role: AppRole; facility_id: number | null }[];
  if (rows.some((r) => r.role === "admin")) return { role: "admin", facilityId: null };
  const va = rows.find((r) => r.role === "venue_admin");
  if (va) return { role: "venue_admin", facilityId: va.facility_id };
  return null;
}

export async function requireStaff(ctx: Ctx): Promise<StaffScope> {
  const scope = await staffScope(ctx);
  if (!scope) throw new Error("Administrator access required.");
  return scope;
}

export function scopeIncludes(
  scope: StaffScope | null,
  facilityId: number | null | undefined,
): boolean {
  if (!scope) return false;
  return scope.role === "admin" || (facilityId != null && facilityId === scope.facilityId);
}
