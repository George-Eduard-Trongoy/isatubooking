// Staff sign in with a username; guests sign in with their email address.
// Usernames map to a fixed internal address so no lookup (and no email exposure) is needed.

export const STAFF_EMAIL_DOMAIN = "staff.isatu-booking.app";

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "");
}

export function staffEmailFor(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_EMAIL_DOMAIN}`;
}

export function isStaffEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

/** Turns what the person typed in the sign-in box into the account email. */
export function toAuthEmail(identifier: string): string {
  const v = identifier.trim().toLowerCase();
  if (v.includes("@")) return v;
  return staffEmailFor(v);
}

export type AppRole = "admin" | "venue_admin" | "guest";

export function roleLabel(role: AppRole, facilityCode?: string | null): string {
  if (role === "admin") return "System Admin";
  if (role === "venue_admin") return facilityCode ? `${facilityCode} Admin` : "Venue Admin";
  return "Guest";
}

/**
 * Which account a staff member may create. System admins may create any role.
 * Facility admins may create guests and admins for their own facility only.
 * Returns the facility to store, or an error message.
 */
export function resolveNewAccountRole(
  creator: { role: AppRole; facilityId: number | null },
  requested: { role: AppRole; facilityId: number | null },
): { ok: true; facilityId: number | null } | { ok: false; message: string } {
  if (creator.role === "guest") return { ok: false, message: "Administrator access required." };
  if (creator.role === "venue_admin" && requested.role === "admin") {
    return {
      ok: false,
      message: "Only the system administrator can create system administrator accounts.",
    };
  }
  if (requested.role !== "venue_admin") return { ok: true, facilityId: null };
  const facilityId = creator.role === "venue_admin" ? creator.facilityId : requested.facilityId;
  if (!facilityId) return { ok: false, message: "Choose the facility this admin manages." };
  return { ok: true, facilityId };
}
