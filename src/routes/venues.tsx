import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/status-badge";
import { listVenues } from "@/lib/catalog.functions";
import { formatPeso } from "@/lib/booking-rules";

const venuesQuery = queryOptions({ queryKey: ["venues"], queryFn: () => listVenues() });

export const Route = createFileRoute("/venues")({
  head: () => ({
    meta: [
      { title: "Event Venues | ISATU Booking" },
      {
        name: "description",
        content:
          "Reserve the HRT Grand Auditorium or the TLE Convention Hall for conferences, seminars and galas.",
      },
      { property: "og:title", content: "Event Venues | ISATU Booking" },
      {
        property: "og:description",
        content:
          "Conference halls for up to 150 guests, each with an interactive floor plan designer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(venuesQuery),
  component: VenuesPage,
});

function VenuesPage() {
  const { data: venues } = useSuspenseQuery(venuesQuery);
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow="Event venues"
        title="Host your next event on campus"
        description="Choose a venue for your conference, seminar or university gala. Every reservation includes an editable 2D floor plan, and requests need at least 7 days notice."
        actions={
          <Button asChild variant="outline">
            <Link to="/rooms">Browse guest rooms</Link>
          </Button>
        }
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {venues.map((v) => (
          <article
            key={v.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src={v.image_url}
                alt={v.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
                {v.facility_name}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-2xl font-semibold">{v.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                  <Users className="size-3.5" /> {v.capacity_tables} with tables, {v.capacity}{" "}
                  without
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                  <LayoutGrid className="size-3.5" /> Floor plan designer included
                </span>
              </div>
              <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                <div>
                  <p className="text-xs text-muted-foreground">Daily rate</p>
                  <p className="font-display text-2xl font-semibold">
                    {v.price === 0 ? "Free" : `${formatPeso(v.price)} / day`}
                  </p>
                </div>
                <Button asChild variant="gold" size="lg">
                  <Link to="/book-venue/$venueId" params={{ venueId: String(v.id) }}>
                    Book venue <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
