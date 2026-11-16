import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const webhookSchema = z
  .object({
    event: z.string(),
    data: z
      .object({
        id: z.string().optional(),
        payment_session_id: z.string().optional(),
        reference_id: z.string().optional(),
        payment_request_id: z.string().optional(),
        payment_id: z.string().optional(),
        request_amount: z.number().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        failure_code: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

function jsonResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function sameAmount(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

async function handleWebhook(request: Request): Promise<Response> {
  const { validWebhookToken, getCheckout, getPaymentRequest } = await import("@/lib/xendit.server");
  if (!validWebhookToken(request.headers.get("x-callback-token")))
    return jsonResponse(401, { error: "Unauthorized" });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) return jsonResponse(413, { error: "Payload too large" });

  let payload: z.infer<typeof webhookSchema>;
  try {
    payload = webhookSchema.parse(JSON.parse(await request.text()));
  } catch {
    return jsonResponse(400, { error: "Invalid webhook payload" });
  }

  try {
    const {
      applyConfirmedPayment,
      findPaymentByReference,
      markPaymentExpired,
      recordPaymentFailure,
    } = await import("@/lib/xendit-data.server");
    const { event, data } = payload;
    // Dashboard samples and unrelated merchant events must not mutate bookings.
    // Only acknowledge unknown non-booking references after token authentication.
    if (data.reference_id && !data.reference_id.startsWith("room-")) {
      const known = await findPaymentByReference(data.reference_id);
      if (!known) return jsonResponse(200, { received: true, ignored: true });
    }
    if (
      event === "payment_session.completed" ||
      event === "payment.capture" ||
      event === "payment.succeeded"
    ) {
      const eventSessionId =
        data.payment_session_id ?? (data.id?.startsWith("ps-") ? data.id : null);
      const eventSession = eventSessionId ? await getCheckout(eventSessionId) : null;
      const referenceId = data.reference_id ?? eventSession?.reference_id;
      const transaction = referenceId ? await findPaymentByReference(referenceId) : null;
      if (!transaction) return jsonResponse(404, { error: "Payment transaction not found" });
      const paymentSessionId = eventSessionId ?? transaction.payment_session_id;
      if (!paymentSessionId || transaction.payment_session_id !== paymentSessionId)
        return jsonResponse(409, { error: "Payment session does not match" });

      const session = eventSession ?? (await getCheckout(paymentSessionId));
      if (
        session.status !== "COMPLETED" ||
        session.reference_id !== transaction.reference_id ||
        !sameAmount(session.amount, transaction.amount) ||
        session.currency !== transaction.currency
      ) {
        return jsonResponse(409, { error: "Xendit session is not a matching completed payment" });
      }

      const paymentRequestId = session.payment_request_id ?? data.payment_request_id;
      if (!paymentRequestId) return jsonResponse(409, { error: "Payment request is missing" });
      const paymentRequest = await getPaymentRequest(paymentRequestId);
      if (
        paymentRequest.status !== "SUCCEEDED" ||
        paymentRequest.reference_id !== transaction.reference_id ||
        !sameAmount(paymentRequest.request_amount, transaction.amount) ||
        paymentRequest.currency !== transaction.currency
      ) {
        return jsonResponse(409, { error: "Xendit has not confirmed this payment" });
      }

      const paymentId =
        data.payment_id ??
        session.payment_id ??
        paymentRequest.payments?.find((payment) => payment.status === "SUCCEEDED")?.payment_id ??
        null;
      const result = await applyConfirmedPayment({
        referenceId: transaction.reference_id,
        paymentSessionId,
        paymentRequestId,
        paymentId,
        amount: paymentRequest.request_amount,
        currency: paymentRequest.currency,
      });
      if (result === "not_found" || result === "mismatch")
        return jsonResponse(409, { error: "Payment details do not match the reservation" });
      return jsonResponse(200, { received: true });
    }

    if (event === "payment_session.expired") {
      const sessionId = data.payment_session_id ?? (data.id?.startsWith("ps-") ? data.id : null);
      if (!sessionId) return jsonResponse(400, { error: "Payment session is missing" });
      const session = await getCheckout(sessionId);
      if (session.status !== "EXPIRED") return jsonResponse(200, { received: true });
      const transaction = await findPaymentByReference(session.reference_id);
      if (!transaction || transaction.payment_session_id !== sessionId)
        return jsonResponse(404, { error: "Payment transaction not found" });
      const result = await markPaymentExpired(transaction.reference_id, sessionId);
      if (result === "not_found")
        return jsonResponse(404, { error: "Payment transaction not found" });
      return jsonResponse(200, { received: true });
    }

    if (event === "payment.failure") {
      const referenceId = data.reference_id;
      const paymentRequestId = data.payment_request_id;
      if (!referenceId || !paymentRequestId)
        return jsonResponse(400, { error: "Payment details are missing" });
      const transaction = await findPaymentByReference(referenceId);
      if (!transaction) return jsonResponse(404, { error: "Payment transaction not found" });
      const paymentRequest = await getPaymentRequest(paymentRequestId);
      if (paymentRequest.status === "SUCCEEDED") {
        const paymentSessionId = transaction.payment_session_id;
        if (
          !paymentSessionId ||
          paymentRequest.reference_id !== transaction.reference_id ||
          !sameAmount(paymentRequest.request_amount, transaction.amount) ||
          paymentRequest.currency !== transaction.currency
        ) {
          return jsonResponse(409, { error: "Xendit payment details do not match" });
        }
        const session = await getCheckout(paymentSessionId);
        if (
          session.status !== "COMPLETED" ||
          session.payment_request_id !== paymentRequestId ||
          session.reference_id !== transaction.reference_id ||
          !sameAmount(session.amount, transaction.amount) ||
          session.currency !== transaction.currency
        ) {
          return jsonResponse(409, { error: "Xendit has not confirmed this completed session" });
        }
        const result = await applyConfirmedPayment({
          referenceId: transaction.reference_id,
          paymentSessionId,
          paymentRequestId,
          paymentId:
            data.payment_id ??
            session.payment_id ??
            paymentRequest.payments?.find((payment) => payment.status === "SUCCEEDED")
              ?.payment_id ??
            null,
          amount: paymentRequest.request_amount,
          currency: paymentRequest.currency,
        });
        if (result === "not_found" || result === "mismatch")
          return jsonResponse(409, { error: "Payment details do not match the reservation" });
        return jsonResponse(200, { received: true });
      }
      if (
        paymentRequest.status !== "FAILED" ||
        paymentRequest.reference_id !== transaction.reference_id ||
        !sameAmount(paymentRequest.request_amount, transaction.amount) ||
        paymentRequest.currency !== transaction.currency
      ) {
        return jsonResponse(409, { error: "Xendit has not confirmed this failed attempt" });
      }
      const result = await recordPaymentFailure({
        referenceId: transaction.reference_id,
        paymentRequestId,
        failureCode: data.failure_code ?? null,
      });
      if (result === "not_found")
        return jsonResponse(404, { error: "Payment transaction not found" });
      return jsonResponse(200, { received: true });
    }

    return jsonResponse(200, { received: true, ignored: true });
  } catch (error) {
    console.error("Xendit webhook processing failed.", error);
    return jsonResponse(500, { error: "Webhook processing failed" });
  }
}

export const Route = createFileRoute("/api/xendit/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleWebhook(request),
    },
  },
});
