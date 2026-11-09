-- Public calendars only need the dates and reason, not who created the entry.
revoke select on public.blackout_dates from anon, authenticated;
grant select (id, venue_id, start_date, end_date, reason, created_at) on public.blackout_dates to anon, authenticated;
