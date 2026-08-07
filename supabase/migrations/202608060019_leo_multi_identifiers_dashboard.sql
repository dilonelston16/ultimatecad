-- UltimateCAD Milestone 3.1
-- Commercial LEO dashboard + saved multi-identifier system

begin;

alter table public.leo_unit_profiles
  add column if not exists identifier_name text,
  add column if not exists is_default boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists suspended_reason text,
  add column if not exists last_used_at timestamptz,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists default_status text not null default 'available';

alter table public.leo_unit_profiles
  drop constraint if exists leo_unit_profiles_approval_status_check;

alter table public.leo_unit_profiles
  add constraint leo_unit_profiles_approval_status_check
  check (approval_status in ('pending','approved','denied','suspended','revoked'));

alter table public.leo_unit_profiles
  drop constraint if exists leo_unit_profiles_default_status_check;

alter table public.leo_unit_profiles
  add constraint leo_unit_profiles_default_status_check
  check (
    default_status in (
      'available','busy','en_route','on_scene','traffic_stop',
      'transporting','out_of_service','break'
    )
  );

-- Remove the former one-profile-per-community/user restriction.
alter table public.leo_unit_profiles
  drop constraint if exists leo_unit_profiles_community_id_user_id_key;

create unique index if not exists leo_identifier_name_unique
  on public.leo_unit_profiles(community_id,user_id,lower(identifier_name))
  where is_archived=false;

create unique index if not exists leo_default_identifier_unique
  on public.leo_unit_profiles(community_id,user_id)
  where is_default=true and is_archived=false;

create unique index if not exists leo_department_callsign_unique
  on public.leo_unit_profiles(
    community_id,
    coalesce(department_node_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(callsign)
  )
  where is_archived=false
    and approval_status='approved'
    and callsign is not null;

create unique index if not exists leo_department_badge_unique
  on public.leo_unit_profiles(
    community_id,
    coalesce(department_node_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(badge_number)
  )
  where is_archived=false
    and approval_status='approved'
    and badge_number is not null;

alter table public.leo_shifts
  add column if not exists identifier_id uuid
  references public.leo_unit_profiles(id) on delete set null;

update public.leo_shifts
set identifier_id=unit_profile_id
where identifier_id is null;

create table if not exists public.leo_user_preferences (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_identifier_id uuid references public.leo_unit_profiles(id) on delete set null,
  compact_mode boolean not null default false,
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id,user_id)
);

alter table public.leo_user_preferences enable row level security;

drop policy if exists "users manage own leo preferences"
on public.leo_user_preferences;

create policy "users manage own leo preferences"
on public.leo_user_preferences
for all
to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

-- Give every existing profile a usable identifier name and default.
update public.leo_unit_profiles p
set identifier_name=coalesce(
      nullif(trim(identifier_name),''),
      coalesce(nullif(trim(rank_name),''),'Officer')
      || ' · ' ||
      coalesce(nullif(trim(callsign),''),'Unit')
    ),
    last_used_at=coalesce(last_used_at,updated_at,created_at)
where identifier_name is null
   or trim(identifier_name)='';

with ranked as (
  select
    id,
    row_number() over(
      partition by community_id,user_id
      order by is_default desc,last_used_at desc nulls last,created_at
    ) as rn
  from public.leo_unit_profiles
  where is_archived=false
)
update public.leo_unit_profiles p
set is_default=(r.rn=1)
from ranked r
where p.id=r.id;

insert into public.leo_user_preferences(
  community_id,user_id,selected_identifier_id
)
select community_id,user_id,id
from public.leo_unit_profiles
where is_default=true
on conflict(community_id,user_id)
do update set
  selected_identifier_id=excluded.selected_identifier_id,
  updated_at=now();

create or replace function public.save_leo_identifier(
  p_community_id uuid,
  p_identifier_id uuid,
  p_identifier_name text,
  p_callsign text,
  p_badge_number text,
  p_rank_name text,
  p_console_platform text,
  p_agency_node_id uuid default null,
  p_department_node_id uuid default null,
  p_division_node_id uuid default null,
  p_subdivision_node_id uuid default null,
  p_is_default boolean default false,
  p_default_status text default 'available',
  p_certifications jsonb default '[]'::jsonb
)
returns public.leo_unit_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_identifier public.leo_unit_profiles;
  v_supervisor boolean;
begin
  if not (
    public.has_permission(p_community_id,'leo.clock_in')
    or public.is_community_owner(p_community_id)
  ) then
    raise exception 'LEO identifier permission required';
  end if;

  if nullif(trim(coalesce(p_identifier_name,'')),'') is null then
    raise exception 'Identifier name is required';
  end if;

  if nullif(trim(coalesce(p_callsign,'')),'') is null then
    raise exception 'Callsign is required';
  end if;

  if p_default_status not in (
    'available','busy','en_route','on_scene','traffic_stop',
    'transporting','out_of_service','break'
  ) then
    raise exception 'Invalid default status';
  end if;

  v_supervisor :=
    public.has_permission(p_community_id,'leo.supervisor')
    or public.has_permission(p_community_id,'leo.self_dispatch')
    or public.is_community_owner(p_community_id);

  if p_is_default then
    update public.leo_unit_profiles
    set is_default=false,updated_at=now()
    where community_id=p_community_id
      and user_id=auth.uid()
      and is_archived=false;
  end if;

  if p_identifier_id is null then
    insert into public.leo_unit_profiles(
      community_id,user_id,identifier_name,agency_node_id,
      department_node_id,division_node_id,subdivision_node_id,
      callsign,badge_number,rank_name,console_platform,supervisor,
      is_default,is_archived,approval_status,default_status,
      certifications,last_used_at,active
    )
    values(
      p_community_id,auth.uid(),trim(p_identifier_name),
      p_agency_node_id,p_department_node_id,p_division_node_id,
      p_subdivision_node_id,trim(p_callsign),
      nullif(trim(coalesce(p_badge_number,'')),''),
      nullif(trim(coalesce(p_rank_name,'')),''),
      nullif(trim(coalesce(p_console_platform,'')),''),
      v_supervisor,p_is_default,false,'approved',p_default_status,
      coalesce(p_certifications,'[]'::jsonb),now(),true
    )
    returning * into v_identifier;
  else
    update public.leo_unit_profiles
    set identifier_name=trim(p_identifier_name),
        agency_node_id=p_agency_node_id,
        department_node_id=p_department_node_id,
        division_node_id=p_division_node_id,
        subdivision_node_id=p_subdivision_node_id,
        callsign=trim(p_callsign),
        badge_number=nullif(trim(coalesce(p_badge_number,'')),''),
        rank_name=nullif(trim(coalesce(p_rank_name,'')),''),
        console_platform=nullif(trim(coalesce(p_console_platform,'')),''),
        supervisor=v_supervisor,
        is_default=p_is_default,
        default_status=p_default_status,
        certifications=coalesce(p_certifications,'[]'::jsonb),
        is_archived=false,
        active=true,
        updated_at=now()
    where id=p_identifier_id
      and community_id=p_community_id
      and user_id=auth.uid()
    returning * into v_identifier;
  end if;

  if v_identifier.id is null then
    raise exception 'Identifier could not be saved';
  end if;

  if not exists(
    select 1
    from public.leo_unit_profiles
    where community_id=p_community_id
      and user_id=auth.uid()
      and is_default=true
      and is_archived=false
  ) then
    update public.leo_unit_profiles
    set is_default=true
    where id=v_identifier.id
    returning * into v_identifier;
  end if;

  insert into public.leo_user_preferences(
    community_id,user_id,selected_identifier_id
  )
  values(p_community_id,auth.uid(),v_identifier.id)
  on conflict(community_id,user_id)
  do update set
    selected_identifier_id=excluded.selected_identifier_id,
    updated_at=now();

  return v_identifier;
exception
  when unique_violation then
    raise exception 'That callsign, badge number, or identifier name is already used in this department';
end;
$$;

grant execute on function public.save_leo_identifier(
  uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,boolean,text,jsonb
) to authenticated;

create or replace function public.select_leo_identifier(
  p_identifier_id uuid
)
returns public.leo_unit_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_identifier public.leo_unit_profiles;
begin
  select * into v_identifier
  from public.leo_unit_profiles
  where id=p_identifier_id
    and user_id=auth.uid()
    and is_archived=false;

  if v_identifier.id is null then
    raise exception 'Identifier not found';
  end if;

  if v_identifier.approval_status<>'approved' then
    raise exception 'This identifier is not approved for use';
  end if;

  if exists(
    select 1
    from public.leo_shifts
    where community_id=v_identifier.community_id
      and user_id=auth.uid()
      and clocked_out_at is null
      and coalesce(identifier_id,unit_profile_id)<>v_identifier.id
  ) then
    raise exception 'End the current shift before switching identifiers';
  end if;

  update public.leo_unit_profiles
  set last_used_at=now(),updated_at=now()
  where id=v_identifier.id
  returning * into v_identifier;

  insert into public.leo_user_preferences(
    community_id,user_id,selected_identifier_id
  )
  values(v_identifier.community_id,auth.uid(),v_identifier.id)
  on conflict(community_id,user_id)
  do update set
    selected_identifier_id=excluded.selected_identifier_id,
    updated_at=now();

  return v_identifier;
end;
$$;

grant execute on function public.select_leo_identifier(uuid)
to authenticated;

create or replace function public.archive_leo_identifier(
  p_identifier_id uuid,
  p_archive boolean default true
)
returns public.leo_unit_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_identifier public.leo_unit_profiles;
begin
  select * into v_identifier
  from public.leo_unit_profiles
  where id=p_identifier_id
    and user_id=auth.uid()
  for update;

  if v_identifier.id is null then
    raise exception 'Identifier not found';
  end if;

  if p_archive and exists(
    select 1 from public.leo_shifts
    where user_id=auth.uid()
      and clocked_out_at is null
      and coalesce(identifier_id,unit_profile_id)=v_identifier.id
  ) then
    raise exception 'End this identifier''s active shift before archiving it';
  end if;

  update public.leo_unit_profiles
  set is_archived=p_archive,
      active=not p_archive,
      is_default=case when p_archive then false else is_default end,
      updated_at=now()
  where id=v_identifier.id
  returning * into v_identifier;

  return v_identifier;
end;
$$;

grant execute on function public.archive_leo_identifier(uuid,boolean)
to authenticated;

create or replace function public.clock_in_leo_identifier(
  p_identifier_id uuid
)
returns public.leo_shifts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_identifier public.leo_unit_profiles;
  v_shift public.leo_shifts;
begin
  select * into v_identifier
  from public.leo_unit_profiles
  where id=p_identifier_id
    and user_id=auth.uid()
    and is_archived=false
    and approval_status='approved';

  if v_identifier.id is null then
    raise exception 'Approved identifier not found';
  end if;

  select * into v_shift
  from public.leo_shifts
  where community_id=v_identifier.community_id
    and user_id=auth.uid()
    and clocked_out_at is null;

  if v_shift.id is not null then
    if coalesce(v_shift.identifier_id,v_shift.unit_profile_id)=v_identifier.id then
      return v_shift;
    end if;
    raise exception 'End the current shift before changing identifiers';
  end if;

  insert into public.leo_shifts(
    community_id,unit_profile_id,identifier_id,user_id,status,
    current_assignment
  )
  values(
    v_identifier.community_id,v_identifier.id,v_identifier.id,auth.uid(),
    v_identifier.default_status,'Patrol'
  )
  returning * into v_shift;

  update public.leo_unit_profiles
  set last_used_at=now(),updated_at=now()
  where id=v_identifier.id;

  insert into public.leo_user_preferences(
    community_id,user_id,selected_identifier_id
  )
  values(v_identifier.community_id,auth.uid(),v_identifier.id)
  on conflict(community_id,user_id)
  do update set
    selected_identifier_id=excluded.selected_identifier_id,
    updated_at=now();

  return v_shift;
end;
$$;

grant execute on function public.clock_in_leo_identifier(uuid)
to authenticated;

commit;
