-- UltimateCAD — Economy Administration and GTA/RP Store Catalogue

begin;

update public.economy_settings
set starting_balance = 25000,
    updated_at = now();

-- Give existing untouched civilian accounts the new starting balance.
update public.bank_accounts a
set balance = 25000,
    available_balance = 25000,
    updated_at = now()
where a.character_id is not null
  and a.account_type = 'checking'
  and a.balance = 0
  and not exists (
    select 1
    from public.bank_transactions t
    where t.account_id = a.id
  );

create or replace function public.create_character_bank_account(
  p_character_id uuid,
  p_account_type text default 'checking',
  p_name text default null
)
returns public.bank_accounts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_account public.bank_accounts;
  v_account_number text;
  v_name text;
  v_starting numeric(16,2) := 0;
begin
  select * into v_character
  from public.characters
  where id=p_character_id
    and owner_user_id=auth.uid()
    and is_archived=false;

  if v_character.id is null then raise exception 'Character not found or unavailable'; end if;
  if p_account_type not in ('checking','savings') then raise exception 'Invalid civilian account type'; end if;

  if exists(
    select 1 from public.bank_accounts
    where character_id=v_character.id
      and account_type=p_account_type
      and status <> 'closed'
  ) then raise exception 'This character already has an open % account',p_account_type; end if;

  if p_account_type='checking'
     and not exists(select 1 from public.bank_accounts where character_id=v_character.id) then
    select coalesce(starting_balance,25000)
    into v_starting
    from public.economy_settings
    where community_id=v_character.community_id;
    v_starting := coalesce(v_starting,25000);
  end if;

  v_account_number:=public.generate_cad_identifier(v_character.community_id,'bank_account');
  v_name:=coalesce(nullif(trim(p_name),''),initcap(p_account_type)||' Account');

  insert into public.bank_accounts(
    community_id,character_id,account_number,account_type,name,
    balance,available_balance,status,opened_by_user_id
  )
  values(
    v_character.community_id,v_character.id,v_account_number,p_account_type,
    v_name,v_starting,v_starting,'active',auth.uid()
  )
  returning * into v_account;

  if v_starting > 0 then
    insert into public.bank_transactions(
      community_id,transaction_number,account_id,transaction_type,direction,
      amount,balance_after,description,reference_type,initiated_by_user_id
    )
    values(
      v_character.community_id,
      public.generate_cad_identifier(v_character.community_id,'bank_transaction'),
      v_account.id,'adjustment','credit',v_starting,v_starting,
      'Civilian starting balance','starting_balance',auth.uid()
    );
  end if;

  return v_account;
end;
$$;

grant execute on function public.create_character_bank_account(uuid,text,text)
to authenticated;

create or replace function public.admin_adjust_bank_balance(
  p_account_id uuid,
  p_direction text,
  p_amount numeric,
  p_reason text
)
returns public.bank_accounts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_account public.bank_accounts%rowtype;
  v_new numeric(16,2);
  v_number text;
begin
  select * into v_account from public.bank_accounts where id=p_account_id for update;
  if v_account.id is null then raise exception 'Account not found'; end if;

  if not (
    public.has_permission(v_account.community_id,'banking.adjust')
    or public.has_permission(v_account.community_id,'banking.manage')
    or public.is_community_owner(v_account.community_id)
  ) then raise exception 'Bank balance adjustment permission required'; end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required'; end if;

  if p_direction='credit' then
    v_new:=v_account.balance+p_amount;
  elsif p_direction='debit' then
    if v_account.balance<p_amount then raise exception 'Account does not contain enough funds'; end if;
    v_new:=v_account.balance-p_amount;
  else
    raise exception 'Direction must be credit or debit';
  end if;

  update public.bank_accounts
  set balance=v_new,
      available_balance=v_new-coalesce((
        select sum(h.amount) from public.bank_account_holds h
        where h.account_id=v_account.id and h.status='active'
      ),0),
      updated_at=now()
  where id=v_account.id
  returning * into v_account;

  v_number:=public.generate_cad_identifier(v_account.community_id,'bank_transaction');

  insert into public.bank_transactions(
    community_id,transaction_number,account_id,transaction_type,direction,
    amount,balance_after,description,reference_type,initiated_by_user_id,
    metadata
  )
  values(
    v_account.community_id,v_number,v_account.id,'adjustment',p_direction,
    p_amount,v_new,trim(p_reason),'admin_adjustment',auth.uid(),
    jsonb_build_object('admin_user_id',auth.uid())
  );

  insert into public.bank_account_notes(
    community_id,account_id,author_user_id,note
  )
  values(
    v_account.community_id,v_account.id,auth.uid(),
    upper(p_direction)||' $'||p_amount::text||': '||trim(p_reason)
  );

  return v_account;
end;
$$;

grant execute on function public.admin_adjust_bank_balance(uuid,text,numeric,text)
to authenticated;

create or replace function public.place_bank_account_hold(
  p_account_id uuid,
  p_amount numeric,
  p_reason text
)
returns public.bank_account_holds
language plpgsql
security definer
set search_path=public
as $$
declare
  v_account public.bank_accounts%rowtype;
  v_hold public.bank_account_holds;
begin
  select * into v_account from public.bank_accounts where id=p_account_id for update;
  if v_account.id is null then raise exception 'Account not found'; end if;

  if not (
    public.has_permission(v_account.community_id,'banking.manage')
    or public.is_community_owner(v_account.community_id)
  ) then raise exception 'Banking management permission required'; end if;

  if p_amount<=0 then raise exception 'Hold amount must be greater than zero'; end if;
  if p_amount>v_account.available_balance then raise exception 'Hold exceeds available balance'; end if;

  insert into public.bank_account_holds(
    community_id,account_id,amount,reason,status,placed_by_user_id
  )
  values(v_account.community_id,v_account.id,p_amount,trim(p_reason),'active',auth.uid())
  returning * into v_hold;

  update public.bank_accounts
  set available_balance=greatest(0,available_balance-p_amount),
      updated_at=now()
  where id=v_account.id;

  return v_hold;
end;
$$;

grant execute on function public.place_bank_account_hold(uuid,numeric,text)
to authenticated;

create or replace function public.release_bank_account_hold(
  p_hold_id uuid,
  p_capture boolean default false
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_hold public.bank_account_holds%rowtype;
  v_account public.bank_accounts%rowtype;
  v_treasury uuid;
begin
  select * into v_hold from public.bank_account_holds where id=p_hold_id for update;
  if v_hold.id is null or v_hold.status<>'active' then raise exception 'Active hold not found'; end if;

  select * into v_account from public.bank_accounts where id=v_hold.account_id for update;

  if not (
    public.has_permission(v_hold.community_id,'banking.manage')
    or public.is_community_owner(v_hold.community_id)
  ) then raise exception 'Banking management permission required'; end if;

  if p_capture then
    if v_account.balance<v_hold.amount then raise exception 'Account balance is below the held amount'; end if;

    update public.bank_accounts
    set balance=balance-v_hold.amount,
        updated_at=now()
    where id=v_account.id;

    select bank_account_id into v_treasury
    from public.government_accounts
    where community_id=v_hold.community_id and code='TREASURY'
    limit 1;

    if v_treasury is not null then
      update public.bank_accounts
      set balance=balance+v_hold.amount,
          available_balance=available_balance+v_hold.amount,
          updated_at=now()
      where id=v_treasury;
    end if;

    update public.bank_account_holds
    set status='captured',released_at=now()
    where id=v_hold.id;

    insert into public.bank_transactions(
      community_id,transaction_number,account_id,related_account_id,
      transaction_type,direction,amount,balance_after,description,
      reference_type,reference_id,initiated_by_user_id
    )
    values(
      v_hold.community_id,
      public.generate_cad_identifier(v_hold.community_id,'bank_transaction'),
      v_account.id,v_treasury,'adjustment','debit',v_hold.amount,
      v_account.balance-v_hold.amount,'Funds seized: '||v_hold.reason,
      'bank_hold',v_hold.id,auth.uid()
    );
  else
    update public.bank_accounts
    set available_balance=least(balance,available_balance+v_hold.amount),
        updated_at=now()
    where id=v_account.id;

    update public.bank_account_holds
    set status='released',released_at=now()
    where id=v_hold.id;
  end if;
end;
$$;

grant execute on function public.release_bank_account_hold(uuid,boolean)
to authenticated;

-- Create default community stores.
insert into public.stores(community_id,name,description,status)
select c.id,s.name,s.description,'active'
from public.communities c
cross join (
  values
    ('Ultimate General Store','Food, drinks, electronics, clothing, and everyday RP items.'),
    ('Ultimate Hardware & Auto','Tools, mechanic supplies, vehicle parts, and safety equipment.'),
    ('Ultimate Medical Supply','Medical, first-aid, rescue, and EMS roleplay supplies.'),
    ('Ultimate Government Services','Documents, applications, replacement IDs, and public services.')
) s(name,description)
on conflict(community_id,name) do update
set description=excluded.description,status='active';

-- Product catalogue seed without temporary tables.
insert into public.store_products(
  community_id,store_id,sku,name,description,category,price,stock_quantity,active
)
select
  st.community_id,
  st.id,
  seed.sku,
  seed.item_name,
  seed.description,
  case seed.store_code
    when 'FOOD' then 'Food'
    when 'DRINK' then 'Drinks'
    when 'GENERAL' then 'General'
    when 'CLOTHING' then 'Clothing'
    when 'DOCS' then 'Documents'
    when 'TOOLS' then 'Tools'
    when 'AUTO' then 'Vehicle Parts'
    when 'MEDICAL' then 'Medical'
    else 'Roleplay Equipment'
  end,
  seed.price,
  seed.stock,
  true
from (
  values
    ('FOOD','FOOD-BURGER','Burger','Burger for civilian and roleplay use.',45,250),
    ('FOOD','FOOD-CHEESEBURGER','Cheeseburger','Cheeseburger for civilian and roleplay use.',55,250),
    ('FOOD','FOOD-CHICKEN','Chicken Sandwich','Chicken Sandwich for civilian and roleplay use.',60,200),
    ('FOOD','FOOD-HOTDOG','Hot Dog','Hot Dog for civilian and roleplay use.',35,250),
    ('FOOD','FOOD-TACO','Taco','Taco for civilian and roleplay use.',30,300),
    ('FOOD','FOOD-BURRITO','Burrito','Burrito for civilian and roleplay use.',55,200),
    ('FOOD','FOOD-PIZZA','Pizza Slice','Pizza Slice for civilian and roleplay use.',40,300),
    ('FOOD','FOOD-DONUT','Donut','Donut for civilian and roleplay use.',20,400),
    ('FOOD','FOOD-CHIPS','Bag of Chips','Bag of Chips for civilian and roleplay use.',15,400),
    ('FOOD','FOOD-CANDY','Candy Bar','Candy Bar for civilian and roleplay use.',12,500),
    ('FOOD','FOOD-SANDWICH','Deli Sandwich','Deli Sandwich for civilian and roleplay use.',50,200),
    ('FOOD','FOOD-SALAD','Salad','Salad for civilian and roleplay use.',45,180),
    ('FOOD','FOOD-STEAK','Steak Dinner','Steak Dinner for civilian and roleplay use.',125,100),
    ('FOOD','FOOD-PASTA','Pasta Meal','Pasta Meal for civilian and roleplay use.',85,120),
    ('FOOD','FOOD-BREAKFAST','Breakfast Plate','Breakfast Plate for civilian and roleplay use.',70,150),
    ('DRINK','DRINK-WATER','Bottled Water','Bottled Water for civilian and roleplay use.',10,500),
    ('DRINK','DRINK-COLA','E-Cola','E-Cola for civilian and roleplay use.',15,500),
    ('DRINK','DRINK-SPRITE','Lemon-Lime Soda','Lemon-Lime Soda for civilian and roleplay use.',15,500),
    ('DRINK','DRINK-COFFEE','Coffee','Coffee for civilian and roleplay use.',18,350),
    ('DRINK','DRINK-ENERGY','Energy Drink','Energy Drink for civilian and roleplay use.',25,300),
    ('DRINK','DRINK-JUICE','Fruit Juice','Fruit Juice for civilian and roleplay use.',20,300),
    ('DRINK','DRINK-MILK','Milk','Milk for civilian and roleplay use.',18,200),
    ('DRINK','DRINK-TEA','Iced Tea','Iced Tea for civilian and roleplay use.',18,300),
    ('DRINK','DRINK-SMOOTHIE','Fruit Smoothie','Fruit Smoothie for civilian and roleplay use.',35,150),
    ('GENERAL','GEN-PHONE','Mobile Phone','Mobile Phone for civilian and roleplay use.',750,100),
    ('GENERAL','GEN-SIM','SIM Card','SIM Card for civilian and roleplay use.',50,200),
    ('GENERAL','GEN-RADIO','Handheld Radio','Handheld Radio for civilian and roleplay use.',450,100),
    ('GENERAL','GEN-FLASHLIGHT','Flashlight','Flashlight for civilian and roleplay use.',85,200),
    ('GENERAL','GEN-BATTERY','Battery Pack','Battery Pack for civilian and roleplay use.',35,300),
    ('GENERAL','GEN-UMBRELLA','Umbrella','Umbrella for civilian and roleplay use.',30,120),
    ('GENERAL','GEN-BACKPACK','Backpack','Backpack for civilian and roleplay use.',180,100),
    ('GENERAL','GEN-DUFFEL','Duffel Bag','Duffel Bag for civilian and roleplay use.',250,80),
    ('GENERAL','GEN-LOCK','Padlock','Padlock for civilian and roleplay use.',45,150),
    ('GENERAL','GEN-ROPE','Rope','Rope for civilian and roleplay use.',65,120),
    ('GENERAL','GEN-DUCTTAPE','Duct Tape','Duct Tape for civilian and roleplay use.',25,250),
    ('GENERAL','GEN-NOTEBOOK','Notebook','Notebook for civilian and roleplay use.',12,300),
    ('GENERAL','GEN-PEN','Pen','Pen for civilian and roleplay use.',5,500),
    ('GENERAL','GEN-CAMERA','Digital Camera','Digital Camera for civilian and roleplay use.',900,60),
    ('GENERAL','GEN-BINOCULARS','Binoculars','Binoculars for civilian and roleplay use.',350,50),
    ('GENERAL','GEN-GPS','GPS Unit','GPS Unit for civilian and roleplay use.',600,75),
    ('GENERAL','GEN-CHARGER','Phone Charger','Phone Charger for civilian and roleplay use.',45,200),
    ('GENERAL','GEN-LAPTOP','Laptop Computer','Laptop Computer for civilian and roleplay use.',2500,40),
    ('GENERAL','GEN-TABLET','Tablet','Tablet for civilian and roleplay use.',1500,50),
    ('TOOLS','TOOL-HAMMER','Hammer','Hammer for civilian and roleplay use.',55,120),
    ('TOOLS','TOOL-SCREWDRIVER','Screwdriver Set','Screwdriver Set for civilian and roleplay use.',80,120),
    ('TOOLS','TOOL-WRENCH','Wrench Set','Wrench Set for civilian and roleplay use.',150,100),
    ('TOOLS','TOOL-PLIERS','Pliers','Pliers for civilian and roleplay use.',45,120),
    ('TOOLS','TOOL-CROWBAR','Crowbar','Crowbar for civilian and roleplay use.',90,80),
    ('TOOLS','TOOL-DRILL','Power Drill','Power Drill for civilian and roleplay use.',350,60),
    ('TOOLS','TOOL-SAW','Hand Saw','Hand Saw for civilian and roleplay use.',85,80),
    ('TOOLS','TOOL-TOOLBOX','Toolbox','Toolbox for civilian and roleplay use.',275,70),
    ('TOOLS','TOOL-SHOVEL','Shovel','Shovel for civilian and roleplay use.',75,100),
    ('TOOLS','TOOL-PICKAXE','Pickaxe','Pickaxe for civilian and roleplay use.',95,70),
    ('TOOLS','TOOL-BOLT','Bolt Cutters','Bolt Cutters for civilian and roleplay use.',240,40),
    ('TOOLS','TOOL-ZIPTIE','Zip Ties','Zip Ties for civilian and roleplay use.',20,300),
    ('TOOLS','TOOL-EXTINGUISHER','Fire Extinguisher','Fire Extinguisher for civilian and roleplay use.',180,100),
    ('TOOLS','TOOL-TRAFFICCONE','Traffic Cone','Traffic Cone for civilian and roleplay use.',35,200),
    ('TOOLS','TOOL-BARRIER','Portable Barrier','Portable Barrier for civilian and roleplay use.',220,60),
    ('MEDICAL','MED-BANDAGE','Bandage','Bandage for civilian and roleplay use.',25,500),
    ('MEDICAL','MED-GAUZE','Sterile Gauze','Sterile Gauze for civilian and roleplay use.',18,500),
    ('MEDICAL','MED-FIRSTAID','First Aid Kit','First Aid Kit for civilian and roleplay use.',250,150),
    ('MEDICAL','MED-TRAUMA','Trauma Kit','Trauma Kit for civilian and roleplay use.',850,60),
    ('MEDICAL','MED-SPLINT','Medical Splint','Medical Splint for civilian and roleplay use.',120,100),
    ('MEDICAL','MED-ICEPACK','Instant Ice Pack','Instant Ice Pack for civilian and roleplay use.',20,250),
    ('MEDICAL','MED-PAINKILLER','Pain Relief Tablets','Pain Relief Tablets for civilian and roleplay use.',35,250),
    ('MEDICAL','MED-ANTISEPTIC','Antiseptic','Antiseptic for civilian and roleplay use.',40,200),
    ('MEDICAL','MED-GLOVES','Medical Gloves','Medical Gloves for civilian and roleplay use.',15,400),
    ('MEDICAL','MED-MASK','Medical Mask','Medical Mask for civilian and roleplay use.',10,400),
    ('MEDICAL','MED-CRUTCH','Crutches','Crutches for civilian and roleplay use.',160,60),
    ('MEDICAL','MED-WHEELCHAIR','Wheelchair','Wheelchair for civilian and roleplay use.',800,25),
    ('MEDICAL','MED-OXYGEN','Portable Oxygen Tank','Portable Oxygen Tank for civilian and roleplay use.',700,30),
    ('MEDICAL','MED-AED','AED Unit','AED Unit for civilian and roleplay use.',1800,20),
    ('AUTO','AUTO-REPAIRKIT','Vehicle Repair Kit','Vehicle Repair Kit for civilian and roleplay use.',450,100),
    ('AUTO','AUTO-ADVREPAIR','Advanced Repair Kit','Advanced Repair Kit for civilian and roleplay use.',950,60),
    ('AUTO','AUTO-TIREKIT','Tire Repair Kit','Tire Repair Kit for civilian and roleplay use.',220,120),
    ('AUTO','AUTO-SPARETIRE','Spare Tire','Spare Tire for civilian and roleplay use.',350,80),
    ('AUTO','AUTO-OIL','Engine Oil','Engine Oil for civilian and roleplay use.',65,200),
    ('AUTO','AUTO-COOLANT','Engine Coolant','Engine Coolant for civilian and roleplay use.',45,200),
    ('AUTO','AUTO-BRAKEFLUID','Brake Fluid','Brake Fluid for civilian and roleplay use.',40,160),
    ('AUTO','AUTO-TRANFLUID','Transmission Fluid','Transmission Fluid for civilian and roleplay use.',70,140),
    ('AUTO','AUTO-BATTERY','Vehicle Battery','Vehicle Battery for civilian and roleplay use.',350,80),
    ('AUTO','AUTO-ALTERNATOR','Alternator','Alternator for civilian and roleplay use.',650,40),
    ('AUTO','AUTO-STARTER','Starter Motor','Starter Motor for civilian and roleplay use.',550,40),
    ('AUTO','AUTO-SPARKPLUG','Spark Plug Set','Spark Plug Set for civilian and roleplay use.',120,100),
    ('AUTO','AUTO-AIRFILTER','Air Filter','Air Filter for civilian and roleplay use.',70,120),
    ('AUTO','AUTO-OILFILTER','Oil Filter','Oil Filter for civilian and roleplay use.',45,150),
    ('AUTO','AUTO-BRAKEPADS','Brake Pad Set','Brake Pad Set for civilian and roleplay use.',280,80),
    ('AUTO','AUTO-ROTOR','Brake Rotor','Brake Rotor for civilian and roleplay use.',240,80),
    ('AUTO','AUTO-TIRE','Standard Tire','Standard Tire for civilian and roleplay use.',220,150),
    ('AUTO','AUTO-PERFTIRE','Performance Tire','Performance Tire for civilian and roleplay use.',450,80),
    ('AUTO','AUTO-FUELCAN','Fuel Can','Fuel Can for civilian and roleplay use.',80,120),
    ('AUTO','AUTO-JACK','Vehicle Jack','Vehicle Jack for civilian and roleplay use.',180,80),
    ('AUTO','AUTO-JUMPER','Jumper Cables','Jumper Cables for civilian and roleplay use.',75,120),
    ('AUTO','AUTO-TOWROPE','Tow Strap','Tow Strap for civilian and roleplay use.',90,100),
    ('AUTO','AUTO-WINCH','Portable Winch','Portable Winch for civilian and roleplay use.',750,30),
    ('AUTO','AUTO-PLATE','Replacement Plate','Replacement Plate for civilian and roleplay use.',200,100),
    ('AUTO','AUTO-WINDSHIELD','Windshield Glass','Windshield Glass for civilian and roleplay use.',550,35),
    ('AUTO','AUTO-HEADLIGHT','Headlight Assembly','Headlight Assembly for civilian and roleplay use.',260,70),
    ('AUTO','AUTO-TAILLIGHT','Tail Light Assembly','Tail Light Assembly for civilian and roleplay use.',220,70),
    ('AUTO','AUTO-BUMPER','Replacement Bumper','Replacement Bumper for civilian and roleplay use.',700,30),
    ('CLOTHING','CLOTH-TSHIRT','T-Shirt','T-Shirt for civilian and roleplay use.',45,200),
    ('CLOTHING','CLOTH-HOODIE','Hoodie','Hoodie for civilian and roleplay use.',95,160),
    ('CLOTHING','CLOTH-JACKET','Jacket','Jacket for civilian and roleplay use.',180,120),
    ('CLOTHING','CLOTH-JEANS','Jeans','Jeans for civilian and roleplay use.',85,180),
    ('CLOTHING','CLOTH-SHORTS','Shorts','Shorts for civilian and roleplay use.',55,160),
    ('CLOTHING','CLOTH-SHOES','Casual Shoes','Casual Shoes for civilian and roleplay use.',110,140),
    ('CLOTHING','CLOTH-BOOTS','Work Boots','Work Boots for civilian and roleplay use.',160,100),
    ('CLOTHING','CLOTH-HAT','Baseball Cap','Baseball Cap for civilian and roleplay use.',40,180),
    ('CLOTHING','CLOTH-BEANIE','Beanie','Beanie for civilian and roleplay use.',35,180),
    ('CLOTHING','CLOTH-GLOVES','Work Gloves','Work Gloves for civilian and roleplay use.',45,180),
    ('CLOTHING','CLOTH-SUIT','Business Suit','Business Suit for civilian and roleplay use.',650,60),
    ('CLOTHING','CLOTH-DRESS','Formal Dress','Formal Dress for civilian and roleplay use.',550,60),
    ('CLOTHING','CLOTH-HIVIS','High-Visibility Vest','High-Visibility Vest for civilian and roleplay use.',75,120),
    ('CLOTHING','CLOTH-HELMET','Safety Helmet','Safety Helmet for civilian and roleplay use.',95,100),
    ('DOCS','DOC-IDCARD','Replacement State ID','Replacement State ID for civilian and roleplay use.',100,999),
    ('DOCS','DOC-DRIVER','Driver Licence Replacement','Driver Licence Replacement for civilian and roleplay use.',150,999),
    ('DOCS','DOC-PASSPORT','Passport Application','Passport Application for civilian and roleplay use.',500,999),
    ('DOCS','DOC-BIRTH','Birth Certificate Copy','Birth Certificate Copy for civilian and roleplay use.',75,999),
    ('DOCS','DOC-BUSINESS','Business Registration Packet','Business Registration Packet for civilian and roleplay use.',250,999),
    ('DOCS','DOC-VEHICLE','Vehicle Registration Packet','Vehicle Registration Packet for civilian and roleplay use.',150,999),
    ('DOCS','DOC-INSURANCE','Insurance Documentation','Insurance Documentation for civilian and roleplay use.',50,999),
    ('DOCS','DOC-NOTARY','Notary Service','Notary Service for civilian and roleplay use.',125,999),
    ('DOCS','DOC-BACKGROUND','Background Check','Background Check for civilian and roleplay use.',300,999),
    ('RP','RP-CLIPBOARD','Clipboard','Clipboard for civilian and roleplay use.',20,250),
    ('RP','RP-EVIDENCEBAG','Evidence Bag','Evidence Bag for civilian and roleplay use.',15,500),
    ('RP','RP-BODYCAM','Body Camera','Body Camera for civilian and roleplay use.',650,80),
    ('RP','RP-DASHCAM','Dashboard Camera','Dashboard Camera for civilian and roleplay use.',900,50),
    ('RP','RP-HANDCUFFS','Handcuffs','Handcuffs for civilian and roleplay use.',180,100),
    ('RP','RP-ROADFLARE','Road Flare','Road Flare for civilian and roleplay use.',25,300),
    ('RP','RP-BREATHALYZER','Breathalyzer','Breathalyzer for civilian and roleplay use.',850,40),
    ('RP','RP-RADARGUN','Radar Gun','Radar Gun for civilian and roleplay use.',1200,30),
    ('RP','RP-MEGAPHONE','Megaphone','Megaphone for civilian and roleplay use.',160,80),
    ('RP','RP-RESCUEAXE','Rescue Axe','Rescue Axe for civilian and roleplay use.',250,60),
    ('RP','RP-HALLIGAN','Halligan Tool','Halligan Tool for civilian and roleplay use.',350,50),
    ('RP','RP-SCBA','SCBA Unit','SCBA Unit for civilian and roleplay use.',1800,25),
    ('RP','RP-TURNOUT','Turnout Gear Set','Turnout Gear Set for civilian and roleplay use.',1300,30),
    ('RP','RP-STRETCHER','Medical Stretcher','Medical Stretcher for civilian and roleplay use.',1200,25),
    ('RP','RP-NECKBRACE','Cervical Collar','Cervical Collar for civilian and roleplay use.',85,100),
    ('RP','RP-TRAFFICSIGN','Portable Traffic Sign','Portable Traffic Sign for civilian and roleplay use.',120,100),
    ('RP','RP-LOCKPICK','Lockpick Set','Lockpick Set for civilian and roleplay use.',250,50),
    ('RP','RP-METALDETECTOR','Metal Detector','Metal Detector for civilian and roleplay use.',900,30),
    ('RP','RP-FISHINGROD','Fishing Rod','Fishing Rod for civilian and roleplay use.',180,80),
    ('RP','RP-BAIT','Fishing Bait','Fishing Bait for civilian and roleplay use.',20,300),
    ('RP','RP-CAMPING','Camping Kit','Camping Kit for civilian and roleplay use.',450,50),
    ('RP','RP-TENT','Tent','Tent for civilian and roleplay use.',300,60),
    ('RP','RP-SLEEPINGBAG','Sleeping Bag','Sleeping Bag for civilian and roleplay use.',140,80)
) as seed(store_code,sku,item_name,description,price,stock)
join public.stores st
  on st.name = case
    when seed.store_code in ('FOOD','DRINK','GENERAL','CLOTHING','RP')
      then 'Ultimate General Store'
    when seed.store_code in ('TOOLS','AUTO')
      then 'Ultimate Hardware & Auto'
    when seed.store_code='MEDICAL'
      then 'Ultimate Medical Supply'
    else 'Ultimate Government Services'
  end
on conflict(store_id,sku) do update
set name=excluded.name,
    description=excluded.description,
    category=excluded.category,
    price=excluded.price,
    stock_quantity=greatest(public.store_products.stock_quantity,excluded.stock_quantity),
    active=true;

commit;
