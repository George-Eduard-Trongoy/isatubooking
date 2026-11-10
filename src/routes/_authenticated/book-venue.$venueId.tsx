import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Info,
  Loader2,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookingHero, StepIndicator } from "@/components/booking-hero";
import { FormMessage } from "@/components/status-badge";
import { getVenue, getVenueAvailability } from "@/lib/catalog.functions";
import { createVenueBooking } from "@/lib/bookings.functions";
import { getVenueMealPlans, type MealPlan } from "@/lib/meal-plans";
import {
  LAYOUT_STYLES,
  daysBetween,
  eachDate,
  formatDate,
  formatPeso,
  maxAttendeesFor,
  minVenueDate,
  styleUsesTables,
  validateVenueRequest,
  venueBlockedDates,
} from "@/lib/booking-rules";
import { dateToYmd, ymdToDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const venueQuery = (id: number) =>
  queryOptions({
    queryKey: ["venue", id],
    queryFn: async () => {
      const [venue, availability] = await Promise.all([
        getVenue({ data: { id } }),
        getVenueAvailability({ data: { id } }),
      ]);
      return { venue, availability };
    },
  });

export const Route = createFileRoute("/_authenticated/book-venue/$venueId")({
  head: () => ({
    meta: [
      { title: "Book a venue | ISATU Booking" },
      { name: "description", content: "Choose dates, hours and a layout for your event." },
      { property: "og:title", content: "Book a venue | ISATU Booking" },
      { property: "og:description", content: "Reserve an ISATU event venue." },
    ],
  }),
  loader: async ({ context, params }) => {
    const id = Number(params.venueId);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const data = await context.queryClient.ensureQueryData(venueQuery(id));
    if (!data.venue) throw notFound();
  },
  component: BookVenuePage,
});

const TIME_PRESETS = [
  { label: "Morning", start: "08:00", end: "12:00" },
  { label: "Afternoon", start: "13:00", end: "17:00" },
  { label: "Full day", start: "08:00", end: "17:00" },
  { label: "Evening", start: "18:00", end: "22:00" },
];

function BookVenuePage() {
  const { venueId } = Route.useParams();
  const { data } = useSuspenseQuery(venueQuery(Number(venueId)));
  const venue = data.venue!;
  const { busy, blackouts } = data.availability;
  const navigate = useNavigate();
  const create = useServerFn(createVenueBooking);
  const fetchMealPlans = useServerFn(getVenueMealPlans);

  const mealPlansQuery = useQuery({
    queryKey: ["venue-meal-plans", venue.id],
    queryFn: () => fetchMealPlans({ data: { venueId: venue.id } }),
  });

  const earliest = minVenueDate();
  const [range, setRange] = useState<DateRange | undefined>({
    from: ymdToDate(earliest),
    to: ymdToDate(earliest),
  });
  const [eventName, setEventName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [style, setStyle] = useState<string>("banquet");
  const [attendees, setAttendees] = useState(100);
  const [selectedMealPlanId, setSelectedMealPlanId] = useState<string>("none");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startDate = range?.from ? dateToYmd(range.from) : "";
  const endDate = range?.to ? dateToYmd(range.to) : startDate;
  const maxPax = maxAttendeesFor(venue, style);
  const days = startDate ? daysBetween(startDate, endDate) + 1 : 0;

  const bookedSet = useMemo(
    () => new Set(venueBlockedDates(busy, startTime, endTime)),
    [busy, startTime, endTime],
  );
  const blackoutSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of blackouts) for (const d of eachDate(b.start_date, b.end_date)) s.add(d);
    return s;
  }, [blackouts]);

  const mealPlans = mealPlansQuery.data ?? [];
  const selectedMealPlan = mealPlans.find((m) => m.id === selectedMealPlanId);
  const cateringTotal = selectedMealPlan ? selectedMealPlan.pricePerPerson * attendees : 0;
  const venueRental = venue.price * Math.max(days, 1);
  const estimatedTotal = venueRental + cateringTotal;

  const request = {
    event_name: eventName,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    attendees,
    layout_style: style,
  };
  const liveCheck = startDate
    ? validateVenueRequest({ ...request, event_name: eventName || "x" }, venue, busy, blackouts)
    : "Select your event dates.";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateVenueRequest(request, venue, busy, blackouts);
    if (err) return setError(err);
    setError(null);
    setSubmitting(true);
    try {
      const meal_plan = selectedMealPlan
        ? {
            id: selectedMealPlan.id,
            name: selectedMealPlan.name,
            pricePerPerson: selectedMealPlan.pricePerPerson,
            inclusions: selectedMealPlan.inclusions,
            servings: attendees,
            totalCost: cateringTotal,
          }
        : undefined;

      const res = await create({ data: { venue_id: venue.id, ...request, meal_plan } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success("Booking submitted. Your floor plan is ready to customize.");
      navigate({ to: "/floor-plan/$bookingId", params: { bookingId: String(res.bookingId) } });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <BookingHero
        image={venue.image_url}
        backTo="/venues"
        backLabel="All venues"
        eyebrow={venue.facility_name}
        title={venue.name}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {venue.capacity_tables} with tables, {venue.capacity}{" "}
              without
            </span>
            <span>{venue.price === 0 ? "Free" : `${formatPeso(venue.price)} per day`}</span>
          </>
        }
      />

      <form
        onSubmit={submit}
        className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]"
      >
        <div className="space-y-8">
          <StepIndicator step={1} />

          <FormMessage tone="info">
            Venue reservations need at least 7 days notice. The earliest start date is{" "}
            <b>{formatDate(earliest)}</b>.
          </FormMessage>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <Label htmlFor="event-name" className="text-base font-semibold">
              Event name or purpose
            </Label>
            <Input
              id="event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. 5th Annual Technology Summit"
              className="mt-3 h-11"
              maxLength={160}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-gold" />
              <h2 className="text-lg font-semibold">Dates</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a start date, then an end date for multi-day events.
            </p>
            <div className="mt-4 overflow-x-auto">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={range}
                onSelect={setRange}
                defaultMonth={ymdToDate(earliest)}
                disabled={(d) => {
                  const y = dateToYmd(d);
                  return y < earliest || bookedSet.has(y) || blackoutSet.has(y);
                }}
                modifiers={{
                  booked: (d) => bookedSet.has(dateToYmd(d)),
                  blackout: (d) => blackoutSet.has(dateToYmd(d)),
                }}
                modifiersClassNames={{
                  booked:
                    "[&>button]:bg-danger-soft [&>button]:text-destructive [&>button]:line-through",
                  blackout: "[&>button]:bg-warning-soft [&>button]:text-warning",
                }}
                className="rounded-xl border border-border [--cell-size:2.5rem]"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <Legend className="bg-danger-soft ring-destructive/30" label="Already reserved" />
              <Legend
                className="bg-warning-soft ring-warning/30"
                label="Unavailable (maintenance or events)"
              />
              <Legend className="bg-primary ring-primary" label="Your selection" />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-gold" />
              <h2 className="text-lg font-semibold">Daily hours</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {TIME_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => {
                    setStartTime(p.start);
                    setEndTime(p.end);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    startTime === p.start && endTime === p.end
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {p.label}{" "}
                  <span className="opacity-70">
                    {p.start} to {p.end}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Layout and guests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Setups with tables hold up to {venue.capacity_tables} guests. Theater and cocktail
              setups hold up to {venue.capacity}.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LAYOUT_STYLES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => {
                    setStyle(s.value);
                    setAttendees((a) => Math.min(a, maxAttendeesFor(venue, s.value)));
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    style === s.value
                      ? "border-primary bg-secondary ring-1 ring-primary"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-xs text-muted-foreground">
                      Max {maxAttendeesFor(venue, s.value)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.detail}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 max-w-xs space-y-2">
              <Label htmlFor="attendees">Expected guests</Label>
              <Input
                id="attendees"
                type="number"
                min={1}
                max={maxPax}
                value={attendees}
                onChange={(e) => setAttendees(Number(e.target.value))}
                className="h-11"
              />
              {attendees > maxPax && (
                <p className="text-xs text-destructive">
                  {styleUsesTables(style)
                    ? `Setups with tables allow up to ${maxPax} guests.`
                    : `Maximum is ${maxPax} guests.`}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Utensils className="size-5 text-gold" />
              <h2 className="text-lg font-semibold">Meal plans & catering packages</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an optional catering package prepared fresh on campus for your guests, or
              proceed with venue only.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedMealPlanId("none")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  selectedMealPlanId === "none"
                    ? "border-primary bg-secondary ring-1 ring-primary"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">No meal plan</span>
                  <span className="text-xs text-muted-foreground">Venue only</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  You will arrange your own food or host a non-dining event.
                </p>
              </button>

              {mealPlans.map((plan) => {
                const active = selectedMealPlanId === plan.id;
                const cost = plan.pricePerPerson * attendees;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedMealPlanId(plan.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-primary bg-secondary ring-1 ring-primary"
                        : "border-border hover:border-foreground/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-snug">{plan.name}</span>
                      <span className="font-display font-semibold text-sm text-primary shrink-0">
                        {formatPeso(plan.pricePerPerson)}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {" "}
                          / pax
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {plan.description}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {plan.inclusions.slice(0, 3).map((inc, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80"
                        >
                          <Check className="size-2.5 text-success" /> {inc}
                        </span>
                      ))}
                      {plan.inclusions.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pt-0.5">
                          +{plan.inclusions.length - 3} more
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-foreground/70">
                      Est. {formatPeso(cost)} for {attendees} guests
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            <h2 className="text-lg font-semibold">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row
                k="Dates"
                v={
                  startDate
                    ? startDate === endDate
                      ? formatDate(startDate)
                      : `${formatDate(startDate)} to ${formatDate(endDate)}`
                    : "Not selected"
                }
              />
              <Row k="Duration" v={days ? `${days} day${days > 1 ? "s" : ""}` : "-"} />
              <Row k="Hours" v={`${startTime} to ${endTime}`} />
              <Row k="Layout" v={LAYOUT_STYLES.find((s) => s.value === style)?.label ?? style} />
              <Row k="Guests" v={String(attendees || 0)} />
            </dl>

            <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Venue rental fee</dt>
                <dd className="font-medium">
                  {venue.price === 0 ? "Free (₱0.00)" : formatPeso(venueRental)}
                </dd>
              </div>
              {selectedMealPlan && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground truncate mr-2">
                    {selectedMealPlan.name} ({attendees} pax)
                  </dt>
                  <dd className="font-medium shrink-0">{formatPeso(cateringTotal)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-muted-foreground">Estimated total</span>
              <span className="font-display text-2xl font-semibold">
                {formatPeso(estimatedTotal)}
              </span>
            </div>
            <p
              className={cn(
                "mt-4 flex items-start gap-2 text-xs",
                liveCheck ? "text-warning" : "text-success",
              )}
            >
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {liveCheck ?? "These dates and hours are available."}
            </p>
            {error && (
              <div className="mt-4">
                <FormMessage tone="error">{error}</FormMessage>
              </div>
            )}
            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="mt-6 w-full"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Continue to floor plan <ArrowRight />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Requests stay pending until the venue administrator approves them.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-3 rounded ring-1 ring-inset", className)} /> {label}
    </span>
  );
}
