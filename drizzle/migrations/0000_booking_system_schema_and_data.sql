-- Roles
create type public.app_role as enum ('admin', 'venue_admin', 'guest');

-- Catalog
create table public.facilities (
  id integer primary key,
  name text not null,
  code text not null,
  description text not null default '',
  has_venue boolean not null default true,
  has_accommodation boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
grant select on public.facilities to anon, authenticated;
grant all on public.facilities to service_role;
alter table public.facilities enable row level security;
create policy "Facilities are public" on public.facilities for select to anon, authenticated using (true);

create table public.venues (
  id integer primary key,
  facility_id integer not null references public.facilities(id),
  name text not null,
  capacity integer not null default 150,
  capacity_tables integer not null default 100,
  description text not null default '',
  price numeric(12,2) not null default 0,
  image_url text not null default '',
  status text not null default 'available',
  created_at timestamptz not null default now()
);
grant select on public.venues to anon, authenticated;
grant update (image_url, price, capacity, description) on public.venues to authenticated;
grant all on public.venues to service_role;
alter table public.venues enable row level security;
create policy "Venues are public" on public.venues for select to anon, authenticated using (true);

create table public.room_types (
  id integer primary key,
  name text not null,
  description text not null default '',
  capacity integer not null default 1
);
grant select on public.room_types to anon, authenticated;
grant all on public.room_types to service_role;
alter table public.room_types enable row level security;
create policy "Room types are public" on public.room_types for select to anon, authenticated using (true);

create table public.rooms (
  id integer primary key,
  facility_id integer not null references public.facilities(id),
  room_type_id integer references public.room_types(id),
  room_number text not null,
  capacity integer not null default 1,
  price_per_night numeric(12,2) not null default 0,
  image_url text not null default '',
  status text not null default 'available',
  created_at timestamptz not null default now()
);
grant select on public.rooms to anon, authenticated;
grant update (image_url, price_per_night, capacity) on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "Rooms are public" on public.rooms for select to anon, authenticated using (true);

-- Users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username)) where username is not null;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  facility_id integer references public.facilities(id),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- Accounts from the previous system (no passwords kept). Claimed by email after verification.
create table public.legacy_users (
  id integer primary key,
  username text,
  full_name text not null default '',
  email text,
  role text not null default 'guest',
  assigned_facility_id integer,
  created_at timestamptz not null default now(),
  claimed_by uuid
);
grant select on public.legacy_users to authenticated;
grant all on public.legacy_users to service_role;
alter table public.legacy_users enable row level security;

-- Role helpers (security definer avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin', 'venue_admin'))
$$;

create or replace function public.manages_facility(_user_id uuid, _facility_id integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and (role = 'admin' or (role = 'venue_admin' and facility_id = _facility_id))
  )
$$;

create policy "Read own profile or staff reads all" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "Read own roles or staff reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Staff read legacy users" on public.legacy_users for select to authenticated
  using (public.is_staff(auth.uid()));

create policy "Managers update venues" on public.venues for update to authenticated
  using (public.manages_facility(auth.uid(), facility_id))
  with check (public.manages_facility(auth.uid(), facility_id));
create policy "Managers update rooms" on public.rooms for update to authenticated
  using (public.manages_facility(auth.uid(), facility_id))
  with check (public.manages_facility(auth.uid(), facility_id));

-- Bookings
create table public.venue_bookings (
  id bigint generated by default as identity primary key,
  user_id uuid,
  legacy_user_id integer references public.legacy_users(id),
  venue_id integer not null references public.venues(id),
  event_name text not null,
  booking_date date not null,
  end_date date not null,
  start_time text not null,
  end_time text not null,
  attendees integer not null,
  layout_type text not null default 'banquet',
  layout_data jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now()
);
create index venue_bookings_user_idx on public.venue_bookings (user_id);
create index venue_bookings_venue_idx on public.venue_bookings (venue_id);
grant select on public.venue_bookings to authenticated;
grant update (status) on public.venue_bookings to authenticated;
grant all on public.venue_bookings to service_role;
alter table public.venue_bookings enable row level security;
create policy "Owners and managers read venue bookings" on public.venue_bookings for select to authenticated
  using (
    user_id = auth.uid()
    or public.manages_facility(auth.uid(), (select v.facility_id from public.venues v where v.id = venue_id))
  );
create policy "Managers update venue bookings" on public.venue_bookings for update to authenticated
  using (public.manages_facility(auth.uid(), (select v.facility_id from public.venues v where v.id = venue_id)))
  with check (public.manages_facility(auth.uid(), (select v.facility_id from public.venues v where v.id = venue_id)));

create table public.room_bookings (
  id bigint generated by default as identity primary key,
  user_id uuid,
  legacy_user_id integer references public.legacy_users(id),
  room_id integer not null references public.rooms(id),
  check_in date not null,
  check_out date not null,
  guests integer not null,
  special_orders text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now()
);
create index room_bookings_user_idx on public.room_bookings (user_id);
create index room_bookings_room_idx on public.room_bookings (room_id);
grant select on public.room_bookings to authenticated;
grant update (status) on public.room_bookings to authenticated;
grant all on public.room_bookings to service_role;
alter table public.room_bookings enable row level security;
create policy "Owners and managers read room bookings" on public.room_bookings for select to authenticated
  using (
    user_id = auth.uid()
    or public.manages_facility(auth.uid(), (select r.facility_id from public.rooms r where r.id = room_id))
  );
create policy "Managers update room bookings" on public.room_bookings for update to authenticated
  using (public.manages_facility(auth.uid(), (select r.facility_id from public.rooms r where r.id = room_id)))
  with check (public.manages_facility(auth.uid(), (select r.facility_id from public.rooms r where r.id = room_id)));

create table public.blackout_dates (
  id bigint generated by default as identity primary key,
  venue_id integer not null references public.venues(id),
  start_date date not null,
  end_date date not null,
  reason text not null default 'Scheduled maintenance',
  created_by uuid,
  legacy_created_by integer,
  created_at timestamptz not null default now()
);
grant select on public.blackout_dates to anon, authenticated;
grant insert, delete on public.blackout_dates to authenticated;
grant all on public.blackout_dates to service_role;
alter table public.blackout_dates enable row level security;
create policy "Blackout dates are public" on public.blackout_dates for select to anon, authenticated using (true);
create policy "Managers add blackout dates" on public.blackout_dates for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.manages_facility(auth.uid(), (select v.facility_id from public.venues v where v.id = venue_id))
  );
create policy "Managers delete blackout dates" on public.blackout_dates for delete to authenticated
  using (public.manages_facility(auth.uid(), (select v.facility_id from public.venues v where v.id = venue_id)));

-- Public availability (dates only, no personal data)
create or replace function public.venue_busy_ranges(_venue_id integer)
returns table (start_date date, end_date date, start_time text, end_time text)
language sql stable security definer set search_path = public as $$
  select booking_date, end_date, start_time, end_time
  from public.venue_bookings
  where venue_id = _venue_id and status in ('pending', 'approved')
$$;

create or replace function public.room_busy_ranges(_room_id integer)
returns table (check_in date, check_out date)
language sql stable security definer set search_path = public as $$
  select check_in, check_out
  from public.room_bookings
  where room_id = _room_id and status in ('pending', 'approved')
$$;
grant execute on function public.venue_busy_ranges(integer) to anon, authenticated;
grant execute on function public.room_busy_ranges(integer) to anon, authenticated;

-- New account setup: profile + role. Staff role/username come only from server-set app metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _role public.app_role := 'guest';
  _facility integer := null;
  _base text;
  _username text;
  _n integer := 0;
begin
  if new.raw_app_meta_data ? 'app_role' then
    _role := (new.raw_app_meta_data ->> 'app_role')::public.app_role;
  end if;
  if new.raw_app_meta_data ? 'facility_id' then
    _facility := nullif(new.raw_app_meta_data ->> 'facility_id', '')::integer;
  end if;

  _base := coalesce(
    nullif(new.raw_app_meta_data ->> 'username', ''),
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
  insert into public.user_roles (user_id, role, facility_id)
  values (new.id, _role, case when _role = 'venue_admin' then _facility else null end);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Imported records
insert into public.facilities (id,name,code,description,has_venue,has_accommodation,status,created_at) values (1,'HRT Center','HRT','Hotel, Restaurant and Tourism Center. State-of-the-art event venues and 6 guest rooms.',true,true,'active','2026-11-09T02:08:18.988Z');
insert into public.facilities (id,name,code,description,has_venue,has_accommodation,status,created_at) values (2,'TLE Service Center','TLE','Technology and Livelihood Education Service Center. Premier event hall and 5 campus guest rooms.',true,true,'active','2026-11-09T02:08:18.988Z');
insert into public.venues (id,facility_id,name,capacity,capacity_tables,description,price,image_url,status,created_at) values (1,1,'HRT Grand Auditorium & Ballroom',150,100,'Prestigious collegiate auditorium equipped with motorized projection, high-fidelity acoustics, professional stage lighting, and banquet configuration.',5000.0,'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&auto=format&fit=crop&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.venues (id,facility_id,name,capacity,capacity_tables,description,price,image_url,status,created_at) values (2,2,'TLE Convention & Event Hall',150,100,'Spacious modern event space ideal for university symposia, research summits, academic seminars, and formal social galas.',4500.0,'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.room_types (id,name,description,capacity) values (1,'Single Room','One guest. Twin bed, private bathroom, study desk, AC, high-speed WiFi.',1);
insert into public.room_types (id,name,description,capacity) values (2,'Double Room','Up to two guests. Queen bed or twin beds, hot shower, AC, work desk.',2);
insert into public.room_types (id,name,description,capacity) values (3,'Family Room','Up to four guests. 1 Queen bed + 2 Twin beds, sitting area, mini fridge.',4);
insert into public.room_types (id,name,description,capacity) values (4,'Executive Suite','Up to two guests. King bed, lounge sofa, mini refrigerator, executive work desk.',2);
insert into public.room_types (id,name,description,capacity) values (5,'Deluxe Dormitory Suite','Up to six guests. Bunk beds, individual lockers, group study desk, spacious bath.',6);
insert into public.room_types (id,name,description,capacity) values (6,'Accessible Queen Room','Ground floor accessible design with roll-in hot shower, wide doorway, and assist grab bars.',2);
insert into public.room_types (id,name,description,capacity) values (7,'Garden Studio Suite','Peaceful garden patio view with private kitchenette, queen bed, and dining nook.',2);
insert into public.room_types (id,name,description,capacity) values (8,'VIP Presidential Penthouse','Top floor panoramic view, master king bed, luxury lounge, private balcony, executive workspace.',3);
insert into public.room_types (id,name,description,capacity) values (9,'Visiting Faculty & Scholar Suite','Tailored for visiting lecturers & researchers, with study library, king bed, and kitchenette.',2);
insert into public.room_types (id,name,description,capacity) values (10,'Skyview Family Suite','Spacious 4th-floor multi-bed setup with 1 King bed, 3 Twin beds, and panoramic lounge.',5);
insert into public.room_types (id,name,description,capacity) values (11,'Chancellor Presidential Suite','Premier top-floor suite featuring two master bedrooms, conference dining area, and scenic balcony.',4);
insert into public.room_types (id,name,description,capacity) values (12,'Studio Loft & Terrace','Modern open-plan loft with upper mezzanine queen bed, lounge kitchenette, and skyline terrace.',2);
insert into public.room_types (id,name,description,capacity) values (20,'Matriarch Suite','Prestigious master suite featuring king bed, luxury executive vanity, lounge area, and private balcony.',2);
insert into public.room_types (id,name,description,capacity) values (21,'Two Beds Deluxe','Spacious guest room featuring two double/queen beds, workstation desk, hot shower bath, and AC.',4);
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (1,2,1,'101',1,1200.0,'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (2,2,2,'102',2,1800.0,'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (3,2,3,'103',2,1800.0,'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (4,2,4,'104',2,2500.0,'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (5,2,5,'105',4,3200.0,'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (6,1,20,'201',2,2800.0,'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (7,1,21,'202',4,2200.0,'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (8,1,20,'203',2,2800.0,'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (9,1,21,'204',4,2200.0,'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (10,1,20,'206',2,2800.0,'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.rooms (id,facility_id,room_type_id,room_number,capacity,price_per_night,image_url,status,created_at) values (11,1,21,'207',4,2200.0,'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80','available','2026-11-09T02:08:18.988Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (1,'admin','System Administrator','admin@example.com','admin',NULL,'2026-11-09T02:08:18.988Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (2,'hrt_admin','HRT Venue Manager','hrt_admin@example.com','venue_admin',1,'2026-11-09T02:08:18.988Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (3,'tle_admin','TLE Facility Manager','tle_admin@example.com','venue_admin',2,'2026-11-09T02:08:18.988Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (4,'guest','George Eduard (Guest)','guest@example.com','guest',NULL,'2026-11-09T02:08:18.988Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (5,'juan','Juan Dela Cruz Updated','juan@test.com','guest',NULL,'2026-11-09T02:08:30.666Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (6,'reyes','Prof. Reyes','reyes@isatu.edu.ph','guest',NULL,'2026-11-09T02:09:28.665Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (7,'elena.velasco','Dr. Elena Velasco','elena.velasco@isatu.edu.ph','guest',NULL,'2026-11-09T02:10:18.816Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (8,'hrt_lead','HRT Lead Officer',NULL,'venue_admin',1,'2026-11-09T02:39:02.546Z');
insert into public.legacy_users (id,username,full_name,email,role,assigned_facility_id,created_at) values (9,'corazonaquino','Corazon Aquino','corazon.aquino@example.com','guest',NULL,'2026-11-09T02:39:19.088Z');
insert into public.venue_bookings (id,legacy_user_id,venue_id,event_name,booking_date,end_date,start_time,end_time,attendees,layout_type,layout_data,status,created_at) values (1,4,1,'Annual Tech Symposium','2026-11-25','2026-11-26','08:00','17:00',250,'banquet',NULL,'pending','2026-11-09T02:10:18.858Z');
insert into public.venue_bookings (id,legacy_user_id,venue_id,event_name,booking_date,end_date,start_time,end_time,attendees,layout_type,layout_data,status,created_at) values (2,4,1,'Valid Banquet Gala','2026-11-28','2026-11-28','08:00','17:00',100,'banquet',NULL,'pending','2026-11-09T02:27:43.969Z');
insert into public.venue_bookings (id,legacy_user_id,venue_id,event_name,booking_date,end_date,start_time,end_time,attendees,layout_type,layout_data,status,created_at) values (3,4,1,'Grand Keynote Assembly','2026-11-30','2026-11-30','08:00','17:00',150,'theater',NULL,'pending','2026-11-09T02:27:43.976Z');
insert into public.room_bookings (id,legacy_user_id,room_id,check_in,check_out,guests,special_orders,status,created_at) values (1,4,1,'2026-11-16','2026-11-18',1,'Late check-in requested around 9 PM, extra pillows','approved','2026-11-09T02:11:49.040Z');
insert into public.room_bookings (id,legacy_user_id,room_id,check_in,check_out,guests,special_orders,status,created_at) values (2,4,6,'2026-11-22','2026-11-24',2,'VIP Chancellor Guest, quiet room request','pending','2026-11-09T02:27:43.992Z');
insert into public.blackout_dates (id,venue_id,start_date,end_date,reason,legacy_created_by,created_at) values (1,1,'2026-11-23','2026-11-24','Annual Sound Engineering & Lighting Maintenance',2,'2026-11-09T02:08:18.988Z');
insert into public.blackout_dates (id,venue_id,start_date,end_date,reason,legacy_created_by,created_at) values (2,1,'2026-11-20','2026-11-22','ISATU Alumni Conference',2,'2026-11-09T02:09:28.672Z');
select setval(pg_get_serial_sequence('public.venue_bookings','id'), (select coalesce(max(id),1) from public.venue_bookings));
select setval(pg_get_serial_sequence('public.room_bookings','id'), (select coalesce(max(id),1) from public.room_bookings));
select setval(pg_get_serial_sequence('public.blackout_dates','id'), (select coalesce(max(id),1) from public.blackout_dates));
