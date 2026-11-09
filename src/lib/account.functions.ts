import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "./identity";

export type Me = {
  id: string;
  username: string | null;
  full_name: string;
  email: string | null;
  role: AppRole;
  facility_id: number | null;
  facility_code: string | null;
};

const ROLE_RANK: Record<AppRole, number> = { admin: 3, venue_admin: 2, guest: 1 };

/**
 * Returns the signed-in person's profile and role. Also links bookings made under the
 * previous system when the account's email address has been verified and matches.
 */
export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Me> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("username, full_name, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, facility_id, facilities(code)").eq("user_id", userId),
    ]);
    const best = (roles ?? []).slice().sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role])[0];

    const email = profile?.email ?? null;
    if (email && best?.role !== "admin" && best?.role !== "venue_admin") {
      await claimLegacyRecords(userId, email);
    }

    return {
      id: userId,
      username: profile?.username ?? null,
      full_name: profile?.full_name ?? "",
      email,
      role: (best?.role ?? "guest") as AppRole,
      facility_id: best?.facility_id ?? null,
      facility_code: (best as any)?.facilities?.code ?? null,
    };
  });

async function claimLegacyRecords(userId: string, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: legacy } = await supabaseAdmin
    .from("legacy_users")
    .select("id")
    .ilike("email", email)
    .eq("role", "guest")
    .is("claimed_by", null);
  if (!legacy?.length) return;

  // Only link after the address is confirmed as belonging to this person.
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!authUser?.user?.email_confirmed_at) return;
  if (authUser.user.email?.toLowerCase() !== email.toLowerCase()) return;

  for (const l of legacy) {
    await supabaseAdmin.from("legacy_users").update({ claimed_by: userId }).eq("id", l.id).is("claimed_by", null);
    await supabaseAdmin.from("venue_bookings").update({ user_id: userId }).eq("legacy_user_id", l.id).is("user_id", null);
    await supabaseAdmin.from("room_bookings").update({ user_id: userId }).eq("legacy_user_id", l.id).is("user_id", null);
  }
}
