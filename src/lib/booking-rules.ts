// Pure booking rules shared by the booking forms (preview) and server functions (enforcement).

export const TIME_ZONE = "Asia/Manila";
export const VENUE_ADVANCE_DAYS = 7;
export const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const LAYOUT_STYLES = [
  { value: "banquet", label: "Banquet and Gala", detail: "Round tables of 8, stage and buffet", tables: true },
  { value: "classroom", label: "Classroom and Workshop", detail: "Desk rows facing the stage", tables: true },
  { value: "ushape", label: "U-Shape Boardroom", detail: "Executive conference tables", tables: true },
  { value: "theater", label: "Theater and Keynote", detail: "Auditorium chair rows", tables: false },
  { value: "cocktail", label: "Cocktail Reception", detail: "Standing high-tops, bar and lounge", tables: false },
] as const;
export type LayoutStyle = (typeof LAYOUT_STYLES)[number]["value"];

export function isLayoutStyle(v: string): v is LayoutStyle {
  return LAYOUT_STYLES.some((s) => s.value === v);
}

export function styleUsesTables(style: string): boolean {
  return ["banquet", "classroom", "ushape", "boardroom", "conference"].includes(style);
}

export function maxAttendeesFor(
  venue: { capacity: number; capacity_tables: number },
  style: string,
): number {
  return styleUsesTables(style) ? venue.capacity_tables || 100 : venue.capacity || 150;
}

/** YYYY-MM-DD for a Date in the campus time zone. */
export function toYMD(date: Date, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function todayYMD(now = new Date()): string {
  return toYMD(now);
}

export function minVenueDate(now = new Date()): string {
  return addDays(todayYMD(now), VENUE_ADVANCE_DAYS);
}

/** Every date from start to end inclusive. */
export function eachDate(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  let guard = 0;
  while (cur <= endYmd && guard < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

export type VenueBusyRange = { start_date: string; end_date: string; start_time: string; end_time: string };
export type BlackoutRange = { start_date: string; end_date: string; reason: string };
export type RoomBusyRange = { check_in: string; check_out: string };

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return !(aEnd < bStart || aStart > bEnd);
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return !(aEnd <= bStart || aStart >= bEnd);
}

export type VenueRequest = {
  event_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  attendees: number;
  layout_style: string;
};

/** Returns an error message, or null when the venue request is valid. */
export function validateVenueRequest(
  req: VenueRequest,
  venue: { capacity: number; capacity_tables: number },
  busy: VenueBusyRange[],
  blackouts: BlackoutRange[],
  now = new Date(),
): string | null {
  if (!req.event_name.trim()) return "Please provide an event name or purpose.";
  if (!isLayoutStyle(req.layout_style)) return "Please choose a layout setup.";
  const max = maxAttendeesFor(venue, req.layout_style);
  if (!Number.isInteger(req.attendees) || req.attendees < 1 || req.attendees > max) {
    return styleUsesTables(req.layout_style)
      ? `Setups with tables accommodate up to ${max} guests. Choose Theater or Cocktail for up to ${venue.capacity || 150}.`
      : `The maximum venue capacity is ${max} guests.`;
  }
  const earliest = minVenueDate(now);
  if (!req.start_date || req.start_date < earliest) {
    return `Venue reservations require at least 7 days notice. The earliest start date is ${earliest}.`;
  }
  if (!req.end_date || req.end_date < req.start_date) return "End date must be on or after the start date.";
  if (daysBetween(req.start_date, req.end_date) > 30) return "Venue reservations can span at most 31 days.";
  if (!/^\d{2}:\d{2}$/.test(req.start_time) || !/^\d{2}:\d{2}$/.test(req.end_time)) {
    return "Please choose valid start and end times.";
  }
  if (req.start_time >= req.end_time) return "End time must be later than start time.";

  for (const b of busy) {
    if (
      rangesOverlap(req.start_date, req.end_date, b.start_date, b.end_date || b.start_date) &&
      timesOverlap(req.start_time, req.end_time, b.start_time, b.end_time)
    ) {
      return `Another event is already reserved from ${b.start_date} to ${b.end_date}, ${b.start_time} to ${b.end_time}.`;
    }
  }
  for (const bl of blackouts) {
    if (rangesOverlap(req.start_date, req.end_date, bl.start_date, bl.end_date)) {
      return `The venue is unavailable from ${bl.start_date} to ${bl.end_date}: ${bl.reason}.`;
    }
  }
  return null;
}

export type RoomRequest = { check_in: string; check_out: string; guests: number };

export function validateRoomRequest(
  req: RoomRequest,
  room: { capacity: number },
  busy: RoomBusyRange[],
  now = new Date(),
): string | null {
  const today = todayYMD(now);
  if (!req.check_in || req.check_in < today) return "Check-in date cannot be in the past.";
  if (!req.check_out || req.check_out <= req.check_in) return "Check-out must be after check-in.";
  if (daysBetween(req.check_in, req.check_out) > 30) return "Stays can be at most 30 nights.";
  if (!Number.isInteger(req.guests) || req.guests < 1) return "Please enter the number of guests.";
  if (req.guests > room.capacity) return `Guest count exceeds room capacity (max ${room.capacity}).`;
  for (const b of busy) {
    if (b.check_in < req.check_out && b.check_out > req.check_in) {
      return "This room is already reserved for some of the selected nights.";
    }
  }
  return null;
}

/** Nights blocked by existing room stays (check-out day stays free). */
export function roomBlockedDates(busy: RoomBusyRange[]): string[] {
  const set = new Set<string>();
  for (const b of busy) {
    if (b.check_out <= b.check_in) continue;
    for (const d of eachDate(b.check_in, addDays(b.check_out, -1))) set.add(d);
  }
  return [...set];
}

export function venueBlockedDates(
  busy: VenueBusyRange[],
  startTime?: string,
  endTime?: string,
): string[] {
  const set = new Set<string>();
  for (const b of busy) {
    if (startTime && endTime && !timesOverlap(startTime, endTime, b.start_time, b.end_time)) continue;
    for (const d of eachDate(b.start_date, b.end_date || b.start_date)) set.add(d);
  }
  return [...set];
}

export function formatPeso(value: number): string {
  return `PHP ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}
