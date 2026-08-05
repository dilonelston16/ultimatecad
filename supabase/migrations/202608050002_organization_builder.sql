-- UltimateCAD Milestone 1.2: Organization Builder
alter table public.organization_nodes
  add column if not exists abbreviation text,
  add column if not exists callsign_prefix text,
  add column if not exists logo_url text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists organization_nodes_community_parent_idx
  on public.organization_nodes (community_id, parent_id, sort_order);

create or replace function public.validate_organization_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_type public.organization_node_type;
begin
  if new.node_type = 'agency' then
    if new.parent_id is not null then raise exception 'Agencies cannot have a parent'; end if;
    return new;
  end if;
  if new.parent_id is null then raise exception '% requires a parent', new.node_type; end if;
  select node_type into parent_type from public.organization_nodes
  where id = new.parent_id and community_id = new.community_id;
  if parent_type is null then raise exception 'Parent node not found in this community'; end if;
  if (new.node_type = 'department' and parent_type <> 'agency') or
     (new.node_type = 'division' and parent_type <> 'department') or
     (new.node_type = 'subdivision' and parent_type <> 'division') then
    raise exception 'Invalid organization hierarchy';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_organization_parent_trigger on public.organization_nodes;
create trigger validate_organization_parent_trigger
before insert or update of parent_id, node_type, community_id
on public.organization_nodes
for each row execute function public.validate_organization_parent();

create policy "owners can insert organization"
on public.organization_nodes for insert to authenticated
with check (public.is_community_owner(community_id));

create policy "owners can update organization"
on public.organization_nodes for update to authenticated
using (public.is_community_owner(community_id))
with check (public.is_community_owner(community_id));

create policy "owners can delete organization"
on public.organization_nodes for delete to authenticated
using (public.is_community_owner(community_id));
