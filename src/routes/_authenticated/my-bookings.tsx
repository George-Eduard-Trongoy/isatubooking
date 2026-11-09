import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, CalendarDays, Clock, LayoutGrid, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageIntro, StatusBadge } from "@/components/status-badge";
import { cancelBooking, getMyBookings } from "@/lib/bookings.functions";
import { daysBetween, formatDate, formatPeso } from "@/lib/booking-rules";

const myBookingsQuery = (fn: () => ReturnType<typeof getMyBookings>) =>
  queryOptions({ queryKey: ["my-bookings"], queryFn: fn });

export const Route = createFileRoute("/_authenticated/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings | ISATU Booking" },
      { name: "description", content: "Track your venue and room reservation requests." },
      { property: "og:title", content: "My Bookings | ISATU Booking" },
      { property: "og:description", content: "Follow the status of your ISATU reservations." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myBookingsQuery(() => getMyBookings())),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const fetchMine = useServerFn(getMyBookings);
  const { data } = useSuspenseQuery(myBookingsQuery(() => fetchMine()));
  const cancel = useServerFn(cancelBooking);
  const qc = useQueryClient();

  const doCancel = async (type: "venue" | "room", id: number) => {
    const res = await cancel({ data: { type, id } });
    if (!res.ok) toast.error(res.message);
    else {
      toast.success("Booking cancelled.");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow="Your reservations"
        title="My Bookings"
        description="Follow the status of your venue and accommodation requests."
        actions={
          <>
            <Button asChild variant="gold"><Link to="/venues"><Plus /> Book a venue</Link></Button>
            <Button asChild variant="outline"><Link to="/rooms"><Plus /> Reserve a room</Link></Button>
          </>
        }
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Venue reservations</h2>
        {data.venue.length === 0 ? (
          <Empty text="No venue bookings yet." to="/venues" cta="Explore venues" />
        ) : (
          <div className="mt-4 grid gap-4">
            {data.venue.map((b) => {
              const days = daysBetween(b.booking_date, b.end_date) + 1;
              const active = b.status === "pending" || b.status === "approved";
              return (
                <article key={b.id} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold">{b.event_name}</h3>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{b.venue_name} · {b.facility_name}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{b.booking_date === b.end_date ? formatDate(b.booking_date) : `${formatDate(b.booking_date)} to ${formatDate(b.end_date)}`} ({days} day{days > 1 ? "s" : ""})</span>
                      <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{b.start_time} to {b.end_time}</span>
                      <span className="inline-flex items-center gap-1.5"><Users className="size-4" />{b.attendees} guests</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link to="/floor-plan/$bookingId" params={{ bookingId: String(b.id) }}><LayoutGrid /> Floor plan</Link>
                    </Button>
                    {active && <CancelButton onConfirm={() => doCancel("venue", b.id)} />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Room reservations</h2>
        {data.room.length === 0 ? (
          <Empty text="No room reservations yet." to="/rooms" cta="Browse rooms" />
        ) : (
          <div className="mt-4 grid gap-4">
            {data.room.map((b) => {
              const nights = Math.max(1, daysBetween(b.check_in, b.check_out));
              const active = b.status === "pending" || b.status === "approved";
              return (
                <article key={b.id} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft md:flex-row md:items-center">
                  <span className="hidden size-12 shrink-0 place-items-center rounded-xl bg-secondary md:grid"><BedDouble className="size-5" /></span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold">Room {b.room_number}</h3>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{b.room_type} · {b.facility_name}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDate(b.check_in)} to {formatDate(b.check_out)} ({nights} night{nights > 1 ? "s" : ""})</span>
                      <span>{b.guests} guest{b.guests > 1 ? "s" : ""}</span>
                      <span>{formatPeso(b.price_per_night * nights)}</span>
                    </div>
                    {b.special_orders && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">{b.special_orders}</p>}
                  </div>
                  {active && <CancelButton onConfirm={() => doCancel("room", b.id)} />}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CancelButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:bg-danger-soft hover:text-destructive">Cancel</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>The dates will be released for other guests. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel booking</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Empty({ text, to, cta }: { text: string; to: "/venues" | "/rooms"; cta: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="link"><Link to={to}>{cta}</Link></Button>
    </div>
  );
}
