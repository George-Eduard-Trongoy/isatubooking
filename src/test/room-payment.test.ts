import { describe, expect, it } from "vitest";
import {
  amountForOption,
  balanceDue,
  canPayOnline,
  minimumDownpayment,
  paymentStatusFor,
  validateReservationPayment,
} from "@/lib/booking-rules";

describe("room downpayment", () => {
  it("requires at least 50% of the total bill", () => {
    expect(minimumDownpayment(3000)).toBe(1500);
    expect(validateReservationPayment(3000, 1499.99)).toMatch(/at least 50%/);
    expect(validateReservationPayment(3000, 1500)).toBeNull();
  });

  it("rounds the 50% minimum up to the centavo", () => {
    expect(minimumDownpayment(1500.01)).toBe(750.01);
  });

  it("charges half for the downpayment option and the whole bill for full payment", () => {
    expect(amountForOption(2400, "downpayment")).toBe(1200);
    expect(amountForOption(2400, "full")).toBe(2400);
  });

  it("rejects paying more than the bill", () => {
    expect(validateReservationPayment(2400, 2400.01)).toMatch(/more than the total/);
  });

  it("marks a half-paid reservation as partial with the other half as balance", () => {
    expect(paymentStatusFor(2400, 1200)).toBe("partial");
    expect(balanceDue(2400, 1200)).toBe(1200);
    expect(paymentStatusFor(2400, 2400)).toBe("paid");
  });

  it("lets open reservations with a balance pay online, but not fully paid or closed ones", () => {
    expect(canPayOnline({ status: "pending", payment_status: "partial" })).toBe(true);
    expect(canPayOnline({ status: "approved", payment_status: "paid" })).toBe(false);
    expect(canPayOnline({ status: "cancelled", payment_status: "partial" })).toBe(false);
  });

  it("does not allow online payment for cancelled or rejected bookings", () => {
    expect(canPayOnline({ status: "cancelled", payment_status: "partial" })).toBe(false);
    expect(canPayOnline({ status: "rejected", payment_status: "partial" })).toBe(false);
  });
});
