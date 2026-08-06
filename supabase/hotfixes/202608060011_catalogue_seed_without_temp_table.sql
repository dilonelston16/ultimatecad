-- UltimateCAD catalogue-only recovery
-- Run this only after the corrected main migration succeeds, or when the
-- economy administration portion already exists and only the catalogue is missing.

begin;

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

select
  st.name as store_name,
  count(sp.id) as product_count
from public.stores st
left join public.store_products sp on sp.store_id=st.id and sp.active=true
where st.name in (
  'Ultimate General Store',
  'Ultimate Hardware & Auto',
  'Ultimate Medical Supply',
  'Ultimate Government Services'
)
group by st.name
order by st.name;
