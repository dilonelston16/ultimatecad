-- UltimateCAD Milestone 1.4 — Character System and Automatic ID Engine

create table if not exists public.identifier_counters (
  community_id uuid not null references public.communities(id) on delete cascade,
  identifier_type text not null,
  next_value bigint not null default 100001,
  updated_at timestamptz not null default now(),
  primary key (community_id, identifier_type)
);

create table if not exists public.generated_identifiers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  identifier_type text not null,
  readable_id text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, identifier_type, readable_id),
  unique (community_id, readable_id)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  state_id text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  gender text,
  phone_number text,
  address text,
  occupation text,
  emergency_contact_name text,
  emergency_contact_phone text,
  hair_color text,
  eye_color text,
  height text,
  weight text,
  photo_url text,
  status text not null default 'active' check (status in ('active','inactive','deceased')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, state_id)
);

create table if not exists public.active_characters (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id),
  unique (community_id, character_id)
);

create table if not exists public.character_timeline (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists characters_owner_idx on public.characters(community_id, owner_user_id, is_archived);
create index if not exists characters_name_idx on public.characters(community_id, last_name, first_name);
create index if not exists character_timeline_character_idx on public.character_timeline(character_id, created_at desc);

alter table public.identifier_counters enable row level security;
alter table public.generated_identifiers enable row level security;
alter table public.characters enable row level security;
alter table public.active_characters enable row level security;
alter table public.character_timeline enable row level security;

create or replace function public.identifier_code(p_identifier_type text)
returns text
language sql
immutable
as $$
  select case lower(p_identifier_type)
    when 'state_id' then 'SID'
    when 'driver_license' then 'DL'
    when 'weapon_license' then 'WL'
    when 'insurance_policy' then 'INS'
    when 'weapon_serial' then 'WS'
    when 'vin' then 'VIN'
    when 'vehicle_registration' then 'REG'
    when 'bank_account' then 'BANK'
    when 'business' then 'BIZ'
    when 'report' then 'RPT'
    when 'citation' then 'CIT'
    when 'arrest' then 'ARR'
    when 'warrant' then 'WAR'
    when 'court_case' then 'CASE'
    when 'evidence' then 'EVD'
    when 'jail_booking' then 'JAIL'
    when 'tow_record' then 'TOW'
    else upper(substr(regexp_replace(p_identifier_type,'[^A-Za-z0-9]','','g'),1,8))
  end;
$$;

create or replace function public.generate_cad_identifier(
  p_community_id uuid,
  p_identifier_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_value bigint;
  community_prefix text;
  generated_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_active_community_member(p_community_id) then raise exception 'Active community membership required'; end if;

  select upper(regexp_replace(prefix,'[^A-Za-z0-9]','','g'))
  into community_prefix
  from public.communities
  where id = p_community_id;

  if community_prefix is null or community_prefix = '' then community_prefix := 'CAD'; end if;

  insert into public.identifier_counters(community_id, identifier_type, next_value)
  values (p_community_id, lower(p_identifier_type), 100002)
  on conflict (community_id, identifier_type)
  do update set next_value = public.identifier_counters.next_value + 1, updated_at = now()
  returning next_value - 1 into current_value;

  generated_value := community_prefix || '-' || public.identifier_code(p_identifier_type) || '-' || lpad(current_value::text, 6, '0');

  insert into public.generated_identifiers(community_id, identifier_type, readable_id)
  values (p_community_id, lower(p_identifier_type), generated_value);

  return generated_value;
end;
$$;

grant execute on function public.generate_cad_identifier(uuid,text) to authenticated;

create or replace function public.create_character(
  p_community_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_date_of_birth date,
  p_gender text default null,
  p_phone_number text default null,
  p_address text default null,
  p_occupation text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_hair_color text default null,
  p_eye_color text default null,
  p_height text default null,
  p_weight text default null,
  p_photo_url text default null
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  new_character public.characters;
  new_state_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_active_community_member(p_community_id) then raise exception 'Active community membership required'; end if;
  if nullif(trim(p_first_name),'') is null or nullif(trim(p_last_name),'') is null then raise exception 'First and last name are required'; end if;

  new_state_id := public.generate_cad_identifier(p_community_id, 'state_id');

  insert into public.characters(
    community_id, owner_user_id, state_id, first_name, middle_name, last_name,
    date_of_birth, gender, phone_number, address, occupation,
    emergency_contact_name, emergency_contact_phone, hair_color, eye_color,
    height, weight, photo_url
  ) values (
    p_community_id, auth.uid(), new_state_id, trim(p_first_name), nullif(trim(p_middle_name),''), trim(p_last_name),
    p_date_of_birth, nullif(trim(p_gender),''), nullif(trim(p_phone_number),''), nullif(trim(p_address),''), nullif(trim(p_occupation),''),
    nullif(trim(p_emergency_contact_name),''), nullif(trim(p_emergency_contact_phone),''), nullif(trim(p_hair_color),''), nullif(trim(p_eye_color),''),
    nullif(trim(p_height),''), nullif(trim(p_weight),''), nullif(trim(p_photo_url),'')
  ) returning * into new_character;

  update public.generated_identifiers
  set entity_type='character', entity_id=new_character.id
  where community_id=p_community_id and readable_id=new_state_id;

  insert into public.character_timeline(community_id, character_id, actor_user_id, event_type, title, description)
  values(p_community_id, new_character.id, auth.uid(), 'character.created', 'Character created', 'State identity issued as ' || new_state_id || '.');

  insert into public.active_characters(community_id,user_id,character_id)
  values(p_community_id,auth.uid(),new_character.id)
  on conflict(community_id,user_id) do nothing;

  insert into public.audit_logs(community_id,actor_user_id,action,target_type,target_id,metadata)
  values(p_community_id,auth.uid(),'character.created','character',new_character.id::text,jsonb_build_object('state_id',new_state_id));

  return new_character;
end;
$$;

grant execute on function public.create_character(uuid,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.set_active_character(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare selected_character public.characters%rowtype;
begin
  select * into selected_character from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
  if selected_character.id is null then raise exception 'Character not found or unavailable'; end if;

  insert into public.active_characters(community_id,user_id,character_id,updated_at)
  values(selected_character.community_id,auth.uid(),selected_character.id,now())
  on conflict(community_id,user_id)
  do update set character_id=excluded.character_id, updated_at=now();
end;
$$;

grant execute on function public.set_active_character(uuid) to authenticated;

create policy "members can read identifier registry"
on public.generated_identifiers for select to authenticated
using (public.is_active_community_member(community_id));

create policy "members can read own characters"
on public.characters for select to authenticated
using (owner_user_id=auth.uid() and public.is_active_community_member(community_id));

create policy "members can update own characters"
on public.characters for update to authenticated
using (owner_user_id=auth.uid() and public.is_active_community_member(community_id))
with check (owner_user_id=auth.uid() and public.is_active_community_member(community_id));

create policy "members can read own active character"
on public.active_characters for select to authenticated
using (user_id=auth.uid() and public.is_active_community_member(community_id));

create policy "members can read own character timeline"
on public.character_timeline for select to authenticated
using (exists(select 1 from public.characters c where c.id=character_timeline.character_id and c.owner_user_id=auth.uid()));
