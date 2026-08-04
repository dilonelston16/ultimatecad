create extension if not exists pgcrypto;

create type public.membership_status as enum ('pending','active','suspended','removed');
create type public.organization_node_type as enum ('agency','department','division','subdivision');
create type public.console_platform as enum ('ps4','ps5','xbox_one','xbox_series');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  prefix text not null,
  timezone text not null default 'America/Montreal',
  currency_name text not null default 'Dollar',
  owner_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'active',
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table public.community_platforms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  platform public.console_platform not null,
  enabled boolean not null default true,
  unique (community_id, platform)
);

create table public.organization_nodes (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  parent_id uuid references public.organization_nodes(id) on delete cascade,
  node_type public.organization_node_type not null,
  name text not null,
  slug text not null,
  description text,
  color text,
  discord_role_id text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (community_id, parent_id, slug)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  organization_node_id uuid references public.organization_nodes(id) on delete cascade,
  name text not null,
  rank_level integer not null default 0,
  is_system boolean not null default false,
  unique (community_id, organization_node_id, name)
);

create table public.permissions (
  key text primary key,
  name text not null,
  description text not null,
  category text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null default true,
  primary key (role_id, permission_key)
);

create table public.member_role_assignments (
  membership_id uuid not null references public.community_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create table public.permission_keys (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  key_hash text not null,
  label text not null,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.permissions (key,name,description,category) values
('leo.view','View LEO workspace','Access the assigned law-enforcement workspace.','Law Enforcement'),
('leo.self_dispatch','Self dispatch','Assign self to active calls.','Law Enforcement'),
('leo.activate_panic','Activate panic','Broadcast an audible panic alert to connected on-duty units.','Law Enforcement'),
('leo.manage_reports','Manage reports','Create and edit law-enforcement reports.','Records'),
('leo.attach_penal_codes','Attach penal codes','Search and attach penal-code snapshots to supported records.','Records'),
('organization.manage','Manage organization','Create and manage agencies, departments, divisions and subdivisions.','Administration'),
('permissions.manage','Manage permissions','Manage roles, permission keys and access assignments.','Administration');

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_platforms enable row level security;
alter table public.organization_nodes enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_role_assignments enable row level security;
alter table public.permission_keys enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles readable by self" on public.profiles for select using (id = auth.uid());
create policy "profiles updatable by self" on public.profiles for update using (id = auth.uid());
create policy "members can read their communities" on public.communities for select using (exists (select 1 from public.community_memberships m where m.community_id = communities.id and m.user_id = auth.uid() and m.status = 'active'));
create policy "members can read memberships" on public.community_memberships for select using (exists (select 1 from public.community_memberships mine where mine.community_id = community_memberships.community_id and mine.user_id = auth.uid() and mine.status = 'active'));
create policy "members can read organization" on public.organization_nodes for select using (exists (select 1 from public.community_memberships m where m.community_id = organization_nodes.community_id and m.user_id = auth.uid() and m.status = 'active'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, discord_id, username, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'user_name', coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = now();
  return new;
end;
$$;
create trigger on_auth_user_created after insert or update on auth.users for each row execute procedure public.handle_new_user();
