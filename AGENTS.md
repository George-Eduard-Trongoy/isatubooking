<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Booking validation lives in `src/lib/booking-rules.ts` and runs both in the forms (preview) and in server functions (enforcement); change rules there only, and keep `src/test/booking-rules.test.ts` in sync.
- Staff sign in with a username mapped to `<username>@staff.isatu-booking.app` (`src/lib/identity.ts`); guests use real emails. Never look up emails by username.
- Roles live only in `public.user_roles` (admin, venue_admin with facility_id, guest); RLS uses `manages_facility()` so venue admins are scoped to their facility. New accounts always start as guest; staff roles are set by the admin server functions.
- Booking inserts, owner cancellations and floor-plan saves go through server functions using the service client after checks; the browser has no insert grant on booking tables.
- Records from the previous system are kept in `legacy_users`; guest bookings link to a new account only after that account's email is confirmed and matches (`getMe`).
- Floor plans use a fixed 980x620 logical canvas with centered shapes (`src/lib/floor-plan.ts`); the Konva editor is lazy-loaded behind `ClientOnly` because Konva cannot run during SSR.
- Keep the interface free of emoji; use lucide icons.
