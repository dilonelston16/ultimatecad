-- UltimateCAD Milestone 3.0 — LEO / MDT Foundation

begin;

insert into public.permissions(key,name,description,category)
values
  ('leo.clock_in','Clock into LEO','Start and end an operational law-enforcement shift.','Law Enforcement'),
  ('leo.manage_calls','Manage LEO calls','Create, update, assign, and close calls.','Law Enforcement'),
  ('leo.view_units','View active units','View the connected active-unit board.','Law Enforcement'),
  ('leo.manage_bolos','Manage BOLOs','Create and update person and vehicle BOLOs.','Law Enforcement'),
  ('leo.view_records','Search MDT records','Search characters, vehicles, licences, weapons, properties, and businesses.','Law Enforcement'),
  ('leo.supervisor','LEO supervisor tools','Use self-dispatch and supervisor operational controls.','Law Enforcement')
on conflict(key) do update
set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (
  values
    ('Founder','leo.clock_in'),('Founder','leo.manage_calls'),('Founder','leo.view_units'),('Founder','leo.manage_bolos'),('Founder','leo.view_records'),('Founder','leo.supervisor'),
    ('Owner','leo.clock_in'),('Owner','leo.manage_calls'),('Owner','leo.view_units'),('Owner','leo.manage_bolos'),('Owner','leo.view_records'),('Owner','leo.supervisor'),
    ('Community Admin','leo.clock_in'),('Community Admin','leo.manage_calls'),('Community Admin','leo.view_units'),('Community Admin','leo.manage_bolos'),('Community Admin','leo.view_records'),('Community Admin','leo.supervisor'),
    ('Agency Director','leo.clock_in'),('Agency Director','leo.manage_calls'),('Agency Director','leo.view_units'),('Agency Director','leo.manage_bolos'),('Agency Director','leo.view_records'),('Agency Director','leo.supervisor'),
    ('Department Command','leo.clock_in'),('Department Command','leo.manage_calls'),('Department Command','leo.view_units'),('Department Command','leo.manage_bolos'),('Department Command','leo.view_records'),('Department Command','leo.supervisor'),
    ('Supervisor','leo.clock_in'),('Supervisor','leo.manage_calls'),('Supervisor','leo.view_units'),('Supervisor','leo.manage_bolos'),('Supervisor','leo.view_records'),('Supervisor','leo.supervisor'),
    ('Officer','leo.clock_in'),('Officer','leo.manage_calls'),('Officer','leo.view_units'),('Officer','leo.manage_bolos'),('Officer','leo.view_records'),
    ('Cadet','leo.clock_in'),('Cadet','leo.view_units'),('Cadet','leo.view_records')
) p(role_name,permission_key) on p.role_name=r.name
on conflict(role_id,permission_key) do update set allowed=true;

create table if not exists public.leo_unit_profiles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agency_node_id uuid references public.organization_nodes(id) on delete set null,
  department_node_id uuid references public.organization_nodes(id) on delete set null,
  division_node_id uuid references public.organization_nodes(id) on delete set null,
  subdivision_node_id uuid references public.organization_nodes(id) on delete set null,
  callsign text,
  badge_number text,
  rank_name text,
  console_platform text,
  supervisor boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id,user_id)
);

create table if not exists public.leo_shifts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  unit_profile_id uuid not null references public.leo_unit_profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'available',
  current_assignment text,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  last_status_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists leo_shifts_active_user_unique
  on public.leo_shifts(community_id,user_id)
  where clocked_out_at is null;

create index if not exists leo_shifts_active_idx
  on public.leo_shifts(community_id,clocked_out_at,status);

create table if not exists public.leo_calls (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  call_number text not null,
  title text not null,
  description text,
  location text not null,
  postal text,
  priority integer not null default 3,
  status text not null default 'open',
  caller_name text,
  caller_phone text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  closed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(community_id,call_number)
);

create index if not exists leo_calls_active_idx
  on public.leo_calls(community_id,status,priority,created_at desc);

create table if not exists public.leo_call_assignments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  call_id uuid not null references public.leo_calls(id) on delete cascade,
  shift_id uuid not null references public.leo_shifts(id) on delete cascade,
  assigned_by_user_id uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  cleared_at timestamptz,
  unique(call_id,shift_id)
);

create table if not exists public.leo_panic_alerts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  shift_id uuid not null references public.leo_shifts(id) on delete cascade,
  activated_by_user_id uuid not null references public.profiles(id) on delete cascade,
  location text,
  message text,
  status text not null default 'active',
  acknowledged_by_user_id uuid references public.profiles(id) on delete set null,
  activated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create index if not exists leo_panic_active_idx
  on public.leo_panic_alerts(community_id,status,activated_at desc);

create table if not exists public.leo_bolos (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  bolo_number text not null,
  bolo_type text not null default 'person',
  title text not null,
  description text not null,
  subject_name text,
  vehicle_plate text,
  vehicle_description text,
  risk_level text not null default 'normal',
  status text not null default 'active',
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  closed_at timestamptz,
  unique(community_id,bolo_number)
);

alter table public.leo_unit_profiles enable row level security;
alter table public.leo_shifts enable row level security;
alter table public.leo_calls enable row level security;
alter table public.leo_call_assignments enable row level security;
alter table public.leo_panic_alerts enable row level security;
alter table public.leo_bolos enable row level security;

drop policy if exists "leo members read unit profiles" on public.leo_unit_profiles;
create policy "leo members read unit profiles"
on public.leo_unit_profiles for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

drop policy if exists "leo members read shifts" on public.leo_shifts;
create policy "leo members read shifts"
on public.leo_shifts for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

drop policy if exists "leo members read calls" on public.leo_calls;
create policy "leo members read calls"
on public.leo_calls for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

drop policy if exists "leo members read assignments" on public.leo_call_assignments;
create policy "leo members read assignments"
on public.leo_call_assignments for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

drop policy if exists "leo members read panic alerts" on public.leo_panic_alerts;
create policy "leo members read panic alerts"
on public.leo_panic_alerts for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

drop policy if exists "leo members read bolos" on public.leo_bolos;
create policy "leo members read bolos"
on public.leo_bolos for select to authenticated
using (
  public.has_permission(community_id,'leo.view')
  or public.is_community_owner(community_id)
);

create or replace function public.next_leo_identifier(
  p_community_id uuid,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_next integer;
  v_candidate text;
begin
  if p_prefix='CALL' then
    select coalesce(max(nullif(regexp_replace(call_number,'\D','','g'), '')::integer),0)+1
    into v_next
    from public.leo_calls
    where community_id=p_community_id;
  else
    select coalesce(max(nullif(regexp_replace(bolo_number,'\D','','g'), '')::integer),0)+1
    into v_next
    from public.leo_bolos
    where community_id=p_community_id;
  end if;

  v_candidate:=upper(p_prefix)||'-'||to_char(now(),'YY')||'-'||lpad(v_next::text,6,'0');
  return v_candidate;
end;
$$;

grant execute on function public.next_leo_identifier(uuid,text) to authenticated;

create or replace function public.ensure_leo_unit_profile(
  p_community_id uuid,
  p_callsign text,
  p_badge_number text,
  p_rank_name text,
  p_console_platform text,
  p_agency_node_id uuid default null,
  p_department_node_id uuid default null,
  p_division_node_id uuid default null,
  p_subdivision_node_id uuid default null
)
returns public.leo_unit_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.leo_unit_profiles;
  v_supervisor boolean;
begin
  if not (
    public.has_permission(p_community_id,'leo.clock_in')
    or public.is_community_owner(p_community_id)
  ) then raise exception 'LEO clock-in permission required'; end if;

  if nullif(trim(coalesce(p_callsign,'')),'') is null then
    raise exception 'Callsign is required';
  end if;

  v_supervisor :=
    public.has_permission(p_community_id,'leo.supervisor')
    or public.has_permission(p_community_id,'leo.self_dispatch')
    or public.is_community_owner(p_community_id);

  insert into public.leo_unit_profiles(
    community_id,user_id,agency_node_id,department_node_id,division_node_id,
    subdivision_node_id,callsign,badge_number,rank_name,console_platform,
    supervisor,active
  )
  values(
    p_community_id,auth.uid(),p_agency_node_id,p_department_node_id,
    p_division_node_id,p_subdivision_node_id,trim(p_callsign),
    nullif(trim(coalesce(p_badge_number,'')),''),
    nullif(trim(coalesce(p_rank_name,'')),''),
    nullif(trim(coalesce(p_console_platform,'')),''),
    v_supervisor,true
  )
  on conflict(community_id,user_id)
  do update set
    agency_node_id=excluded.agency_node_id,
    department_node_id=excluded.department_node_id,
    division_node_id=excluded.division_node_id,
    subdivision_node_id=excluded.subdivision_node_id,
    callsign=excluded.callsign,
    badge_number=excluded.badge_number,
    rank_name=excluded.rank_name,
    console_platform=excluded.console_platform,
    supervisor=v_supervisor,
    active=true,
    updated_at=now()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.ensure_leo_unit_profile(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid
) to authenticated;

create or replace function public.clock_in_leo(
  p_community_id uuid,
  p_callsign text,
  p_badge_number text,
  p_rank_name text,
  p_console_platform text,
  p_agency_node_id uuid default null,
  p_department_node_id uuid default null,
  p_division_node_id uuid default null,
  p_subdivision_node_id uuid default null
)
returns public.leo_shifts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_unit public.leo_unit_profiles;
  v_shift public.leo_shifts;
begin
  v_unit:=public.ensure_leo_unit_profile(
    p_community_id,p_callsign,p_badge_number,p_rank_name,p_console_platform,
    p_agency_node_id,p_department_node_id,p_division_node_id,p_subdivision_node_id
  );

  select * into v_shift
  from public.leo_shifts
  where community_id=p_community_id
    and user_id=auth.uid()
    and clocked_out_at is null;

  if v_shift.id is not null then return v_shift; end if;

  insert into public.leo_shifts(
    community_id,unit_profile_id,user_id,status,current_assignment
  )
  values(p_community_id,v_unit.id,auth.uid(),'available','Patrol')
  returning * into v_shift;

  insert into public.audit_logs(
    community_id,actor_user_id,action,target_type,target_id,metadata
  )
  values(
    p_community_id,auth.uid(),'leo.clock_in','leo_shift',v_shift.id::text,
    jsonb_build_object('callsign',v_unit.callsign)
  );

  return v_shift;
end;
$$;

grant execute on function public.clock_in_leo(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid
) to authenticated;

create or replace function public.update_leo_shift(
  p_shift_id uuid,
  p_action text,
  p_status text default null,
  p_assignment text default null
)
returns public.leo_shifts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_shift public.leo_shifts;
begin
  select * into v_shift
  from public.leo_shifts
  where id=p_shift_id
    and user_id=auth.uid()
    and clocked_out_at is null
  for update;

  if v_shift.id is null then raise exception 'Active shift not found'; end if;

  if p_action='clock_out' then
    update public.leo_shifts
    set status='off_duty',
        clocked_out_at=now(),
        last_status_at=now(),
        current_assignment=null
    where id=v_shift.id
    returning * into v_shift;
  elsif p_action='status' then
    if p_status not in (
      'available','busy','en_route','on_scene','traffic_stop',
      'transporting','out_of_service','break'
    ) then raise exception 'Invalid unit status'; end if;

    update public.leo_shifts
    set status=p_status,
        current_assignment=coalesce(nullif(trim(coalesce(p_assignment,'')),''),current_assignment),
        last_status_at=now()
    where id=v_shift.id
    returning * into v_shift;
  else
    raise exception 'Unsupported shift action';
  end if;

  return v_shift;
end;
$$;

grant execute on function public.update_leo_shift(uuid,text,text,text)
to authenticated;

create or replace function public.create_leo_call(
  p_community_id uuid,
  p_title text,
  p_location text,
  p_priority integer,
  p_description text default null,
  p_postal text default null
)
returns public.leo_calls
language plpgsql
security definer
set search_path=public
as $$
declare
  v_call public.leo_calls;
begin
  if not (
    public.has_permission(p_community_id,'leo.manage_calls')
    or public.is_community_owner(p_community_id)
  ) then raise exception 'Call management permission required'; end if;

  if nullif(trim(coalesce(p_title,'')),'') is null
     or nullif(trim(coalesce(p_location,'')),'') is null then
    raise exception 'Call title and location are required';
  end if;

  insert into public.leo_calls(
    community_id,call_number,title,description,location,postal,
    priority,status,created_by_user_id
  )
  values(
    p_community_id,public.next_leo_identifier(p_community_id,'CALL'),
    trim(p_title),nullif(trim(coalesce(p_description,'')),''),
    trim(p_location),nullif(trim(coalesce(p_postal,'')),''),
    greatest(1,least(coalesce(p_priority,3),5)),
    'open',auth.uid()
  )
  returning * into v_call;

  return v_call;
end;
$$;

grant execute on function public.create_leo_call(
  uuid,text,text,integer,text,text
) to authenticated;

create or replace function public.self_dispatch_leo_call(
  p_call_id uuid,
  p_shift_id uuid
)
returns public.leo_call_assignments
language plpgsql
security definer
set search_path=public
as $$
declare
  v_call public.leo_calls%rowtype;
  v_shift public.leo_shifts%rowtype;
  v_assignment public.leo_call_assignments;
begin
  select * into v_call from public.leo_calls where id=p_call_id and status in ('open','assigned') for update;
  select * into v_shift from public.leo_shifts where id=p_shift_id and user_id=auth.uid() and clocked_out_at is null for update;

  if v_call.id is null then raise exception 'Active call not found'; end if;
  if v_shift.id is null then raise exception 'Active shift not found'; end if;

  if not (
    public.has_permission(v_call.community_id,'leo.self_dispatch')
    or public.has_permission(v_call.community_id,'leo.supervisor')
    or public.is_community_owner(v_call.community_id)
  ) then raise exception 'Supervisor self-dispatch permission required'; end if;

  insert into public.leo_call_assignments(
    community_id,call_id,shift_id,assigned_by_user_id
  )
  values(v_call.community_id,v_call.id,v_shift.id,auth.uid())
  on conflict(call_id,shift_id)
  do update set cleared_at=null,assigned_at=now(),assigned_by_user_id=auth.uid()
  returning * into v_assignment;

  update public.leo_calls set status='assigned',updated_at=now() where id=v_call.id;
  update public.leo_shifts
  set status='en_route',
      current_assignment=v_call.call_number||' · '||v_call.title,
      last_status_at=now()
  where id=v_shift.id;

  return v_assignment;
end;
$$;

grant execute on function public.self_dispatch_leo_call(uuid,uuid)
to authenticated;

create or replace function public.activate_leo_panic(
  p_shift_id uuid,
  p_location text default null,
  p_message text default 'Officer activated emergency panic'
)
returns public.leo_panic_alerts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_shift public.leo_shifts%rowtype;
  v_alert public.leo_panic_alerts;
begin
  select * into v_shift
  from public.leo_shifts
  where id=p_shift_id
    and user_id=auth.uid()
    and clocked_out_at is null;

  if v_shift.id is null then raise exception 'You must be clocked in'; end if;

  if not (
    public.has_permission(v_shift.community_id,'leo.activate_panic')
    or public.is_community_owner(v_shift.community_id)
  ) then raise exception 'Panic permission required'; end if;

  insert into public.leo_panic_alerts(
    community_id,shift_id,activated_by_user_id,location,message,status
  )
  values(
    v_shift.community_id,v_shift.id,auth.uid(),
    nullif(trim(coalesce(p_location,'')),''),
    coalesce(nullif(trim(coalesce(p_message,'')),''),'Officer activated emergency panic'),
    'active'
  )
  returning * into v_alert;

  update public.leo_shifts
  set status='busy',
      current_assignment='PANIC ACTIVATED',
      last_status_at=now()
  where id=v_shift.id;

  return v_alert;
end;
$$;

grant execute on function public.activate_leo_panic(uuid,text,text)
to authenticated;

commit;
