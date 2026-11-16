import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelCheckout, createCheckout, validWebhookToken } from "@/lib/xendit.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Xendit test-mode checkout", () => {
  it("creates a hosted PHP payment session with the configured expiry", async () => {
    vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_test-key");
    vi.stubEnv("APP_URL", "https://booking.example.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        payment_session_id: "ps-661f87c614802d6c402cd82d",
        reference_id: "room-23-test",
        amount: 1500,
        currency: "PHP",
        status: "ACTIVE",
        payment_link_url: "https://dev.xen.to/checkout",
        expires_at: "2026-11-16T16:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCheckout("room-23-test", 1500, "2026-11-16T16:00:00.000Z");

    expect(result.payment_session_id).toBe("ps-661f87c614802d6c402cd82d");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xendit.co/sessions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      reference_id: "room-23-test",
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: 1500,
      currency: "PHP",
      country: "PH",
      expires_at: "2026-11-16T16:00:00.000Z",
      allow_save_payment_method: "DISABLED",
    });
  });

  it("requires the exact configured webhook token", () => {
    vi.stubEnv("XENDIT_WEBHOOK_TOKEN", "test-callback-token");

    expect(validWebhookToken("test-callback-token")).toBe(true);
    expect(validWebhookToken("wrong-token")).toBe(false);
    expect(validWebhookToken(null)).toBe(false);
  });

  it("cancels an active hosted session through the Session API", async () => {
    vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_test-key");
    const active = {
      payment_session_id: "ps-661f87c614802d6c402cd82d",
      reference_id: "room-23-test",
      amount: 1500,
      currency: "PHP",
      status: "ACTIVE",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(active))
      .mockResolvedValueOnce(Response.json({ ...active, status: "CANCELED" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(cancelCheckout(active.payment_session_id)).resolves.toBe("CANCELED");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.xendit.co/sessions/ps-661f87c614802d6c402cd82d/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not create a checkout with a non-HTTPS return URL", async () => {
    vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_test-key");
    vi.stubEnv("APP_URL", "http://booking.example.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createCheckout("room-23-test", 1500, "2026-11-16T16:00:00.000Z")).rejects.toThrow(
      "HTTPS APP_URL required",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
