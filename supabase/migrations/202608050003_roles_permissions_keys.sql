-- UltimateCAD Milestone 1.3 — roles, permissions and access keys

alter table public.roles
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists discord_role_id text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.member_role_assignments
  add column if not exists assigned_by uuid references public.profiles(id),
  add column if not exists organization_node_id uuid references public.organization_nodes(id) on delete cascade;

alter table public.permission_keys
  add column if not exists organization_node_id uuid references public.organization_nodes(id) on delete cascade,
  add column if not exists code text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists redeemed_at timestamptz;

create unique index if not exists permission_keys_active_code_key
  on public.permission_keys (community_id, upper(code))
  where code is not null;

insert into public.permissions (key,name,description,category) values
('community.view_members','View community members','View members and their access assignments.','Community'),
('community.manage_members','Manage community members','Assign roles and manage member access.','Community'),
('permissions.create_keys','Create permission keys','Create expiring or limited-use access keys.','Administration'),
('permissions.assign_roles','Assign roles','Assign roles to community members.','Administration'),
('organization.view','View organization','View the community organization structure.','Administration'),
('discord.manage_role_mappings','Manage Discord mappings','Configure Discord role IDs for CAD roles.','Integrations')
on conflict (key) do update set name=excluded.name, description=excluded.description, category=excluded.category;

create or replace function public.has_permission(target_community_id uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_community_owner(target_community_id)
  or exists (
    select 1
    from public.community_memberships m
    join public.member_role_assignments a on a.membership_id = m.id
    join public.roles r on r.id = a.role_id and r.community_id = m.community_id and r.is_archived = false
    join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = requested_permission and rp.allowed = true
    where m.community_id = target_community_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

grant execute on function public.has_permission(uuid,text) to authenticated;

create or replace function public.generate_permission_key_code(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare candidate text;
begin
  loop
    candidate := upper(coalesce(nullif(regexp_replace(p_prefix,'[^A-Za-z0-9]','','g'),''),'CAD'))
      || '-KEY-' || upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text),1,8));
    exit when not exists(select 1 from public.permission_keys where upper(code)=candidate);
  end loop;
  return candidate;
end;
$$;

grant execute on function public.generate_permission_key_code(text) to authenticated;

create or replace function public.redeem_permission_key(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_key public.permission_keys%rowtype;
  selected_membership uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into selected_key
  from public.permission_keys
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  for update;

  if selected_key.id is null then raise exception 'Permission key is invalid, expired or fully used'; end if;

  select id into selected_membership
  from public.community_memberships
  where community_id=selected_key.community_id and user_id=auth.uid() and status='active';

  if selected_membership is null then raise exception 'You must join the community before using this key'; end if;

  insert into public.member_role_assignments(membership_id,role_id,assigned_by,organization_node_id)
  values(selected_membership,selected_key.role_id,selected_key.created_by,selected_key.organization_node_id)
  on conflict (membership_id,role_id) do nothing;

  update public.permission_keys
  set used_count=used_count+1,
      active=case when max_uses is not null and used_count+1>=max_uses then false else active end,
      redeemed_at=now()
  where id=selected_key.id;

  insert into public.audit_logs(community_id,actor_user_id,action,target_type,target_id,metadata)
  values(selected_key.community_id,auth.uid(),'permission_key.redeemed','permission_key',selected_key.id::text,jsonb_build_object('role_id',selected_key.role_id));

  return selected_key.role_id;
end;
$$;

grant execute on function public.redeem_permission_key(text) to authenticated;

-- Seed a practical default hierarchy for every existing community.
insert into public.roles(community_id,name,rank_level,is_system,description,color)
select c.id, seed.name, seed.rank_level, true, seed.description, seed.color
from public.communities c
cross join (values
 ('Owner',900,'Full community administration below Founder.','#8b5cf6'),
 ('Community Admin',800,'Manage community operations, members and configuration.','#6366f1'),
 ('Agency Director',700,'Lead an agency and its departments.','#3b82f6'),
 ('Department Command',600,'Manage a department and its divisions.','#0ea5e9'),
 ('Supervisor',400,'Supervise members and approve operational records.','#14b8a6'),
 ('Officer',200,'Standard operational department access.','#22c55e'),
 ('Cadet',100,'Entry-level department access with restricted approvals.','#f59e0b'),
 ('Civilian',0,'Shared civilian access only.','#94a3b8')
) as seed(name,rank_level,description,color)
where not exists(select 1 from public.roles r where r.community_id=c.id and r.organization_node_id is null and r.name=seed.name);

-- Founder and Owner receive every permission.
insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.key,true
from public.roles r cross join public.permissions p
where r.name in ('Founder','Owner')
on conflict(role_id,permission_key) do update set allowed=true;

-- Useful defaults for command and operational roles.
insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (values
 ('Community Admin','organization.manage'),('Community Admin','permissions.manage'),('Community Admin','community.view_members'),('Community Admin','community.manage_members'),('Community Admin','permissions.create_keys'),('Community Admin','permissions.assign_roles'),
 ('Agency Director','organization.view'),('Agency Director','community.view_members'),('Agency Director','leo.view'),('Agency Director','leo.self_dispatch'),('Agency Director','leo.manage_reports'),('Agency Director','leo.attach_penal_codes'),
 ('Department Command','organization.view'),('Department Command','community.view_members'),('Department Command','leo.view'),('Department Command','leo.self_dispatch'),('Department Command','leo.manage_reports'),('Department Command','leo.attach_penal_codes'),
 ('Supervisor','leo.view'),('Supervisor','leo.self_dispatch'),('Supervisor','leo.manage_reports'),('Supervisor','leo.attach_penal_codes'),('Supervisor','leo.activate_panic'),
 ('Officer','leo.view'),('Officer','leo.manage_reports'),('Officer','leo.attach_penal_codes'),('Officer','leo.activate_panic'),
 ('Cadet','leo.view'),('Cadet','leo.manage_reports'),('Cadet','leo.attach_penal_codes'),('Cadet','leo.activate_panic')
) as p(role_name,permission_key) on p.role_name=r.name
on conflict(role_id,permission_key) do update set allowed=true;

-- RLS policies
create policy "members can read assignments"
on public.member_role_assignments for select to authenticated
using (exists(select 1 from public.community_memberships m where m.id=member_role_assignments.membership_id and public.is_active_community_member(m.community_id)));

create policy "authorized can insert assignments"
on public.member_role_assignments for insert to authenticated
with check (exists(select 1 from public.community_memberships m where m.id=member_role_assignments.membership_id and public.has_permission(m.community_id,'permissions.assign_roles')));

create policy "authorized can delete assignments"
on public.member_role_assignments for delete to authenticated
using (exists(select 1 from public.community_memberships m where m.id=member_role_assignments.membership_id and public.has_permission(m.community_id,'permissions.assign_roles')));

create policy "authorized can insert roles"
on public.roles for insert to authenticated
with check (public.has_permission(community_id,'permissions.manage'));

create policy "authorized can update roles"
on public.roles for update to authenticated
using (public.has_permission(community_id,'permissions.manage'))
with check (public.has_permission(community_id,'permissions.manage'));

create policy "authorized can insert role permissions"
on public.role_permissions for insert to authenticated
with check (exists(select 1 from public.roles r where r.id=role_permissions.role_id and public.has_permission(r.community_id,'permissions.manage')));

create policy "authorized can update role permissions"
on public.role_permissions for update to authenticated
using (exists(select 1 from public.roles r where r.id=role_permissions.role_id and public.has_permission(r.community_id,'permissions.manage')))
with check (exists(select 1 from public.roles r where r.id=role_permissions.role_id and public.has_permission(r.community_id,'permissions.manage')));

create policy "authorized can delete role permissions"
on public.role_permissions for delete to authenticated
using (exists(select 1 from public.roles r where r.id=role_permissions.role_id and public.has_permission(r.community_id,'permissions.manage')));

create policy "authorized can read keys"
on public.permission_keys for select to authenticated
using (public.has_permission(community_id,'permissions.manage'));

create policy "authorized can insert keys"
on public.permission_keys for insert to authenticated
with check (public.has_permission(community_id,'permissions.create_keys'));

create policy "authorized can update keys"
on public.permission_keys for update to authenticated
using (public.has_permission(community_id,'permissions.manage'))
with check (public.has_permission(community_id,'permissions.manage'));

create policy "members can read audit logs"
on public.audit_logs for select to authenticated
using (public.has_permission(community_id,'permissions.manage') or public.is_community_owner(community_id));
