begin;

create table if not exists public.character_contacts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  contact_type text not null,
  label text not null,
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (contact_type in ('phone','email','address','emergency'))
);

create table if not exists public.weapons (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete restrict,
  serial_number text not null,
  registration_number text not null,
  weapon_type text not null,
  make text not null,
  model text not null,
  caliber text,
  status text not null default 'active',
  acquired_at timestamptz not null default now(),
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id,serial_number),
  unique(community_id,registration_number),
  check(status in ('active','stolen','recovered','seized','destroyed','transferred','inactive'))
);

create table if not exists public.weapon_transfers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  from_character_id uuid not null references public.characters(id) on delete restrict,
  to_character_id uuid not null references public.characters(id) on delete restrict,
  status text not null default 'pending',
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  check(status in ('pending','approved','denied','cancelled','completed'))
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete restrict,
  property_number text not null,
  property_type text not null,
  address text not null,
  unit_number text,
  purchase_price numeric(16,2),
  assessed_value numeric(16,2),
  status text not null default 'active',
  garage_spaces integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id,property_number),
  check(property_type in ('house','apartment','condo','commercial','warehouse','land','garage','other')),
  check(status in ('active','listed','foreclosed','seized','sold','inactive'))
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  seller_character_id uuid not null references public.characters(id) on delete cascade,
  listing_number text not null,
  listing_type text not null,
  title text not null,
  description text,
  price numeric(16,2) not null check(price>=0),
  reference_type text,
  reference_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(community_id,listing_number),
  check(listing_type in ('vehicle','property','business','item','service','job','other')),
  check(status in ('active','sold','expired','cancelled'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'info',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check(notification_type in ('info','success','warning','error','payment','dmv','business','marketplace'))
);

create index if not exists character_contacts_character_idx on public.character_contacts(character_id);
create index if not exists weapons_owner_idx on public.weapons(owner_character_id,status);
create index if not exists properties_owner_idx on public.properties(owner_character_id,status);
create index if not exists marketplace_active_idx on public.marketplace_listings(community_id,status,created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id,read_at,created_at desc);

alter table public.character_contacts enable row level security;
alter table public.weapons enable row level security;
alter table public.weapon_transfers enable row level security;
alter table public.properties enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.notifications enable row level security;

insert into public.permissions(key,name,description,category) values
 ('weapons.view','View weapons','View authorized weapon records.','Civilian'),
 ('weapons.manage','Manage weapons','Manage registrations and statuses.','Civilian'),
 ('properties.view','View properties','View authorized property records.','Civilian'),
 ('properties.manage','Manage properties','Manage community property records.','Civilian'),
 ('marketplace.manage','Manage marketplace','Moderate marketplace listings.','Economy')
on conflict(key) do update set name=excluded.name,description=excluded.description,category=excluded.category;

create or replace function public.register_weapon(
 p_character_id uuid,p_weapon_type text,p_make text,p_model text,p_caliber text default null,p_notes text default null
) returns public.weapons language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; w public.weapons; s text; r text;
begin
 select * into c from public.characters where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
 if c.id is null then raise exception 'Character unavailable'; end if;
 s:=public.generate_cad_identifier(c.community_id,'weapon_serial');
 r:=public.generate_cad_identifier(c.community_id,'weapon_registration');
 insert into public.weapons(community_id,owner_character_id,serial_number,registration_number,weapon_type,make,model,caliber,notes,created_by_user_id)
 values(c.community_id,c.id,s,r,trim(p_weapon_type),trim(p_make),trim(p_model),nullif(trim(coalesce(p_caliber,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid()) returning * into w;
 return w;
end $$;
grant execute on function public.register_weapon(uuid,text,text,text,text,text) to authenticated;

create or replace function public.register_property(
 p_character_id uuid,p_property_type text,p_address text,p_unit_number text default null,p_purchase_price numeric default null,p_garage_spaces integer default 0,p_notes text default null
) returns public.properties language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; p public.properties; n text;
begin
 select * into c from public.characters where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
 if c.id is null then raise exception 'Character unavailable'; end if;
 n:=public.generate_cad_identifier(c.community_id,'property');
 insert into public.properties(community_id,owner_character_id,property_number,property_type,address,unit_number,purchase_price,assessed_value,garage_spaces,notes)
 values(c.community_id,c.id,n,p_property_type,trim(p_address),nullif(trim(coalesce(p_unit_number,'')),''),p_purchase_price,p_purchase_price,greatest(0,p_garage_spaces),nullif(trim(coalesce(p_notes,'')),'')) returning * into p;
 return p;
end $$;
grant execute on function public.register_property(uuid,text,text,text,numeric,integer,text) to authenticated;

create or replace function public.create_marketplace_listing(
 p_character_id uuid,p_listing_type text,p_title text,p_description text,p_price numeric,p_reference_type text default null,p_reference_id uuid default null
) returns public.marketplace_listings language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; l public.marketplace_listings; n text;
begin
 select * into c from public.characters where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
 if c.id is null then raise exception 'Character unavailable'; end if;
 n:=public.generate_cad_identifier(c.community_id,'marketplace_listing');
 insert into public.marketplace_listings(community_id,seller_character_id,listing_number,listing_type,title,description,price,reference_type,reference_id,expires_at)
 values(c.community_id,c.id,n,p_listing_type,trim(p_title),nullif(trim(coalesce(p_description,'')),''),greatest(0,p_price),p_reference_type,p_reference_id,now()+interval '30 days') returning * into l;
 return l;
end $$;
grant execute on function public.create_marketplace_listing(uuid,text,text,text,numeric,text,uuid) to authenticated;

create policy "owners read contacts" on public.character_contacts for select to authenticated using(
 exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid()) or public.is_community_owner(community_id));
create policy "owners manage contacts" on public.character_contacts for all to authenticated using(
 exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())) with check(
 exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid()));
create policy "owners and staff read weapons" on public.weapons for select to authenticated using(
 exists(select 1 from public.characters c where c.id=owner_character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'weapons.view') or public.is_community_owner(community_id));
create policy "owners and staff read properties" on public.properties for select to authenticated using(
 exists(select 1 from public.characters c where c.id=owner_character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'properties.view') or public.is_community_owner(community_id));
create policy "members read marketplace" on public.marketplace_listings for select to authenticated using(public.is_active_community_member(community_id));
create policy "owners manage own marketplace" on public.marketplace_listings for all to authenticated using(
 exists(select 1 from public.characters c where c.id=seller_character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'marketplace.manage')) with check(
 exists(select 1 from public.characters c where c.id=seller_character_id and c.owner_user_id=auth.uid()) or public.has_permission(community_id,'marketplace.manage'));
create policy "users read notifications" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "users update notifications" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

commit;
