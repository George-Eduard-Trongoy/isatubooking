import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const sessionSchema = z.object({
  payment_session_id: z.string().regex(/^ps-[a-zA-Z0-9]{24}$/),
  reference_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  payment_link_url: z.string().url().optional(),
  expires_at: z.string().datetime().optional(),
  payment_request_id: z.string().nullable().optional(),
  payment_id: z.string().nullable().optional(),
});

const paymentRequestSchema = z.object({
  payment_request_id: z.string(),
  reference_id: z.string(),
  request_amount: z.number(),
  currency: z.string(),
  status: z.string(),
  payments: z.array(z.object({ payment_id: z.string(), status: z.string() })).optional(),
});

export type XenditSession = z.infer<typeof sessionSchema>;
export type XenditPaymentRequest = z.infer<typeof paymentRequestSchema>;

function secret() {
  const key = process.env["XENDIT_SECRET_KEY"];
  if (!key?.startsWith("xnd_development_")) throw new Error("Xendit test key required");
  return key;
}

async function request(path: string, body?: object, method?: "GET" | "POST"): Promise<unknown> {
  const init: RequestInit = {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret()}:`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const response = await fetch(`https://api.xendit.co${path}`, init);
  if (!response.ok) throw new Error(`Xendit request failed with status ${response.status}`);
  return response.json();
}

export async function createCheckout(
  reference: string,
  amount: number,
  expiresAt: string,
): Promise<XenditSession> {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(reference) ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new Error("Invalid checkout");
  }

  const appUrl = process.env["APP_URL"];
  if (!appUrl) throw new Error("APP_URL is required for Xendit checkout");
  const returnUrl = new URL("/my-bookings", appUrl);
  if (returnUrl.protocol !== "https:" || returnUrl.username || returnUrl.password)
    throw new Error("HTTPS APP_URL required");

  const result = sessionSchema.parse(
    await request("/sessions", {
      reference_id: reference,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount,
      currency: "PHP",
      country: "PH",
      capture_method: "AUTOMATIC",
      allow_save_payment_method: "DISABLED",
      expires_at: expiresAt,
      success_return_url: returnUrl.href,
      cancel_return_url: returnUrl.href,
    }),
  );
  const checkoutUrl = result.payment_link_url ? new URL(result.payment_link_url) : null;
  if (
    !checkoutUrl ||
    checkoutUrl.protocol !== "https:" ||
    checkoutUrl.username ||
    checkoutUrl.password
  )
    throw new Error("Xendit did not return a secure checkout URL");
  if (result.reference_id !== reference || result.amount !== amount || result.currency !== "PHP")
    throw new Error("Xendit returned a checkout with unexpected payment details");
  return result;
}

export async function getCheckout(id: string): Promise<XenditSession> {
  if (!/^ps-[a-zA-Z0-9]{24}$/.test(id)) throw new Error("Invalid session ID");
  return sessionSchema.parse(await request(`/sessions/${encodeURIComponent(id)}`));
}

export async function cancelCheckout(id: string): Promise<XenditSession["status"]> {
  if (!/^ps-[a-zA-Z0-9]{24}$/.test(id)) throw new Error("Invalid session ID");
  const session = await getCheckout(id);
  if (session.status !== "ACTIVE") return session.status;
  try {
    const canceled = sessionSchema.parse(
      await request(`/sessions/${encodeURIComponent(id)}/cancel`, undefined, "POST"),
    );
    return canceled.status;
  } catch (error) {
    const current = await getCheckout(id);
    if (
      current.status === "CANCELED" ||
      current.status === "COMPLETED" ||
      current.status === "EXPIRED"
    )
      return current.status;
    throw error;
  }
}

export async function getPaymentRequest(id: string): Promise<XenditPaymentRequest> {
  if (!/^pr-[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid payment request ID");
  return paymentRequestSchema.parse(
    await request(`/v3/payment_requests/${encodeURIComponent(id)}`),
  );
}

export function validWebhookToken(value: string | null): boolean {
  const expected = process.env["XENDIT_WEBHOOK_TOKEN"];
  if (!expected || !value) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(value);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
