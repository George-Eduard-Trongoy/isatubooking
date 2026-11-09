import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BedDouble, CalendarCheck2, LayoutGrid, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listFacilities, listRooms, listVenues } from "@/lib/catalog.functions";
import { formatPeso } from "@/lib/booking-rules";

const HERO = "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2000&q=80";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [facilities, venues, rooms] = await Promise.all([listFacilities(), listVenues(), listRooms()]);
    return { facilities, venues, rooms };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ISATU Booking | Reserve University Venues and Guest Rooms" },
      {
        name: "description",
        content: "Book the HRT Grand Auditorium, the TLE Convention Hall, and 11 campus guest rooms at Iloilo Science and Technology University.",
      },
      { property: "og:title", content: "ISATU Booking | Reserve University Venues and Guest Rooms" },
      {
        property: "og:description",
        content: "Book event venues with a custom floor plan, or reserve campus accommodation at the HRT Center and TLE Service Center.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: HERO },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: HERO },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const minRoom = Math.min(...data.rooms.map((r) => r.price_per_night));

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img src={HERO} alt="Grand auditorium set for a university event" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-hero-fade" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 md:pb-28 md:pt-40">
          <div className="max-w-3xl animate-rise">
            <p className="eyebrow text-gold">Iloilo Science and Technology University</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] text-ink-foreground md:text-6xl">
              University venues and guest rooms, booked in minutes.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-foreground/80 md:text-lg">
              Reserve conference halls with a floor plan tailored to your event, or stay on campus at the HRT
              Center and TLE Service Center.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="gold" size="lg">
                <Link to="/venues">
                  Explore venues <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link to="/rooms">Browse {data.rooms.length} rooms</Link>
              </Button>
            </div>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-xl bg-ink-foreground/15 ring-1 ring-ink-foreground/15 backdrop-blur-md">
            {[
              { k: "Event venues", v: String(data.venues.length) },
              { k: "Guest rooms", v: String(data.rooms.length) },
              { k: "Max capacity", v: "150 guests" },
            ].map((s) => (
              <div key={s.k} className="bg-ink/40 px-5 py-4">
                <dt className="text-xs font-medium text-ink-foreground/70">{s.k}</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-ink-foreground md:text-2xl">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Facilities */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-gold">Facilities</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Two centers, one booking portal</h2>
          </div>
          <p className="max-w-md text-muted-foreground">
            Each facility offers a premier event space and dedicated campus accommodation, managed by its own
            administration team.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {data.facilities.map((f) => {
            const venue = data.venues.find((v) => v.facility_id === f.id);
            const rooms = data.rooms.filter((r) => r.facility_id === f.id);
            return (
              <article key={f.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={venue?.image_url || HERO}
                    alt={f.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-card-fade" />
                  <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-bold tracking-wide text-foreground backdrop-blur">
                    {f.code}
                  </span>
                  <h3 className="absolute bottom-4 left-5 text-2xl font-semibold text-ink-foreground">{f.name}</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground">Event venue</p>
                      <p className="mt-0.5 font-semibold">{venue ? formatPeso(venue.price) : "None"} / day</p>
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground">Guest rooms</p>
                      <p className="mt-0.5 font-semibold">{rooms.length} rooms available</p>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button asChild variant="default">
                      <Link to="/venues">Book the venue</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/rooms" search={{ facility: f.code === "HRT" ? "hrt" : "tle" }}>
                        View rooms
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-4">
          {[
            { icon: CalendarCheck2, t: "Live availability", d: "Calendars show booked and blocked dates before you submit." },
            { icon: LayoutGrid, t: "Floor plan designer", d: "Every venue booking comes with an editable 2D layout." },
            { icon: BedDouble, t: `Rooms from ${formatPeso(minRoom)}`, d: "Comfortable campus stays with special requests." },
            { icon: ShieldCheck, t: "Facility-scoped admins", d: "Each center reviews and approves its own requests." },
          ].map((f) => (
            <div key={f.t}>
              <span className="grid size-11 place-items-center rounded-xl bg-card text-gold ring-1 ring-border">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-ink px-8 py-14 md:px-14">
          <div className="max-w-xl">
            <Users className="size-7 text-gold" />
            <h2 className="mt-5 text-3xl font-semibold text-ink-foreground">Planning an event or a visit?</h2>
            <p className="mt-3 text-ink-foreground/75">
              Create a free guest account to submit requests and follow their approval status.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg">
              <Link to="/register">Create a guest account</Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
