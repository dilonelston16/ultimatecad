-- UltimateCAD Milestone 2.0 — Full Economy Foundation
-- Banking integrations, government accounts, scheduled payments, loans,
-- businesses, employment, payroll, stores, products and inventories.

begin;

create table if not exists public.economy_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  currency_code text not null default 'USD',
  currency_symbol text not null default '$',
  starting_balance numeric(16,2) not null default 5000,
  sales_tax_percent numeric(7,4) not null default 5,
  income_tax_percent numeric(7,4) not null default 10,
  business_tax_percent numeric(7,4) not null default 8,
  late_fee_percent numeric(7,4) not null default 5,
  insurance_billing_days integer not null default 30,
  registration_fee numeric(12,2) not null default 500,
  license_application_fee numeric(12,2) not null default 250,
  failed_payment_retry_days integer not null default 3,
  max_payment_retries integer not null default 3,
  updated_at timestamptz not null default now()
);

create table if not exists public.government_accounts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  code text not null,
  name text not null,
  purpose text,
  created_at timestamptz not null default now(),
  unique (community_id, code)
);

create table if not exists public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  business_id uuid,
  source_account_id uuid references public.bank_accounts(id) on delete set null,
  destination_account_id uuid references public.bank_accounts(id) on delete set null,
  payment_type text not null,
  reference_type text,
  reference_id uuid,
  description text not null,
  amount numeric(16,2) not null check (amount > 0),
  frequency text not null default 'monthly',
  next_due_at timestamptz not null,
  status text not null default 'active',
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_type in (
    'insurance_premium','loan_payment','tax','payroll','registration',
    'license_fee','rent','subscription','business_expense','other'
  )),
  check (frequency in ('once','weekly','biweekly','monthly','quarterly','yearly')),
  check (status in ('active','paused','completed','failed','cancelled'))
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  business_id uuid,
  bill_number text not null,
  bill_type text not null,
  issuer_name text not null,
  description text not null,
  amount numeric(16,2) not null check (amount >= 0),
  amount_paid numeric(16,2) not null default 0,
  due_at timestamptz not null,
  status text not null default 'unpaid',
  reference_type text,
  reference_id uuid,
  paid_from_account_id uuid references public.bank_accounts(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (community_id, bill_number),
  check (status in ('unpaid','partially_paid','paid','overdue','waived','cancelled'))
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  business_id uuid,
  destination_account_id uuid references public.bank_accounts(id) on delete set null,
  loan_number text not null,
  loan_type text not null default 'personal',
  principal numeric(16,2) not null check (principal > 0),
  interest_rate numeric(8,4) not null default 5,
  term_months integer not null check (term_months > 0),
  monthly_payment numeric(16,2),
  remaining_balance numeric(16,2) not null,
  status text not null default 'pending',
  purpose text,
  collateral_type text,
  collateral_id uuid,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  next_payment_at timestamptz,
  missed_payments integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, loan_number),
  check (loan_type in ('personal','vehicle','business','property','emergency')),
  check (status in ('pending','approved','active','paid','denied','defaulted','cancelled'))
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete restrict,
  business_number text not null,
  name text not null,
  business_type text not null,
  description text,
  status text not null default 'active',
  tax_rate numeric(7,4),
  business_bank_account_id uuid references public.bank_accounts(id) on delete set null,
  address text,
  phone text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, business_number),
  unique (community_id, name),
  check (status in ('pending','active','suspended','closed','revoked'))
);

alter table public.bank_accounts
  drop constraint if exists bank_accounts_check;

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  role_name text not null default 'Employee',
  pay_type text not null default 'hourly',
  pay_rate numeric(14,2) not null default 0,
  status text not null default 'active',
  hired_at timestamptz not null default now(),
  terminated_at timestamptz,
  unique (business_id, character_id),
  check (pay_type in ('hourly','salary','commission')),
  check (status in ('active','suspended','terminated'))
);

create table if not exists public.employment_records (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  department_id uuid,
  employer_name text not null,
  job_title text not null,
  pay_type text not null default 'hourly',
  pay_rate numeric(14,2) not null default 0,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (pay_type in ('hourly','salary','commission')),
  check (status in ('active','leave','suspended','terminated'))
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  department_id uuid,
  payroll_number text not null,
  pay_period_start date not null,
  pay_period_end date not null,
  gross_amount numeric(16,2) not null default 0,
  tax_amount numeric(16,2) not null default 0,
  net_amount numeric(16,2) not null default 0,
  status text not null default 'draft',
  processed_by_user_id uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (community_id, payroll_number),
  check (status in ('draft','processing','completed','failed','cancelled'))
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employment_record_id uuid references public.employment_records(id) on delete set null,
  character_id uuid not null references public.characters(id) on delete cascade,
  destination_account_id uuid references public.bank_accounts(id) on delete set null,
  gross_amount numeric(16,2) not null default 0,
  tax_amount numeric(16,2) not null default 0,
  net_amount numeric(16,2) not null default 0,
  status text not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  check (status in ('pending','paid','failed','cancelled'))
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (community_id, name),
  check (status in ('active','closed','suspended'))
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  category text,
  price numeric(14,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, sku)
);

create table if not exists public.character_inventory (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now()
);

create table if not exists public.store_sales (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  sale_number text not null,
  subtotal numeric(16,2) not null,
  tax_amount numeric(16,2) not null default 0,
  total_amount numeric(16,2) not null,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  unique (community_id, sale_number),
  check (status in ('completed','refunded','cancelled'))
);

create table if not exists public.store_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.store_sales(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(16,2) not null
);

create index if not exists scheduled_payments_due_idx on public.scheduled_payments(status,next_due_at);
create index if not exists bills_character_idx on public.bills(character_id,status,due_at);
create index if not exists loans_character_idx on public.loans(character_id,status);
create index if not exists businesses_owner_idx on public.businesses(owner_character_id,status);
create index if not exists employment_character_idx on public.employment_records(character_id,status);
create index if not exists products_store_idx on public.store_products(store_id,active);
create index if not exists inventory_character_idx on public.character_inventory(character_id);

alter table public.economy_settings enable row level security;
alter table public.government_accounts enable row level security;
alter table public.scheduled_payments enable row level security;
alter table public.bills enable row level security;
alter table public.loans enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.employment_records enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.stores enable row level security;
alter table public.store_products enable row level security;
alter table public.character_inventory enable row level security;
alter table public.store_sales enable row level security;
alter table public.store_sale_items enable row level security;

insert into public.economy_settings(community_id)
select id from public.communities
on conflict(community_id) do nothing;

insert into public.permissions(key,name,description,category)
values
 ('economy.view','View economy','View personal economy information.','Economy'),
 ('economy.manage','Manage economy','Manage economy settings and government accounts.','Economy'),
 ('loans.apply','Apply for loans','Submit personal and business loan applications.','Loans'),
 ('loans.manage','Manage loans','Approve, deny and manage loans.','Loans'),
 ('businesses.create','Create businesses','Register a new business.','Businesses'),
 ('businesses.manage','Manage businesses','Manage all community businesses.','Businesses'),
 ('payroll.manage','Manage payroll','Create and process payroll runs.','Payroll'),
 ('stores.manage','Manage stores','Create stores and manage products.','Stores')
on conflict(key) do update
set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (
  values
   ('Founder','economy.view'),('Founder','economy.manage'),('Founder','loans.apply'),('Founder','loans.manage'),('Founder','businesses.create'),('Founder','businesses.manage'),('Founder','payroll.manage'),('Founder','stores.manage'),
   ('Owner','economy.view'),('Owner','economy.manage'),('Owner','loans.apply'),('Owner','loans.manage'),('Owner','businesses.create'),('Owner','businesses.manage'),('Owner','payroll.manage'),('Owner','stores.manage'),
   ('Community Admin','economy.view'),('Community Admin','economy.manage'),('Community Admin','loans.manage'),('Community Admin','businesses.manage'),('Community Admin','payroll.manage'),('Community Admin','stores.manage'),
   ('Civilian','economy.view'),('Civilian','loans.apply'),('Civilian','businesses.create')
) p(role_name,permission_key) on p.role_name=r.name
on conflict(role_id,permission_key) do update set allowed=true;

create or replace function public.ensure_government_accounts(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_code text;
  v_name text;
  v_account_id uuid;
  v_account_number text;
begin
  for v_code,v_name in
    select * from (
      values
        ('TREASURY','Government Treasury'),
        ('DMV','DMV Revenue'),
        ('COURT','Court and Fines'),
        ('TAX','Tax Revenue'),
        ('INSURANCE','Insurance Clearing')
    ) as x(code,name)
  loop
    if not exists(
      select 1 from public.government_accounts
      where community_id=p_community_id and code=v_code
    ) then
      v_account_number:=public.generate_cad_identifier(p_community_id,'bank_account');

      insert into public.bank_accounts(
        community_id,business_id,account_number,account_type,name,
        balance,available_balance,status,opened_by_user_id
      )
      values(
        p_community_id,gen_random_uuid(),v_account_number,'government',v_name,
        0,0,'active',auth.uid()
      )
      returning id into v_account_id;

      insert into public.government_accounts(
        community_id,bank_account_id,code,name,purpose
      )
      values(
        p_community_id,v_account_id,v_code,v_name,
        'System government revenue account.'
      );
    end if;
  end loop;
end;
$$;

-- Note: if your bank_accounts business_id has a FK later, government accounts
-- should be migrated to a dedicated owner_type/owner_id model.

create or replace function public.create_business(
  p_character_id uuid,
  p_name text,
  p_business_type text,
  p_description text default null,
  p_address text default null,
  p_phone text default null
)
returns public.businesses
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_business public.businesses;
  v_business_number text;
  v_account_number text;
  v_account_id uuid;
begin
  select * into v_character
  from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;

  if v_character.id is null then raise exception 'Character unavailable'; end if;

  v_business_number:=public.generate_cad_identifier(v_character.community_id,'business');
  v_account_number:=public.generate_cad_identifier(v_character.community_id,'bank_account');

  insert into public.businesses(
    community_id,owner_character_id,business_number,name,business_type,
    description,address,phone,created_by_user_id
  )
  values(
    v_character.community_id,v_character.id,v_business_number,trim(p_name),
    trim(p_business_type),nullif(trim(coalesce(p_description,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    auth.uid()
  )
  returning * into v_business;

  insert into public.bank_accounts(
    community_id,business_id,account_number,account_type,name,
    balance,available_balance,status,opened_by_user_id
  )
  values(
    v_character.community_id,v_business.id,v_account_number,'business',
    v_business.name||' Operating Account',0,0,'active',auth.uid()
  )
  returning id into v_account_id;

  update public.businesses
  set business_bank_account_id=v_account_id
  where id=v_business.id
  returning * into v_business;

  insert into public.business_members(
    community_id,business_id,character_id,role_name,pay_type,pay_rate
  )
  values(
    v_character.community_id,v_business.id,v_character.id,'Owner','salary',0
  );

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description,metadata
  )
  values(
    v_character.community_id,v_character.id,auth.uid(),
    'business.created','Business registered',
    v_business.name||' registered as '||v_business_number||'.',
    jsonb_build_object('business_id',v_business.id)
  );

  return v_business;
end;
$$;

grant execute on function public.create_business(uuid,text,text,text,text,text)
to authenticated;

create or replace function public.apply_for_loan(
  p_character_id uuid,
  p_destination_account_id uuid,
  p_loan_type text,
  p_principal numeric,
  p_term_months integer,
  p_purpose text default null,
  p_collateral_type text default null,
  p_collateral_id uuid default null
)
returns public.loans
language plpgsql
security definer
set search_path=public
as $$
declare
  v_character public.characters%rowtype;
  v_account public.bank_accounts%rowtype;
  v_loan public.loans;
  v_number text;
begin
  select * into v_character
  from public.characters
  where id=p_character_id and owner_user_id=auth.uid() and is_archived=false;

  if v_character.id is null then raise exception 'Character unavailable'; end if;

  select * into v_account
  from public.bank_accounts
  where id=p_destination_account_id and character_id=v_character.id and status='active';

  if v_account.id is null then raise exception 'Destination account unavailable'; end if;
  if p_principal<=0 then raise exception 'Principal must be greater than zero'; end if;
  if p_term_months<=0 then raise exception 'Term must be greater than zero'; end if;

  v_number:=public.generate_cad_identifier(v_character.community_id,'loan');

  insert into public.loans(
    community_id,character_id,destination_account_id,loan_number,loan_type,
    principal,interest_rate,term_months,remaining_balance,status,purpose,
    collateral_type,collateral_id
  )
  values(
    v_character.community_id,v_character.id,v_account.id,v_number,p_loan_type,
    p_principal,5,p_term_months,p_principal,'pending',
    nullif(trim(coalesce(p_purpose,'')),''),
    nullif(trim(coalesce(p_collateral_type,'')),''),
    p_collateral_id
  )
  returning * into v_loan;

  return v_loan;
end;
$$;

grant execute on function public.apply_for_loan(
  uuid,uuid,text,numeric,integer,text,text,uuid
) to authenticated;

create or replace function public.review_loan(
  p_loan_id uuid,
  p_approve boolean,
  p_interest_rate numeric default 5
)
returns public.loans
language plpgsql
security definer
set search_path=public
as $$
declare
  v_loan public.loans%rowtype;
  v_monthly numeric(16,2);
begin
  select * into v_loan from public.loans where id=p_loan_id for update;
  if v_loan.id is null then raise exception 'Loan not found'; end if;

  if not(
    public.has_permission(v_loan.community_id,'loans.manage')
    or public.is_community_owner(v_loan.community_id)
  ) then raise exception 'Loan management permission required'; end if;

  if not p_approve then
    update public.loans
    set status='denied',approved_by_user_id=auth.uid(),approved_at=now(),updated_at=now()
    where id=v_loan.id
    returning * into v_loan;
    return v_loan;
  end if;

  v_monthly:=round(
    (v_loan.principal*(1+(p_interest_rate/100))) / v_loan.term_months,
    2
  );

  perform public.post_bank_transaction(
    v_loan.destination_account_id,'loan_disbursement','credit',
    v_loan.principal,'Loan disbursement '||v_loan.loan_number,
    'loan',v_loan.id,null,'{}'::jsonb
  );

  update public.loans
  set status='active',
      interest_rate=p_interest_rate,
      monthly_payment=v_monthly,
      remaining_balance=v_loan.principal*(1+(p_interest_rate/100)),
      approved_by_user_id=auth.uid(),
      approved_at=now(),
      next_payment_at=now()+interval '1 month',
      updated_at=now()
  where id=v_loan.id
  returning * into v_loan;

  insert into public.scheduled_payments(
    community_id,character_id,source_account_id,payment_type,
    reference_type,reference_id,description,amount,frequency,next_due_at
  )
  values(
    v_loan.community_id,v_loan.character_id,v_loan.destination_account_id,
    'loan_payment','loan',v_loan.id,
    'Loan payment '||v_loan.loan_number,v_monthly,'monthly',v_loan.next_payment_at
  );

  return v_loan;
end;
$$;

grant execute on function public.review_loan(uuid,boolean,numeric)
to authenticated;

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
  if p_quantity<=0 then raise exception 'Quantity must be positive'; end if;
  if v_product.stock_quantity<p_quantity then raise exception 'Insufficient stock'; end if;

  select * into v_store from public.stores where id=v_product.store_id and status='active';
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
  set stock_quantity=stock_quantity-p_quantity
  where id=v_product.id;

  insert into public.store_sales(
    community_id,store_id,character_id,bank_account_id,sale_number,
    subtotal,tax_amount,total_amount
  )
  values(
    v_character.community_id,v_store.id,v_character.id,v_account.id,v_sale_number,
    v_subtotal,v_tax,v_total
  )
  returning id into v_sale_id;

  insert into public.store_sale_items(
    sale_id,product_id,quantity,unit_price,line_total
  )
  values(v_sale_id,v_product.id,p_quantity,v_product.price,v_subtotal);

  insert into public.character_inventory(
    community_id,character_id,product_id,item_name,quantity
  )
  values(
    v_character.community_id,v_character.id,v_product.id,v_product.name,p_quantity
  );

  return v_sale_id;
end;
$$;

grant execute on function public.purchase_store_product(uuid,uuid,uuid,integer)
to authenticated;

-- Broad read policies for owners and community managers.
create policy "members read economy settings"
on public.economy_settings for select to authenticated
using(public.is_active_community_member(community_id));

create policy "owners read own scheduled payments"
on public.scheduled_payments for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'economy.manage')
  or public.is_community_owner(community_id)
);

create policy "owners read own bills"
on public.bills for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'economy.manage')
  or public.is_community_owner(community_id)
);

create policy "owners read own loans"
on public.loans for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'loans.manage')
  or public.is_community_owner(community_id)
);

create policy "members read businesses"
on public.businesses for select to authenticated
using(public.is_active_community_member(community_id));

create policy "business participants read members"
on public.business_members for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'businesses.manage')
  or public.is_community_owner(community_id)
);

create policy "owners read employment"
on public.employment_records for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'payroll.manage')
  or public.is_community_owner(community_id)
);

create policy "members read active stores"
on public.stores for select to authenticated
using(status='active' and public.is_active_community_member(community_id));

create policy "members read active products"
on public.store_products for select to authenticated
using(active=true and public.is_active_community_member(community_id));

create policy "owners read inventory"
on public.character_inventory for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.is_community_owner(community_id)
);

create policy "owners read purchases"
on public.store_sales for select to authenticated
using(
  exists(select 1 from public.characters c where c.id=character_id and c.owner_user_id=auth.uid())
  or public.has_permission(community_id,'stores.manage')
  or public.is_community_owner(community_id)
);

commit;
