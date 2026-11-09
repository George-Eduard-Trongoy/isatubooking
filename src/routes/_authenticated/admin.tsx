import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BedDouble, CalendarOff, ClipboardList, ImageIcon, LayoutGrid, Loader2, Pencil, Plus, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormMessage, PageIntro, StatusBadge } from "@/components/status-badge";
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
import { BOOKING_STATUSES, daysBetween, formatDate, formatPeso } from "@/lib/booking-rules";
import { roleLabel, type AppRole } from "@/lib/identity";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration | ISATU Booking" },
      { name: "description", content: "Review booking requests and manage venues, rooms, dates and accounts." },
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
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldAlert className="mx-auto size-8 text-gold" />
        <h1 className="mt-4 text-2xl font-semibold">Administrators only</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account does not have access to the administration portal.</p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    );
  }
  if (dash.isError || !dash.data) {
    return <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">The dashboard could not load. Please refresh.</div>;
  }

  const d = dash.data;
  const superAdmin = me?.role === "admin";
  const facility = d.facilities.find((f) => f.id === d.scope.facilityId);
  const pending = d.venueBookings.filter((b) => b.status === "pending").length + d.roomBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow={superAdmin ? "System administration" : `${facility?.name ?? "Facility"} administration`}
        title={`Welcome, ${me?.full_name ?? "Administrator"}`}
        description={superAdmin ? "You manage every venue, room and account across the university." : `You manage bookings, dates and listings for ${facility?.name ?? "your facility"}.`}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ClipboardList} label="Pending requests" value={pending} highlight />
        <Stat icon={LayoutGrid} label="Venue bookings" value={d.venueBookings.length} />
        <Stat icon={BedDouble} label="Room bookings" value={d.roomBookings.length} />
        <Stat icon={CalendarOff} label="Blocked date ranges" value={d.blackouts.length} />
      </div>

      <Tabs defaultValue="bookings" className="mt-10">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="bookings" className="px-4 py-2">Booking requests</TabsTrigger>
          <TabsTrigger value="blackouts" className="px-4 py-2">Unavailable dates</TabsTrigger>
          <TabsTrigger value="catalog" className="px-4 py-2">Photos and details</TabsTrigger>
          {superAdmin && <TabsTrigger value="users" className="px-4 py-2">Accounts</TabsTrigger>}
        </TabsList>
        <TabsContent value="bookings" className="mt-6"><BookingsPanel d={d} /></TabsContent>
        <TabsContent value="blackouts" className="mt-6"><BlackoutsPanel d={d} /></TabsContent>
        <TabsContent value="catalog" className="mt-6"><CatalogPanel d={d} /></TabsContent>
        {superAdmin && <TabsContent value="users" className="mt-6"><UsersPanel facilities={d.facilities} selfId={me!.id} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-2xl bg-gradient-ink p-5" : "rounded-2xl border border-border bg-card p-5 shadow-soft"}>
      <Icon className={highlight ? "size-5 text-gold" : "size-5 text-muted-foreground"} />
      <p className={highlight ? "mt-4 font-display text-3xl font-semibold text-ink-foreground" : "mt-4 font-display text-3xl font-semibold"}>{value}</p>
      <p className={highlight ? "text-sm text-ink-foreground/70" : "text-sm text-muted-foreground"}>{label}</p>
    </div>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
}

function StatusSelect({ type, id, status }: { type: "venue" | "room"; id: number; status: string }) {
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
        if (!res.ok) { toast.error(res.message); return; }
        toast.success(`Booking #${id} marked ${v}.`);
        refresh();
      }}
    >
      <SelectTrigger className="h-8 w-32 text-xs capitalize"><SelectValue /></SelectTrigger>
      <SelectContent>
        {BOOKING_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft"><table className="w-full min-w-[860px] text-sm">{children}</table></div>;
}
const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const td = "px-4 py-4 align-top";

function BookingsPanel({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Venue requests</h2>
        {d.venueBookings.length === 0 ? <EmptyRow text="No venue requests yet." /> : (
          <div className="mt-4"><TableShell>
            <thead className="border-b border-border bg-surface"><tr><th className={th}>Client</th><th className={th}>Event</th><th className={th}>Schedule</th><th className={th}>Guests</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-border">
              {d.venueBookings.map((b) => {
                const days = daysBetween(b.booking_date, b.end_date) + 1;
                return (
                  <tr key={b.id}>
                    <td className={td}><p className="font-semibold">{b.client.name}</p><p className="text-xs text-muted-foreground">{b.client.contact}</p></td>
                    <td className={td}><p className="font-medium">{b.event_name}</p><p className="text-xs text-muted-foreground">{b.venue_name} · {b.layout_type}</p></td>
                    <td className={td}><p>{b.booking_date === b.end_date ? formatDate(b.booking_date) : `${formatDate(b.booking_date)} to ${formatDate(b.end_date)}`}</p><p className="text-xs text-muted-foreground">{b.start_time} to {b.end_time} · {days} day{days > 1 ? "s" : ""}</p></td>
                    <td className={td}>{b.attendees}</td>
                    <td className={td}><div className="flex flex-col gap-2"><StatusBadge status={b.status} /><StatusSelect type="venue" id={b.id} status={b.status} /></div></td>
                    <td className={td}><Button asChild size="sm" variant="outline"><Link to="/floor-plan/$bookingId" params={{ bookingId: String(b.id) }}><LayoutGrid /> Floor plan</Link></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell></div>
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold">Room requests</h2>
        {d.roomBookings.length === 0 ? <EmptyRow text="No room requests yet." /> : (
          <div className="mt-4"><TableShell>
            <thead className="border-b border-border bg-surface"><tr><th className={th}>Client</th><th className={th}>Room</th><th className={th}>Stay</th><th className={th}>Guests</th><th className={th}>Requests</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {d.roomBookings.map((b) => {
                const nights = Math.max(1, daysBetween(b.check_in, b.check_out));
                return (
                  <tr key={b.id}>
                    <td className={td}><p className="font-semibold">{b.client.name}</p><p className="text-xs text-muted-foreground">{b.client.contact}</p></td>
                    <td className={td}><p className="font-medium">Room {b.room_number}</p><p className="text-xs text-muted-foreground">{b.room_type}</p></td>
                    <td className={td}><p>{formatDate(b.check_in)} to {formatDate(b.check_out)}</p><p className="text-xs text-muted-foreground">{nights} night{nights > 1 ? "s" : ""}</p></td>
                    <td className={td}>{b.guests}</td>
                    <td className={`${td} max-w-60 text-xs text-muted-foreground`}>{b.special_orders || "None"}</td>
                    <td className={td}><div className="flex flex-col gap-2"><StatusBadge status={b.status} /><StatusSelect type="room" id={b.id} status={b.status} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell></div>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="mt-4 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function BlackoutsPanel({ d }: { d: Dashboard }) {
  const add = useServerFn(addBlackout);
  const remove = useServerFn(deleteBlackout);
  const refresh = useRefresh();
  const [venueId, setVenueId] = useState<string>(String(d.venues[0]?.id ?? ""));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId || !start) { toast.error("Choose a venue and a start date."); return; }
    setBusy(true);
    const res = await add({ data: { venue_id: Number(venueId), start_date: start, end_date: end || start, reason } });
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success("Dates blocked for booking.");
    setStart(""); setEnd(""); setReason("");
    refresh();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft lg:self-start">
        <h2 className="text-lg font-semibold">Block dates</h2>
        <p className="text-sm text-muted-foreground">Guests cannot book a venue on blocked dates.</p>
        <div className="space-y-2">
          <Label>Venue</Label>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger><SelectValue placeholder="Choose a venue" /></SelectTrigger>
            <SelectContent>{d.venues.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="bo-start">From</Label><Input id="bo-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="bo-end">To</Label><Input id="bo-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="bo-reason">Reason</Label><Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sound system maintenance" maxLength={200} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Block dates</Button>
      </form>
      <div>
        {d.blackouts.length === 0 ? <EmptyRow text="No blocked dates." /> : (
          <div className="grid gap-3">
            {d.blackouts.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft">
                <span className="grid size-10 place-items-center rounded-lg bg-warning-soft text-warning"><CalendarOff className="size-5" /></span>
                <div className="flex-1">
                  <p className="font-semibold">{b.start_date === b.end_date ? formatDate(b.start_date) : `${formatDate(b.start_date)} to ${formatDate(b.end_date)}`}</p>
                  <p className="text-sm text-muted-foreground">{b.venue_name} · {b.reason}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={async () => {
                    const res = await remove({ data: { id: b.id } });
                    if (!res.ok) { toast.error(res.message); return; }
                    toast.success("Dates are bookable again.");
                    refresh();
                  }}
                ><Trash2 className="text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type CatalogTarget = { type: "venue" | "room"; id: number; title: string; image_url: string; price: number; capacity: number; description?: string };

function CatalogPanel({ d }: { d: Dashboard }) {
  const [editing, setEditing] = useState<CatalogTarget | null>(null);
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold">Venues</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {d.venues.map((v) => (
            <CatalogCard key={v.id} image={v.image_url} title={v.name} sub={`${formatPeso(v.price)} per day · ${v.capacity} max`} onEdit={() => setEditing({ type: "venue", id: v.id, title: v.name, image_url: v.image_url, price: v.price, capacity: v.capacity, description: v.description })} />
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Rooms</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.rooms.map((r) => (
            <CatalogCard key={r.id} image={r.image_url} title={`Room ${r.room_number}`} sub={`${r.type_name} · ${formatPeso(r.price_per_night)} per night · ${r.capacity} guests`} onEdit={() => setEditing({ type: "room", id: r.id, title: `Room ${r.room_number}`, image_url: r.image_url, price: r.price_per_night, capacity: r.capacity })} />
          ))}
        </div>
      </div>
      {editing && <CatalogDialog target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CatalogCard({ image, title, sub, onEdit }: { image: string; title: string; sub: string; onEdit: () => void }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
      {image ? <img src={image} alt="" className="size-20 shrink-0 rounded-xl object-cover" /> : <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-muted"><ImageIcon className="text-muted-foreground" /></span>}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit ${title}`}><Pencil /></Button>
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
      const res = await save({ data: { type: target.type, id: target.id, image_url: image.trim(), price: Number(price), capacity: Number(capacity), description: target.type === "venue" ? description : undefined } });
      if (!res.ok) { setError(res.message); return; }
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
        <DialogHeader><DialogTitle>Edit {target.title}</DialogTitle><DialogDescription>Update the photo and listing details guests see.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          {image && <img src={image} alt="" className="aspect-video w-full rounded-lg object-cover" />}
          <div className="space-y-2"><Label htmlFor="cat-img">Photo link</Label><Input id="cat-img" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="cat-price">{target.type === "venue" ? "Daily rate (PHP)" : "Nightly rate (PHP)"}</Label><Input id="cat-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="cat-cap">Capacity</Label><Input id="cat-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          </div>
          {target.type === "venue" && <div className="space-y-2"><Label htmlFor="cat-desc">Description</Label><Textarea id="cat-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save changes</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Accounts ----------

function UsersPanel({ facilities, selfId }: { facilities: Dashboard["facilities"]; selfId: string }) {
  const fetchUsers = useServerFn(listUsers);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const remove = useServerFn(deleteUser);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);

  if (users.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (!users.data) return <EmptyRow text="Accounts could not load." />;
  const fcode = (id: number | null) => facilities.find((f) => f.id === id)?.code ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Staff sign in with a username. Guests sign in with their email address.</p>
        <Button variant="gold" onClick={() => setEditing("new")}><UserPlus /> Add account</Button>
      </div>
      <TableShell>
        <thead className="border-b border-border bg-surface"><tr><th className={th}>Name</th><th className={th}>Sign-in</th><th className={th}>Role</th><th className={th}>Joined</th><th className={th}></th></tr></thead>
        <tbody className="divide-y divide-border">
          {users.data.users.map((u) => (
            <tr key={u.id}>
              <td className={td}><p className="font-semibold">{u.full_name}</p></td>
              <td className={td}>{u.email ?? <span className="font-mono text-xs">{u.username}</span>}</td>
              <td className={td}><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{roleLabel(u.role, fcode(u.facility_id))}</span></td>
              <td className={`${td} text-muted-foreground`}>{formatDate(u.created_at.slice(0, 10))}</td>
              <td className={`${td} text-right`}>
                <Button size="icon" variant="ghost" onClick={() => setEditing(u)} aria-label="Edit"><Pencil /></Button>
                {u.id !== selfId && (
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={async () => {
                    if (!window.confirm(`Delete the account for ${u.full_name}?`)) return;
                    const res = await remove({ data: { id: u.id } });
                    if (!res.ok) { toast.error(res.message); return; }
                    toast.success("Account deleted.");
                    qc.invalidateQueries({ queryKey: ["admin-users"] });
                  }}><Trash2 className="text-destructive" /></Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {users.data.pendingImported.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6">
          <h3 className="font-semibold">Guests from the previous system</h3>
          <p className="mt-1 text-sm text-muted-foreground">These guests keep their bookings. They will appear above once they register with the same email address and confirm it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {users.data.pendingImported.map((g) => <span key={g.id} className="rounded-full bg-muted px-3 py-1 text-xs">{g.full_name} · {g.email}</span>)}
          </div>
        </div>
      )}

      {editing && <UserDialog user={editing === "new" ? null : editing} facilities={facilities} selfId={selfId} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserDialog({ user, facilities, selfId, onClose }: { user: ManagedUser | null; facilities: Dashboard["facilities"]; selfId: string; onClose: () => void }) {
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [role, setRole] = useState<AppRole>(user?.role ?? "venue_admin");
  const [facilityId, setFacilityId] = useState<string>(String(user?.facility_id ?? facilities[0]?.id ?? ""));
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
    const payload = { full_name: fullName, role, facility_id: role === "venue_admin" ? Number(facilityId) : null, username: usesUsername ? username : undefined, email: !usesUsername ? email : undefined, password: password || undefined };
    try {
      const res = user ? await update({ data: { ...payload, id: user.id } }) : await create({ data: payload });
      if (!res.ok) { setError(res.message); return; }
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
          <DialogDescription>{user ? "Leave the password empty to keep the current one." : "Share the sign-in details with the person privately."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="space-y-2"><Label htmlFor="u-name">Full name</Label><Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={user?.id === selfId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">System Admin</SelectItem>
                  <SelectItem value="venue_admin">Venue Admin</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "venue_admin" && (
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select value={facilityId} onValueChange={setFacilityId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{facilities.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          {usesUsername ? (
            <div className="space-y-2"><Label htmlFor="u-user">Username</Label><Input id="u-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. hrt_staff" /></div>
          ) : (
            <div className="space-y-2"><Label htmlFor="u-mail">Email</Label><Input id="u-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></div>
          )}
          <div className="space-y-2">
            <Label htmlFor="u-pass">{user ? "New password" : "Password"}</Label>
            <Input id="u-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} {user ? "Save changes" : "Create account"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
