import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Facility = { id: number; name: string; code: string; description: string; has_venue: boolean; has_accommodation: boolean };
export type Venue = {
  id: number;
  facility_id: number;
  name: string;
  capacity: number;
  capacity_tables: number;
  description: string;
  price: number;
  image_url: string;
  facility_name: string;
  facility_code: string;
};
export type Room = {
  id: number;
  facility_id: number;
  room_number: string;
  capacity: number;
  price_per_night: number;
  image_url: string;
  facility_name: string;
  facility_code: string;
  type_name: string;
  type_description: string;
};

async function db() {
  const { createPublicClient } = await import("./public-client.server");
  return createPublicClient();
}

export const listFacilities = createServerFn({ method: "GET" }).handler(async (): Promise<Facility[]> => {
  const sb = await db();
  const { data, error } = await sb
    .from("facilities")
    .select("id, name, code, description, has_venue, has_accommodation")
    .eq("status", "active")
    .order("id");
  if (error) throw new Error("Could not load facilities");
  return data ?? [];
});

function mapVenue(v: any): Venue {
  return {
    id: v.id,
    facility_id: v.facility_id,
    name: v.name,
    capacity: v.capacity,
    capacity_tables: v.capacity_tables,
    description: v.description,
    price: Number(v.price),
    image_url: v.image_url,
    facility_name: v.facilities?.name ?? "",
    facility_code: v.facilities?.code ?? "",
  };
}

function mapRoom(r: any): Room {
  return {
    id: r.id,
    facility_id: r.facility_id,
    room_number: r.room_number,
    capacity: r.capacity,
    price_per_night: Number(r.price_per_night),
    image_url: r.image_url,
    facility_name: r.facilities?.name ?? "",
    facility_code: r.facilities?.code ?? "",
    type_name: r.room_types?.name ?? "Standard Room",
    type_description:
      r.room_types?.description ?? "Air-conditioned room with private bath, work desk and campus WiFi.",
  };
}

export const listVenues = createServerFn({ method: "GET" }).handler(async (): Promise<Venue[]> => {
  const sb = await db();
  const { data, error } = await sb
    .from("venues")
    .select("*, facilities(name, code)")
    .eq("status", "available")
    .order("id");
  if (error) throw new Error("Could not load venues");
  return (data ?? []).map(mapVenue);
});

export const getVenue = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<Venue | null> => {
    const sb = await db();
    const { data: v } = await sb.from("venues").select("*, facilities(name, code)").eq("id", data.id).maybeSingle();
    return v ? mapVenue(v) : null;
  });

export const listRooms = createServerFn({ method: "GET" }).handler(async (): Promise<Room[]> => {
  const sb = await db();
  const { data, error } = await sb
    .from("rooms")
    .select("*, facilities(name, code), room_types(name, description)")
    .eq("status", "available")
    .order("facility_id")
    .order("room_number");
  if (error) throw new Error("Could not load rooms");
  return (data ?? []).map(mapRoom);
});

export const getRoom = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<Room | null> => {
    const sb = await db();
    const { data: r } = await sb
      .from("rooms")
      .select("*, facilities(name, code), room_types(name, description)")
      .eq("id", data.id)
      .maybeSingle();
    return r ? mapRoom(r) : null;
  });

export const getVenueAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const [busy, blackouts] = await Promise.all([
      sb.rpc("venue_busy_ranges", { _venue_id: data.id }),
      sb.from("blackout_dates").select("start_date, end_date, reason").eq("venue_id", data.id),
    ]);
    return {
      busy: (busy.data ?? []).map((b) => ({
        start_date: b.start_date,
        end_date: b.end_date,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
      blackouts: blackouts.data ?? [],
    };
  });

export const getRoomAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: busy } = await sb.rpc("room_busy_ranges", { _room_id: data.id });
    return { busy: (busy ?? []).map((b) => ({ check_in: b.check_in, check_out: b.check_out })) };
  });
