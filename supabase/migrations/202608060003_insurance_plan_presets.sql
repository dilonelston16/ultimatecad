-- UltimateCAD Milestone 1.8.1 — Insurance plan presets and policy controls

begin;

create table if not exists public.insurance_plan_presets (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  coverage_type text not null,
  premium numeric(12,2) not null,
  deductible numeric(12,2) not null,
  coverage_limit numeric(14,2) not null,
  collision_covered boolean not null default false,
  theft_covered boolean not null default false,
  fire_covered boolean not null default false,
  liability_covered boolean not null default true,
  commercial_use boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, code),
  check (coverage_type in ('liability','standard','full','premium','commercial'))
);

alter table public.insurance_plan_presets enable row level security;

drop policy if exists "members read insurance presets" on public.insurance_plan_presets;
create policy "members read insurance presets"
on public.insurance_plan_presets for select to authenticated
using (
  active = true
  and public.is_active_community_member(community_id)
);

drop policy if exists "insurance staff manage presets" on public.insurance_plan_presets;
create policy "insurance staff manage presets"
on public.insurance_plan_presets for all to authenticated
using (
  public.has_permission(community_id,'insurance.manage')
  or public.is_community_owner(community_id)
)
with check (
  public.has_permission(community_id,'insurance.manage')
  or public.is_community_owner(community_id)
);

alter table public.insurance_policies
  add column if not exists plan_preset_id uuid references public.insurance_plan_presets(id) on delete set null;

insert into public.insurance_plan_presets (
  community_id,code,name,description,coverage_type,
  premium,deductible,coverage_limit,
  collision_covered,theft_covered,fire_covered,liability_covered,
  commercial_use,sort_order
)
select
  c.id,
  plan.code,
  plan.name,
  plan.description,
  plan.coverage_type,
  plan.premium,
  plan.deductible,
  plan.coverage_limit,
  plan.collision_covered,
  plan.theft_covered,
  plan.fire_covered,
  plan.liability_covered,
  plan.commercial_use,
  plan.sort_order
from public.communities c
cross join (
  values
    (
      'LIABILITY',
      'Liability',
      'Basic legal protection for damage caused to another person or vehicle.',
      'liability',
      250::numeric,
      2500::numeric,
      25000::numeric,
      false,false,false,true,false,1
    ),
    (
      'STANDARD',
      'Standard',
      'Liability plus collision protection for everyday civilian vehicles.',
      'standard',
      600::numeric,
      1500::numeric,
      75000::numeric,
      true,false,false,true,false,2
    ),
    (
      'FULL',
      'Full Coverage',
      'Collision, theft, fire and liability protection for most personal vehicles.',
      'full',
      1000::numeric,
      750::numeric,
      150000::numeric,
      true,true,true,true,false,3
    ),
    (
      'PREMIUM',
      'Premium',
      'High-limit protection with a low deductible for luxury and high-value vehicles.',
      'premium',
      1800::numeric,
      250::numeric,
      350000::numeric,
      true,true,true,true,false,4
    ),
    (
      'COMMERCIAL',
      'Commercial Fleet',
      'Business-use protection for commercial vehicles and company fleets.',
      'commercial',
      2500::numeric,
      2000::numeric,
      500000::numeric,
      true,true,true,true,true,5
    )
) as plan(
  code,name,description,coverage_type,premium,deductible,coverage_limit,
  collision_covered,theft_covered,fire_covered,liability_covered,
  commercial_use,sort_order
)
on conflict (community_id,code) do update
set name=excluded.name,
    description=excluded.description,
    coverage_type=excluded.coverage_type,
    premium=excluded.premium,
    deductible=excluded.deductible,
    coverage_limit=excluded.coverage_limit,
    collision_covered=excluded.collision_covered,
    theft_covered=excluded.theft_covered,
    fire_covered=excluded.fire_covered,
    liability_covered=excluded.liability_covered,
    commercial_use=excluded.commercial_use,
    active=true,
    sort_order=excluded.sort_order,
    updated_at=now();

create or replace function public.create_vehicle_insurance_policy(
  p_character_id uuid,
  p_vehicle_id uuid,
  p_plan_preset_id uuid,
  p_provider_name text default 'Los Santos Mutual',
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
  v_plan public.insurance_plan_presets%rowtype;
  v_policy public.insurance_policies;
  v_policy_number text;
begin
  select v.* into v_vehicle
  from public.vehicles v
  where v.id=p_vehicle_id
    and v.primary_owner_character_id=p_character_id
    and exists (
      select 1
      from public.characters c
      where c.id=p_character_id
        and c.owner_user_id=auth.uid()
        and c.is_archived=false
    );

  if v_vehicle.id is null then
    raise exception 'Vehicle not found or not owned by this character';
  end if;

  select * into v_plan
  from public.insurance_plan_presets
  where id=p_plan_preset_id
    and community_id=v_vehicle.community_id
    and active=true;

  if v_plan.id is null then
    raise exception 'Insurance plan is unavailable';
  end if;

  if exists (
    select 1
    from public.insurance_policies
    where vehicle_id=v_vehicle.id
      and status='active'
      and expires_at>now()
  ) then
    raise exception 'This vehicle already has an active policy';
  end if;

  v_policy_number :=
    public.generate_cad_identifier(v_vehicle.community_id,'insurance_policy');

  insert into public.insurance_policies (
    community_id,character_id,vehicle_id,plan_preset_id,
    policy_number,provider_name,coverage_type,status,
    premium,deductible,coverage_limit,auto_renew,notes
  )
  values (
    v_vehicle.community_id,p_character_id,v_vehicle.id,v_plan.id,
    v_policy_number,
    coalesce(nullif(trim(p_provider_name),''),'Los Santos Mutual'),
    v_plan.coverage_type,
    'active',
    v_plan.premium,
    v_plan.deductible,
    v_plan.coverage_limit,
    coalesce(p_auto_renew,false),
    nullif(trim(coalesce(p_notes,'')),'')
  )
  returning * into v_policy;

  update public.generated_identifiers
  set entity_type='insurance_policy',entity_id=v_policy.id
  where community_id=v_vehicle.community_id
    and readable_id=v_policy_number;

  insert into public.character_timeline (
    community_id,character_id,actor_user_id,event_type,title,description,metadata
  )
  values (
    v_vehicle.community_id,p_character_id,auth.uid(),
    'insurance.issued',
    'Insurance policy issued',
    v_plan.name||' policy '||v_policy_number||' issued for '
      ||v_vehicle.model_year::text||' '||v_vehicle.make||' '||v_vehicle.model||'.',
    jsonb_build_object(
      'policy_id',v_policy.id,
      'vehicle_id',v_vehicle.id,
      'plan',v_plan.code
    )
  );

  return v_policy;
end;
$$;

grant execute on function public.create_vehicle_insurance_policy(
  uuid,uuid,uuid,text,boolean,text
) to authenticated;

create or replace function public.update_insurance_policy_status(
  p_policy_id uuid,
  p_status text,
  p_reason text default null
)
returns public.insurance_policies
language plpgsql
security definer
set search_path=public
as $$
declare
  v_policy public.insurance_policies%rowtype;
  v_owner boolean;
begin
  select * into v_policy
  from public.insurance_policies
  where id=p_policy_id
  for update;

  if v_policy.id is null then
    raise exception 'Policy not found';
  end if;

  select exists (
    select 1
    from public.characters c
    where c.id=v_policy.character_id
      and c.owner_user_id=auth.uid()
  ) into v_owner;

  if not (
    v_owner
    or public.has_permission(v_policy.community_id,'insurance.manage')
    or public.is_community_owner(v_policy.community_id)
  ) then
    raise exception 'Insurance policy access denied';
  end if;

  if p_status not in ('active','suspended','cancelled','expired','lapsed') then
    raise exception 'Invalid policy status';
  end if;

  update public.insurance_policies
  set status=p_status,
      notes=case
        when nullif(trim(coalesce(p_reason,'')),'') is null then notes
        else concat_ws(E'\n',notes,'Status reason: '||trim(p_reason))
      end,
      updated_at=now()
  where id=v_policy.id
  returning * into v_policy;

  return v_policy;
end;
$$;

grant execute on function public.update_insurance_policy_status(uuid,text,text)
to authenticated;

commit;
