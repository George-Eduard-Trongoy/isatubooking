import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  ImagePlus,
  LayoutGrid,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StepIndicator } from "@/components/booking-hero";
import { FormMessage, StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/hooks/use-auth";
import {
  createDocumentUploadUrls,
  getBookingDocuments,
  reviewDocument,
  submitDocument,
  type BookingDocument,
} from "@/lib/documents.functions";
import {
  MAX_DOCUMENT_PAGES,
  canUploadDocument,
  formatDate,
  validateDocumentPages,
} from "@/lib/booking-rules";
import { preparePhoto, uploadToSignedUrl } from "@/lib/uploads";
import { cn } from "@/lib/utils";

const docsQuery = (id: number) =>
  queryOptions({
    queryKey: ["documents", id],
    queryFn: () => getBookingDocuments({ data: { bookingId: id } }),
  });

export const Route = createFileRoute("/_authenticated/documents/$bookingId")({
  head: () => ({
    meta: [
      { title: "Required documents | ISATU Booking" },
      {
        name: "description",
        content: "Download the venue forms and upload photos of your completed documents.",
      },
      { property: "og:title", content: "Required documents | ISATU Booking" },
      {
        property: "og:description",
        content: "Submit the documents needed to confirm your venue reservation.",
      },
    ],
  }),
  loader: async ({ context, params }) => {
    const id = Number(params.bookingId);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const data = await context.queryClient.ensureQueryData(docsQuery(id));
    if (!data) throw notFound();
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  const { bookingId } = Route.useParams();
  const id = Number(bookingId);
  const { data } = useSuspenseQuery(docsQuery(id));
  const d = data!;
  const { isStaff } = useAuth();
  const s = d.summary;
  const pct = s.total ? Math.round((s.approved / s.total) * 100) : 0;
  const dateLabel =
    d.booking.booking_date === d.booking.end_date
      ? formatDate(d.booking.booking_date)
      : `${formatDate(d.booking.booking_date)} to ${formatDate(d.booking.end_date)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={isStaff ? "/admin" : "/my-bookings"}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {isStaff ? "Back to dashboard" : "Back to my bookings"}
        </Link>
        <StepIndicator step={3} />
      </div>

      <header className="mt-6 rounded-2xl bg-gradient-ink p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow text-gold">{d.booking.venue_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-ink-foreground md:text-3xl">
                {d.booking.event_name}
              </h1>
              <StatusBadge status={d.booking.status} />
            </div>
            <p className="mt-2 text-sm text-ink-foreground/75">
              Booking #{d.booking.id} · {dateLabel}
            </p>
          </div>
          <div className="min-w-56">
            <p className="text-sm text-ink-foreground/80">
              <b className="text-ink-foreground">
                {s.approved} of {s.total}
              </b>{" "}
              documents verified
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-foreground/15">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {s.pending > 0 && (
              <p className="mt-2 text-xs text-ink-foreground/70">{s.pending} waiting for review</p>
            )}
          </div>
        </div>
      </header>

      {d.isOwner ? (
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Download, title: "Download", text: "Get the soft copy of each form below." },
            {
              icon: FileText,
              title: "Complete and sign",
              text: "Print it, fill it in by hand and sign it.",
            },
            {
              icon: Camera,
              title: "Upload photos",
              text: `Take clear photos of every page, up to ${MAX_DOCUMENT_PAGES} per document.`,
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-accent-foreground">
                <step.icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {i + 1}. {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Check each photo against the form. Verify it, or ask the client to fix it with a short
          note.
        </p>
      )}

      {s.complete && (
        <div className="mt-6">
          <FormMessage tone="success">
            All documents are verified. The venue team will finalize your reservation.
          </FormMessage>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {d.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            This venue does not require any documents.
          </p>
        ) : (
          d.items.map((item, i) => (
            <DocumentCard
              key={item.requirement.id}
              index={i + 1}
              item={item}
              bookingId={d.booking.id}
              bookingStatus={d.booking.status}
              isOwner={d.isOwner}
              canReview={d.canReview}
            />
          ))
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/floor-plan/$bookingId" params={{ bookingId: String(d.booking.id) }}>
            <LayoutGrid /> View floor plan
          </Link>
        </Button>
        <Button asChild variant="gold">
          <Link to={isStaff ? "/admin" : "/my-bookings"}>
            {isStaff ? "Back to dashboard" : "Done, go to my bookings"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

const DOC_STATUS: Record<string, { label: string; icon: typeof Check; className: string }> = {
  missing: {
    label: "Not submitted",
    icon: Clock3,
    className: "bg-muted text-muted-foreground ring-border",
  },
  pending: {
    label: "Waiting for review",
    icon: Clock3,
    className: "bg-warning-soft text-warning ring-warning/25",
  },
  approved: {
    label: "Verified",
    icon: CheckCircle2,
    className: "bg-success-soft text-success ring-success/25",
  },
  rejected: {
    label: "Needs changes",
    icon: XCircle,
    className: "bg-danger-soft text-destructive ring-destructive/20",
  },
};

function DocStatus({ status }: { status: string }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS["missing"]!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        s.className,
      )}
    >
      <s.icon className="size-3.5" /> {s.label}
    </span>
  );
}

function DocumentCard({
  index,
  item,
  bookingId,
  bookingStatus,
  isOwner,
  canReview,
}: {
  index: number;
  item: BookingDocument;
  bookingId: number;
  bookingStatus: string;
  isOwner: boolean;
  canReview: boolean;
}) {
  const { requirement: r, submission: sub } = item;
  const status = sub?.status ?? "missing";
  const uploadBlocked = canUploadDocument(bookingStatus, sub?.status ?? null);
  const [replacing, setReplacing] = useState(false);
  const showUploader =
    isOwner && !uploadBlocked && (!sub || sub.status === "rejected" || replacing);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-sm font-semibold">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{r.title}</h2>
            <DocStatus status={status} />
          </div>
          {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
        </div>
        {r.template_url ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={r.template_url} target="_blank" rel="noreferrer">
              <Download /> Download form
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No file attached</span>
        )}
      </div>

      {sub?.status === "rejected" && sub.admin_note && (
        <div className="mt-4">
          <FormMessage tone="error">
            <b>Venue team note:</b> {sub.admin_note}
          </FormMessage>
        </div>
      )}
      {sub?.status === "approved" && sub.admin_note && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
          <b>Note:</b> {sub.admin_note}
        </p>
      )}

      {sub && sub.files.length > 0 && !showUploader && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Uploaded {formatDate(sub.submitted_at.slice(0, 10))} · {sub.files.length} photo
            {sub.files.length > 1 ? "s" : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sub.files.map((f, i) => (
              <a
                key={f.path}
                href={f.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="group relative block size-24 overflow-hidden rounded-lg border border-border bg-muted"
              >
                {f.url && (
                  <img
                    src={f.url}
                    alt={`${r.title}, page ${i + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                )}
                <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 text-[10px] font-semibold">
                  Page {i + 1}
                </span>
              </a>
            ))}
          </div>
          {isOwner && !uploadBlocked && sub.status === "pending" && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReplacing(true)}>
              <RotateCcw /> Replace photos
            </Button>
          )}
        </div>
      )}

      {showUploader && (
        <Uploader
          bookingId={bookingId}
          requirementId={r.id}
          onDone={() => setReplacing(false)}
          onCancel={replacing ? () => setReplacing(false) : undefined}
        />
      )}

      {canReview && sub && (
        <ReviewBar submissionId={sub.id} bookingId={bookingId} status={sub.status} />
      )}
      {canReview && !sub && (
        <p className="mt-4 text-xs text-muted-foreground">
          The client has not uploaded this document yet.
        </p>
      )}
    </article>
  );
}

function Uploader({
  bookingId,
  requirementId,
  onDone,
  onCancel,
}: {
  bookingId: number;
  requirementId: number;
  onDone: () => void;
  onCancel?: (() => void) | undefined;
}) {
  const getUrls = useServerFn(createDocumentUploadUrls);
  const submit = useServerFn(submitDocument);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, MAX_DOCUMENT_PAGES));
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = async () => {
    setError(null);
    const err = validateDocumentPages(files);
    if (err) return setError(err);
    setBusy(true);
    try {
      const prepared = await Promise.all(files.map((f) => preparePhoto(f)));
      const urls = await getUrls({
        data: {
          bookingId,
          requirementId,
          files: prepared.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        },
      });
      if (!urls.ok) return setError(urls.message);
      const results = await Promise.all(
        urls.uploads.map((u, i) =>
          uploadToSignedUrl("document-submissions", u.path, u.token, prepared[i]!),
        ),
      );
      if (results.some((ok) => !ok))
        return setError("Some photos failed to upload. Check your connection and try again.");
      const res = await submit({
        data: { bookingId, requirementId, paths: urls.uploads.map((u) => u.path) },
      });
      if (!res.ok) return setError(res.message);
      toast.success("Document submitted for review.");
      setFiles([]);
      await qc.invalidateQueries({ queryKey: ["documents", bookingId] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      onDone();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="sr-only"
        id={`up-${requirementId}`}
        onChange={(e) => addFiles(e.target.files)}
      />
      {files.length === 0 ? (
        <label
          htmlFor={`up-${requirementId}`}
          className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center"
        >
          <ImagePlus className="size-6 text-gold" />
          <span className="text-sm font-semibold">Add photos of the completed document</span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG or HEIC. One photo per page, up to {MAX_DOCUMENT_PAGES} pages.
          </span>
        </label>
      ) : (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="relative size-24 overflow-hidden rounded-lg border border-border bg-muted"
            >
              {previews[i] && (
                <img
                  src={previews[i]}
                  alt={`Page ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 text-[10px] font-semibold">
                Page {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Remove page ${i + 1}`}
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-foreground hover:bg-background"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < MAX_DOCUMENT_PAGES && (
            <label
              htmlFor={`up-${requirementId}`}
              className="grid size-24 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-gold hover:text-foreground"
            >
              <span className="flex flex-col items-center gap-1 text-xs">
                <ImagePlus className="size-5" /> Add page
              </span>
            </label>
          )}
        </div>
      )}
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      {(files.length > 0 || onCancel) && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          {files.length > 0 && (
            <Button variant="gold" size="sm" onClick={send} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />} Submit {files.length} photo
              {files.length > 1 ? "s" : ""} for review
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewBar({
  submissionId,
  bookingId,
  status,
}: {
  submissionId: number;
  bookingId: number;
  status: string;
}) {
  const review = useServerFn(reviewDocument);
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (next: "approved" | "rejected") => {
    setBusy(true);
    const res = await review({ data: { submissionId, status: next, note } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      next === "approved" ? "Document verified." : "The client was asked to fix this document.",
    );
    setRejecting(false);
    setNote("");
    qc.invalidateQueries({ queryKey: ["documents", bookingId] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      {rejecting ? (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What should the client fix? e.g. The signature on page 2 is missing."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => send("rejected")}
              disabled={busy || !note.trim()}
            >
              {busy && <Loader2 className="animate-spin" />} Send back to client
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {status === "pending"
              ? "Review the photos above."
              : "You can change this decision at any time."}
          </p>
          <div className="flex gap-2">
            {status !== "rejected" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejecting(true)}
                disabled={busy}
              >
                <XCircle /> Request changes
              </Button>
            )}
            {status !== "approved" && (
              <Button size="sm" onClick={() => send("approved")} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Verify document
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
