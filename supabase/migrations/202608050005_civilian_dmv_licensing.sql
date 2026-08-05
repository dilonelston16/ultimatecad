-- UltimateCAD Milestone 1.5 — Civilian redesign, DMV and licensing

create table if not exists public.license_types (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('driver','weapon','other')),
  description text,
  requires_written_test boolean not null default true,
  requires_practical_test boolean not null default false,
  requires_staff_approval boolean not null default true,
  validity_months integer not null default 12 check (validity_months > 0),
  application_fee numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (community_id, code)
);

create table if not exists public.license_applications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  license_type_id uuid not null references public.license_types(id),
  application_number text not null,
  status text not null default 'submitted' check (status in ('submitted','testing','ready_for_review','approved','rejected','cancelled')),
  written_status text not null default 'not_required' check (written_status in ('not_required','pending','passed','failed')),
  practical_status text not null default 'not_required' check (practical_status in ('not_required','pending','passed','failed')),
  applicant_notes text,
  staff_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, application_number)
);

create table if not exists public.license_tests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  application_id uuid not null references public.license_applications(id) on delete cascade,
  test_type text not null check (test_type in ('written','practical')),
  status text not null default 'scheduled' check (status in ('scheduled','passed','failed','cancelled')),
  score numeric(5,2),
  scheduled_for timestamptz,
  completed_at timestamptz,
  examiner_user_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (application_id, test_type)
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  license_type_id uuid not null references public.license_types(id),
  application_id uuid references public.license_applications(id),
  license_number text not null,
  status text not null default 'valid' check (status in ('valid','expired','suspended','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  restrictions text,
  endorsements text,
  points integer not null default 0,
  issued_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, license_number)
);

create table if not exists public.license_events (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  license_id uuid not null references public.licenses(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists license_applications_character_idx on public.license_applications(character_id, created_at desc);
create index if not exists licenses_character_idx on public.licenses(character_id, status, expires_at);
create index if not exists license_tests_application_idx on public.license_tests(application_id);

alter table public.license_types enable row level security;
alter table public.license_applications enable row level security;
alter table public.license_tests enable row level security;
alter table public.licenses enable row level security;
alter table public.license_events enable row level security;

create or replace function public.identifier_code(p_identifier_type text)
returns text language sql immutable as $$
  select case lower(p_identifier_type)
    when 'state_id' then 'SID'
    when 'driver_license' then 'DL'
    when 'weapon_license' then 'WL'
    when 'license_application' then 'LAPP'
    when 'license_test' then 'TEST'
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

insert into public.permissions(key,name,description,category) values
 ('dmv.view','View DMV','View licensing applications and tests.','DMV'),
 ('dmv.manage_tests','Manage DMV tests','Record written and practical test outcomes.','DMV'),
 ('dmv.approve','Approve licenses','Approve or reject license applications.','DMV'),
 ('dmv.suspend','Suspend licenses','Suspend or revoke issued licenses.','DMV')
on conflict (key) do update set name=excluded.name,description=excluded.description,category=excluded.category;

create or replace function public.seed_default_license_types(p_community_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.license_types(community_id,code,name,category,description,requires_written_test,requires_practical_test,validity_months,application_fee)
  values
    (p_community_id,'DL-C','Class C Driver License','driver','Standard passenger vehicle license.',true,true,12,500),
    (p_community_id,'DL-M','Motorcycle License','driver','Motorcycle operating endorsement.',true,true,12,350),
    (p_community_id,'CDL-A','Commercial Driver License','driver','Heavy commercial vehicle license.',true,true,12,1000),
    (p_community_id,'WL-BASIC','Basic Weapon License','weapon','Permit to lawfully own and carry approved weapons.',true,true,12,1500)
  on conflict (community_id,code) do nothing;
end; $$;

do $$ declare c record; begin for c in select id from public.communities loop perform public.seed_default_license_types(c.id); end loop; end $$;

create or replace function public.submit_license_application(p_character_id uuid,p_license_type_id uuid,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; lt public.license_types%rowtype; app_id uuid; app_no text;
begin
  select * into c from public.characters where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
  if c.id is null then raise exception 'Character not found or unavailable'; end if;
  select * into lt from public.license_types where id=p_license_type_id and community_id=c.community_id and active=true;
  if lt.id is null then raise exception 'License type is unavailable'; end if;
  if exists(select 1 from public.license_applications where character_id=c.id and license_type_id=lt.id and status in ('submitted','testing','ready_for_review')) then raise exception 'An active application already exists'; end if;
  if exists(select 1 from public.licenses where character_id=c.id and license_type_id=lt.id and status='valid') then raise exception 'Character already has a valid license of this type'; end if;
  app_no:=public.generate_cad_identifier(c.community_id,'license_application');
  insert into public.license_applications(community_id,character_id,license_type_id,application_number,status,written_status,practical_status,applicant_notes)
  values(c.community_id,c.id,lt.id,app_no,'submitted',case when lt.requires_written_test then 'pending' else 'not_required' end,case when lt.requires_practical_test then 'pending' else 'not_required' end,nullif(trim(p_notes),'')) returning id into app_id;
  if lt.requires_written_test then insert into public.license_tests(community_id,application_id,test_type,status) values(c.community_id,app_id,'written','scheduled'); end if;
  if lt.requires_practical_test then insert into public.license_tests(community_id,application_id,test_type,status) values(c.community_id,app_id,'practical','scheduled'); end if;
  insert into public.character_timeline(community_id,character_id,actor_user_id,event_type,title,description)
  values(c.community_id,c.id,auth.uid(),'license.application','License application submitted',lt.name||' application '||app_no||' submitted.');
  return app_id;
end; $$;
grant execute on function public.submit_license_application(uuid,uuid,text) to authenticated;

create or replace function public.record_license_test(p_application_id uuid,p_test_type text,p_passed boolean,p_score numeric default null,p_notes text default null)
returns void language plpgsql security definer set search_path=public as $$
declare app public.license_applications%rowtype; allowed boolean;
begin
  select * into app from public.license_applications where id=p_application_id;
  if app.id is null then raise exception 'Application not found'; end if;
  allowed:=public.has_permission(app.community_id,'dmv.manage_tests') or exists(select 1 from public.community_memberships where community_id=app.community_id and user_id=auth.uid() and is_owner=true and status='active');
  if not allowed then raise exception 'DMV test permission required'; end if;
  update public.license_tests set status=case when p_passed then 'passed' else 'failed' end,score=p_score,completed_at=now(),examiner_user_id=auth.uid(),notes=nullif(trim(p_notes),'') where application_id=app.id and test_type=p_test_type;
  if p_test_type='written' then update public.license_applications set written_status=case when p_passed then 'passed' else 'failed' end,updated_at=now() where id=app.id;
  elsif p_test_type='practical' then update public.license_applications set practical_status=case when p_passed then 'passed' else 'failed' end,updated_at=now() where id=app.id;
  else raise exception 'Invalid test type'; end if;
  update public.license_applications set status=case when written_status in ('passed','not_required') and practical_status in ('passed','not_required') then 'ready_for_review' else 'testing' end,updated_at=now() where id=app.id;
end; $$;
grant execute on function public.record_license_test(uuid,text,boolean,numeric,text) to authenticated;

create or replace function public.review_license_application(p_application_id uuid,p_approve boolean,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare app public.license_applications%rowtype; lt public.license_types%rowtype; license_id uuid; license_no text; id_type text; allowed boolean;
begin
  select * into app from public.license_applications where id=p_application_id for update;
  if app.id is null then raise exception 'Application not found'; end if;
  allowed:=public.has_permission(app.community_id,'dmv.approve') or exists(select 1 from public.community_memberships where community_id=app.community_id and user_id=auth.uid() and is_owner=true and status='active');
  if not allowed then raise exception 'DMV approval permission required'; end if;
  if not p_approve then update public.license_applications set status='rejected',staff_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=app.id; return null; end if;
  if app.written_status not in ('passed','not_required') or app.practical_status not in ('passed','not_required') then raise exception 'Required tests must be passed first'; end if;
  select * into lt from public.license_types where id=app.license_type_id;
  id_type:=case when lt.category='weapon' then 'weapon_license' else 'driver_license' end;
  license_no:=public.generate_cad_identifier(app.community_id,id_type);
  insert into public.licenses(community_id,character_id,license_type_id,application_id,license_number,expires_at,issued_by)
  values(app.community_id,app.character_id,app.license_type_id,app.id,license_no,now()+make_interval(months=>lt.validity_months),auth.uid()) returning id into license_id;
  update public.generated_identifiers set entity_type='license',entity_id=license_id where community_id=app.community_id and readable_id=license_no;
  update public.license_applications set status='approved',staff_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=app.id;
  insert into public.license_events(community_id,license_id,actor_user_id,event_type,title,description) values(app.community_id,license_id,auth.uid(),'issued','License issued',lt.name||' issued as '||license_no||'.');
  insert into public.character_timeline(community_id,character_id,actor_user_id,event_type,title,description) values(app.community_id,app.character_id,auth.uid(),'license.issued','License issued',lt.name||' issued as '||license_no||'.');
  return license_id;
end; $$;
grant execute on function public.review_license_application(uuid,boolean,text) to authenticated;

create policy "members read license types" on public.license_types for select to authenticated using (public.is_active_community_member(community_id));
create policy "owners read own applications" on public.license_applications for select to authenticated using (exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'dmv.view') or exists(select 1 from public.community_memberships m where m.community_id=license_applications.community_id and m.user_id=auth.uid() and m.is_owner=true and m.status='active'));
create policy "owners read own tests" on public.license_tests for select to authenticated using (exists(select 1 from public.license_applications a join public.characters c on c.id=a.character_id where a.id=application_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'dmv.view'));
create policy "owners read own licenses" on public.licenses for select to authenticated using (exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'dmv.view'));
create policy "license events readable" on public.license_events for select to authenticated using (exists(select 1 from public.licenses l join public.characters c on c.id=l.character_id where l.id=license_id and (c.owner_user_id=auth.uid() or public.has_permission(l.community_id,'dmv.view'))));
