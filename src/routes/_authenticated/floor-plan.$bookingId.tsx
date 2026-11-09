import { ClientOnly, createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { ArrowLeft, CalendarDays, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { StepIndicator } from "@/components/booking-hero";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { getFloorPlanBooking, saveFloorPlan } from "@/lib/bookings.functions";
import { LAYOUT_STYLES, formatDate } from "@/lib/booking-rules";

const FloorPlanEditor = lazy(() => import("@/components/floor-plan-editor"));

const planQuery = (id: number) =>
  queryOptions({ queryKey: ["floor-plan", id], queryFn: () => getFloorPlanBooking({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/floor-plan/$bookingId")({
  head: () => ({
    meta: [
      { title: "Floor plan designer | ISATU Booking" },
      { name: "description", content: "Arrange tables, seating and stage equipment for your event." },
      { property: "og:title", content: "Floor plan designer | ISATU Booking" },
      { property: "og:description", content: "Customize the 2D floor plan for your venue booking." },
    ],
  }),
  loader: async ({ context, params }) => {
    const id = Number(params.bookingId);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const data = await context.queryClient.ensureQueryData(planQuery(id));
    if (!data) throw notFound();
  },
  component: FloorPlanPage,
});

function FloorPlanPage() {
  const { bookingId } = Route.useParams();
  const id = Number(bookingId);
  const { data } = useSuspenseQuery(planQuery(id));
  const b = data!;
  const save = useServerFn(saveFloorPlan);
  const qc = useQueryClient();
  const { isStaff } = useAuth();

  const onSave = async (plan: { style: string; items: unknown[] }) => {
    const res = await save({ data: { id, style: plan.style, items: plan.items } });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    toast.success("Floor plan saved.");
    qc.invalidateQueries({ queryKey: ["floor-plan", id] });
    return true;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to={isStaff ? "/admin" : "/my-bookings"} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {isStaff ? "Back to dashboard" : "Back to my bookings"}
        </Link>
        <StepIndicator step={2} />
      </div>

      <header className="mt-6 flex flex-col gap-4 rounded-2xl bg-gradient-ink p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow text-gold">{b.venue.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink-foreground md:text-3xl">{b.event_name}</h1>
            <StatusBadge status={b.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-foreground/80">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{b.booking_date === b.end_date ? formatDate(b.booking_date) : `${formatDate(b.booking_date)} to ${formatDate(b.end_date)}`}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{b.start_time} to {b.end_time}</span>
          <span className="inline-flex items-center gap-1.5"><Users className="size-4" />{b.attendees} guests · {LAYOUT_STYLES.find((s) => s.value === b.layout_type)?.label ?? b.layout_type}</span>
        </div>
      </header>

      <p className="mt-5 text-sm text-muted-foreground">
        This layout was generated from your booking details. Move, rotate, add or remove items, then save to share it with the venue team.
      </p>

      <div className="mt-6">
        <ClientOnly fallback={<EditorSkeleton />}>
          <Suspense fallback={<EditorSkeleton />}>
            <FloorPlanEditor
              initial={b.plan}
              venue={b.venue}
              attendees={b.attendees}
              canEdit={b.canEdit}
              onSave={onSave}
              fileName={`floor-plan-booking-${b.id}`}
            />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return <div className="h-[620px] animate-pulse rounded-2xl border border-border bg-surface" />;
}
