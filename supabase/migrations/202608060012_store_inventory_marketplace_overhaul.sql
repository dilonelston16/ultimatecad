-- UltimateCAD — Store, Inventory and Marketplace Overhaul

begin;

alter table public.stores
  add column if not exists store_type text not null default 'business',
  add column if not exists category_group text not null default 'Business',
  add column if not exists owner_purchase_restriction boolean not null default false,
  add column if not exists restock_permission text not null default 'owner',
  add column if not exists updated_at timestamptz not null default now();

alter table public.stores drop constraint if exists stores_store_type_check;
alter table public.stores
  add constraint stores_store_type_check
  check (store_type in ('general','government','business'));

alter table public.stores drop constraint if exists stores_restock_permission_check;
alter table public.stores
  add constraint stores_restock_permission_check
  check (restock_permission in ('founder','owner','staff'));

alter table public.store_products
  add column if not exists product_type text not null default 'item',
  add column if not exists asset_template jsonb not null default '{}'::jsonb,
  add column if not exists restricted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.store_products drop constraint if exists store_products_product_type_check;
alter table public.store_products
  add constraint store_products_product_type_check
  check (product_type in ('item','vehicle','weapon','property','service','document'));

alter table public.character_inventory
  add column if not exists status text not null default 'owned',
  add column if not exists listed_quantity integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.character_inventory drop constraint if exists character_inventory_status_check;
alter table public.character_inventory
  add constraint character_inventory_status_check
  check (status in ('owned','reserved','listed','consumed','transferred'));

alter table public.marketplace_listings
  add column if not exists inventory_id uuid references public.character_inventory(id) on delete set null,
  add column if not exists quantity integer not null default 1,
  add column if not exists seller_account_id uuid references public.bank_accounts(id) on delete set null,
  add column if not exists buyer_character_id uuid references public.characters(id) on delete set null,
  add column if not exists buyer_account_id uuid references public.bank_accounts(id) on delete set null,
  add column if not exists sold_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists stores_type_category_idx
  on public.stores(community_id,store_type,category_group,status);

create index if not exists store_products_category_type_idx
  on public.store_products(store_id,category,product_type,active);

create index if not exists character_inventory_owned_idx
  on public.character_inventory(character_id,status,item_name);

create index if not exists marketplace_reference_idx
  on public.marketplace_listings(reference_type,reference_id,status);

insert into public.permissions(key,name,description,category)
values
 ('stores.restock','Restock stores','Restock general, government, and authorized business stores.','Stores'),
 ('stores.manage_catalog','Manage store catalogue','Create and update products and catalogue categories.','Stores')
on conflict(key) do update
set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.key,true
from public.roles r
cross join (
  values ('stores.restock'),('stores.manage_catalog')
) p(key)
where r.name in ('Founder','Owner','Community Admin')
on conflict(role_id,permission_key) do update set allowed=true;

-- Classify existing system stores.
update public.stores
set store_type='general',
    category_group='General Store',
    restock_permission='founder',
    updated_at=now()
where name in ('Ultimate General Store','Ultimate Hardware & Auto','Ultimate Medical Supply');

update public.stores
set store_type='government',
    category_group='Government',
    restock_permission='founder',
    updated_at=now()
where name='Ultimate Government Services';

update public.stores
set store_type='business',
    category_group='Businesses',
    restock_permission='owner',
    updated_at=now()
where business_id is not null;

-- Add focused government/asset storefronts.
insert into public.stores(
  community_id,name,description,status,store_type,category_group,
  restock_permission
)
select c.id,s.name,s.description,'active',s.store_type,s.category_group,'founder'
from public.communities c
cross join (
  values
   ('Ultimate Vehicle Dealership','Civilian and commercial vehicle catalogue.','government','Government'),
   ('Ultimate Property Registry','Residential, garage, land, and commercial property catalogue.','government','Government'),
   ('Ultimate Licensed Weapons','Licensed civilian weapon catalogue and registration-ready equipment.','government','Government')
) s(name,description,store_type,category_group)
on conflict(community_id,name) do update
set description=excluded.description,
    status='active',
    store_type=excluded.store_type,
    category_group=excluded.category_group,
    restock_permission='founder',
    updated_at=now();

-- Expanded asset catalogue.
with seed(store_name,sku,name,description,category,product_type,price,stock,template) as (
  values
  -- Vehicles
  ('Ultimate Vehicle Dealership','VEH-COMPACT-01','Karin Dilettante','Economical civilian compact vehicle.','Compact Cars','vehicle',18000,25,'{"vehicle_type":"car","make":"Karin","model":"Dilettante","body_style":"Compact"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-COMPACT-02','Dinka Blista','Sporty compact hatchback.','Compact Cars','vehicle',22000,25,'{"vehicle_type":"car","make":"Dinka","model":"Blista","body_style":"Hatchback"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-SEDAN-01','Vapid Stanier','Reliable full-size civilian sedan.','Sedans','vehicle',32000,20,'{"vehicle_type":"car","make":"Vapid","model":"Stanier","body_style":"Sedan"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-SEDAN-02','Karin Asterope','Comfortable everyday sedan.','Sedans','vehicle',29000,20,'{"vehicle_type":"car","make":"Karin","model":"Asterope","body_style":"Sedan"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-SUV-01','Gallivanter Baller','Luxury civilian SUV.','SUVs','vehicle',85000,12,'{"vehicle_type":"truck","make":"Gallivanter","model":"Baller","body_style":"SUV"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-SUV-02','Canis Seminole','Off-road capable SUV.','SUVs','vehicle',52000,15,'{"vehicle_type":"truck","make":"Canis","model":"Seminole","body_style":"SUV"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-TRUCK-01','Vapid Sandking','Heavy-duty pickup truck.','Trucks','vehicle',72000,12,'{"vehicle_type":"truck","make":"Vapid","model":"Sandking","body_style":"Pickup"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-TRUCK-02','Bravado Bison','Civilian work pickup.','Trucks','vehicle',48000,18,'{"vehicle_type":"truck","make":"Bravado","model":"Bison","body_style":"Pickup"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-MOTO-01','Pegassi Bati 801','High-performance street motorcycle.','Motorcycles','vehicle',35000,15,'{"vehicle_type":"motorcycle","make":"Pegassi","model":"Bati 801","body_style":"Sport Bike"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-MOTO-02','Western Bagger','Civilian cruiser motorcycle.','Motorcycles','vehicle',24000,18,'{"vehicle_type":"motorcycle","make":"Western","model":"Bagger","body_style":"Cruiser"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-COMM-01','Vapid Benson','Commercial box truck.','Commercial Vehicles','vehicle',115000,8,'{"vehicle_type":"commercial","make":"Vapid","model":"Benson","body_style":"Box Truck"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-COMM-02','Brute Stockade','Armored commercial transport.','Commercial Vehicles','vehicle',350000,3,'{"vehicle_type":"commercial","make":"Brute","model":"Stockade","body_style":"Armored Truck"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-BOAT-01','Shitzu Suntrap','Small recreational boat.','Boats','vehicle',65000,8,'{"vehicle_type":"boat","make":"Shitzu","model":"Suntrap","body_style":"Boat"}'::jsonb),
  ('Ultimate Vehicle Dealership','VEH-AIR-01','Buckingham Maverick','Civilian light helicopter.','Aircraft','vehicle',950000,3,'{"vehicle_type":"aircraft","make":"Buckingham","model":"Maverick","body_style":"Helicopter"}'::jsonb),

  -- Weapons (fictional game items, registration-ready)
  ('Ultimate Licensed Weapons','WPN-PISTOL-01','Pistol','Standard licensed civilian handgun.','Handguns','weapon',12000,20,'{"weapon_type":"Handgun","make":"Hawk & Little","model":"Pistol","caliber":"9mm"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-COMBAT-01','Combat Pistol','Enhanced licensed handgun.','Handguns','weapon',18000,15,'{"weapon_type":"Handgun","make":"Hawk & Little","model":"Combat Pistol","caliber":"9mm"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-HEAVY-01','Heavy Pistol','Large-frame licensed handgun.','Handguns','weapon',24000,10,'{"weapon_type":"Handgun","make":"Hawk & Little","model":"Heavy Pistol","caliber":".45"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-VINTAGE-01','Vintage Pistol','Collectible licensed handgun.','Collectibles','weapon',30000,8,'{"weapon_type":"Handgun","make":"Vintage Arms","model":"Vintage Pistol","caliber":"9mm"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-SHOTGUN-01','Pump Shotgun','Licensed sporting shotgun.','Sporting Weapons','weapon',28000,8,'{"weapon_type":"Shotgun","make":"Shrewsbury","model":"Pump Shotgun","caliber":"12 Gauge"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-RIFLE-01','Hunting Rifle','Licensed hunting rifle.','Sporting Weapons','weapon',32000,8,'{"weapon_type":"Rifle","make":"Vom Feuer","model":"Hunting Rifle","caliber":".308"}'::jsonb),
  ('Ultimate Licensed Weapons','WPN-STUNGUN-01','Stun Gun','Civilian defensive stun device.','Defensive Equipment','weapon',8500,15,'{"weapon_type":"Less Lethal","make":"Coil","model":"Stun Gun","caliber":"Electric"}'::jsonb),

  -- Property
  ('Ultimate Property Registry','PROP-APT-01','Studio Apartment','Entry-level studio apartment.','Apartments','property',85000,20,'{"property_type":"apartment","address":"To be assigned by Property Registry","garage_spaces":0}'::jsonb),
  ('Ultimate Property Registry','PROP-APT-02','Two-Bedroom Apartment','Standard two-bedroom apartment.','Apartments','property',165000,15,'{"property_type":"apartment","address":"To be assigned by Property Registry","garage_spaces":1}'::jsonb),
  ('Ultimate Property Registry','PROP-CONDO-01','Downtown Condo','Modern city condominium.','Condos','property',350000,10,'{"property_type":"condo","address":"To be assigned by Property Registry","garage_spaces":1}'::jsonb),
  ('Ultimate Property Registry','PROP-HOUSE-01','Starter House','Small residential starter home.','Houses','property',275000,12,'{"property_type":"house","address":"To be assigned by Property Registry","garage_spaces":1}'::jsonb),
  ('Ultimate Property Registry','PROP-HOUSE-02','Family House','Mid-size residential family home.','Houses','property',525000,8,'{"property_type":"house","address":"To be assigned by Property Registry","garage_spaces":2}'::jsonb),
  ('Ultimate Property Registry','PROP-LUXURY-01','Luxury Estate','Large high-value residential estate.','Luxury Property','property',2500000,3,'{"property_type":"house","address":"To be assigned by Property Registry","garage_spaces":6}'::jsonb),
  ('Ultimate Property Registry','PROP-GARAGE-01','Single Garage','Single-vehicle standalone garage.','Garages','property',45000,15,'{"property_type":"garage","address":"To be assigned by Property Registry","garage_spaces":1}'::jsonb),
  ('Ultimate Property Registry','PROP-GARAGE-04','Four-Car Garage','Four-vehicle storage garage.','Garages','property',175000,8,'{"property_type":"garage","address":"To be assigned by Property Registry","garage_spaces":4}'::jsonb),
  ('Ultimate Property Registry','PROP-WAREHOUSE-01','Small Warehouse','Small commercial storage warehouse.','Commercial Property','property',425000,8,'{"property_type":"warehouse","address":"To be assigned by Property Registry","garage_spaces":2}'::jsonb),
  ('Ultimate Property Registry','PROP-COMM-01','Retail Unit','Commercial storefront property.','Commercial Property','property',600000,6,'{"property_type":"commercial","address":"To be assigned by Property Registry","garage_spaces":2}'::jsonb),
  ('Ultimate Property Registry','PROP-LAND-01','Residential Land Parcel','Undeveloped residential land.','Land','property',200000,10,'{"property_type":"land","address":"To be assigned by Property Registry","garage_spaces":0}'::jsonb)
)
insert into public.store_products(
  community_id,store_id,sku,name,description,category,product_type,
  price,stock_quantity,active,asset_template
)
select st.community_id,st.id,s.sku,s.name,s.description,s.category,
       s.product_type,s.price,s.stock,true,s.template
from seed s
join public.stores st on st.name=s.store_name
on conflict(store_id,sku) do update
set name=excluded.name,
    description=excluded.description,
    category=excluded.category,
    product_type=excluded.product_type,
    price=excluded.price,
    stock_quantity=greatest(public.store_products.stock_quantity,excluded.stock_quantity),
    active=true,
    asset_template=excluded.asset_template,
    updated_at=now();

-- Founder/admin restocking.
create or replace function public.restock_store_product(
  p_product_id uuid,
  p_quantity integer,
  p_reason text default 'Manual restock'
)
returns public.store_products
language plpgsql
security definer
set search_path=public
as $$
declare
  v_product public.store_products%rowtype;
  v_store public.stores%rowtype;
  v_is_owner boolean:=false;
begin
  select * into v_product from public.store_products where id=p_product_id for update;
  if v_product.id is null then raise exception 'Product not found'; end if;
  select * into v_store from public.stores where id=v_product.store_id;

  if v_store.business_id is not null then
    select exists(
      select 1 from public.businesses b
      join public.characters c on c.id=b.owner_character_id
      where b.id=v_store.business_id and c.owner_user_id=auth.uid()
    ) into v_is_owner;
  end if;

  if not (
    public.is_community_owner(v_product.community_id)
    or public.has_permission(v_product.community_id,'stores.restock')
    or (v_store.restock_permission='owner' and v_is_owner)
  ) then raise exception 'Store restock permission required'; end if;

  if p_quantity<=0 then raise exception 'Restock quantity must be positive'; end if;

  update public.store_products
  set stock_quantity=stock_quantity+p_quantity,
      updated_at=now()
  where id=v_product.id
  returning * into v_product;

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_product.community_id,auth.uid(),'store_restock','store_product',
    v_product.id,coalesce(nullif(trim(p_reason),''),'Manual restock'),
    jsonb_build_object('quantity',p_quantity,'store_id',v_store.id)
  );

  return v_product;
end;
$$;

grant execute on function public.restock_store_product(uuid,integer,text)
to authenticated;

-- Purchase an item or create the purchased asset.
create or replace function public.purchase_store_product(
  p_character_id uuid,
  p_account_id uuid,
  p_product_id uuid,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_account public.bank_accounts%rowtype;
  v_product public.store_products%rowtype;
  v_store public.stores%rowtype;
  v_settings public.economy_settings%rowtype;
  v_subtotal numeric(16,2);
  v_tax numeric(16,2);
  v_total numeric(16,2);
  v_sale_id uuid;
  v_sale_number text;
  v_asset_id uuid;
  i integer;
  v_template jsonb;
begin
  select * into v_character
  from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
  if v_character.id is null then raise exception 'Character unavailable'; end if;

  select * into v_account
  from public.bank_accounts
  where id=p_account_id and character_id=v_character.id and status='active';
  if v_account.id is null then raise exception 'Bank account unavailable'; end if;

  select * into v_product
  from public.store_products
  where id=p_product_id and active=true
  for update;
  if v_product.id is null then raise exception 'Product unavailable'; end if;

  select * into v_store from public.stores where id=v_product.store_id and status='active';
  if v_store.id is null then raise exception 'Store unavailable'; end if;

  if v_store.owner_purchase_restriction
     and not exists(
       select 1 from public.businesses b
       where b.owner_character_id=v_character.id and b.status='active'
     ) then
    raise exception 'This store is restricted to active business owners';
  end if;

  if p_quantity<=0 then raise exception 'Quantity must be positive'; end if;
  if v_product.product_type in ('vehicle','weapon','property','service','document') and p_quantity<>1 then
    raise exception 'This product can only be purchased one at a time';
  end if;
  if v_product.stock_quantity<p_quantity then raise exception 'Insufficient stock'; end if;

  select * into v_settings from public.economy_settings where community_id=v_character.community_id;
  v_subtotal:=v_product.price*p_quantity;
  v_tax:=round(v_subtotal*(coalesce(v_settings.sales_tax_percent,5)/100),2);
  v_total:=v_subtotal+v_tax;
  v_sale_number:=public.generate_cad_identifier(v_character.community_id,'store_sale');

  perform public.post_bank_transaction(
    v_account.id,'purchase','debit',v_total,
    'Purchase from '||v_store.name,'store_sale',null,v_store.bank_account_id,
    jsonb_build_object('product_id',v_product.id,'quantity',p_quantity)
  );

  if v_store.bank_account_id is not null then
    perform public.post_bank_transaction(
      v_store.bank_account_id,'purchase','credit',v_subtotal,
      'Sale at '||v_store.name,'store_sale',null,v_account.id,
      jsonb_build_object('product_id',v_product.id,'quantity',p_quantity)
    );
  end if;

  update public.store_products
  set stock_quantity=stock_quantity-p_quantity,updated_at=now()
  where id=v_product.id;

  insert into public.store_sales(
    community_id,store_id,character_id,bank_account_id,sale_number,
    subtotal,tax_amount,total_amount
  )
  values(
    v_character.community_id,v_store.id,v_character.id,v_account.id,
    v_sale_number,v_subtotal,v_tax,v_total
  )
  returning id into v_sale_id;

  insert into public.store_sale_items(
    sale_id,product_id,quantity,unit_price,line_total
  )
  values(v_sale_id,v_product.id,p_quantity,v_product.price,v_subtotal);

  v_template:=coalesce(v_product.asset_template,'{}'::jsonb);

  if v_product.product_type='vehicle' then
    insert into public.vehicles(
      community_id,primary_owner_character_id,vin,registration_number,plate_number,
      make,model,model_year,color,vehicle_type,body_style,purchase_price,
      created_by_user_id
    )
    values(
      v_character.community_id,v_character.id,
      public.generate_cad_identifier(v_character.community_id,'vin'),
      public.generate_cad_identifier(v_character.community_id,'vehicle_registration'),
      public.generate_vehicle_plate(v_character.community_id,null),
      coalesce(v_template->>'make','Unknown'),
      coalesce(v_template->>'model',v_product.name),
      extract(year from now())::integer,
      'Unspecified',
      coalesce(v_template->>'vehicle_type','car'),
      v_template->>'body_style',
      v_product.price,auth.uid()
    )
    returning id into v_asset_id;

    insert into public.vehicle_owners(
      community_id,vehicle_id,character_id,ownership_percentage,owner_type
    ) values(v_character.community_id,v_asset_id,v_character.id,100,'primary');

  elsif v_product.product_type='weapon' then
    insert into public.weapons(
      community_id,owner_character_id,serial_number,registration_number,
      weapon_type,make,model,caliber,created_by_user_id
    )
    values(
      v_character.community_id,v_character.id,
      public.generate_cad_identifier(v_character.community_id,'weapon_serial'),
      public.generate_cad_identifier(v_character.community_id,'weapon_registration'),
      coalesce(v_template->>'weapon_type','Weapon'),
      coalesce(v_template->>'make','Unknown'),
      coalesce(v_template->>'model',v_product.name),
      v_template->>'caliber',auth.uid()
    )
    returning id into v_asset_id;

  elsif v_product.product_type='property' then
    insert into public.properties(
      community_id,owner_character_id,property_number,property_type,address,
      purchase_price,assessed_value,garage_spaces
    )
    values(
      v_character.community_id,v_character.id,
      public.generate_cad_identifier(v_character.community_id,'property'),
      coalesce(v_template->>'property_type','other'),
      coalesce(v_template->>'address','Property address pending assignment'),
      v_product.price,v_product.price,
      coalesce((v_template->>'garage_spaces')::integer,0)
    )
    returning id into v_asset_id;

  else
    insert into public.character_inventory(
      community_id,character_id,product_id,item_name,quantity,metadata,status
    )
    values(
      v_character.community_id,v_character.id,v_product.id,v_product.name,
      p_quantity,
      jsonb_build_object('sale_id',v_sale_id,'store_id',v_store.id,'product_type',v_product.product_type),
      'owned'
    );
  end if;

  update public.marketplace_listings
  set status='expired',updated_at=now()
  where reference_id=v_asset_id and reference_type=v_product.product_type and status='active';

  return v_sale_id;
end;
$$;

grant execute on function public.purchase_store_product(uuid,uuid,uuid,integer)
to authenticated;

-- Ownership-backed marketplace listing creation.
create or replace function public.create_owned_marketplace_listing(
  p_character_id uuid,
  p_asset_kind text,
  p_asset_id uuid,
  p_quantity integer,
  p_price numeric,
  p_description text default null,
  p_seller_account_id uuid default null
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_listing public.marketplace_listings;
  v_number text;
  v_title text;
  v_inventory public.character_inventory%rowtype;
begin
  select * into v_character
  from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
  if v_character.id is null then raise exception 'Character unavailable'; end if;

  if p_price<0 then raise exception 'Listing price cannot be negative'; end if;
  if p_quantity<=0 then raise exception 'Quantity must be positive'; end if;

  if p_seller_account_id is not null and not exists(
    select 1 from public.bank_accounts
    where id=p_seller_account_id and character_id=v_character.id and status='active'
  ) then raise exception 'Seller account unavailable'; end if;

  case p_asset_kind
    when 'item' then
      select * into v_inventory
      from public.character_inventory
      where id=p_asset_id and character_id=v_character.id and status in ('owned','listed')
      for update;
      if v_inventory.id is null then raise exception 'Inventory item not owned'; end if;
      if v_inventory.quantity-v_inventory.listed_quantity<p_quantity then
        raise exception 'Not enough unlisted quantity';
      end if;
      v_title:=v_inventory.item_name;
      update public.character_inventory
      set listed_quantity=listed_quantity+p_quantity,
          status=case when listed_quantity+p_quantity>=quantity then 'listed' else 'owned' end,
          updated_at=now()
      where id=v_inventory.id;

    when 'vehicle' then
      select model_year::text||' '||make||' '||model into v_title
      from public.vehicles
      where id=p_asset_id and primary_owner_character_id=v_character.id
        and status not in ('scrapped','seized');
      if v_title is null then raise exception 'Vehicle not owned or unavailable'; end if;
      if p_quantity<>1 then raise exception 'Vehicle quantity must be one'; end if;

    when 'weapon' then
      select make||' '||model into v_title
      from public.weapons
      where id=p_asset_id and owner_character_id=v_character.id
        and status='active';
      if v_title is null then raise exception 'Weapon not owned or unavailable'; end if;
      if p_quantity<>1 then raise exception 'Weapon quantity must be one'; end if;

    when 'property' then
      select initcap(property_type)||' · '||address into v_title
      from public.properties
      where id=p_asset_id and owner_character_id=v_character.id
        and status='active';
      if v_title is null then raise exception 'Property not owned or unavailable'; end if;
      if p_quantity<>1 then raise exception 'Property quantity must be one'; end if;

    when 'business' then
      select name into v_title
      from public.businesses
      where id=p_asset_id and owner_character_id=v_character.id
        and status='active';
      if v_title is null then raise exception 'Business not owned or unavailable'; end if;
      if p_quantity<>1 then raise exception 'Business quantity must be one'; end if;

    else raise exception 'Unsupported owned asset type';
  end case;

  if exists(
    select 1 from public.marketplace_listings
    where seller_character_id=v_character.id
      and reference_type=p_asset_kind
      and reference_id=p_asset_id
      and status='active'
  ) and p_asset_kind<>'item' then
    raise exception 'This asset is already listed';
  end if;

  v_number:=public.generate_cad_identifier(v_character.community_id,'marketplace');

  insert into public.marketplace_listings(
    community_id,seller_character_id,listing_number,listing_type,title,
    description,price,reference_type,reference_id,status,inventory_id,
    quantity,seller_account_id,expires_at
  )
  values(
    v_character.community_id,v_character.id,v_number,p_asset_kind,v_title,
    nullif(trim(coalesce(p_description,'')),''),p_price,p_asset_kind,p_asset_id,
    'active',case when p_asset_kind='item' then p_asset_id else null end,
    p_quantity,p_seller_account_id,now()+interval '30 days'
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.create_owned_marketplace_listing(
  uuid,text,uuid,integer,numeric,text,uuid
) to authenticated;

create or replace function public.cancel_owned_marketplace_listing(
  p_listing_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_listing public.marketplace_listings%rowtype;
begin
  select * into v_listing
  from public.marketplace_listings
  where id=p_listing_id and status='active'
  for update;

  if v_listing.id is null then raise exception 'Active listing not found'; end if;

  if not exists(
    select 1 from public.characters
    where id=v_listing.seller_character_id and owner_user_id=auth.uid()
  ) and not (
    public.has_permission(v_listing.community_id,'marketplace.manage')
    or public.is_community_owner(v_listing.community_id)
  ) then raise exception 'Listing access denied'; end if;

  update public.marketplace_listings
  set status='cancelled',updated_at=now()
  where id=v_listing.id;

  if v_listing.inventory_id is not null then
    update public.character_inventory
    set listed_quantity=greatest(0,listed_quantity-v_listing.quantity),
        status='owned',
        updated_at=now()
    where id=v_listing.inventory_id;
  end if;
end;
$$;

grant execute on function public.cancel_owned_marketplace_listing(uuid)
to authenticated;

commit;
