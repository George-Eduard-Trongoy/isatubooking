// Staff sign in with a username; guests sign in with their email address.
// Usernames map to a fixed internal address so no lookup (and no email exposure) is needed.

export const STAFF_EMAIL_DOMAIN = "staff.isatu-booking.app";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
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
