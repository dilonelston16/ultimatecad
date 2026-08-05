-- UltimateCAD Milestone 1.1: authentication and community onboarding
create extension if not exists pgcrypto;

alter table public.communities
  add column if not exists join_code text,
  add column if not exists description text,
  add column if not exists logo_url text;

update public.communities
set join_code = upper(prefix) || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6))
where join_code is null;

alter table public.communities alter column join_code set not null;
create unique index if not exists communities_join_code_key on public.communities(join_code);

create or replace function public.is_active_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_memberships
    where community_id = target_community_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_community_owner(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_memberships
    where community_id = target_community_id
      and user_id = auth.uid()
      and status = 'active'
      and is_owner = true
  );
$$;

drop policy if exists "members can read their communities" on public.communities;
drop policy if exists "members can read memberships" on public.community_memberships;
drop policy if exists "members can read organization" on public.organization_nodes;

create policy "members can read their communities"
on public.communities for select
to authenticated
using (public.is_active_community_member(id));

create policy "members can read memberships"
on public.community_memberships for select
to authenticated
using (user_id = auth.uid() or public.is_active_community_member(community_id));

create policy "members can read platforms"
on public.community_platforms for select
to authenticated
using (public.is_active_community_member(community_id));

create policy "members can read organization"
on public.organization_nodes for select
to authenticated
using (public.is_active_community_member(community_id));

create policy "members can read roles"
on public.roles for select
to authenticated
using (public.is_active_community_member(community_id));

create policy "members can read role permissions"
on public.role_permissions for select
to authenticated
using (exists (
  select 1 from public.roles r
  where r.id = role_permissions.role_id
    and public.is_active_community_member(r.community_id)
));

create or replace function public.generate_community_join_code(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(regexp_replace(p_prefix, '[^A-Za-z0-9]', '', 'g')) || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from public.communities where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_community(
  p_name text,
  p_prefix text,
  p_slug text,
  p_timezone text,
  p_platforms text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_community_id uuid;
  agency_id uuid;
  department_id uuid;
  founder_role_id uuid;
  platform_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.community_memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'You already belong to an active community';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  select auth.uid(),
         coalesce(auth.jwt()->'user_metadata'->>'user_name', auth.jwt()->'user_metadata'->>'name'),
         coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name'),
         auth.jwt()->'user_metadata'->>'avatar_url'
  on conflict (id) do nothing;

  insert into public.communities (name, slug, prefix, timezone, owner_user_id, join_code)
  values (trim(p_name), lower(trim(p_slug)), upper(trim(p_prefix)), coalesce(nullif(trim(p_timezone), ''), 'America/Montreal'), auth.uid(), public.generate_community_join_code(p_prefix))
  returning id into new_community_id;

  insert into public.community_memberships (community_id, user_id, status, is_owner)
  values (new_community_id, auth.uid(), 'active', true);

  foreach platform_value in array p_platforms loop
    if platform_value in ('ps4','ps5','xbox_one','xbox_series') then
      insert into public.community_platforms (community_id, platform)
      values (new_community_id, platform_value::public.console_platform)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.organization_nodes (community_id, node_type, name, slug, description, sort_order)
  values (new_community_id, 'agency', 'Law Enforcement', 'law-enforcement', 'Community law-enforcement agency.', 10)
  returning id into agency_id;

  insert into public.organization_nodes (community_id, parent_id, node_type, name, slug, description, sort_order)
  values (new_community_id, agency_id, 'department', 'Initial LEO Department', 'initial-leo-department', 'Rename and configure this department in the Organization Builder.', 10)
  returning id into department_id;

  insert into public.roles (community_id, name, rank_level, is_system)
  values (new_community_id, 'Founder', 1000, true)
  returning id into founder_role_id;

  insert into public.member_role_assignments (membership_id, role_id)
  select id, founder_role_id from public.community_memberships
  where community_id = new_community_id and user_id = auth.uid();

  insert into public.role_permissions (role_id, permission_key, allowed)
  select founder_role_id, key, true from public.permissions
  on conflict do nothing;

  insert into public.audit_logs (community_id, actor_user_id, action, target_type, target_id, metadata)
  values (new_community_id, auth.uid(), 'community.created', 'community', new_community_id::text, jsonb_build_object('name', p_name, 'prefix', p_prefix));

  return new_community_id;
end;
$$;

create or replace function public.join_community_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select id into target_id from public.communities where join_code = upper(trim(p_join_code));
  if target_id is null then raise exception 'Community join code not found'; end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  select auth.uid(),
         coalesce(auth.jwt()->'user_metadata'->>'user_name', auth.jwt()->'user_metadata'->>'name'),
         coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name'),
         auth.jwt()->'user_metadata'->>'avatar_url'
  on conflict (id) do nothing;

  insert into public.community_memberships (community_id, user_id, status, is_owner)
  values (target_id, auth.uid(), 'active', false)
  on conflict (community_id, user_id)
  do update set status = 'active';

  insert into public.audit_logs (community_id, actor_user_id, action, target_type, target_id)
  values (target_id, auth.uid(), 'community.joined', 'profile', auth.uid()::text);

  return target_id;
end;
$$;

grant execute on function public.create_community(text,text,text,text,text[]) to authenticated;
grant execute on function public.join_community_by_code(text) to authenticated;
grant execute on function public.is_active_community_member(uuid) to authenticated;
grant execute on function public.is_community_owner(uuid) to authenticated;
