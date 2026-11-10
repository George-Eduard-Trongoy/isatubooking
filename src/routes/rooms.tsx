import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Snowflake, Users, Wifi } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/status-badge";
import { listRooms } from "@/lib/catalog.functions";
import { formatPeso } from "@/lib/booking-rules";
import { cn } from "@/lib/utils";

const roomsQuery = queryOptions({ queryKey: ["rooms"], queryFn: () => listRooms() });

const searchSchema = z.object({ facility: z.enum(["all", "hrt", "tle"]).optional() });

export const Route = createFileRoute("/rooms")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Campus Guest Rooms | ISATU Booking" },
      {
        name: "description",
        content:
          "Reserve one of 11 air-conditioned guest rooms at the HRT Center and TLE Service Center.",
      },
      { property: "og:title", content: "Campus Guest Rooms | ISATU Booking" },
      {
        property: "og:description",
        content: "Suites and deluxe rooms on campus with WiFi, hot shower and special requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(roomsQuery),
  component: RoomsPage,
});

function RoomsPage() {
  const { data: rooms } = useSuspenseQuery(roomsQuery);
  const search = Route.useSearch();
  const [filter, setFilter] = useState<string>(search.facility ?? "all");
  const [q, setQ] = useState("");

  const filters = [
    { key: "all", label: `All rooms (${rooms.length})` },
    { key: "hrt", label: `HRT Center (${rooms.filter((r) => r.facility_code === "HRT").length})` },
    {
      key: "tle",
      label: `TLE Service Center (${rooms.filter((r) => r.facility_code === "TLE").length})`,
    },
  ];

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter !== "all" && r.facility_code.toLowerCase() !== filter) return false;
      if (!query) return true;
      return `${r.room_number} ${r.type_name} ${r.facility_name}`.toLowerCase().includes(query);
    });
  }, [rooms, filter, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow="Campus accommodation"
        title="Stay on campus"
        description="Comfortable rooms across the HRT Center and TLE Service Center, each with air conditioning, WiFi and a private hot shower. Add special requests when you book."
        actions={
          <Button asChild variant="outline">
            <Link to="/venues">Browse event venues</Link>
          </Button>
        }
      />

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search room number or type"
            className="h-10 rounded-full pl-9"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">No rooms match your filters.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <article
              key={r.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={r.image_url}
                  alt={`Room ${r.room_number}`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {r.facility_code} · Floor {r.room_number.charAt(0)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Room {r.room_number}</h2>
                    <p className="text-sm font-medium text-gold">{r.type_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold">
                      {formatPeso(r.price_per_night)}
                    </p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {r.type_description}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {r.capacity} guest{r.capacity > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wifi className="size-3.5" /> WiFi
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Snowflake className="size-3.5" /> Air conditioning
                  </span>
                </div>
                <Button asChild variant="default" className="mt-6 w-full">
                  <Link to="/book-room/$roomId" params={{ roomId: String(r.id) }}>
                    Reserve this room <ArrowRight />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
