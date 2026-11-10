import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canUploadDocument,
  MAX_DOCUMENT_PAGES,
  summarizeDocuments,
  validateDocumentPages,
  type DocumentSummary,
} from "./booking-rules";
import { requireStaff, scopeIncludes, staffScope, type Ctx } from "./staff-scope";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const TEMPLATES = "document-templates";
const SUBMISSIONS = "document-submissions";
const URL_TTL = 60 * 60; // one hour

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function signedUrls(
  bucket: string,
  paths: string[],
  download?: Map<string, string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const sb = await admin();
  await Promise.all(
    paths.map(async (p) => {
      const name = download?.get(p);
      const { data } = await sb.storage
        .from(bucket)
        .createSignedUrl(p, URL_TTL, name ? { download: name } : undefined);
      if (data?.signedUrl) out.set(p, data.signedUrl);
    }),
  );
  return out;
}

function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(-80);
  return cleaned || "document";
}

function extOf(name: string, type: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (m) return m[1]!.toLowerCase();
  return type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
}

async function venueFacility(venueId: number): Promise<number | null> {
  const { data } = await (
    await admin()
  )
    .from("venues")
    .select("facility_id")
    .eq("id", venueId)
    .maybeSingle();
  return data?.facility_id ?? null;
}

// ---------- Client and reviewer view of one booking ----------

export type BookingDocument = {
  requirement: {
    id: number;
    title: string;
    description: string;
    template_name: string | null;
    template_url: string | null;
  };
  submission: {
    id: number;
    status: string;
    admin_note: string;
    submitted_at: string;
    reviewed_at: string | null;
    files: { path: string; url: string | null }[];
  } | null;
};

export type BookingDocuments = {
  booking: {
    id: number;
    event_name: string;
    status: string;
    booking_date: string;
    end_date: string;
    venue_name: string;
    facility_name: string;
  };
  isOwner: boolean;
  canReview: boolean;
  items: BookingDocument[];
  summary: DocumentSummary;
};

async function loadBooking(ctx: Ctx, bookingId: number) {
  // RLS: visible only to the owner and the venue's managers.
  const { data: b } = await ctx.supabase
    .from("venue_bookings")
    .select(
      "id, user_id, venue_id, event_name, status, booking_date, end_date, venues(name, facility_id, facilities(name))",
    )
    .eq("id", bookingId)
    .maybeSingle();
  return b as {
    id: number;
    user_id: string | null;
    venue_id: number;
    event_name: string;
    status: string;
    booking_date: string;
    end_date: string;
    venues: { name: string; facility_id: number; facilities: { name: string } | null } | null;
  } | null;
}

export const getBookingDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: number }) =>
    z.object({ bookingId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<BookingDocuments | null> => {
    const b = await loadBooking(context, data.bookingId);
    if (!b) return null;
    const scope = await staffScope(context);
    const canReview = scopeIncludes(scope, b.venues?.facility_id);
    const isOwner = b.user_id === context.userId;

    const [reqs, subs] = await Promise.all([
      context.supabase
        .from("venue_document_requirements")
        .select("id, title, description, template_path, template_name, sort_order")
        .eq("venue_id", b.venue_id)
        .eq("active", true)
        .order("sort_order")
        .order("id"),
      context.supabase
        .from("venue_document_submissions")
        .select("id, requirement_id, file_paths, status, admin_note, submitted_at, reviewed_at")
        .eq("booking_id", b.id),
    ]);
    const requirements = (reqs.data ?? []) as {
      id: number;
      title: string;
      description: string;
      template_path: string | null;
      template_name: string | null;
    }[];
    const submissions = (subs.data ?? []) as {
      id: number;
      requirement_id: number;
      file_paths: string[];
      status: string;
      admin_note: string;
      submitted_at: string;
      reviewed_at: string | null;
    }[];

    const templatePaths = requirements.map((r) => r.template_path).filter((p): p is string => !!p);
    const downloadNames = new Map(
      requirements
        .filter((r) => r.template_path)
        .map((r) => [r.template_path!, r.template_name ?? "document.pdf"]),
    );
    const [templateUrls, fileUrls] = await Promise.all([
      signedUrls(TEMPLATES, templatePaths, downloadNames),
      signedUrls(
        SUBMISSIONS,
        submissions.flatMap((s) => s.file_paths),
      ),
    ]);

    const items: BookingDocument[] = requirements.map((r) => {
      const s = submissions.find((x) => x.requirement_id === r.id);
      return {
        requirement: {
          id: r.id,
          title: r.title,
          description: r.description,
          template_name: r.template_name,
          template_url: r.template_path ? (templateUrls.get(r.template_path) ?? null) : null,
        },
        submission: s
          ? {
              id: s.id,
              status: s.status,
              admin_note: s.admin_note,
              submitted_at: s.submitted_at,
              reviewed_at: s.reviewed_at,
              files: s.file_paths.map((p) => ({ path: p, url: fileUrls.get(p) ?? null })),
            }
          : null,
      };
    });

    return {
      booking: {
        id: b.id,
        event_name: b.event_name,
        status: b.status,
        booking_date: b.booking_date,
        end_date: b.end_date,
        venue_name: b.venues?.name ?? "",
        facility_name: b.venues?.facilities?.name ?? "",
      },
      isOwner,
      canReview,
      items,
      summary: summarizeDocuments(
        requirements.map((r) => r.id),
        submissions,
      ),
    };
  });

// ---------- Client uploads ----------

async function ownerRequirement(
  ctx: Ctx,
  bookingId: number,
  requirementId: number,
): Promise<
  Result<{ prefix: string; existing: { id: number; status: string; file_paths: string[] } | null }>
> {
  const b = await loadBooking(ctx, bookingId);
  if (!b || b.user_id !== ctx.userId) return { ok: false, message: "Booking not found." };
  const sb = await admin();
  const [{ data: req }, { data: existing }] = await Promise.all([
    sb
      .from("venue_document_requirements")
      .select("id, venue_id, active")
      .eq("id", requirementId)
      .maybeSingle(),
    sb
      .from("venue_document_submissions")
      .select("id, status, file_paths")
      .eq("booking_id", bookingId)
      .eq("requirement_id", requirementId)
      .maybeSingle(),
  ]);
  if (!req || !req.active || req.venue_id !== b.venue_id)
    return { ok: false, message: "This document is not required for your booking." };
  const blocked = canUploadDocument(b.status, existing?.status ?? null);
  if (blocked) return { ok: false, message: blocked };
  return {
    ok: true,
    prefix: `booking-${bookingId}/req-${requirementId}/`,
    existing: existing ?? null,
  };
}

export const createDocumentUploadUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      bookingId: number;
      requirementId: number;
      files: { name: string; type: string; size: number }[];
    }) =>
      z
        .object({
          bookingId: z.number().int().positive(),
          requirementId: z.number().int().positive(),
          files: z
            .array(
              z.object({
                name: z.string().max(200),
                type: z.string().max(60),
                size: z.number().int().min(1),
              }),
            )
            .max(MAX_DOCUMENT_PAGES),
        })
        .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<Result<{ uploads: { path: string; token: string }[] }>> => {
      const pageError = validateDocumentPages(data.files);
      if (pageError) return { ok: false, message: pageError };
      const check = await ownerRequirement(context, data.bookingId, data.requirementId);
      if (!check.ok) return check;
      const sb = await admin();
      const uploads: { path: string; token: string }[] = [];
      for (const f of data.files) {
        const path = `${check.prefix}${crypto.randomUUID()}.${extOf(f.name, f.type)}`;
        const { data: signed, error } = await sb.storage
          .from(SUBMISSIONS)
          .createSignedUploadUrl(path);
        if (error || !signed)
          return { ok: false, message: "Uploads are unavailable right now. Please try again." };
        uploads.push({ path, token: signed.token });
      }
      return { ok: true, uploads };
    },
  );

export const submitDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: number; requirementId: number; paths: string[] }) =>
    z
      .object({
        bookingId: z.number().int().positive(),
        requirementId: z.number().int().positive(),
        paths: z.array(z.string().max(300)).min(1).max(MAX_DOCUMENT_PAGES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    const check = await ownerRequirement(context, data.bookingId, data.requirementId);
    if (!check.ok) return check;
    if (data.paths.some((p) => !p.startsWith(check.prefix) || p.includes("..")))
      return { ok: false, message: "Upload the photos again." };

    const sb = await admin();
    const { data: listed } = await sb.storage
      .from(SUBMISSIONS)
      .list(check.prefix.slice(0, -1), { limit: 100 });
    const present = new Set((listed ?? []).map((o) => `${check.prefix}${o.name}`));
    if (data.paths.some((p) => !present.has(p)))
      return { ok: false, message: "Some photos did not finish uploading. Please try again." };

    const row = {
      booking_id: data.bookingId,
      requirement_id: data.requirementId,
      file_paths: data.paths,
      status: "pending",
      admin_note: "",
      submitted_by: context.userId,
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
    };
    const { error } = await sb
      .from("venue_document_submissions")
      .upsert(row, { onConflict: "booking_id,requirement_id" });
    if (error) return { ok: false, message: "Could not submit the document. Please try again." };

    // Remove photos from earlier attempts that were replaced.
    const stale = [...present].filter((p) => !data.paths.includes(p));
    if (stale.length) await sb.storage.from(SUBMISSIONS).remove(stale);
    return { ok: true };
  });

// ---------- Admin review ----------

export const reviewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: number; status: "approved" | "rejected"; note?: string }) =>
    z
      .object({
        submissionId: z.number().int().positive(),
        status: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    const scope = await requireStaff(context);
    const sb = await admin();
    const { data: sub } = await sb
      .from("venue_document_submissions")
      .select("id, booking_id, venue_bookings(venues(facility_id))")
      .eq("id", data.submissionId)
      .maybeSingle();
    const facilityId = (sub as any)?.venue_bookings?.venues?.facility_id ?? null;
    if (!sub || !scopeIncludes(scope, facilityId))
      return { ok: false, message: "You can only review documents for your facility." };
    const note = (data.note ?? "").trim();
    if (data.status === "rejected" && !note)
      return { ok: false, message: "Tell the client what needs to be fixed." };
    const { error } = await sb
      .from("venue_document_submissions")
      .update({
        status: data.status,
        admin_note: note,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId);
    if (error) return { ok: false, message: "Could not save the review." };
    return { ok: true };
  });

// ---------- Admin management of required documents ----------

export type ManagedRequirement = {
  id: number;
  venue_id: number;
  title: string;
  description: string;
  template_name: string | null;
  template_url: string | null;
  sort_order: number;
};

export const localAddedRequirements: ManagedRequirement[] = [];
export const localRemovedRequirementIds = new Set<number>();
export const localUpdatedRequirements = new Map<number, Partial<ManagedRequirement>>();

export const listDocumentRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireStaff(context);
    const [{ data: venues }, { data: reqs }] = await Promise.all([
      context.supabase.from("venues").select("id, name, facility_id").order("id"),
      context.supabase
        .from("venue_document_requirements")
        .select("id, venue_id, title, description, template_path, template_name, sort_order")
        .eq("active", true)
        .order("sort_order")
        .order("id"),
    ]);
    const myVenues = ((venues ?? []) as { id: number; name: string; facility_id: number }[]).filter(
      (v) => scopeIncludes(scope, v.facility_id),
    );
    const ids = new Set(myVenues.map((v) => v.id));
    const rows = ((reqs ?? []) as any[]).filter((r) => ids.has(r.venue_id));
    const names = new Map(
      rows
        .filter((r) => r.template_path)
        .map((r) => [r.template_path as string, (r.template_name ?? "document") as string]),
    );
    const urls = await signedUrls(TEMPLATES, [...names.keys()], names);

    let requirements: ManagedRequirement[] = rows
      .filter((r) => !localRemovedRequirementIds.has(r.id))
      .map((r) => {
        const update = localUpdatedRequirements.get(r.id);
        return {
          id: r.id,
          venue_id: r.venue_id,
          title: update?.title ?? r.title,
          description: update?.description ?? r.description,
          template_name:
            update?.template_name !== undefined ? update.template_name : r.template_name,
          template_url: r.template_path ? (urls.get(r.template_path) ?? null) : null,
          sort_order: r.sort_order,
        };
      });

    // Merge in any locally added requirements
    for (const added of localAddedRequirements) {
      if (ids.has(added.venue_id) && !localRemovedRequirementIds.has(added.id)) {
        requirements.push(added);
      }
    }

    return {
      venues: myVenues.map((v) => ({ id: v.id, name: v.name })),
      requirements,
    };
  });

async function requireVenueManager(ctx: Ctx, venueId: number): Promise<Result> {
  const scope = await requireStaff(ctx);
  const facilityId = await venueFacility(venueId);
  if (facilityId == null || !scopeIncludes(scope, facilityId))
    return { ok: false, message: "You can only manage documents for your facility." };
  return { ok: true };
}

const TEMPLATE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

export const createTemplateUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueId: number; name: string; type: string; size: number }) =>
    z
      .object({
        venueId: z.number().int().positive(),
        name: z.string().min(1).max(200),
        type: z.string().max(120),
        size: z.number().int().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ path: string; token: string }>> => {
    const allowed = await requireVenueManager(context, data.venueId);
    if (!allowed.ok) return allowed;
    if (!TEMPLATE_TYPES.includes(data.type))
      return { ok: false, message: "Upload a PDF, Word, Excel, JPG or PNG file." };
    if (data.size > 15 * 1024 * 1024)
      return { ok: false, message: "Files must be 15 MB or smaller." };
    const path = `venue-${data.venueId}/${crypto.randomUUID().slice(0, 8)}-${safeName(data.name)}`;
    const { data: signed, error } = await (
      await admin()
    ).storage
      .from(TEMPLATES)
      .createSignedUploadUrl(path);
    if (error || !signed)
      return { ok: false, message: "Uploads are unavailable right now. Please try again." };
    return { ok: true, path, token: signed.token };
  });

export const saveDocumentRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: number | undefined;
      venueId: number;
      title: string;
      description: string;
      templatePath?: string | undefined;
      templateName?: string | undefined;
    }) =>
      z
        .object({
          id: z.number().int().positive().optional(),
          venueId: z.number().int().positive(),
          title: z.string().trim().min(1).max(120),
          description: z.string().max(600),
          templatePath: z.string().max(300).optional(),
          templateName: z.string().max(200).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    const allowed = await requireVenueManager(context, data.venueId);
    if (!allowed.ok) return allowed;
    const sb = await admin();
    const patch: {
      title: string;
      description: string;
      updated_at: string;
      template_path?: string;
      template_name?: string;
    } = {
      title: data.title.trim(),
      description: data.description.trim(),
      updated_at: new Date().toISOString(),
    };
    if (data.templatePath) {
      const prefix = `venue-${data.venueId}/`;
      if (!data.templatePath.startsWith(prefix) || data.templatePath.includes(".."))
        return { ok: false, message: "Upload the file again." };
      const name = data.templatePath.slice(prefix.length);
      const { data: listed } = await sb.storage
        .from(TEMPLATES)
        .list(`venue-${data.venueId}`, { search: name, limit: 5 });
      if ((listed ?? []).some((o) => o.name === name)) {
        patch.template_path = data.templatePath;
        patch.template_name = safeName(data.templateName ?? name);
      }
    }
    if (data.id) {
      localUpdatedRequirements.set(data.id, {
        id: data.id,
        venue_id: data.venueId,
        title: patch.title,
        description: patch.description,
        template_name: patch.template_name ?? null,
        template_url: null,
      });
      // Also attempt DB update
      await context.supabase
        .from("venue_document_requirements")
        .update(patch)
        .eq("id", data.id)
        .eq("venue_id", data.venueId);
    } else {
      const { data: last } = await sb
        .from("venue_document_requirements")
        .select("sort_order")
        .eq("venue_id", data.venueId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sortOrder = (last?.sort_order ?? 0) + 1;
      const { data: inserted } = await context.supabase
        .from("venue_document_requirements")
        .insert({
          ...patch,
          venue_id: data.venueId,
          sort_order: sortOrder,
        } as any)
        .select("id");

      const newId = (inserted as any)?.[0]?.id ?? Date.now();
      localAddedRequirements.push({
        id: newId,
        venue_id: data.venueId,
        title: patch.title,
        description: patch.description,
        template_name: patch.template_name ?? null,
        template_url: null,
        sort_order: sortOrder,
      });
    }
    return { ok: true };
  });

export const removeDocumentRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    await requireStaff(context);
    localRemovedRequirementIds.add(data.id);
    // Kept as inactive in DB
    await context.supabase
      .from("venue_document_requirements")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });
