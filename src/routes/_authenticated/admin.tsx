import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  BedDouble,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  Download,
  FileText,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, PageIntro, PaymentBadge, StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/hooks/use-auth";
import {
  addBlackout,
  createUser,
  deleteBlackout,
  deleteUser,
  getAdminDashboard,
  listUsers,
  updateBookingStatus,
  updateCatalogItem,
  updateUser,
  type ManagedUser,
} from "@/lib/admin.functions";
import {
  listDocumentRequirements,
  removeDocumentRequirement,
  saveDocumentRequirement,
  type ManagedRequirement,
} from "@/lib/documents.functions";
import { deleteMealPlan, listAdminMealPlans, saveMealPlan, type MealPlan } from "@/lib/meal-plans";
import {
  BOOKING_STATUSES,
  daysBetween,
  eachDate,
  formatDate,
  formatPeso,
} from "@/lib/booking-rules";
import { roleLabel, type AppRole } from "@/lib/identity";
import { dateToYmd, ymdToDate } from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration | ISATU Booking" },
      {
        name: "description",
        content: "Review booking requests and manage venues, rooms, dates, documents and accounts.",
      },
      { property: "og:title", content: "Administration | ISATU Booking" },
      { property: "og:description", content: "Facility administration portal." },
    ],
  }),
  component: AdminPage,
});

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

function AdminPage() {
  const { me, meLoading, isStaff } = useAuth();
  const fetchDash = useServerFn(getAdminDashboard);
  const dash = useQuery(
    queryOptions({ queryKey: ["admin-dashboard"], queryFn: () => fetchDash(), enabled: isStaff }),
  );

  if (meLoading || (isStaff && dash.isLoading)) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldAlert className="mx-auto size-8 text-gold" />
        <h1 className="mt-4 text-2xl font-semibold">Administrators only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have access to the administration portal.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }
  if (dash.isError || !dash.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">
        The dashboard could not load. Please refresh.
      </div>
    );
  }

  const d = dash.data;
  const superAdmin = me?.role === "admin";
  const facility = d.facilities.find((f) => f.id === d.scope.facilityId);
  const pending =
    d.venueBookings.filter((b) => b.status === "pending").length +
    d.roomBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow={
          superAdmin ? "System administration" : `${facility?.name ?? "Facility"} administration`
        }
        title={`Welcome, ${me?.full_name ?? "Administrator"}`}
        description={
          superAdmin
            ? "You manage every venue, room, document, meal plan and account across the university."
            : `You manage bookings, dates, documents, meal plans and listings for ${facility?.name ?? "your facility"}.`
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ClipboardList} label="Pending requests" value={pending} highlight />
        <Stat icon={LayoutGrid} label="Venue bookings" value={d.venueBookings.length} />
        <Stat icon={BedDouble} label="Room bookings" value={d.roomBookings.length} />
        <Stat icon={CalendarOff} label="Blocked date ranges" value={d.blackouts.length} />
      </div>

      <Tabs defaultValue="bookings" className="mt-10">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="bookings" className="px-4 py-2">
            Booking requests
          </TabsTrigger>
          <TabsTrigger value="blackouts" className="px-4 py-2">
            Unavailable dates
          </TabsTrigger>
          <TabsTrigger value="documents" className="px-4 py-2">
            Venue documents
          </TabsTrigger>
          <TabsTrigger value="meals" className="px-4 py-2">
            Meal plans
          </TabsTrigger>
          <TabsTrigger value="catalog" className="px-4 py-2">
            Photos and details
          </TabsTrigger>
          <TabsTrigger value="users" className="px-4 py-2">
            Accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-6">
          <BookingsPanel d={d} />
        </TabsContent>
        <TabsContent value="blackouts" className="mt-6">
          <BlackoutsPanel d={d} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsPanel d={d} />
        </TabsContent>
        <TabsContent value="meals" className="mt-6">
          <MealPlansPanel d={d} />
        </TabsContent>
        <TabsContent value="catalog" className="mt-6">
          <CatalogPanel d={d} />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel
            facilities={d.facilities}
            selfId={me!.id}
            superAdmin={superAdmin}
            facilityId={d.scope.facilityId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl bg-gradient-ink p-5"
          : "rounded-2xl border border-border bg-card p-5 shadow-soft"
      }
    >
      <Icon className={highlight ? "size-5 text-gold" : "size-5 text-muted-foreground"} />
      <p
        className={
          highlight
            ? "mt-4 font-display text-3xl font-semibold text-ink-foreground"
            : "mt-4 font-display text-3xl font-semibold"
        }
      >
        {value}
      </p>
      <p className={highlight ? "text-sm text-ink-foreground/70" : "text-sm text-muted-foreground"}>
        {label}
      </p>
    </div>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
}

function StatusSelect({
  type,
  id,
  status,
}: {
  type: "venue" | "room";
  id: number;
  status: string;
}) {
  const update = useServerFn(updateBookingStatus);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  return (
    <Select
      value={status}
      disabled={busy}
      onValueChange={async (v) => {
        setBusy(true);
        const res = await update({ data: { type, id, status: v } });
        setBusy(false);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(`Booking #${id} marked ${v}.`);
        refresh();
      }}
    >
      <SelectTrigger className="h-8 w-32 text-xs capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BOOKING_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full min-w-[860px] text-sm">{children}</table>
    </div>
  );
}
const th =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const td = "px-4 py-4 align-top";

function BookingsPanel({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Venue requests</h2>
        {d.venueBookings.length === 0 ? (
          <EmptyRow text="No venue requests yet." />
        ) : (
          <div className="mt-4">
            <TableShell>
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className={th}>Client</th>
                  <th className={th}>Event</th>
                  <th className={th}>Schedule</th>
                  <th className={th}>Guests</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.venueBookings.map((b) => {
                  const days = daysBetween(b.booking_date, b.end_date) + 1;
                  return (
                    <tr key={b.id}>
                      <td className={td}>
                        <p className="font-semibold">{b.client.name}</p>
                        <p className="text-xs text-muted-foreground">{b.client.contact}</p>
                      </td>
                      <td className={td}>
                        <p className="font-medium">{b.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.venue_name} · {b.layout_type}
                        </p>
                      </td>
                      <td className={td}>
                        <p>
                          {b.booking_date === b.end_date
                            ? formatDate(b.booking_date)
                            : `${formatDate(b.booking_date)} to ${formatDate(b.end_date)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.start_time} to {b.end_time} · {days} day{days > 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className={td}>{b.attendees}</td>
                      <td className={td}>
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={b.status} />
                          <StatusSelect type="venue" id={b.id} status={b.status} />
                        </div>
                      </td>
                      <td className={td}>
                        <div className="flex flex-col gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/floor-plan/$bookingId" params={{ bookingId: String(b.id) }}>
                              <LayoutGrid /> Floor plan
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant={b.documents.pending > 0 ? "gold" : "outline"}
                          >
                            <Link to="/documents/$bookingId" params={{ bookingId: String(b.id) }}>
                              <FileText /> Documents{" "}
                              {b.documents.total > 0 &&
                                `${b.documents.approved}/${b.documents.total}`}
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold">Room requests</h2>
        {d.roomBookings.length === 0 ? (
          <EmptyRow text="No room requests yet." />
        ) : (
          <div className="mt-4">
            <TableShell>
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className={th}>Client</th>
                  <th className={th}>Room</th>
                  <th className={th}>Stay</th>
                  <th className={th}>Guests</th>
                  <th className={th}>Requests</th>
                  <th className={th}>Payment</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.roomBookings.map((b) => {
                  const nights = Math.max(1, daysBetween(b.check_in, b.check_out));
                  return (
                    <tr key={b.id}>
                      <td className={td}>
                        <p className="font-semibold">{b.client.name}</p>
                        <p className="text-xs text-muted-foreground">{b.client.contact}</p>
                      </td>
                      <td className={td}>
                        <p className="font-medium">Room {b.room_number}</p>
                        <p className="text-xs text-muted-foreground">{b.room_type}</p>
                      </td>
                      <td className={td}>
                        <p>
                          {formatDate(b.check_in)} to {formatDate(b.check_out)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {nights} night{nights > 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className={td}>{b.guests}</td>
                      <td className={`${td} max-w-60 text-xs text-muted-foreground`}>
                        {b.special_orders || "None"}
                      </td>
                      <td className={td}>
                        <PaymentBadge status={b.payment_status} />
                        <p className="mt-1.5 text-xs">
                          {formatPeso(b.amount_paid)} of {formatPeso(b.amount_due)}
                        </p>
                        {b.payment_reference && (
                          <p className="text-xs text-muted-foreground">{b.payment_reference}</p>
                        )}
                      </td>
                      <td className={td}>
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={b.status} />
                          <StatusSelect type="room" id={b.id} status={b.status} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function BlackoutsPanel({ d }: { d: Dashboard }) {
  const add = useServerFn(addBlackout);
  const remove = useServerFn(deleteBlackout);
  const refresh = useRefresh();
  const [venueId, setVenueId] = useState<string>(String(d.venues[0]?.id ?? ""));
  const [range, setRange] = useState<DateRange | undefined>();
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const currentVenue = d.venues.find((v) => String(v.id) === venueId);
  const venueBlackouts = d.blackouts.filter((b) => String(b.venue_id) === venueId);

  // Blacked out dates set for this venue
  const blackoutSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of venueBlackouts) {
      for (const date of eachDate(b.start_date, b.end_date)) {
        set.add(date);
      }
    }
    return set;
  }, [venueBlackouts]);

  const startDate = range?.from ? dateToYmd(range.from) : manualStart;
  const endDate = range?.to ? dateToYmd(range.to) : manualEnd || startDate;

  const handleSelectRange = (selected: DateRange | undefined) => {
    setRange(selected);
    if (selected?.from) setManualStart(dateToYmd(selected.from));
    if (selected?.to) setManualEnd(dateToYmd(selected.to));
    else if (selected?.from) setManualEnd(dateToYmd(selected.from));
  };

  const applyQuickPreset = (daysAhead: number, durationDays: number) => {
    const startD = new Date();
    startD.setDate(startD.getDate() + daysAhead);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + durationDays - 1);
    setRange({ from: startD, to: endD });
    setManualStart(dateToYmd(startD));
    setManualEnd(dateToYmd(endD));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId || !startDate) {
      toast.error("Choose a venue and select dates on the calendar.");
      return;
    }
    setBusy(true);
    const res = await add({
      data: {
        venue_id: Number(venueId),
        start_date: startDate,
        end_date: endDate || startDate,
        reason: reason.trim() || "Scheduled maintenance",
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Dates blocked for booking.");
    setRange(undefined);
    setManualStart("");
    setManualEnd("");
    setReason("");
    refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Unavailable dates & blackout periods</h2>
          <p className="text-sm text-muted-foreground">
            Block out specific dates or maintenance periods on the calendar so guests cannot reserve
            them.
          </p>
        </div>
        <div className="w-64">
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectContent>
              {d.venues.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[440px_1fr]">
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-gold" />
            <h3 className="font-semibold">Interactive calendar blackout picker</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Click on a date or drag across a date range on the calendar to select blocked dates for{" "}
            <b>{currentVenue?.name}</b>.
          </p>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface p-2">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleSelectRange}
              modifiers={{
                blackout: (date) => blackoutSet.has(dateToYmd(date)),
              }}
              modifiersClassNames={{
                blackout:
                  "[&>button]:bg-warning-soft [&>button]:text-warning font-semibold ring-1 ring-warning/50",
              }}
              className="mx-auto"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Quick select:</span>
            <button
              type="button"
              onClick={() => applyQuickPreset(1, 1)}
              className="rounded-full border border-border px-2.5 py-1 hover:bg-muted font-medium"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset(3, 2)}
              className="rounded-full border border-border px-2.5 py-1 hover:bg-muted font-medium"
            >
              Weekend (2d)
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset(7, 5)}
              className="rounded-full border border-border px-2.5 py-1 hover:bg-muted font-medium"
            >
              Next week (5d)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bo-start" className="text-xs">
                Start date
              </Label>
              <Input
                id="bo-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setManualStart(e.target.value);
                  setRange(
                    e.target.value
                      ? {
                          from: ymdToDate(e.target.value),
                          to: endDate ? ymdToDate(endDate) : undefined,
                        }
                      : undefined,
                  );
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bo-end" className="text-xs">
                End date
              </Label>
              <Input
                id="bo-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setManualEnd(e.target.value);
                  setRange(
                    startDate
                      ? { from: ymdToDate(startDate), to: ymdToDate(e.target.value) }
                      : undefined,
                  );
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bo-reason" className="text-xs">
              Reason for blackout
            </Label>
            <Input
              id="bo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Electrical maintenance, campus event, holidays"
              maxLength={200}
            />
          </div>

          <Button type="submit" className="w-full" variant="gold" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Block selected dates
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Current blocked dates for {currentVenue?.name}</h3>
            <span className="text-xs text-muted-foreground">
              {venueBlackouts.length} active blackout(s)
            </span>
          </div>

          {venueBlackouts.length === 0 ? (
            <EmptyRow text={`No dates are currently blocked for ${currentVenue?.name}.`} />
          ) : (
            <div className="grid gap-3">
              {venueBlackouts.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:border-gold/50"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-warning-soft text-warning">
                    <CalendarOff className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {b.start_date === b.end_date
                        ? formatDate(b.start_date)
                        : `${formatDate(b.start_date)} to ${formatDate(b.end_date)}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.venue_name} · {b.reason}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove blackout"
                    onClick={async () => {
                      const res = await remove({ data: { id: b.id } });
                      if (!res.ok) {
                        toast.error(res.message);
                        return;
                      }
                      toast.success("Dates are bookable again.");
                      refresh();
                    }}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Venue Document Requirements Management ----------

function DocumentsPanel({ d }: { d: Dashboard }) {
  const fetchDocs = useServerFn(listDocumentRequirements);
  const removeDoc = useServerFn(removeDocumentRequirement);
  const qc = useQueryClient();
  const docsQuery = useQuery({ queryKey: ["admin-documents"], queryFn: () => fetchDocs() });
  const [selectedVenueId, setSelectedVenueId] = useState<string>(String(d.venues[0]?.id ?? ""));
  const [editingDoc, setEditingDoc] = useState<ManagedRequirement | "new" | null>(null);

  if (docsQuery.isLoading) {
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  const requirements = (docsQuery.data?.requirements ?? []).filter(
    (r) => String(r.venue_id) === selectedVenueId,
  );
  const currentVenue = d.venues.find((v) => String(v.id) === selectedVenueId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Required venue booking documents</h2>
          <p className="text-sm text-muted-foreground">
            Configure the required paperwork, permits, and downloadable forms clients must submit
            when booking a venue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose a venue" />
            </SelectTrigger>
            <SelectContent>
              {d.venues.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="gold" onClick={() => setEditingDoc("new")}>
            <Plus /> Add required document
          </Button>
        </div>
      </div>

      {requirements.length === 0 ? (
        <EmptyRow text={`No document requirements configured for ${currentVenue?.name}.`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requirements.map((req) => (
            <div
              key={req.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-lift"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary font-bold text-xs">
                      #{req.sort_order}
                    </span>
                    <h3 className="font-semibold text-base leading-snug">{req.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  {req.description || "No specific instructions provided."}
                </p>
                {req.template_name && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface border border-border p-2.5 text-xs text-muted-foreground">
                    <FileText className="size-4 shrink-0 text-gold" />
                    <span className="truncate flex-1 font-medium text-foreground">
                      {req.template_name}
                    </span>
                    {req.template_url && (
                      <a
                        href={req.template_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline shrink-0"
                      >
                        <Download className="size-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button size="sm" variant="outline" onClick={() => setEditingDoc(req)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-danger-soft"
                  onClick={async () => {
                    if (!window.confirm(`Remove "${req.title}" requirement?`)) return;
                    const res = await removeDoc({ data: { id: req.id } });
                    if (!res.ok) {
                      toast.error(res.message);
                      return;
                    }
                    toast.success("Document requirement removed.");
                    qc.invalidateQueries({ queryKey: ["admin-documents"] });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingDoc && (
        <DocumentDialog
          requirement={editingDoc === "new" ? null : editingDoc}
          venueId={Number(selectedVenueId)}
          venueName={currentVenue?.name ?? "Venue"}
          onClose={() => setEditingDoc(null)}
        />
      )}
    </div>
  );
}

function DocumentDialog({
  requirement,
  venueId,
  venueName,
  onClose,
}: {
  requirement: ManagedRequirement | null;
  venueId: number;
  venueName: string;
  onClose: () => void;
}) {
  const save = useServerFn(saveDocumentRequirement);
  const qc = useQueryClient();
  const [title, setTitle] = useState(requirement?.title ?? "");
  const [description, setDescription] = useState(requirement?.description ?? "");
  const [templateName, setTemplateName] = useState(requirement?.template_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the document.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await save({
        data: {
          id: requirement?.id,
          venueId,
          title: title.trim(),
          description: description.trim(),
          templateName: templateName.trim() || undefined,
        },
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(requirement ? "Document requirement updated." : "Document requirement added.");
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      onClose();
    } catch {
      setError("Failed to save. Please check inputs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {requirement ? "Edit document requirement" : "Add required document"}
          </DialogTitle>
          <DialogDescription>
            For {venueName}. Clients must submit this before event approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dean's Endorsement Letter, Security Undertaking"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-desc">Instructions for client</Label>
            <Textarea
              id="doc-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State what needs to be signed, noted, or included..."
              maxLength={600}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-tmpl">Form / Template Name (optional)</Label>
            <Input
              id="doc-tmpl"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Letter-of-Request-Template.pdf"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Name of the official downloadable soft copy document given to the client.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}{" "}
              {requirement ? "Save changes" : "Add requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Venue Meal Plans Management ----------

function MealPlansPanel({ d }: { d: Dashboard }) {
  const fetchMeals = useServerFn(listAdminMealPlans);
  const deleteMeal = useServerFn(deleteMealPlan);
  const qc = useQueryClient();
  const mealsQuery = useQuery({ queryKey: ["admin-meal-plans"], queryFn: () => fetchMeals() });
  const [selectedVenueId, setSelectedVenueId] = useState<string>(String(d.venues[0]?.id ?? ""));
  const [editingMeal, setEditingMeal] = useState<MealPlan | "new" | null>(null);

  if (mealsQuery.isLoading) {
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  const plans = (mealsQuery.data ?? []).filter((p) => String(p.venueId) === selectedVenueId);
  const currentVenue = d.venues.find((v) => String(v.id) === selectedVenueId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Available meal plans & catering options</h2>
          <p className="text-sm text-muted-foreground">
            Manage catering and meal packages available for event organizers booking this venue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose a venue" />
            </SelectTrigger>
            <SelectContent>
              {d.venues.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="gold" onClick={() => setEditingMeal("new")}>
            <Utensils className="size-4" /> Add meal plan
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyRow text={`No meal plans configured for ${currentVenue?.name}.`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-lift"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-display font-semibold text-primary">
                  {formatPeso(p.pricePerPerson)}
                  <span className="text-xs font-normal text-muted-foreground"> / person</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Menu inclusions:</p>
                  <ul className="list-inside list-disc text-xs text-foreground/80 space-y-0.5">
                    {p.inclusions.map((inc, i) => (
                      <li key={i}>{inc}</li>
                    ))}
                  </ul>
                </div>
                {p.minAttendees && (
                  <p className="mt-3 text-[11px] text-muted-foreground font-medium">
                    Min. {p.minAttendees} guests required
                  </p>
                )}
              </div>
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button size="sm" variant="outline" onClick={() => setEditingMeal(p)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-danger-soft"
                  onClick={async () => {
                    if (!window.confirm(`Delete the "${p.name}" meal plan?`)) return;
                    const res = await deleteMeal({ data: { id: p.id } });
                    if (!res.ok) {
                      toast.error(res.message);
                      return;
                    }
                    toast.success("Meal plan deleted.");
                    qc.invalidateQueries({ queryKey: ["admin-meal-plans"] });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingMeal && (
        <MealPlanDialog
          plan={editingMeal === "new" ? null : editingMeal}
          venueId={Number(selectedVenueId)}
          venueName={currentVenue?.name ?? "Venue"}
          onClose={() => setEditingMeal(null)}
        />
      )}
    </div>
  );
}

function MealPlanDialog({
  plan,
  venueId,
  venueName,
  onClose,
}: {
  plan: MealPlan | null;
  venueId: number;
  venueName: string;
  onClose: () => void;
}) {
  const save = useServerFn(saveMealPlan);
  const qc = useQueryClient();
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(String(plan?.pricePerPerson ?? 300));
  const [description, setDescription] = useState(plan?.description ?? "");
  const [inclusionsText, setInclusionsText] = useState(plan?.inclusions.join("\n") ?? "");
  const [minAttendees, setMinAttendees] = useState(String(plan?.minAttendees ?? 20));
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for the meal plan.");
      return;
    }
    const inclusions = inclusionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (inclusions.length === 0) {
      setError("Please add at least one menu inclusion.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await save({
        data: {
          id: plan?.id,
          venueId,
          name: name.trim(),
          pricePerPerson: Number(price),
          description: description.trim(),
          inclusions,
          active,
          minAttendees: Number(minAttendees) || undefined,
        },
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(plan ? "Meal plan updated." : "Meal plan added.");
      qc.invalidateQueries({ queryKey: ["admin-meal-plans"] });
      onClose();
    } catch {
      setError("Failed to save meal plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "Add meal plan"}</DialogTitle>
          <DialogDescription>Catering package for {venueName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="space-y-2">
            <Label htmlFor="meal-name">Plan Name</Label>
            <Input
              id="meal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Executive Buffet"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="meal-price">Price per Person (PHP)</Label>
              <Input
                id="meal-price"
                type="number"
                min={0}
                step="10"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-min">Min. Attendees</Label>
              <Input
                id="meal-min"
                type="number"
                min={1}
                value={minAttendees}
                onChange={(e) => setMinAttendees(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meal-desc">Description</Label>
            <Input
              id="meal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Full course buffet with appetizers, mains, and desserts."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meal-inc">Menu inclusions (one per line)</Label>
            <Textarea
              id="meal-inc"
              rows={4}
              value={inclusionsText}
              onChange={(e) => setInclusionsText(e.target.value)}
              placeholder="Steamed Fragrant Rice&#10;Roast Chicken Rosemary&#10;Creamy Fish Fillet&#10;Fresh Garden Salad&#10;Chilled Fruit Salad&#10;Iced Tea & Mineral Water"
              required
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="meal-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <Label htmlFor="meal-active" className="text-sm cursor-pointer">
              Active and selectable by event organizers
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}{" "}
              {plan ? "Save changes" : "Create meal plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CatalogTarget = {
  type: "venue" | "room";
  id: number;
  title: string;
  image_url: string;
  price: number;
  capacity: number;
  description?: string;
};

function CatalogPanel({ d }: { d: Dashboard }) {
  const [editing, setEditing] = useState<CatalogTarget | null>(null);
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Venues</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {d.venues.map((v) => (
            <CatalogCard
              key={v.id}
              image={v.image_url}
              title={v.name}
              sub={`${formatPeso(v.price)} per day · ${v.capacity} max`}
              onEdit={() =>
                setEditing({
                  type: "venue",
                  id: v.id,
                  title: v.name,
                  image_url: v.image_url,
                  price: v.price,
                  capacity: v.capacity,
                  description: v.description,
                })
              }
            />
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Rooms</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.rooms.map((r) => (
            <CatalogCard
              key={r.id}
              image={r.image_url}
              title={`Room ${r.room_number}`}
              sub={`${r.type_name} · ${formatPeso(r.price_per_night)} per night · ${r.capacity} guests`}
              onEdit={() =>
                setEditing({
                  type: "room",
                  id: r.id,
                  title: `Room ${r.room_number}`,
                  image_url: r.image_url,
                  price: r.price_per_night,
                  capacity: r.capacity,
                })
              }
            />
          ))}
        </div>
      </div>
      {editing && <CatalogDialog target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CatalogCard({
  image,
  title,
  sub,
  onEdit,
}: {
  image: string;
  title: string;
  sub: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
      {image ? (
        <img src={image} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-muted">
          <ImageIcon className="text-muted-foreground" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit ${title}`}>
        <Pencil />
      </Button>
    </div>
  );
}

function CatalogDialog({ target, onClose }: { target: CatalogTarget; onClose: () => void }) {
  const save = useServerFn(updateCatalogItem);
  const refresh = useRefresh();
  const [image, setImage] = useState(target.image_url);
  const [price, setPrice] = useState(String(target.price));
  const [capacity, setCapacity] = useState(String(target.capacity));
  const [description, setDescription] = useState(target.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await save({
        data: {
          type: target.type,
          id: target.id,
          image_url: image.trim(),
          price: Number(price),
          capacity: Number(capacity),
          description: target.type === "venue" ? description : undefined,
        },
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(`${target.title} updated.`);
      refresh();
      onClose();
    } catch {
      setError("Check the photo link, price and capacity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {target.title}</DialogTitle>
          <DialogDescription>Update the photo and listing details guests see.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          {image && (
            <img src={image} alt="" className="aspect-video w-full rounded-lg object-cover" />
          )}
          <div className="space-y-2">
            <Label htmlFor="cat-img">Photo link</Label>
            <Input
              id="cat-img"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-price">
                {target.type === "venue" ? "Daily rate (PHP)" : "Nightly rate (PHP)"}
              </Label>
              <Input
                id="cat-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-cap">Capacity</Label>
              <Input
                id="cat-cap"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          {target.type === "venue" && (
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Accounts ----------

function UsersPanel({
  facilities,
  selfId,
  superAdmin,
}: {
  facilities: Dashboard["facilities"];
  selfId: string;
  superAdmin: boolean;
  facilityId: number | null;
}) {
  const fetchUsers = useServerFn(listUsers);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const remove = useServerFn(deleteUser);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);

  if (users.isLoading)
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (!users.data) return <EmptyRow text="Accounts could not load." />;
  const fcode = (id: number | null) => facilities.find((f) => f.id === id)?.code ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          All administrators can create, edit, and manage accounts. Staff sign in with a username;
          guests sign in with their email address.
        </p>
        <Button variant="gold" onClick={() => setEditing("new")}>
          <UserPlus /> Add account
        </Button>
      </div>
      <TableShell>
        <thead className="border-b border-border bg-surface">
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Sign-in</th>
            <th className={th}>Role</th>
            <th className={th}>Joined</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.data.users.map((u) => {
            const canEdit = superAdmin || u.role !== "admin" || u.id === selfId;
            const canDelete = u.id !== selfId && (superAdmin || u.role !== "admin");
            return (
              <tr key={u.id}>
                <td className={td}>
                  <p className="font-semibold">{u.full_name}</p>
                </td>
                <td className={td}>
                  {u.email ?? <span className="font-mono text-xs">{u.username}</span>}
                </td>
                <td className={td}>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {roleLabel(u.role, fcode(u.facility_id))}
                  </span>
                </td>
                <td className={`${td} text-muted-foreground`}>
                  {formatDate(u.created_at.slice(0, 10))}
                </td>
                <td className={`${td} text-right`}>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(u)}
                      aria-label="Edit account"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete account"
                      onClick={async () => {
                        if (!window.confirm(`Delete the account for ${u.full_name}?`)) return;
                        const res = await remove({ data: { id: u.id } });
                        if (!res.ok) {
                          toast.error(res.message);
                          return;
                        }
                        toast.success("Account deleted.");
                        qc.invalidateQueries({ queryKey: ["admin-users"] });
                      }}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      {users.data.pendingImported.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6">
          <h3 className="font-semibold">Guests from the previous system</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            These guests keep their bookings. They will appear above once they register with the
            same email address and confirm it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {users.data.pendingImported.map((g) => (
              <span key={g.id} className="rounded-full bg-muted px-3 py-1 text-xs">
                {g.full_name} · {g.email}
              </span>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          facilities={facilities}
          selfId={selfId}
          superAdmin={superAdmin}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function UserDialog({
  user,
  facilities,
  selfId,
  superAdmin,
  onClose,
}: {
  user: ManagedUser | null;
  facilities: Dashboard["facilities"];
  selfId: string;
  superAdmin: boolean;
  onClose: () => void;
}) {
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [role, setRole] = useState<AppRole>(user?.role ?? "venue_admin");
  const [facilityId, setFacilityId] = useState<string>(
    String(user?.facility_id ?? facilities[0]?.id ?? "1"),
  );
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesUsername = user ? !user.email : role !== "guest";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      full_name: fullName,
      role,
      facility_id: role === "venue_admin" ? Number(facilityId) : null,
      username: usesUsername ? username : undefined,
      email: !usesUsername ? email : undefined,
      password: password || undefined,
    };
    try {
      const res = user
        ? await update({ data: { ...payload, id: user.id } })
        : await create({ data: payload });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(user ? "Account updated." : "Account created.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    } catch {
      setError("Please check the details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.full_name}` : "Add account"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Leave the password empty to keep the current one."
              : "Share the sign-in details with the person privately."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="space-y-2">
            <Label htmlFor="u-name">Full name</Label>
            <Input
              id="u-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as AppRole)}
                disabled={user?.id === selfId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {superAdmin && <SelectItem value="admin">System Admin</SelectItem>}
                  <SelectItem value="venue_admin">Venue Admin</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "venue_admin" && (
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select value={facilityId} onValueChange={setFacilityId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {usesUsername ? (
            <div className="space-y-2">
              <Label htmlFor="u-user">Username</Label>
              <Input
                id="u-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. hrt_staff"
                required={!user}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="u-mail">Email</Label>
              <Input
                id="u-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!user}
                required={!user}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="u-pass">{user ? "New password (optional)" : "Password"}</Label>
            <Input
              id="u-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                user ? "Leave blank to keep existing password" : "At least 10 characters"
              }
              required={!user}
            />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}{" "}
              {user ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
