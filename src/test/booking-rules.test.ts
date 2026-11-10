import { describe, expect, it } from "vitest";
import {
  maxAttendeesFor,
  minVenueDate,
  validateRoomRequest,
  validateVenueRequest,
} from "@/lib/booking-rules";
import { toAuthEmail } from "@/lib/identity";

const venue = { capacity: 150, capacity_tables: 100 };
// Noon in Manila on 9 Nov 2026
const now = new Date("2026-11-09T04:00:00Z");

const base = {
  event_name: "Research Summit",
  start_date: "2026-11-16",
  end_date: "2026-11-16",
  start_time: "08:00",
  end_time: "17:00",
  attendees: 80,
  layout_style: "banquet",
};

describe("venue capacity", () => {
  it("allows 100 guests with tables and 150 without", () => {
    expect(maxAttendeesFor(venue, "banquet")).toBe(100);
    expect(maxAttendeesFor(venue, "theater")).toBe(150);
  });

  it("rejects 101 guests for a table setup", () => {
    expect(validateVenueRequest({ ...base, attendees: 101 }, venue, [], [], now)).toMatch(
      /up to 100/,
    );
  });

  it("accepts 150 guests for a theater setup", () => {
    expect(
      validateVenueRequest(
        { ...base, attendees: 150, layout_style: "theater" },
        venue,
        [],
        [],
        now,
      ),
    ).toBeNull();
  });
});

describe("venue advance notice", () => {
  it("requires at least 7 days notice", () => {
    expect(minVenueDate(now)).toBe("2026-11-16");
    expect(
      validateVenueRequest(
        { ...base, start_date: "2026-11-15", end_date: "2026-11-15" },
        venue,
        [],
        [],
        now,
      ),
    ).toMatch(/7 days/);
  });
});

describe("venue conflicts", () => {
  it("blocks overlapping hours on a booked date", () => {
    const busy = [
      { start_date: "2026-11-16", end_date: "2026-11-16", start_time: "13:00", end_time: "18:00" },
    ];
    expect(validateVenueRequest(base, venue, busy, [], now)).toMatch(/already reserved/);
  });

  it("allows non-overlapping hours on the same date", () => {
    const busy = [
      { start_date: "2026-11-16", end_date: "2026-11-16", start_time: "18:00", end_time: "22:00" },
    ];
    expect(validateVenueRequest(base, venue, busy, [], now)).toBeNull();
  });

  it("blocks dates an administrator marked unavailable", () => {
    const blackouts = [{ start_date: "2026-11-16", end_date: "2026-11-17", reason: "Maintenance" }];
    expect(validateVenueRequest(base, venue, [], blackouts, now)).toMatch(/unavailable/);
  });
});

describe("room stays", () => {
  const room = { capacity: 2 };
  it("rejects more guests than the room holds", () => {
    expect(
      validateRoomRequest(
        { check_in: "2026-11-10", check_out: "2026-11-11", guests: 3 },
        room,
        [],
        now,
      ),
    ).toMatch(/max 2/);
  });

  it("lets a new stay start on another stay's check-out day", () => {
    const busy = [{ check_in: "2026-11-10", check_out: "2026-11-12" }];
    expect(
      validateRoomRequest(
        { check_in: "2026-11-12", check_out: "2026-11-13", guests: 1 },
        room,
        busy,
        now,
      ),
    ).toBeNull();
  });

  it("rejects overlapping nights", () => {
    const busy = [{ check_in: "2026-11-10", check_out: "2026-11-12" }];
    expect(
      validateRoomRequest(
        { check_in: "2026-11-11", check_out: "2026-11-13", guests: 1 },
        room,
        busy,
        now,
      ),
    ).toMatch(/already reserved/);
  });
});

describe("sign-in identifiers", () => {
  it("maps staff usernames to their internal sign-in address", () => {
    expect(toAuthEmail("HRT_Admin")).toBe("hrt_admin@staff.isatu-booking.app");
  });
  it("keeps guest emails as typed", () => {
    expect(toAuthEmail("Guest@Example.com")).toBe("guest@example.com");
  });
});
