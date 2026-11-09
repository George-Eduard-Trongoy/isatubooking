import { describe, expect, it } from "vitest";
import { resolveNewAccountRole } from "@/lib/identity";

const hrtAdmin = { role: "venue_admin" as const, facilityId: 1 };
const systemAdmin = { role: "admin" as const, facilityId: null };

describe("who can create which accounts", () => {
  it("facility admins can create guest accounts", () => {
    expect(resolveNewAccountRole(hrtAdmin, { role: "guest", facilityId: null })).toEqual({ ok: true, facilityId: null });
  });
  it("facility admins can create admins only for their own facility", () => {
    expect(resolveNewAccountRole(hrtAdmin, { role: "venue_admin", facilityId: 2 })).toEqual({ ok: true, facilityId: 1 });
  });
  it("facility admins cannot create system administrators", () => {
    expect(resolveNewAccountRole(hrtAdmin, { role: "admin", facilityId: null }).ok).toBe(false);
  });
  it("guests cannot create accounts", () => {
    expect(resolveNewAccountRole({ role: "guest", facilityId: null }, { role: "guest", facilityId: null }).ok).toBe(false);
  });
  it("the system administrator can create admins for any facility", () => {
    expect(resolveNewAccountRole(systemAdmin, { role: "venue_admin", facilityId: 2 })).toEqual({ ok: true, facilityId: 2 });
    expect(resolveNewAccountRole(systemAdmin, { role: "admin", facilityId: null }).ok).toBe(true);
  });
});
