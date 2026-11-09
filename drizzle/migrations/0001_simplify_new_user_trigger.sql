-- Every new account starts as a guest; staff roles are assigned afterwards by the admin tools.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _base text;
  _username text;
  _n integer := 0;
begin
  _base := coalesce(
    nullif(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_.]', '', 'g'), ''),
    'guest'
  );
  _username := _base;
  while exists (select 1 from public.profiles where lower(username) = lower(_username)) loop
    _n := _n + 1;
    _username := _base || _n::text;
  end loop;

  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    _username,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), _username),
    case when new.email like '%@staff.isatu-booking.app' then null else new.email end
  );
  insert into public.user_roles (user_id, role) values (new.id, 'guest');
  return new;
end;
$$;
