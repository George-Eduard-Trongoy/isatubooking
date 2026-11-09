import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateRoomRequest, validateVenueRequest } from "./booking-rules";
import { generateRecommendedLayout, normalizePlan, type FloorPlan } from "./floor-plan";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const venueInput = z.object({
  venue_id: z.number().int().positive(),
  event_name: z.string().max(160),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().max(5),
  end_time: z.string().max(5),
  attendees: z.number().int(),
  layout_style: z.string().max(20),
});

export const createVenueBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof venueInput>) => venueInput.parse(d))
  .handler(async ({ data, context }): Promise<Result<{ bookingId: number }>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: venue } = await supabaseAdmin
      .from("venues")
      .select("id, capacity, capacity_tables, status")
      .eq("id", data.venue_id)
      .maybeSingle();
    if (!venue || venue.status !== "available") return { ok: false, message: "Venue not found." };

    const [busy, blackouts] = await Promise.all([
      supabaseAdmin.rpc("venue_busy_ranges", { _venue_id: venue.id }),
      supabaseAdmin.from("blackout_dates").select("start_date, end_date, reason").eq("venue_id", venue.id),
    ]);
    const err = validateVenueRequest(
      { ...data, event_name: data.event_name },
      venue,
      busy.data ?? [],
      blackouts.data ?? [],
    );
    if (err) return { ok: false, message: err };

    const plan = generateRecommendedLayout(venue, data.attendees, data.layout_style);
    const { data: row, error } = await supabaseAdmin
      .from("venue_bookings")
      .insert({
        user_id: context.userId,
        venue_id: venue.id,
        event_name: data.event_name.trim(),
        booking_date: data.start_date,
        end_date: data.end_date,
        start_time: data.start_time,
        end_time: data.end_time,
        attendees: data.attendees,
        layout_type: data.layout_style,
        layout_data: plan as any,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, message: "Could not save the booking. Please try again." };
    return { ok: true, bookingId: row.id };
  });

const roomInput = z.object({
  room_id: z.number().int().positive(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int(),
  special_orders: z.string().max(1000).default(""),
});

export const createRoomBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof roomInput>) => roomInput.parse(d))
  .handler(async ({ data, context }): Promise<Result<{ bookingId: number }>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, capacity, status, room_number")
      .eq("id", data.room_id)
      .maybeSingle();
    if (!room || room.status !== "available") return { ok: false, message: "Room not found." };
    const { data: busy } = await supabaseAdmin.rpc("room_busy_ranges", { _room_id: room.id });
    const err = validateRoomRequest(data, room, busy ?? []);
    if (err) return { ok: false, message: err };

    const { data: row, error } = await supabaseAdmin
      .from("room_bookings")
      .insert({
        user_id: context.userId,
        room_id: room.id,
        check_in: data.check_in,
        check_out: data.check_out,
        guests: data.guests,
        special_orders: data.special_orders.trim(),
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, message: "Could not save the reservation. Please try again." };
    return { ok: true, bookingId: row.id };
  });

export type MyVenueBooking = {
  id: number;
  event_name: string;
  booking_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  attendees: number;
  layout_type: string;
  status: string;
  venue_name: string;
  facility_name: string;
  created_at: string;
};
export type MyRoomBooking = {
  id: number;
  check_in: string;
  check_out: string;
  guests: number;
  special_orders: string;
  status: string;
  room_number: string;
  room_type: string;
  facility_name: string;
  price_per_night: number;
  created_at: string;
};

export const getMyBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [v, r] = await Promise.all([
      supabase
        .from("venue_bookings")
        .select("id, event_name, booking_date, end_date, start_time, end_time, attendees, layout_type, status, created_at, venues(name, facilities(name))")
        .eq("user_id", userId)
        .order("id", { ascending: false }),
      supabase
        .from("room_bookings")
        .select("id, check_in, check_out, guests, special_orders, status, created_at, rooms(room_number, price_per_night, facilities(name), room_types(name))")
        .eq("user_id", userId)
        .order("id", { ascending: false }),
    ]);
    const venue: MyVenueBooking[] = (v.data ?? []).map((b: any) => ({
      id: b.id,
      event_name: b.event_name,
      booking_date: b.booking_date,
      end_date: b.end_date,
      start_time: b.start_time,
      end_time: b.end_time,
      attendees: b.attendees,
      layout_type: b.layout_type,
      status: b.status,
      venue_name: b.venues?.name ?? "",
      facility_name: b.venues?.facilities?.name ?? "",
      created_at: b.created_at,
    }));
    const room: MyRoomBooking[] = (r.data ?? []).map((b: any) => ({
      id: b.id,
      check_in: b.check_in,
      check_out: b.check_out,
      guests: b.guests,
      special_orders: b.special_orders,
      status: b.status,
      room_number: b.rooms?.room_number ?? "",
      room_type: b.rooms?.room_types?.name ?? "Standard Room",
      facility_name: b.rooms?.facilities?.name ?? "",
      price_per_night: Number(b.rooms?.price_per_night ?? 0),
      created_at: b.created_at,
    }));
    return { venue, room };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "venue" | "room"; id: number }) =>
    z.object({ type: z.enum(["venue", "room"]), id: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    const table = data.type === "venue" ? "venue_bookings" : "room_bookings";
    // RLS limits this read to the caller's own bookings (or bookings they manage).
    const { data: b } = await context.supabase
      .from(table)
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.user_id !== context.userId) return { ok: false, message: "Booking not found." };
    if (b.status === "cancelled") return { ok: false, message: "This booking is already cancelled." };
    if (b.status === "rejected") return { ok: false, message: "Rejected bookings cannot be cancelled." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from(table).update({ status: "cancelled" }).eq("id", data.id);
    if (error) return { ok: false, message: "Could not cancel the booking." };
    return { ok: true };
  });

export type PlanBooking = {
  id: number;
  event_name: string;
  booking_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  attendees: number;
  layout_type: string;
  status: string;
  venue: { id: number; name: string; capacity: number; capacity_tables: number; facility_name: string };
  plan: FloorPlan;
  canEdit: boolean;
};

export const getFloorPlanBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<PlanBooking | null> => {
    const { data: b } = await context.supabase
      .from("venue_bookings")
      .select("*, venues(id, name, capacity, capacity_tables, facilities(name))")
      .eq("id", data.id)
      .maybeSingle();
    if (!b) return null;
    const v = (b as any).venues;
    const venue = {
      id: v?.id ?? b.venue_id,
      name: v?.name ?? "Venue",
      capacity: v?.capacity ?? 150,
      capacity_tables: v?.capacity_tables ?? 100,
      facility_name: v?.facilities?.name ?? "",
    };
    const plan = normalizePlan(b.layout_data) ?? generateRecommendedLayout(venue, b.attendees, b.layout_type);
    return {
      id: b.id,
      event_name: b.event_name,
      booking_date: b.booking_date,
      end_date: b.end_date,
      start_time: b.start_time,
      end_time: b.end_time,
      attendees: b.attendees,
      layout_type: b.layout_type,
      status: b.status,
      venue,
      plan,
      canEdit: b.status !== "cancelled" && b.status !== "rejected",
    };
  });

const planItem = z.object({
  id: z.string().max(60),
  type: z.string().max(30),
  name: z.string().max(80),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  radius: z.number().optional(),
  seats: z.number().int().min(0).max(50).optional(),
  color: z.string().max(20).optional(),
  stroke: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
});

export const saveFloorPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; style: string; items: unknown[] }) =>
    z
      .object({ id: z.number().int().positive(), style: z.string().max(20), items: z.array(planItem).max(600) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    // Visible only to the owner or the venue's managers (RLS).
    const { data: b } = await context.supabase
      .from("venue_bookings")
      .select("id, status, attendees")
      .eq("id", data.id)
      .maybeSingle();
    if (!b) return { ok: false, message: "Booking not found." };
    if (b.status === "cancelled" || b.status === "rejected") {
      return { ok: false, message: "This booking can no longer be edited." };
    }
    const plan: FloorPlan = { stage: { width: 980, height: 620 }, style: data.style, attendees: b.attendees, items: data.items as any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("venue_bookings")
      .update({ layout_data: plan as any })
      .eq("id", data.id);
    if (error) return { ok: false, message: "Could not save the floor plan." };
    return { ok: true };
  });
