-- UltimateCAD Milestone 1.8 — Vehicles, Registration, Ownership and Insurance

begin;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  primary_owner_character_id uuid not null references public.characters(id) on delete restrict,
  vin text not null,
  registration_number text not null,
  plate_number text not null,
  make text not null,
  model text not null,
  model_year integer not null check (model_year between 1900 and 2100),
  color text not null,
  secondary_color text,
  vehicle_type text not null default 'car',
  body_style text,
  status text not null default 'active',
  registration_status text not null default 'active',
  registration_issued_at timestamptz not null default now(),
  registration_expires_at timestamptz not null default (now() + interval '12 months'),
  odometer integer not null default 0 check (odometer >= 0),
  purchase_price numeric(14,2),
  financed boolean not null default false,
  lienholder text,
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, vin),
  unique (community_id, registration_number),
  unique (community_id, plate_number),
  check (vehicle_type in ('car','truck','motorcycle','commercial','emergency','boat','aircraft','other')),
  check (status in ('active','stolen','recovered','impounded','seized','scrapped','inactive')),
  check (registration_status in ('pending','active','suspended','expired','revoked'))
);

create table if not exists public.vehicle_owners (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  ownership_percentage numeric(5,2) not null default 100 check (ownership_percentage > 0 and ownership_percentage <= 100),
  owner_type text not null default 'primary' check (owner_type in ('primary','co_owner')),
  acquired_at timestamptz not null default now(),
  released_at timestamptz,
  active boolean not null default true,
  unique (vehicle_id, character_id, active)
);

create table if not exists public.vehicle_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_character_id uuid not null references public.characters(id) on delete restrict,
  to_character_id uuid not null references public.characters(id) on delete restrict,
  sale_price numeric(14,2),
  status text not null default 'pending',
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (status in ('pending','accepted','approved','denied','cancelled','completed')),
  check (from_character_id <> to_character_id)
);

create table if not exists public.vehicle_status_history (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  previous_status text,
  new_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_dmv_notes (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  policy_number text not null,
  provider_name text not null,
  coverage_type text not null default 'full',
  status text not null default 'active',
  premium numeric(12,2) not null default 0,
  deductible numeric(12,2) not null default 0,
  coverage_limit numeric(14,2),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  auto_renew boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, policy_number),
  check (coverage_type in ('liability','collision','comprehensive','full','commercial')),
  check (status in ('pending','active','suspended','cancelled','expired','lapsed'))
);

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  policy_id uuid not null references public.insurance_policies(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  character_id uuid not null references public.characters(id) on delete cascade,
  claim_number text not null,
  incident_date timestamptz not null,
  description text not null,
  amount_claimed numeric(14,2) not null default 0,
  amount_approved numeric(14,2),
  status text not null default 'submitted',
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (community_id, claim_number),
  check (status in ('submitted','under_review','approved','partially_approved','denied','paid','closed'))
);

create index if not exists vehicles_owner_idx on public.vehicles(primary_owner_character_id,status);
create index if not exists vehicles_lookup_idx on public.vehicles(community_id,plate_number,vin,registration_number);
create index if not exists vehicle_owners_character_idx on public.vehicle_owners(character_id,active);
create index if not exists vehicle_transfers_status_idx on public.vehicle_transfer_requests(community_id,status,created_at);
create index if not exists insurance_character_idx on public.insurance_policies(character_id,status);
create index if not exists insurance_vehicle_idx on public.insurance_policies(vehicle_id,status);

alter table public.vehicles enable row level security;
alter table public.vehicle_owners enable row level security;
alter table public.vehicle_transfer_requests enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.vehicle_dmv_notes enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_claims enable row level security;

insert into public.permissions(key,name,description,category)
values
 ('vehicles.view','View vehicles','View authorized vehicle records.','Vehicles'),
 ('vehicles.manage','Manage vehicles','Manage registrations, status and ownership.','Vehicles'),
 ('vehicles.transfer','Transfer vehicles','Request and approve ownership transfers.','Vehicles'),
 ('insurance.view','View insurance','View insurance policies and claims.','Insurance'),
 ('insurance.manage','Manage insurance','Create and manage insurance policies and claims.','Insurance')
on conflict(key) do update
set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (
  values
   ('Founder','vehicles.view'),('Founder','vehicles.manage'),('Founder','vehicles.transfer'),('Founder','insurance.view'),('Founder','insurance.manage'),
   ('Owner','vehicles.view'),('Owner','vehicles.manage'),('Owner','vehicles.transfer'),('Owner','insurance.view'),('Owner','insurance.manage'),
   ('Community Admin','vehicles.view'),('Community Admin','vehicles.manage'),('Community Admin','vehicles.transfer'),('Community Admin','insurance.view'),('Community Admin','insurance.manage'),
   ('Agency Director','vehicles.view'),('Department Command','vehicles.view'),('Officer','vehicles.view')
) p(role_name,permission_key) on p.role_name=r.name
on conflict(role_id,permission_key) do update set allowed=true;

create or replace function public.generate_vehicle_plate(
  p_community_id uuid,
  p_prefix text default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plate text;
  v_prefix text;
begin
  v_prefix := upper(regexp_replace(coalesce(nullif(trim(p_prefix),''),'CAD'),'[^A-Za-z0-9]','','g'));
  v_prefix := substr(v_prefix,1,3);

  loop
    v_plate := v_prefix || '-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,5));
    exit when not exists(
      select 1 from public.vehicles
      where community_id=p_community_id and plate_number=v_plate
    );
  end loop;

  return v_plate;
end;
$$;

grant execute on function public.generate_vehicle_plate(uuid,text) to authenticated;

create or replace function public.create_vehicle_registration(
  p_character_id uuid,
  p_make text,
  p_model text,
  p_model_year integer,
  p_color text,
  p_secondary_color text default null,
  p_vehicle_type text default 'car',
  p_body_style text default null,
  p_plate_number text default null,
  p_purchase_price numeric default null,
  p_financed boolean default false,
  p_lienholder text default null,
  p_notes text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_vehicle public.vehicles;
  v_vin text;
  v_registration text;
  v_plate text;
begin
  select * into v_character
  from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;

  if v_character.id is null then raise exception 'Character not found or unavailable'; end if;
  if nullif(trim(p_make),'') is null or nullif(trim(p_model),'') is null then
    raise exception 'Make and model are required';
  end if;
  if p_model_year < 1900 or p_model_year > 2100 then raise exception 'Invalid model year'; end if;

  v_vin := public.generate_cad_identifier(v_character.community_id,'vin');
  v_registration := public.generate_cad_identifier(v_character.community_id,'vehicle_registration');
  v_plate := coalesce(nullif(upper(regexp_replace(trim(p_plate_number),'[^A-Za-z0-9-]','','g')),''),public.generate_vehicle_plate(v_character.community_id,null));

  insert into public.vehicles(
    community_id,primary_owner_character_id,vin,registration_number,plate_number,
    make,model,model_year,color,secondary_color,vehicle_type,body_style,
    purchase_price,financed,lienholder,notes,created_by_user_id
  ) values(
    v_character.community_id,v_character.id,v_vin,v_registration,v_plate,
    trim(p_make),trim(p_model),p_model_year,trim(p_color),nullif(trim(p_secondary_color),''),
    p_vehicle_type,nullif(trim(p_body_style),''),p_purchase_price,coalesce(p_financed,false),
    nullif(trim(p_lienholder),''),nullif(trim(p_notes),''),auth.uid()
  ) returning * into v_vehicle;

  insert into public.vehicle_owners(
    community_id,vehicle_id,character_id,ownership_percentage,owner_type
  ) values(v_character.community_id,v_vehicle.id,v_character.id,100,'primary');

  update public.generated_identifiers
  set entity_type='vehicle',entity_id=v_vehicle.id
  where community_id=v_character.community_id
    and readable_id in (v_vin,v_registration);

  insert into public.vehicle_status_history(
    community_id,vehicle_id,actor_user_id,new_status,reason
  ) values(v_character.community_id,v_vehicle.id,auth.uid(),'active','Vehicle registered.');

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description,
    metadata
  ) values(
    v_character.community_id,v_character.id,auth.uid(),'vehicle.registered',
    'Vehicle registered',
    p_model_year::text||' '||trim(p_make)||' '||trim(p_model)||' registered as '||v_registration||'.',
    jsonb_build_object('vehicle_id',v_vehicle.id,'plate',v_plate,'vin',v_vin)
  );

  return v_vehicle;
end;
$$;

grant execute on function public.create_vehicle_registration(uuid,text,text,integer,text,text,text,text,text,numeric,boolean,text,text) to authenticated;

create or replace function public.create_vehicle_insurance_policy(
  p_character_id uuid,
  p_vehicle_id uuid,
  p_provider_name text,
  p_coverage_type text,
  p_premium numeric,
  p_deductible numeric,
  p_coverage_limit numeric default null,
  p_auto_renew boolean default false,
  p_notes text default null
)
returns public.insurance_policies
language plpgsql
security definer
set search_path=public
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_policy public.insurance_policies;
  v_policy_number text;
begin
  select v.* into v_vehicle
  from public.vehicles v
  where v.id=p_vehicle_id
    and v.primary_owner_character_id=p_character_id
    and exists(
      select 1 from public.characters c
      where c.id=p_character_id and c.owner_user_id=auth.uid() and c.is_archived=false
    );

  if v_vehicle.id is null then raise exception 'Vehicle not found or not owned by this character'; end if;

  if exists(
    select 1 from public.insurance_policies
    where vehicle_id=v_vehicle.id and status='active' and expires_at>now()
  ) then raise exception 'This vehicle already has an active policy'; end if;

  v_policy_number := public.generate_cad_identifier(v_vehicle.community_id,'insurance_policy');

  insert into public.insurance_policies(
    community_id,character_id,vehicle_id,policy_number,provider_name,
    coverage_type,status,premium,deductible,coverage_limit,auto_renew,notes
  ) values(
    v_vehicle.community_id,p_character_id,v_vehicle.id,v_policy_number,trim(p_provider_name),
    p_coverage_type,'active',greatest(0,p_premium),greatest(0,p_deductible),
    p_coverage_limit,coalesce(p_auto_renew,false),nullif(trim(p_notes),'')
  ) returning * into v_policy;

  update public.generated_identifiers
  set entity_type='insurance_policy',entity_id=v_policy.id
  where community_id=v_vehicle.community_id and readable_id=v_policy_number;

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description,
    metadata
  ) values(
    v_vehicle.community_id,p_character_id,auth.uid(),'insurance.issued',
    'Insurance policy issued',
    v_policy_number||' issued for '||v_vehicle.model_year::text||' '||v_vehicle.make||' '||v_vehicle.model||'.',
    jsonb_build_object('policy_id',v_policy.id,'vehicle_id',v_vehicle.id)
  );

  return v_policy;
end;
$$;

grant execute on function public.create_vehicle_insurance_policy(uuid,uuid,text,text,numeric,numeric,numeric,boolean,text) to authenticated;

create or replace function public.update_vehicle_status(
  p_vehicle_id uuid,
  p_status text,
  p_reason text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_old text;
  v_allowed boolean;
begin
  select * into v_vehicle from public.vehicles where id=p_vehicle_id for update;
  if v_vehicle.id is null then raise exception 'Vehicle not found'; end if;

  v_allowed :=
    exists(
      select 1 from public.characters c
      where c.id=v_vehicle.primary_owner_character_id and c.owner_user_id=auth.uid()
    )
    or public.has_permission(v_vehicle.community_id,'vehicles.manage')
    or public.is_community_owner(v_vehicle.community_id);

  if not v_allowed then raise exception 'Vehicle access denied'; end if;
  if p_status not in ('active','stolen','recovered','impounded','seized','scrapped','inactive') then
    raise exception 'Invalid vehicle status';
  end if;

  v_old := v_vehicle.status;

  update public.vehicles
  set status=p_status,updated_at=now()
  where id=v_vehicle.id
  returning * into v_vehicle;

  insert into public.vehicle_status_history(
    community_id,vehicle_id,actor_user_id,previous_status,new_status,reason
  ) values(
    v_vehicle.community_id,v_vehicle.id,auth.uid(),v_old,p_status,
    nullif(trim(coalesce(p_reason,'')),'')
  );

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description,
    metadata
  ) values(
    v_vehicle.community_id,v_vehicle.primary_owner_character_id,auth.uid(),
    'vehicle.status','Vehicle status updated',
    v_vehicle.plate_number||' changed from '||v_old||' to '||p_status||'.',
    jsonb_build_object('vehicle_id',v_vehicle.id,'previous_status',v_old,'new_status',p_status)
  );

  return v_vehicle;
end;
$$;

grant execute on function public.update_vehicle_status(uuid,text,text) to authenticated;

create or replace function public.request_vehicle_transfer(
  p_vehicle_id uuid,
  p_to_state_id text,
  p_sale_price numeric default null,
  p_notes text default null
)
returns public.vehicle_transfer_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_from public.characters%rowtype;
  v_to public.characters%rowtype;
  v_transfer public.vehicle_transfer_requests;
begin
  select * into v_vehicle from public.vehicles where id=p_vehicle_id;
  if v_vehicle.id is null then raise exception 'Vehicle not found'; end if;

  select * into v_from
  from public.characters
  where id=v_vehicle.primary_owner_character_id and owner_user_id=auth.uid();

  if v_from.id is null then raise exception 'Only the primary owner can request a transfer'; end if;

  select * into v_to
  from public.characters
  where community_id=v_vehicle.community_id
    and upper(state_id)=upper(trim(p_to_state_id))
    and is_archived=false
  limit 1;

  if v_to.id is null then raise exception 'Receiving character was not found'; end if;
  if v_to.id=v_from.id then raise exception 'Cannot transfer a vehicle to the same character'; end if;

  insert into public.vehicle_transfer_requests(
    community_id,vehicle_id,from_character_id,to_character_id,sale_price,
    requested_by_user_id,notes
  ) values(
    v_vehicle.community_id,v_vehicle.id,v_from.id,v_to.id,p_sale_price,
    auth.uid(),nullif(trim(p_notes),'')
  ) returning * into v_transfer;

  return v_transfer;
end;
$$;

grant execute on function public.request_vehicle_transfer(uuid,text,numeric,text) to authenticated;

-- RLS
create policy "owners and authorized staff view vehicles"
on public.vehicles for select to authenticated
using(
  exists(
    select 1 from public.vehicle_owners vo
    join public.characters c on c.id=vo.character_id
    where vo.vehicle_id=vehicles.id and vo.active=true and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'vehicles.view')
  or public.is_community_owner(community_id)
);

create policy "owners view ownership records"
on public.vehicle_owners for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'vehicles.view')
  or public.is_community_owner(community_id)
);

create policy "participants view transfers"
on public.vehicle_transfer_requests for select to authenticated
using(
  exists(select 1 from public.characters c where c.id in (from_character_id,to_character_id) and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'vehicles.manage')
  or public.is_community_owner(community_id)
);

create policy "owners and staff view vehicle history"
on public.vehicle_status_history for select to authenticated
using(
  exists(
    select 1 from public.vehicles v
    join public.characters c on c.id=v.primary_owner_character_id
    where v.id=vehicle_id and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'vehicles.view')
  or public.is_community_owner(community_id)
);

create policy "staff view DMV notes"
on public.vehicle_dmv_notes for select to authenticated
using(
  public.has_permission(community_id,'vehicles.manage')
  or public.has_permission(community_id,'dmv.view')
  or public.is_community_owner(community_id)
);

create policy "owners and authorized staff view policies"
on public.insurance_policies for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'insurance.view')
  or public.is_community_owner(community_id)
);

create policy "owners and authorized staff view claims"
on public.insurance_claims for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'insurance.view')
  or public.is_community_owner(community_id)
);

commit;
