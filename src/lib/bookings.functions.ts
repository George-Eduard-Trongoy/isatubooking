import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  amountForOption,
  balanceDue,
  canPayOnline,
  paymentStatusAfterClosing,
  paymentStatusFor,
  roomTotal,
  summarizeDocuments,
  validateRoomRequest,
  validateReservationPayment,
  validateSandboxAccount,
  validateVenueRequest,
  type DocumentSummary,
} from "./booking-rules";
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
  payment_option: z.enum(["downpayment", "full"]),
  sandbox_mobile: z.string().max(20),
});

export const createRoomBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof roomInput>) => roomInput.parse(d))
  .handler(async ({ data, context }): Promise<Result<{ bookingId: number; reference: string; amountPaid: number; balance: number }>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, capacity, status, room_number, price_per_night")
      .eq("id", data.room_id)
      .maybeSingle();
    if (!room || room.status !== "available") return { ok: false, message: "Room not found." };
    const { data: busy } = await supabaseAdmin.rpc("room_busy_ranges", { _room_id: room.id });
    const err = validateRoomRequest(data, room, busy ?? []);
    if (err) return { ok: false, message: err };

    // A reservation is placed only together with a Sandbox payment of at least 50% of the bill.
    const accountError = validateSandboxAccount(data.sandbox_mobile);
    if (accountError) return { ok: false, message: accountError };
    const total = roomTotal(Number(room.price_per_night), data.check_in, data.check_out);
    const amount = amountForOption(total, data.payment_option);
    const paymentError = validateReservationPayment(total, amount);
    if (paymentError) return { ok: false, message: paymentError };

    const reference = sandboxReference();
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
        payment_method: "sandbox",
        payment_status: paymentStatusFor(total, amount),
        amount_due: total,
        amount_paid: amount,
        payment_reference: reference,
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, message: "Could not save the reservation. You were not charged." };
    return { ok: true, bookingId: row.id, reference, amountPaid: amount, balance: balanceDue(total, amount) };
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
  documents: DocumentSummary;
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
  payment_method: string;
  payment_status: string;
  amount_due: number;
  amount_paid: number;
  payment_reference: string | null;
};

export const getMyBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [v, r, reqs] = await Promise.all([
      supabase
        .from("venue_bookings")
        .select("id, venue_id, event_name, booking_date, end_date, start_time, end_time, attendees, layout_type, status, created_at, venues(name, facilities(name)), venue_document_submissions(requirement_id, status)")
        .eq("user_id", userId)
        .order("id", { ascending: false }),
      supabase
        .from("room_bookings")
        .select("id, check_in, check_out, guests, special_orders, status, created_at, payment_method, payment_status, amount_due, amount_paid, payment_reference, rooms(room_number, price_per_night, facilities(name), room_types(name))")
        .eq("user_id", userId)
        .order("id", { ascending: false }),
      supabase.from("venue_document_requirements").select("id, venue_id").eq("active", true),
    ]);
    const reqIds = (venueId: number) => ((reqs.data ?? []) as { id: number; venue_id: number }[]).filter((x) => x.venue_id === venueId).map((x) => x.id);
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
      documents: summarizeDocuments(reqIds(b.venue_id), b.venue_document_submissions ?? []),
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
      payment_method: b.payment_method,
      payment_status: b.payment_status,
      amount_due: Number(b.amount_due) > 0 ? Number(b.amount_due) : roomTotal(Number(b.rooms?.price_per_night ?? 0), b.check_in, b.check_out),
      amount_paid: Number(b.amount_paid ?? 0),
      payment_reference: b.payment_reference ?? null,
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
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.user_id !== context.userId) return { ok: false, message: "Booking not found." };
    if (b.status === "cancelled") return { ok: false, message: "This booking is already cancelled." };
    if (b.status === "rejected") return { ok: false, message: "Rejected bookings cannot be cancelled." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: string; payment_status?: string } = { status: "cancelled" };
    if (data.type === "room") patch.payment_status = paymentStatusAfterClosing(String((b as any).payment_status ?? "unpaid"));
    const { error } = await supabaseAdmin.from(table).update(patch as any).eq("id", data.id);
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

// ---------- Room payments (mock "Sandbox" online wallet) ----------

function sandboxReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `SBX-${Array.from(bytes, (x) => alphabet[x % alphabet.length]).join("")}`;
}

/** Pays the remaining balance of an existing reservation through the Sandbox wallet. */
export const paySandboxBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; mobile: string }) =>
    z.object({ id: z.number().int().positive(), mobile: z.string().max(20) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ reference: string; amount: number }>> => {
    const accountError = validateSandboxAccount(data.mobile);
    if (accountError) return { ok: false, message: accountError };
    const { data: b } = await context.supabase
      .from("room_bookings")
      .select("id, user_id, check_in, check_out, status, payment_status, amount_due, amount_paid, rooms(price_per_night)")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.user_id !== context.userId) return { ok: false, message: "Reservation not found." };
    if (!canPayOnline(b)) {
      return { ok: false, message: b.payment_status === "paid" ? "This reservation is already paid in full." : "This reservation can no longer be paid." };
    }
    const total = Number(b.amount_due) > 0 ? Number(b.amount_due) : roomTotal(Number((b as any).rooms?.price_per_night ?? 0), b.check_in, b.check_out);
    const paidBefore = Number(b.amount_paid ?? 0);
    const amount = balanceDue(total, paidBefore);
    if (amount <= 0) return { ok: false, message: "This reservation is already paid in full." };
    const reference = sandboxReference();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("room_bookings")
      .update({
        payment_method: "sandbox",
        payment_status: "paid",
        amount_due: total,
        amount_paid: total,
        payment_reference: reference,
        paid_at: new Date().toISOString(),
      })
      .eq("id", b.id)
      .eq("amount_paid", paidBefore)
      .select("id");
    if (error || !rows?.length) return { ok: false, message: "The payment could not be completed. You were not charged." };
    return { ok: true, reference, amount };
  });
