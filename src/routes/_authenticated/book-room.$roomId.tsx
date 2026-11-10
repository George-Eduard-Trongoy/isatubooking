import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDays, Info, Loader2, Plus, ShieldCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookingHero } from "@/components/booking-hero";
import { FormMessage } from "@/components/status-badge";
import { getRoom, getRoomAvailability } from "@/lib/catalog.functions";
import { createRoomBooking } from "@/lib/bookings.functions";
import {
  PAYMENT_OPTIONS,
  addDays,
  amountForOption,
  balanceDue,
  daysBetween,
  formatDate,
  formatPeso,
  roomBlockedDates,
  roomTotal,
  todayYMD,
  validateRoomRequest,
  validateSandboxAccount,
  type PaymentOption,
} from "@/lib/booking-rules";
import { dateToYmd, ymdToDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const roomQuery = (id: number) =>
  queryOptions({
    queryKey: ["room", id],
    queryFn: async () => {
      const [room, availability] = await Promise.all([getRoom({ data: { id } }), getRoomAvailability({ data: { id } })]);
      return { room, availability };
    },
  });

export const Route = createFileRoute("/_authenticated/book-room/$roomId")({
  head: () => ({
    meta: [
      { title: "Reserve a room | ISATU Booking" },
      { name: "description", content: "Choose your stay dates and add special requests." },
      { property: "og:title", content: "Reserve a room | ISATU Booking" },
      { property: "og:description", content: "Reserve campus accommodation at ISATU." },
    ],
  }),
  loader: async ({ context, params }) => {
    const id = Number(params.roomId);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const data = await context.queryClient.ensureQueryData(roomQuery(id));
    if (!data.room) throw notFound();
  },
  component: BookRoomPage,
});

const STAY_PRESETS = [1, 2, 3, 5, 7];
const REQUESTS = [
  "Extra pillows and blankets",
  "Late check-in after 8:00 PM",
  "Early check-in",
  "Quiet study setup with extra lamp",
  "Luggage drop-off before check-in",
  "Extra towels and toiletries",
];

function BookRoomPage() {
  const { roomId } = Route.useParams();
  const { data } = useSuspenseQuery(roomQuery(Number(roomId)));
  const room = data.room!;
  const busy = data.availability.busy;
  const navigate = useNavigate();
  const create = useServerFn(createRoomBooking);

  const today = todayYMD();
  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState("");
  const [option, setOption] = useState<PaymentOption>("downpayment");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const blocked = useMemo(() => new Set(roomBlockedDates(busy)), [busy]);
  const checkIn = range?.from ? dateToYmd(range.from) : "";
  const checkOut = range?.to ? dateToYmd(range.to) : "";
  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0;
  const req = { check_in: checkIn, check_out: checkOut, guests };
  const liveCheck = checkIn && checkOut ? validateRoomRequest(req, room, busy) : "Select check-in and check-out dates.";
  const total = checkIn && checkOut ? roomTotal(room.price_per_night, checkIn, checkOut) : room.price_per_night;
  const dueNow = amountForOption(total, option);
  const balance = balanceDue(total, dueNow);

  const applyPreset = (n: number) => {
    const start = checkIn || today;
    setRange({ from: ymdToDate(start), to: ymdToDate(addDays(start, n)) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateRoomRequest(req, room, busy) ?? validateSandboxAccount(mobile);
    if (err) return setError(err);
    setError(null);
    setSubmitting(true);
    try {
      const res = await create({ data: { room_id: room.id, ...req, special_orders: notes, payment_option: option, sandbox_mobile: mobile } });
      if (!res.ok) return setError(res.message);
      toast.success(`Paid ${formatPeso(res.amountPaid)} through Sandbox (ref ${res.reference}). Reservation for Room ${room.room_number} submitted.`);
      navigate({ to: "/my-bookings" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <BookingHero
        image={room.image_url}
        backTo="/rooms"
        backLabel="All rooms"
        eyebrow={`${room.facility_name} · Floor ${room.room_number.charAt(0)}`}
        title={`Room ${room.room_number}, ${room.type_name}`}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> Up to {room.capacity} guest{room.capacity > 1 ? "s" : ""}</span>
            <span>{formatPeso(room.price_per_night)} per night</span>
          </>
        }
      />

      <form onSubmit={submit} className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-gold" />
              <h2 className="text-lg font-semibold">Stay dates</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Pick your check-in date, then your check-out date.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STAY_PRESETS.map((n) => (
                <button key={n} type="button" onClick={() => applyPreset(n)} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors", nights === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                  {n} night{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={range}
                onSelect={setRange}
                disabled={(d) => {
                  const y = dateToYmd(d);
                  return y < today || blocked.has(y);
                }}
                modifiers={{ booked: (d) => blocked.has(dateToYmd(d)) }}
                modifiersClassNames={{ booked: "[&>button]:bg-danger-soft [&>button]:text-destructive [&>button]:line-through" }}
                className="rounded-xl border border-border [--cell-size:2.5rem]"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Crossed-out nights are already reserved.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Guests and requests</h2>
            <div className="mt-4 max-w-xs space-y-2">
              <Label htmlFor="guests">Number of guests</Label>
              <Input id="guests" type="number" min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="h-11" />
            </div>
            <div className="mt-6 space-y-2">
              <Label htmlFor="notes">Special requests <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {REQUESTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNotes((n) => (n.includes(r) ? n : n ? `${n}, ${r}` : r))}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-gold hover:text-foreground"
                  >
                    <Plus className="size-3" /> {r}
                  </button>
                ))}
              </div>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="Bedding preference, arrival time, accessibility needs..." className="mt-2" />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Wallet className="size-5 text-gold" />
              <h2 className="text-lg font-semibold">Payment</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              A downpayment of at least 50% of the total bill, paid online through the Sandbox wallet, is required to reserve a room.
            </p>
            <div role="radiogroup" aria-label="Payment amount" className="mt-4 grid gap-3 sm:grid-cols-2">
              {PAYMENT_OPTIONS.map((o) => {
                const active = option === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOption(o.value)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      active ? "border-primary bg-secondary ring-1 ring-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{o.label}</span>
                      <span className="font-display font-semibold">{formatPeso(amountForOption(total, o.value))}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{o.detail}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">Sandbox wallet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Test wallet for demonstration. No real money is charged.</p>
              <div className="mt-3 max-w-xs space-y-2">
                <Label htmlFor="sandbox-mobile">Wallet mobile number</Label>
                <Input id="sandbox-mobile" inputMode="numeric" autoComplete="tel" placeholder="09XX XXX XXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={13} className="h-11" />
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            <h2 className="text-lg font-semibold">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Check-in</dt><dd className="font-medium">{checkIn ? formatDate(checkIn) : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Check-out</dt><dd className="font-medium">{checkOut ? formatDate(checkOut) : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Nights</dt><dd className="font-medium">{nights || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Guests</dt><dd className="font-medium">{guests}</dd></div>
            </dl>
            <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total bill</dt><dd className="font-medium">{formatPeso(total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Balance after payment</dt><dd className="font-medium">{formatPeso(balance)}</dd></div>
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Due now</span>
              <span className="font-display text-2xl font-semibold">{formatPeso(dueNow)}</span>
            </div>
            <p className={cn("mt-4 flex items-start gap-2 text-xs", liveCheck ? "text-warning" : "text-success")}>
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {liveCheck ?? "This room is available for your stay."}
            </p>
            {error && <div className="mt-4"><FormMessage tone="error">{error}</FormMessage></div>}
            <Button type="submit" variant="gold" size="lg" className="mt-6 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Pay {formatPeso(dueNow)} and reserve
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Cancelled or rejected reservations are refunded to your Sandbox wallet.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
