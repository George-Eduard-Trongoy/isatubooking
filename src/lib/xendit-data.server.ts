import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const paymentTransactionSchema = z.object({
  id: z.number(),
  room_booking_id: z.number(),
  user_id: z.string(),
  reference_id: z.string(),
  payment_session_id: z.string().nullable(),
  payment_request_id: z.string().nullable(),
  payment_id: z.string().nullable(),
  purpose: z.enum(["downpayment", "full", "balance"]),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["pending", "succeeded", "failed", "expired", "cancelled"]),
  payment_link_url: z.string().nullable(),
  expires_at: z.string().nullable(),
  failure_code: z.string().nullable(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
});

export type PaymentTransaction = z.infer<typeof paymentTransactionSchema>;
export type PaymentPurpose = PaymentTransaction["purpose"];

type PaymentInsert = {
  room_booking_id: number;
  user_id: string;
  reference_id: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: "PHP";
  status: "pending";
};

type PaymentUpdate = Partial<
  Pick<
    PaymentTransaction,
    | "payment_session_id"
    | "payment_request_id"
    | "payment_id"
    | "status"
    | "payment_link_url"
    | "expires_at"
    | "failure_code"
    | "paid_at"
  >
>;

type DatabaseError = { code?: string; message: string };
type DatabaseResult<T> = { data: T | null; error: DatabaseError | null };
type QueryResult<T> = PromiseLike<DatabaseResult<T>>;

interface PaymentQuery extends PromiseLike<DatabaseResult<unknown>> {
  select(columns?: string): PaymentQuery;
  insert(values: PaymentInsert): PaymentQuery;
  update(values: PaymentUpdate): PaymentQuery;
  eq(column: string, value: string | number): PaymentQuery;
  in(column: string, values: (string | number)[]): PaymentQuery;
  order(column: string, options?: { ascending?: boolean }): PaymentQuery;
  limit(count: number): PaymentQuery;
  single(): QueryResult<unknown>;
  maybeSingle(): QueryResult<unknown>;
}

const database = supabaseAdmin as unknown as {
  from(table: "payment_transactions"): PaymentQuery;
  rpc(name: string, args: Record<string, unknown>): QueryResult<unknown>;
};

function parseTransaction(value: unknown): PaymentTransaction {
  return paymentTransactionSchema.parse(value);
}

export function isUniqueViolation(error: DatabaseError): boolean {
  return error.code === "23505";
}

export async function createPaymentTransaction(values: PaymentInsert) {
  const { data, error } = await database
    .from("payment_transactions")
    .insert(values)
    .select("*")
    .single();
  if (error) return { data: null, error };
  return { data: parseTransaction(data), error: null };
}

export async function updatePaymentTransaction(id: number, values: PaymentUpdate) {
  const { error } = await database.from("payment_transactions").update(values).eq("id", id);
  return { error };
}

export async function findPendingPayment(roomBookingId: number) {
  const { data, error } = await database
    .from("payment_transactions")
    .select("*")
    .eq("room_booking_id", roomBookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not check for an existing payment.");
  return data ? parseTransaction(data) : null;
}

export async function findPaymentByReference(referenceId: string) {
  const { data, error } = await database
    .from("payment_transactions")
    .select("*")
    .eq("reference_id", referenceId)
    .maybeSingle();
  if (error) throw new Error("Could not find the Xendit payment transaction.");
  return data ? parseTransaction(data) : null;
}

export async function listPaymentsForBookings(roomBookingIds: number[]) {
  if (roomBookingIds.length === 0) return [];
  const { data, error } = await database
    .from("payment_transactions")
    .select("*")
    .in("room_booking_id", roomBookingIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load payment transactions.");
  return z.array(paymentTransactionSchema).parse(data);
}

export async function applyConfirmedPayment(values: {
  referenceId: string;
  paymentSessionId: string;
  paymentRequestId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
}) {
  const { data, error } = await database.rpc("apply_xendit_payment", {
    _reference_id: values.referenceId,
    _payment_session_id: values.paymentSessionId,
    _payment_request_id: values.paymentRequestId,
    _payment_id: values.paymentId,
    _amount: values.amount,
    _currency: values.currency,
  });
  if (error) throw new Error("Could not record the confirmed Xendit payment.");
  const result = z.enum(["applied", "already_applied", "not_found", "mismatch"]).parse(data);
  return result;
}

export async function markPaymentExpired(referenceId: string, paymentSessionId: string) {
  const { data, error } = await database.rpc("expire_xendit_payment", {
    _reference_id: referenceId,
    _payment_session_id: paymentSessionId,
  });
  if (error) throw new Error("Could not record the expired Xendit payment.");
  return z.enum(["expired", "already_final", "not_found"]).parse(data);
}

export async function recordPaymentFailure(values: {
  referenceId: string;
  paymentRequestId: string;
  failureCode: string | null;
}) {
  const { data, error } = await database.rpc("record_xendit_payment_failure", {
    _reference_id: values.referenceId,
    _payment_request_id: values.paymentRequestId,
    _failure_code: values.failureCode,
  });
  if (error) throw new Error("Could not record the failed Xendit payment attempt.");
  return z.enum(["recorded", "already_final", "not_found"]).parse(data);
}
