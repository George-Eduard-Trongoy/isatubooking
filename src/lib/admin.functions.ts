import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOOKING_STATUSES } from "./booking-rules";
import { isStaffEmail, normalizeUsername, resolveNewAccountRole, staffEmailFor, type AppRole } from "./identity";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };
type Ctx = { supabase: any; userId: string };

async function staffScope(ctx: Ctx): Promise<{ role: AppRole; facilityId: number | null } | null> {
  const { data } = await ctx.supabase.from("user_roles").select("role, facility_id").eq("user_id", ctx.userId);
  const rows = (data ?? []) as { role: AppRole; facility_id: number | null }[];
  const admin = rows.find((r) => r.role === "admin");
  if (admin) return { role: "admin", facilityId: null };
  const va = rows.find((r) => r.role === "venue_admin");
  if (va) return { role: "venue_admin", facilityId: va.facility_id };
  return null;
}

async function requireStaff(ctx: Ctx) {
  const scope = await staffScope(ctx);
  if (!scope) throw new Error("Administrator access required.");
  return scope;
}

async function requireSuperAdmin(ctx: Ctx) {
  const scope = await staffScope(ctx);
  if (scope?.role !== "admin") throw new Error("Only the system administrator can manage accounts.");
  return scope;
}

export const getAdminDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireStaff(context);
    const sb = context.supabase;

    // RLS already limits every query below to the caller's facility scope.
    const [vb, rb, venues, rooms, blackouts, facilities] = await Promise.all([
      sb
        .from("venue_bookings")
        .select("id, user_id, legacy_user_id, event_name, booking_date, end_date, start_time, end_time, attendees, layout_type, status, created_at, venue_id, venues(name, facility_id)")
        .order("id", { ascending: false }),
      sb
        .from("room_bookings")
        .select("id, user_id, legacy_user_id, check_in, check_out, guests, special_orders, status, created_at, room_id, rooms(room_number, facility_id, room_types(name))")
        .order("id", { ascending: false }),
      sb.from("venues").select("*").order("id"),
      sb.from("rooms").select("*, room_types(name)").order("facility_id").order("room_number"),
      sb.from("blackout_dates").select("id, venue_id, start_date, end_date, reason, venues(name, facility_id)").order("start_date", { ascending: false }),
      sb.from("facilities").select("id, name, code").order("id"),
    ]);

    const inScope = (fid: number | null | undefined) =>
      scope.role === "admin" || (fid != null && fid === scope.facilityId);

    const venueBookings = (vb.data ?? []).filter((b: any) => inScope(b.venues?.facility_id));
    const roomBookings = (rb.data ?? []).filter((b: any) => inScope(b.rooms?.facility_id));

    const userIds = [...new Set([...venueBookings, ...roomBookings].map((b: any) => b.user_id).filter(Boolean))];
    const legacyIds = [...new Set([...venueBookings, ...roomBookings].map((b: any) => b.legacy_user_id).filter(Boolean))];
    const [profiles, legacy] = await Promise.all([
      userIds.length ? sb.from("profiles").select("id, full_name, email, username").in("id", userIds) : { data: [] },
      legacyIds.length ? sb.from("legacy_users").select("id, full_name, email").in("id", legacyIds) : { data: [] },
    ]);
    const pMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const lMap = new Map((legacy.data ?? []).map((l: any) => [l.id, l]));
    const client = (b: any) => {
      const p: any = b.user_id ? pMap.get(b.user_id) : null;
      if (p) return { name: p.full_name || p.username, contact: p.email ?? `@${p.username}` };
      const l: any = b.legacy_user_id ? lMap.get(b.legacy_user_id) : null;
      if (l) return { name: l.full_name, contact: l.email ?? "" };
      return { name: "Unknown", contact: "" };
    };

    return {
      scope,
      facilities: (facilities.data ?? []) as { id: number; name: string; code: string }[],
      venueBookings: venueBookings.map((b: any) => ({
        id: b.id as number,
        client: client(b),
        event_name: b.event_name as string,
        booking_date: b.booking_date as string,
        end_date: b.end_date as string,
        start_time: b.start_time as string,
        end_time: b.end_time as string,
        attendees: b.attendees as number,
        layout_type: b.layout_type as string,
        status: b.status as string,
        venue_name: (b.venues?.name ?? "") as string,
      })),
      roomBookings: roomBookings.map((b: any) => ({
        id: b.id as number,
        client: client(b),
        check_in: b.check_in as string,
        check_out: b.check_out as string,
        guests: b.guests as number,
        special_orders: b.special_orders as string,
        status: b.status as string,
        room_number: (b.rooms?.room_number ?? "") as string,
        room_type: (b.rooms?.room_types?.name ?? "Standard") as string,
      })),
      venues: (venues.data ?? [])
        .filter((v: any) => inScope(v.facility_id))
        .map((v: any) => ({ ...v, price: Number(v.price) })) as {
        id: number; facility_id: number; name: string; capacity: number; capacity_tables: number; description: string; price: number; image_url: string;
      }[],
      rooms: (rooms.data ?? [])
        .filter((r: any) => inScope(r.facility_id))
        .map((r: any) => ({ ...r, price_per_night: Number(r.price_per_night), type_name: r.room_types?.name ?? "Standard" })) as {
        id: number; facility_id: number; room_number: string; capacity: number; price_per_night: number; image_url: string; type_name: string;
      }[],
      blackouts: (blackouts.data ?? [])
        .filter((b: any) => inScope(b.venues?.facility_id))
        .map((b: any) => ({ id: b.id as number, venue_id: b.venue_id as number, venue_name: (b.venues?.name ?? "") as string, start_date: b.start_date as string, end_date: b.end_date as string, reason: b.reason as string })),
    };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "venue" | "room"; id: number; status: string }) =>
    z.object({ type: z.enum(["venue", "room"]), id: z.number().int().positive(), status: z.enum(BOOKING_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    await requireStaff(context);
    const table = data.type === "venue" ? "venue_bookings" : "room_bookings";
    // RLS rejects updates outside the caller's facility.
    const { data: rows, error } = await context.supabase.from(table).update({ status: data.status }).eq("id", data.id).select("id");
    if (error || !rows?.length) return { ok: false, message: "This booking is managed by another administrator." };
    return { ok: true };
  });

export const addBlackout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venue_id: number; start_date: string; end_date: string; reason: string }) =>
    z
      .object({
        venue_id: z.number().int().positive(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    await requireStaff(context);
    if (data.end_date < data.start_date) return { ok: false, message: "End date must be on or after the start date." };
    const { error } = await context.supabase.from("blackout_dates").insert({
      venue_id: data.venue_id,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason.trim() || "Scheduled maintenance",
      created_by: context.userId,
    });
    if (error) return { ok: false, message: "You can only block dates for venues you manage." };
    return { ok: true };
  });

export const deleteBlackout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    await requireStaff(context);
    const { data: rows, error } = await context.supabase.from("blackout_dates").delete().eq("id", data.id).select("id");
    if (error || !rows?.length) return { ok: false, message: "Could not remove these dates." };
    return { ok: true };
  });

export const updateCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "venue" | "room"; id: number; image_url: string; price: number; capacity: number; description?: string | undefined }) =>
    z
      .object({
        type: z.enum(["venue", "room"]),
        id: z.number().int().positive(),
        image_url: z.string().url().max(1000).or(z.literal("")),
        price: z.number().min(0).max(10_000_000),
        capacity: z.number().int().min(1).max(1000),
        description: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    await requireStaff(context);
    const q =
      data.type === "venue"
        ? context.supabase
            .from("venues")
            .update({
              price: data.price,
              capacity: data.capacity,
              ...(data.image_url ? { image_url: data.image_url } : {}),
              ...(data.description ? { description: data.description } : {}),
            })
        : context.supabase
            .from("rooms")
            .update({ price_per_night: data.price, capacity: data.capacity, ...(data.image_url ? { image_url: data.image_url } : {}) });
    const { data: rows, error } = await q.eq("id", data.id).select("id");
    if (error || !rows?.length) return { ok: false, message: "You can only edit items in your assigned facility." };
    return { ok: true };
  });

// ---------- Accounts ----------
// Any admin can list and create accounts (facility admins within their facility);
// editing and deleting stay with the system administrator.

export type ManagedUser = {
  id: string;
  username: string | null;
  full_name: string;
  email: string | null;
  role: AppRole;
  facility_id: number | null;
  created_at: string;
};

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireStaff(context);
    const [p, r, l] = await Promise.all([
      context.supabase.from("profiles").select("id, username, full_name, email, created_at").order("created_at"),
      context.supabase.from("user_roles").select("user_id, role, facility_id"),
      context.supabase.from("legacy_users").select("id, full_name, email, role").is("claimed_by", null).order("id"),
    ]);
    const rank: Record<string, number> = { admin: 3, venue_admin: 2, guest: 1 };
    const roleMap = new Map<string, { role: AppRole; facility_id: number | null }>();
    for (const row of (r.data ?? []) as any[]) {
      const cur = roleMap.get(row.user_id);
      if (!cur || (rank[row.role] ?? 0) > (rank[cur.role] ?? 0)) roleMap.set(row.user_id, { role: row.role, facility_id: row.facility_id });
    }
    const all: ManagedUser[] = ((p.data ?? []) as any[]).map((u) => ({
      ...u,
      role: roleMap.get(u.id)?.role ?? "guest",
      facility_id: roleMap.get(u.id)?.facility_id ?? null,
    }));
    // Facility admins see guests and their own facility's staff only.
    const users = scope.role === "admin"
      ? all
      : all.filter((u) => u.role === "guest" || (u.role === "venue_admin" && u.facility_id === scope.facilityId));
    const pending = ((l.data ?? []) as any[]).filter((x) => x.role === "guest");
    return { users, pendingImported: pending as { id: number; full_name: string; email: string | null }[] };
  });

const userInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "venue_admin", "guest"]),
  facility_id: z.number().int().positive().nullable(),
  username: z.string().max(40).optional(),
  email: z.string().max(200).optional(),
  password: z.string().max(128).optional(),
});

async function setRole(admin: any, userId: string, role: AppRole, facilityId: number | null) {
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role, facility_id: role === "venue_admin" ? facilityId : null });
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof userInput>) => userInput.parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const scope = await requireStaff(context);
    const allowed = resolveNewAccountRole(scope, { role: data.role, facilityId: data.facility_id });
    if (!allowed.ok) return allowed;
    data.facility_id = allowed.facilityId;
    const password = data.password ?? "";
    if (password.length < 10) return { ok: false, message: "Passwords need at least 10 characters." };

    let email: string;
    let username: string | null = null;
    if (data.role === "guest") {
      email = (data.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || isStaffEmail(email)) return { ok: false, message: "Enter a valid email address for guest accounts." };
    } else {
      username = normalizeUsername(data.username ?? "");
      if (username.length < 3) return { ok: false, message: "Staff accounts need a username of at least 3 characters." };
      email = staffEmailFor(username);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (username) {
      const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (taken) return { ok: false, message: `The username "${username}" is already taken.` };
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      return { ok: false, message: error?.message?.includes("already") ? "An account with these details already exists." : "Could not create the account." };
    }
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name, ...(username ? { username } : {}) }).eq("id", created.user.id);
    await setRole(supabaseAdmin, created.user.id, data.role, data.facility_id);
    return { ok: true };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof userInput> & { id: string }) => userInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    await requireSuperAdmin(context);
    if (data.id === context.userId && data.role !== "admin") {
      return { ok: false, message: "You cannot remove your own administrator role." };
    }
    if (data.role === "venue_admin" && !data.facility_id) return { ok: false, message: "Choose the facility this admin manages." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (!target?.user) return { ok: false, message: "Account not found." };

    const authPatch: { password?: string; email?: string; user_metadata?: object } = { user_metadata: { full_name: data.full_name } };
    const profilePatch: { full_name: string; username?: string } = { full_name: data.full_name };

    if (data.password) {
      if (data.password.length < 10) return { ok: false, message: "Passwords need at least 10 characters." };
      authPatch.password = data.password;
    }
    // Staff who sign in with a username can be renamed.
    if (isStaffEmail(target.user.email) && data.username) {
      const username = normalizeUsername(data.username);
      if (username.length < 3) return { ok: false, message: "Usernames need at least 3 characters." };
      const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("username", username).neq("id", data.id).maybeSingle();
      if (taken) return { ok: false, message: `The username "${username}" is already taken.` };
      authPatch.email = staffEmailFor(username);
      profilePatch.username = username;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { ...authPatch, ...(authPatch.email ? { email_confirm: true } : {}) });
    if (error) return { ok: false, message: "Could not update the account." };
    await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.id);
    await setRole(supabaseAdmin, data.id, data.role, data.facility_id);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    await requireSuperAdmin(context);
    if (data.id === context.userId) return { ok: false, message: "You cannot delete your own account." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) return { ok: false, message: "Could not delete the account." };
    return { ok: true };
  });
