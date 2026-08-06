-- UltimateCAD — Business Store and Inventory Completion
-- Built against uwncad(5).zip

begin;

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,name)
);

create table if not exists public.business_inventory (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check(quantity >= 0),
  reserved_quantity integer not null default 0 check(reserved_quantity >= 0),
  average_cost numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'available',
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,product_id),
  check(status in ('available','reserved','depleted','inactive')),
  check(reserved_quantity <= quantity)
);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  sale_id uuid references public.store_sales(id) on delete set null,
  expense_type text not null default 'inventory',
  description text not null,
  amount numeric(16,2) not null check(amount >= 0),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.store_products
  add column if not exists category_id uuid references public.store_categories(id) on delete set null,
  add column if not exists source_inventory_id uuid references public.business_inventory(id) on delete set null,
  add column if not exists wholesale_price numeric(14,2),
  add column if not exists purchase_limit integer,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists store_categories_store_idx on public.store_categories(store_id,sort_order,active);
create index if not exists business_inventory_business_idx on public.business_inventory(business_id,status,item_name);
create index if not exists business_expenses_business_idx on public.business_expenses(business_id,created_at desc);

alter table public.store_categories enable row level security;
alter table public.business_inventory enable row level security;
alter table public.business_expenses enable row level security;

create or replace function public.can_manage_business_inventory(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.business_owner_can_manage(p_business_id)
  or exists(
    select 1 from public.business_members bm
    join public.characters c on c.id=bm.character_id
    where bm.business_id=p_business_id
      and c.owner_user_id=auth.uid()
      and bm.status='active'
      and bm.role_level >= 3
  );
$$;
grant execute on function public.can_manage_business_inventory(uuid) to authenticated;

-- Owners and authorized management can see business stock and expenses.
drop policy if exists "business users read store categories" on public.store_categories;
create policy "business users read store categories" on public.store_categories
for select to authenticated using(public.is_active_community_member(community_id));

drop policy if exists "business managers manage store categories" on public.store_categories;
create policy "business managers manage store categories" on public.store_categories
for all to authenticated
using(exists(select 1 from public.stores s where s.id=store_id and s.business_id is not null and public.can_manage_business_inventory(s.business_id)) or public.has_permission(community_id,'stores.manage_catalog') or public.is_community_owner(community_id))
with check(exists(select 1 from public.stores s where s.id=store_id and s.business_id is not null and public.can_manage_business_inventory(s.business_id)) or public.has_permission(community_id,'stores.manage_catalog') or public.is_community_owner(community_id));

drop policy if exists "business managers read inventory" on public.business_inventory;
create policy "business managers read inventory" on public.business_inventory
for select to authenticated using(public.can_manage_business_inventory(business_id) or public.has_permission(community_id,'businesses.manage') or public.is_community_owner(community_id));

drop policy if exists "business managers read expenses" on public.business_expenses;
create policy "business managers read expenses" on public.business_expenses
for select to authenticated using(public.can_manage_business_inventory(business_id) or public.has_permission(community_id,'businesses.manage') or public.is_community_owner(community_id));

-- Repair every existing business with a storefront and default categories.
insert into public.stores(community_id,business_id,name,description,status,bank_account_id,store_type,category_group,restock_permission)
select b.community_id,b.id,b.name||' Store',coalesce(b.description,b.name||' official storefront.'),'active',b.business_bank_account_id,'business','Businesses','owner'
from public.businesses b
where not exists(select 1 from public.stores s where s.business_id=b.id)
on conflict(community_id,name) do update
set business_id=excluded.business_id,bank_account_id=excluded.bank_account_id,status='active',store_type='business',category_group='Businesses',updated_at=now();

insert into public.store_categories(community_id,store_id,name,description,sort_order)
select s.community_id,s.id,c.name,c.description,c.sort_order
from public.stores s
cross join (values
 ('Featured','Featured products',10),
 ('General','General business merchandise',20),
 ('Clothing','Clothing and wearable products',30),
 ('Food & Drinks','Food and beverage products',40),
 ('Tools & Equipment','Tools, equipment, and supplies',50),
 ('Vehicle & Parts','Vehicles and automotive products',60),
 ('Services','Business services',70),
 ('Other','Other products',999)
) c(name,description,sort_order)
where s.business_id is not null
on conflict(store_id,name) do update set description=excluded.description,sort_order=excluded.sort_order,active=true;

-- Rebuild business creation so every new business is fully operational.
create or replace function public.create_business(
  p_character_id uuid,
  p_name text,
  p_business_type text,
  p_description text default null,
  p_address text default null,
  p_phone text default null
)
returns public.businesses
language plpgsql security definer set search_path=public as $$
declare
  v_character public.characters%rowtype;
  v_business public.businesses;
  v_business_number text;
  v_account_number text;
  v_account_id uuid;
  v_store_id uuid;
begin
  select * into v_character from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
  if v_character.id is null then raise exception 'Character unavailable'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Business name is required'; end if;

  v_business_number:=public.generate_cad_identifier(v_character.community_id,'business');
  v_account_number:=public.generate_cad_identifier(v_character.community_id,'bank_account');

  insert into public.businesses(community_id,owner_character_id,business_number,name,business_type,description,address,phone,created_by_user_id)
  values(v_character.community_id,v_character.id,v_business_number,trim(p_name),trim(p_business_type),nullif(trim(coalesce(p_description,'')),''),nullif(trim(coalesce(p_address,'')),''),nullif(trim(coalesce(p_phone,'')),''),auth.uid())
  returning * into v_business;

  insert into public.bank_accounts(community_id,business_id,account_number,account_type,name,balance,available_balance,status,opened_by_user_id)
  values(v_character.community_id,v_business.id,v_account_number,'business',v_business.name||' Operating Account',0,0,'active',auth.uid())
  returning id into v_account_id;

  update public.businesses set business_bank_account_id=v_account_id where id=v_business.id returning * into v_business;

  insert into public.business_members(community_id,business_id,character_id,role_name,pay_type,pay_rate,role_level,status)
  values(v_character.community_id,v_business.id,v_character.id,'Owner','salary',0,99,'active')
  on conflict(business_id,character_id) do update set role_name='Owner',role_level=99,status='active',terminated_at=null;

  insert into public.stores(community_id,business_id,name,description,status,bank_account_id,store_type,category_group,restock_permission)
  values(v_character.community_id,v_business.id,v_business.name||' Store',coalesce(v_business.description,v_business.name||' official storefront.'),'active',v_account_id,'business','Businesses','owner')
  returning id into v_store_id;

  insert into public.store_categories(community_id,store_id,name,description,sort_order)
  values
   (v_character.community_id,v_store_id,'Featured','Featured products',10),
   (v_character.community_id,v_store_id,'General','General business merchandise',20),
   (v_character.community_id,v_store_id,'Clothing','Clothing and wearable products',30),
   (v_character.community_id,v_store_id,'Food & Drinks','Food and beverage products',40),
   (v_character.community_id,v_store_id,'Tools & Equipment','Tools, equipment, and supplies',50),
   (v_character.community_id,v_store_id,'Vehicle & Parts','Vehicles and automotive products',60),
   (v_character.community_id,v_store_id,'Services','Business services',70),
   (v_character.community_id,v_store_id,'Other','Other products',999);

  insert into public.character_timeline(community_id,character_id,actor_user_id,event_type,title,description,metadata)
  values(v_character.community_id,v_character.id,auth.uid(),'business.created','Business registered',v_business.name||' registered as '||v_business_number||'.',jsonb_build_object('business_id',v_business.id,'store_id',v_store_id,'account_id',v_account_id));

  return v_business;
end;
$$;
grant execute on function public.create_business(uuid,text,text,text,text,text) to authenticated;

create or replace function public.add_business_store_category(p_business_id uuid,p_name text,p_description text default null)
returns public.store_categories language plpgsql security definer set search_path=public as $$
declare v_store public.stores%rowtype; v_category public.store_categories;
begin
 if not public.can_manage_business_inventory(p_business_id) then raise exception 'Business inventory permission required'; end if;
 select * into v_store from public.stores where business_id=p_business_id and status='active' order by created_at limit 1;
 if v_store.id is null then raise exception 'Business storefront unavailable'; end if;
 insert into public.store_categories(community_id,store_id,name,description,sort_order)
 values(v_store.community_id,v_store.id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),(select coalesce(max(sort_order),0)+10 from public.store_categories where store_id=v_store.id))
 on conflict(store_id,name) do update set active=true,description=excluded.description,updated_at=now()
 returning * into v_category;
 return v_category;
end $$;
grant execute on function public.add_business_store_category(uuid,text,text) to authenticated;

create or replace function public.purchase_store_product_for_destination(
 p_character_id uuid,p_account_id uuid,p_product_id uuid,p_quantity integer,
 p_destination_type text default 'personal',p_business_id uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 v_character public.characters%rowtype; v_account public.bank_accounts%rowtype;
 v_product public.store_products%rowtype; v_store public.stores%rowtype;
 v_settings public.economy_settings%rowtype; v_subtotal numeric(16,2); v_tax numeric(16,2); v_total numeric(16,2);
 v_sale_id uuid; v_sale_number text; v_existing public.business_inventory%rowtype;
begin
 select * into v_character from public.characters where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;
 if v_character.id is null then raise exception 'Character unavailable'; end if;
 select * into v_product from public.store_products where id=p_product_id and active=true for update;
 if v_product.id is null then raise exception 'Product unavailable'; end if;
 select * into v_store from public.stores where id=v_product.store_id and status='active';
 if p_quantity<=0 or v_product.stock_quantity<p_quantity then raise exception 'Invalid quantity or insufficient stock'; end if;

 if p_destination_type='business' then
   if p_business_id is null or not public.can_manage_business_inventory(p_business_id) then raise exception 'Business purchasing permission required'; end if;
   select * into v_account from public.bank_accounts where id=p_account_id and business_id=p_business_id and status='active';
   if v_account.id is null then raise exception 'Business account unavailable'; end if;
 else
   select * into v_account from public.bank_accounts where id=p_account_id and character_id=v_character.id and status='active';
   if v_account.id is null then raise exception 'Personal account unavailable'; end if;
 end if;

 select * into v_settings from public.economy_settings where community_id=v_character.community_id;
 v_subtotal:=v_product.price*p_quantity; v_tax:=round(v_subtotal*(coalesce(v_settings.sales_tax_percent,5)/100),2); v_total:=v_subtotal+v_tax;
 v_sale_number:=public.generate_cad_identifier(v_character.community_id,'store_sale');

 if p_destination_type='business' then
   perform public.post_business_bank_entry(p_business_id,v_account.id,'purchase','debit',v_total,'Business inventory purchase from '||v_store.name,'store_sale',null,v_store.bank_account_id);
 else
   perform public.post_bank_transaction(v_account.id,'purchase','debit',v_total,'Purchase from '||v_store.name,'store_sale',null,v_store.bank_account_id,jsonb_build_object('product_id',v_product.id,'quantity',p_quantity));
 end if;

 if v_store.bank_account_id is not null then
   if v_store.business_id is not null then
     perform public.post_business_bank_entry(v_store.business_id,v_store.bank_account_id,'purchase','credit',v_subtotal,'Sale at '||v_store.name,'store_sale',null,v_account.id);
   else
     update public.bank_accounts set balance=balance+v_subtotal,available_balance=available_balance+v_subtotal,updated_at=now() where id=v_store.bank_account_id;
   end if;
 end if;

 update public.store_products set stock_quantity=stock_quantity-p_quantity,updated_at=now() where id=v_product.id;
 insert into public.store_sales(community_id,store_id,character_id,bank_account_id,sale_number,subtotal,tax_amount,total_amount)
 values(v_character.community_id,v_store.id,v_character.id,v_account.id,v_sale_number,v_subtotal,v_tax,v_total) returning id into v_sale_id;
 insert into public.store_sale_items(sale_id,product_id,quantity,unit_price,line_total) values(v_sale_id,v_product.id,p_quantity,v_product.price,v_subtotal);

 if p_destination_type='business' then
   select * into v_existing from public.business_inventory where business_id=p_business_id and product_id=v_product.id for update;
   if v_existing.id is null then
     insert into public.business_inventory(community_id,business_id,product_id,item_name,quantity,average_cost,metadata)
     values(v_character.community_id,p_business_id,v_product.id,v_product.name,p_quantity,v_product.price,jsonb_build_object('source_store_id',v_store.id,'last_sale_id',v_sale_id));
   else
     update public.business_inventory set
       average_cost=case when quantity+p_quantity=0 then v_product.price else round(((quantity*average_cost)+(p_quantity*v_product.price))/(quantity+p_quantity),2) end,
       quantity=quantity+p_quantity,status='available',updated_at=now(),metadata=metadata||jsonb_build_object('last_sale_id',v_sale_id)
     where id=v_existing.id;
   end if;
   insert into public.business_expenses(community_id,business_id,bank_account_id,sale_id,expense_type,description,amount,created_by_user_id)
   values(v_character.community_id,p_business_id,v_account.id,v_sale_id,'inventory','Inventory purchase: '||v_product.name,v_total,auth.uid());
 else
   insert into public.character_inventory(community_id,character_id,product_id,item_name,quantity,metadata,status)
   values(v_character.community_id,v_character.id,v_product.id,v_product.name,p_quantity,jsonb_build_object('sale_id',v_sale_id,'store_id',v_store.id),'owned')
   on conflict do nothing;
 end if;
 return v_sale_id;
end $$;
grant execute on function public.purchase_store_product_for_destination(uuid,uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.publish_business_inventory_product(
 p_inventory_id uuid,p_category_id uuid,p_price numeric,p_description text default null,p_active boolean default true
)
returns public.store_products language plpgsql security definer set search_path=public as $$
declare v_inv public.business_inventory%rowtype; v_store public.stores%rowtype; v_product public.store_products; v_sku text;
begin
 select * into v_inv from public.business_inventory where id=p_inventory_id for update;
 if v_inv.id is null then raise exception 'Business inventory item not found'; end if;
 if not public.can_manage_business_inventory(v_inv.business_id) then raise exception 'Business inventory permission required'; end if;
 if p_price<0 then raise exception 'Price cannot be negative'; end if;
 select * into v_store from public.stores where business_id=v_inv.business_id and status='active' order by created_at limit 1;
 if v_store.id is null then raise exception 'Business storefront unavailable'; end if;
 if p_category_id is not null and not exists(select 1 from public.store_categories where id=p_category_id and store_id=v_store.id and active=true) then raise exception 'Category unavailable'; end if;
 v_sku:='BIZ-'||upper(substr(replace(v_inv.id::text,'-',''),1,12));
 insert into public.store_products(community_id,store_id,sku,name,description,category,category_id,price,stock_quantity,active,product_type,source_inventory_id)
 values(v_inv.community_id,v_store.id,v_sku,v_inv.item_name,nullif(trim(coalesce(p_description,'')),''),coalesce((select name from public.store_categories where id=p_category_id),'General'),p_category_id,p_price,greatest(0,v_inv.quantity-v_inv.reserved_quantity),p_active,'item',v_inv.id)
 on conflict(store_id,sku) do update set description=excluded.description,category=excluded.category,category_id=excluded.category_id,price=excluded.price,stock_quantity=greatest(0,v_inv.quantity-v_inv.reserved_quantity),active=excluded.active,updated_at=now()
 returning * into v_product;
 return v_product;
end $$;
grant execute on function public.publish_business_inventory_product(uuid,uuid,numeric,text,boolean) to authenticated;

-- Broad catalogue expansion. Fictional RP contraband only; no production instructions.
with clothing(name,category,price) as (
 values
 ('Basic T-Shirt','Tops',45),('Graphic T-Shirt','Tops',65),('Polo Shirt','Tops',80),('Dress Shirt','Tops',120),('Tank Top','Tops',35),('Sweater','Tops',110),('Hoodie','Tops',135),('Leather Jacket','Jackets',320),('Denim Jacket','Jackets',180),('Bomber Jacket','Jackets',260),('Winter Coat','Jackets',300),('Rain Jacket','Jackets',160),('Suit Jacket','Formal Wear',450),('Tuxedo Jacket','Formal Wear',650),('Formal Dress','Formal Wear',550),('Wedding Dress','Formal Wear',1200),('Work Shirt','Workwear',85),('Coveralls','Workwear',150),('High Visibility Jacket','Workwear',125),('Chef Uniform','Uniforms',180),('Medical Scrubs','Uniforms',140),('Security Uniform','Uniforms',220),('Mechanic Uniform','Uniforms',180),('Firefighter Station Wear','Uniforms',260),('Jeans','Pants',95),('Cargo Pants','Pants',120),('Dress Pants','Pants',150),('Joggers','Pants',85),('Shorts','Pants',60),('Skirt','Pants',90),('Work Pants','Workwear',110),('Running Shoes','Footwear',140),('Casual Sneakers','Footwear',120),('Dress Shoes','Footwear',190),('Work Boots','Footwear',180),('Hiking Boots','Footwear',220),('Sandals','Footwear',55),('High Heels','Footwear',160),('Baseball Cap','Headwear',45),('Beanie','Headwear',40),('Cowboy Hat','Headwear',130),('Top Hat','Headwear',180),('Motorcycle Helmet','Headwear',350),('Safety Helmet','Headwear',95),('Sunglasses','Accessories',90),('Reading Glasses','Accessories',75),('Sports Watch','Accessories',180),('Luxury Watch','Accessories',2500),('Silver Chain','Jewelry',300),('Gold Chain','Jewelry',1800),('Diamond Necklace','Jewelry',12000),('Backpack','Bags',180),('Duffel Bag','Bags',250),('Briefcase','Bags',300),('Tool Belt','Accessories',120),('Winter Gloves','Accessories',65),('Work Gloves','Accessories',45),('Face Mask','Masks',35),('Ski Mask','Masks',80),('Bandana','Masks',30)
), target as (
 select s.* from public.stores s where s.name='Ultimate General Store'
)
insert into public.store_products(community_id,store_id,sku,name,description,category,price,stock_quantity,active,product_type)
select t.community_id,t.id,'CLOTH-'||upper(substr(md5(c.name),1,10)),c.name,c.name||' for civilian roleplay.',c.category,c.price,250,true,'item'
from target t cross join clothing c
on conflict(store_id,sku) do update set name=excluded.name,category=excluded.category,price=excluded.price,active=true,updated_at=now();

with rp(name,category,price) as (
 values
 ('Office Desk','Furniture',450),('Office Chair','Furniture',180),('Filing Cabinet','Furniture',220),('Cash Register','Business Equipment',600),('Barcode Scanner','Business Equipment',280),('Receipt Printer','Business Equipment',350),('Display Shelf','Business Equipment',250),('Storage Crate','Storage',80),('Storage Pallet','Storage',120),('Cardboard Box','Storage',15),('Packing Tape','Business Supplies',12),('Shipping Labels','Business Supplies',20),('Cleaning Kit','Cleaning',75),('Mop and Bucket','Cleaning',55),('Vacuum Cleaner','Cleaning',180),('Pressure Washer','Tools',450),('Generator','Equipment',800),('Portable Lighting Kit','Equipment',350),('Extension Cord','Tools',35),('Ladder','Tools',120),('Concrete Mix','Construction',25),('Lumber Bundle','Construction',85),('Steel Sheet','Construction',120),('Copper Wire','Construction',65),('Electrical Kit','Construction',180),('Plumbing Kit','Construction',160),('Fertilizer Bag','Farming',45),('Seed Pack','Farming',20),('Watering Can','Farming',30),('Garden Tools','Farming',95),('Fishing Rod','Fishing',180),('Fishing Bait','Fishing',20),('Tackle Box','Fishing',110),('Camping Tent','Camping',300),('Sleeping Bag','Camping',140),('Camping Stove','Camping',175),('Cooler','Camping',90),('Portable Radio','Electronics',180),('Desktop Computer','Electronics',1600),('Monitor','Electronics',350),('Printer','Electronics',280),('Security Camera','Security',450),('Alarm System','Security',900),('Safe','Security',1200),('Document Shredder','Office',180),('Clipboard','Office',20),('Invoice Book','Office',15),('Business Cards','Office',60),('Vehicle Detail Kit','Automotive',120),('Car Wash Soap','Automotive',25),('Paint Supplies','Automotive',260),('Welding Kit','Automotive',850),('Diagnostic Scanner','Automotive',1800),('Engine Hoist','Automotive',1400),('Tire Machine','Automotive',3200),('Hydraulic Lift','Automotive',8500),('Medical Supply Box','Medical',320),('Rescue Rope','Rescue',180),('Life Jacket','Marine',95),('Boat Repair Kit','Marine',550),('Aircraft Tool Kit','Aviation',1600),('Parachute Pack','Aviation',2500)
), target as (select s.* from public.stores s where s.name='Ultimate Hardware & Auto')
insert into public.store_products(community_id,store_id,sku,name,description,category,price,stock_quantity,active,product_type)
select t.community_id,t.id,'RP-'||upper(substr(md5(r.name),1,10)),r.name,r.name||' for civilian and business roleplay.',r.category,r.price,200,true,'item'
from target t cross join rp r
on conflict(store_id,sku) do update set name=excluded.name,category=excluded.category,price=excluded.price,active=true,updated_at=now();

with contraband(name,category,price) as (
 values
 ('Fictional Street Powder','Fictional Contraband',900),('Fictional Herbal Package','Fictional Contraband',650),('Fictional Crystal Package','Fictional Contraband',1200),('Unmarked Pill Bottle','Fictional Contraband',800),('Suspicious Chemical Container','Fictional Contraband',1500),('Counterfeit Document Pack','Fictional Contraband',1800),('Stolen Electronics Crate','Fictional Contraband',2500),('Unregistered Cargo Box','Fictional Contraband',2000),('Black Market Medical Crate','Fictional Contraband',2200),('Illegal Racing Parts Crate','Fictional Contraband',3000)
), target as (select s.* from public.stores s where s.name='Ultimate Government Services')
insert into public.store_products(community_id,store_id,sku,name,description,category,price,stock_quantity,active,product_type,restricted)
select t.community_id,t.id,'CONTRA-'||upper(substr(md5(c.name),1,10)),c.name,'Fictional roleplay evidence/contraband item. No real-world instructions included.',c.category,c.price,0,false,'item',true
from target t cross join contraband c
on conflict(store_id,sku) do update set name=excluded.name,description=excluded.description,category=excluded.category,price=excluded.price,restricted=true,updated_at=now();

commit;
