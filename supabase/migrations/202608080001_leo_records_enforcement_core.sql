-- UltimateCAD Milestone 3.2 — LEO Records & Enforcement Core
begin;

insert into public.permissions(key,name,description,category) values
 ('leo.manage_warrants','Manage warrants','Create, serve, revoke and review warrants.','Law Enforcement'),
 ('leo.manage_traffic','Manage traffic stops','Create and update traffic stops.','Law Enforcement'),
 ('leo.manage_tow','Manage tow and impound','Request towing and manage impounds.','Law Enforcement'),
 ('leo.manage_booking','Manage jail booking','Create and update arrest bookings.','Law Enforcement'),
 ('leo.manage_units','Manage units','Manage operational unit status and assignments.','Law Enforcement'),
 ('leo.request_backup','Request backup','Request non-panic officer backup.','Law Enforcement')
on conflict(key) do update set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true from public.roles r cross join (values
 ('leo.manage_warrants'),('leo.manage_traffic'),('leo.manage_tow'),('leo.manage_booking'),('leo.manage_units'),('leo.request_backup')
) p(permission_key)
where r.name in ('Founder','Owner','Community Admin','Agency Director','Department Command','Supervisor','Officer')
on conflict(role_id,permission_key) do update set allowed=true;

create table if not exists public.penal_codes (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 code text not null, title text not null, category text not null default 'General', description text,
 classification text not null default 'Misdemeanor', fine_amount numeric(12,2) not null default 0,
 jail_minutes integer not null default 0, points integer not null default 0, bond_amount numeric(12,2) not null default 0,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(community_id,code)
);

create table if not exists public.leo_records (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 record_number text not null, record_type text not null check(record_type in ('report','citation','arrest')),
 status text not null default 'open', title text not null, narrative text,
 character_id uuid references public.characters(id) on delete set null, vehicle_id uuid references public.vehicles(id) on delete set null,
 officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null, officer_user_id uuid references public.profiles(id) on delete set null,
 location text, total_fine numeric(12,2) not null default 0, total_jail_minutes integer not null default 0,
 total_points integer not null default 0, bond_amount numeric(12,2) not null default 0,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz,
 unique(community_id,record_number)
);
create index if not exists leo_records_lookup_idx on public.leo_records(community_id,record_type,created_at desc);
create index if not exists leo_records_character_idx on public.leo_records(character_id,created_at desc);
create index if not exists leo_records_vehicle_idx on public.leo_records(vehicle_id,created_at desc);

create table if not exists public.leo_record_charges (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 record_id uuid not null references public.leo_records(id) on delete cascade, penal_code_id uuid references public.penal_codes(id) on delete set null,
 code text not null, title text not null, classification text, fine_amount numeric(12,2) not null default 0,
 jail_minutes integer not null default 0, points integer not null default 0, bond_amount numeric(12,2) not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.leo_warrants (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 warrant_number text not null, character_id uuid not null references public.characters(id) on delete cascade,
 officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null, created_by_user_id uuid references public.profiles(id) on delete set null,
 title text not null, probable_cause text not null, status text not null default 'active', priority text not null default 'normal',
 issued_at timestamptz not null default now(), expires_at timestamptz, served_at timestamptz, revoked_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 unique(community_id,warrant_number)
);

create table if not exists public.leo_traffic_stops (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 stop_number text not null, shift_id uuid references public.leo_shifts(id) on delete set null, officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null,
 character_id uuid references public.characters(id) on delete set null, vehicle_id uuid references public.vehicles(id) on delete set null,
 location text not null, reason text not null, status text not null default 'active', outcome text, started_at timestamptz not null default now(), ended_at timestamptz,
 unique(community_id,stop_number)
);

create table if not exists public.leo_tow_requests (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 request_number text not null, vehicle_id uuid references public.vehicles(id) on delete set null, requested_by_identifier_id uuid references public.leo_unit_profiles(id) on delete set null,
 location text not null, reason text not null, priority text not null default 'normal', status text not null default 'requested', requested_at timestamptz not null default now(), completed_at timestamptz,
 unique(community_id,request_number)
);

create table if not exists public.leo_impounds (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 impound_number text not null, vehicle_id uuid not null references public.vehicles(id) on delete cascade, tow_request_id uuid references public.leo_tow_requests(id) on delete set null,
 officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null, reason text not null, lot_name text, fee numeric(12,2) not null default 0,
 status text not null default 'held', impounded_at timestamptz not null default now(), released_at timestamptz, unique(community_id,impound_number)
);

create table if not exists public.leo_bookings (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 booking_number text not null, arrest_record_id uuid references public.leo_records(id) on delete set null, character_id uuid not null references public.characters(id) on delete cascade,
 officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null, status text not null default 'booked', jail_minutes integer not null default 0,
 bond_amount numeric(12,2) not null default 0, facility text, notes text, booked_at timestamptz not null default now(), released_at timestamptz,
 unique(community_id,booking_number)
);

create table if not exists public.leo_backup_requests (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
 shift_id uuid not null references public.leo_shifts(id) on delete cascade, officer_identifier_id uuid references public.leo_unit_profiles(id) on delete set null,
 location text, reason text, priority text not null default 'normal', status text not null default 'active', created_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists public.leo_call_history (
 id bigint generated always as identity primary key, community_id uuid not null references public.communities(id) on delete cascade,
 call_id uuid not null references public.leo_calls(id) on delete cascade, actor_user_id uuid references public.profiles(id) on delete set null,
 event_type text not null, description text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.leo_officer_activity (
 id bigint generated always as identity primary key, community_id uuid not null references public.communities(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null, identifier_id uuid references public.leo_unit_profiles(id) on delete set null,
 activity_type text not null, entity_type text, entity_id uuid, description text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.next_leo_record_number(p_community_id uuid,p_prefix text) returns text language plpgsql security definer set search_path=public as $$
declare v integer; begin
 select coalesce(max(nullif(regexp_replace(record_number,'\D','','g'),'')::integer),0)+1 into v from public.leo_records where community_id=p_community_id and record_number like upper(p_prefix)||'-%';
 return upper(p_prefix)||'-'||to_char(now(),'YY')||'-'||lpad(v::text,6,'0'); end $$;
create or replace function public.next_leo_entity_number(p_community_id uuid,p_prefix text) returns text language plpgsql security definer set search_path=public as $$
declare v integer; begin
 select count(*)+1 into v from public.leo_officer_activity where community_id=p_community_id and created_at >= date_trunc('year',now());
 return upper(p_prefix)||'-'||to_char(now(),'YY')||'-'||lpad(v::text,6,'0'); end $$;
grant execute on function public.next_leo_record_number(uuid,text) to authenticated;
grant execute on function public.next_leo_entity_number(uuid,text) to authenticated;

-- RLS: LEO members can read operational data; writes are performed through authenticated API after permission checks.
do $$ declare t text; begin foreach t in array array['penal_codes','leo_records','leo_record_charges','leo_warrants','leo_traffic_stops','leo_tow_requests','leo_impounds','leo_bookings','leo_backup_requests','leo_call_history','leo_officer_activity'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists %I on public.%I','leo read '||t,t);
 execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(community_id,''leo.view'') or public.is_community_owner(community_id))','leo read '||t,t);
 execute format('drop policy if exists %I on public.%I','leo write '||t,t);
 execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(community_id,''leo.manage_reports'') or public.is_community_owner(community_id)) with check (public.has_permission(community_id,''leo.manage_reports'') or public.is_community_owner(community_id))','leo write '||t,t);
 end loop; end $$;

commit;
