import { timingSafeEqual } from "node:crypto";

function secret() {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key?.startsWith("xnd_development_")) throw new Error("Xendit test key required");
  return key;
}
async function request(path: string, body?: object) {
  const response = await fetch("https://api.xendit.co" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Basic " + Buffer.from(secret() + ":").toString("base64"), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Xendit request failed: " + response.status);
  return response.json();
}
export async function createCheckout(reference: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || !/^[a-zA-Z0-9-]{1,64}$/.test(reference)) throw new Error("Invalid checkout");
  const url = new URL("/my-bookings", process.env.APP_URL);
  if (url.protocol !== "https:") throw new Error("HTTPS APP_URL required");
  return request("/sessions", {
    reference_id: reference, amount, currency: "PHP", country: "PH",
    session_type: "PAY", mode: "PAYMENT_LINK", capture_method: "AUTOMATIC",
    allow_save_payment_method: "DISABLED",
    success_return_url: url.href, cancel_return_url: url.href,
  });
}
export async function getCheckout(id: string) {
  if (!/^ps-[a-zA-Z0-9]+$/.test(id)) throw new Error("Invalid session ID");
  return request("/sessions/" + encodeURIComponent(id));
}
export function validWebhookToken(value: string | null) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !value) return false;
  const a = Buffer.from(expected), b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
