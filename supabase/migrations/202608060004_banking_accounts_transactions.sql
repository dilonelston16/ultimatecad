-- UltimateCAD Milestone 1.9 — Banking Accounts and Transactions

begin;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  business_id uuid,
  account_number text not null,
  account_type text not null default 'checking',
  name text not null,
  balance numeric(16,2) not null default 0,
  available_balance numeric(16,2) not null default 0,
  status text not null default 'active',
  overdraft_limit numeric(14,2) not null default 0,
  interest_rate numeric(8,4) not null default 0,
  currency_code text not null default 'USD',
  opened_by_user_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (community_id, account_number),
  check (account_type in ('checking','savings','business','government','escrow')),
  check (status in ('active','frozen','closed','restricted')),
  check (
    (character_id is not null and business_id is null)
    or (character_id is null and business_id is not null)
  )
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  transaction_number text not null,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  related_account_id uuid references public.bank_accounts(id) on delete set null,
  transaction_type text not null,
  direction text not null,
  amount numeric(16,2) not null check (amount > 0),
  balance_after numeric(16,2) not null,
  description text not null,
  reference_type text,
  reference_id uuid,
  initiated_by_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (community_id, transaction_number),
  check (transaction_type in (
    'deposit','withdrawal','transfer','purchase','refund','payroll',
    'tax','fine','insurance_premium','insurance_claim','loan_disbursement',
    'loan_payment','fee','interest','adjustment'
  )),
  check (direction in ('credit','debit'))
);

create table if not exists public.bank_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  from_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  to_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  description text,
  status text not null default 'pending',
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  check (status in ('pending','completed','failed','cancelled')),
  check (from_account_id <> to_account_id)
);

create table if not exists public.bank_account_holds (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  reason text not null,
  reference_type text,
  reference_id uuid,
  status text not null default 'active',
  placed_by_user_id uuid references public.profiles(id) on delete set null,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  check (status in ('active','released','captured'))
);

create table if not exists public.bank_account_notes (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists bank_accounts_character_idx
  on public.bank_accounts(character_id,status);

create index if not exists bank_accounts_lookup_idx
  on public.bank_accounts(community_id,account_number,status);

create index if not exists bank_transactions_account_idx
  on public.bank_transactions(account_id,created_at desc);

create index if not exists bank_transactions_reference_idx
  on public.bank_transactions(reference_type,reference_id);

create index if not exists bank_transfer_requests_status_idx
  on public.bank_transfer_requests(community_id,status,created_at);

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_transfer_requests enable row level security;
alter table public.bank_account_holds enable row level security;
alter table public.bank_account_notes enable row level security;

insert into public.permissions(key,name,description,category)
values
  ('banking.view','View banking','View authorized bank accounts and transactions.','Banking'),
  ('banking.manage','Manage banking','Freeze, restrict and manage bank accounts.','Banking'),
  ('banking.adjust','Adjust balances','Perform authorized balance adjustments.','Banking'),
  ('banking.view_all','View all accounts','View every account within the community.','Banking')
on conflict(key) do update
set name=excluded.name,
    description=excluded.description,
    category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (
  values
    ('Founder','banking.view'),
    ('Founder','banking.manage'),
    ('Founder','banking.adjust'),
    ('Founder','banking.view_all'),
    ('Owner','banking.view'),
    ('Owner','banking.manage'),
    ('Owner','banking.adjust'),
    ('Owner','banking.view_all'),
    ('Community Admin','banking.view'),
    ('Community Admin','banking.manage'),
    ('Community Admin','banking.adjust'),
    ('Community Admin','banking.view_all'),
    ('Agency Director','banking.view')
) p(role_name,permission_key)
  on p.role_name=r.name
on conflict(role_id,permission_key)
do update set allowed=true;

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
begin
  select * into v_character
  from public.characters
  where id=p_character_id
    and owner_user_id=auth.uid()
    and is_archived=false;

  if v_character.id is null then
    raise exception 'Character not found or unavailable';
  end if;

  if p_account_type not in ('checking','savings') then
    raise exception 'Invalid civilian account type';
  end if;

  if exists(
    select 1
    from public.bank_accounts
    where character_id=v_character.id
      and account_type=p_account_type
      and status <> 'closed'
  ) then
    raise exception 'This character already has an open % account',p_account_type;
  end if;

  v_account_number :=
    public.generate_cad_identifier(v_character.community_id,'bank_account');

  v_name := coalesce(
    nullif(trim(p_name),''),
    initcap(p_account_type)||' Account'
  );

  insert into public.bank_accounts(
    community_id,character_id,account_number,account_type,name,
    balance,available_balance,status,opened_by_user_id
  )
  values(
    v_character.community_id,v_character.id,v_account_number,
    p_account_type,v_name,0,0,'active',auth.uid()
  )
  returning * into v_account;

  update public.generated_identifiers
  set entity_type='bank_account',entity_id=v_account.id
  where community_id=v_character.community_id
    and readable_id=v_account_number;

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description,metadata
  )
  values(
    v_character.community_id,v_character.id,auth.uid(),
    'bank.account.opened','Bank account opened',
    v_name||' opened as '||v_account_number||'.',
    jsonb_build_object('account_id',v_account.id,'account_type',p_account_type)
  );

  return v_account;
end;
$$;

grant execute on function public.create_character_bank_account(uuid,text,text)
to authenticated;

create or replace function public.post_bank_transaction(
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_related_account_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.bank_transactions
language plpgsql
security definer
set search_path=public
as $$
declare
  v_account public.bank_accounts%rowtype;
  v_transaction public.bank_transactions;
  v_new_balance numeric(16,2);
  v_transaction_number text;
  v_is_owner boolean;
  v_active_holds numeric(16,2);
begin
  select * into v_account
  from public.bank_accounts
  where id=p_account_id
  for update;

  if v_account.id is null then
    raise exception 'Bank account not found';
  end if;

  select exists(
    select 1
    from public.characters c
    where c.id=v_account.character_id
      and c.owner_user_id=auth.uid()
  ) into v_is_owner;

  if not (
    v_is_owner
    or public.has_permission(v_account.community_id,'banking.adjust')
    or public.is_community_owner(v_account.community_id)
  ) then
    raise exception 'Bank account access denied';
  end if;

  if v_account.status <> 'active' then
    raise exception 'This bank account is not active';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transaction amount must be greater than zero';
  end if;

  if p_direction not in ('credit','debit') then
    raise exception 'Invalid transaction direction';
  end if;

  select coalesce(sum(amount),0)
  into v_active_holds
  from public.bank_account_holds
  where account_id=v_account.id
    and status='active';

  if p_direction='debit' then
    v_new_balance := v_account.balance-p_amount;

    if (v_account.balance-v_active_holds+v_account.overdraft_limit) < p_amount then
      raise exception 'Insufficient available balance';
    end if;
  else
    v_new_balance := v_account.balance+p_amount;
  end if;

  v_transaction_number :=
    public.generate_cad_identifier(v_account.community_id,'bank_transaction');

  update public.bank_accounts
  set balance=v_new_balance,
      available_balance=v_new_balance-v_active_holds,
      updated_at=now()
  where id=v_account.id;

  insert into public.bank_transactions(
    community_id,transaction_number,account_id,related_account_id,
    transaction_type,direction,amount,balance_after,description,
    reference_type,reference_id,initiated_by_user_id,metadata
  )
  values(
    v_account.community_id,v_transaction_number,v_account.id,p_related_account_id,
    p_transaction_type,p_direction,p_amount,v_new_balance,trim(p_description),
    p_reference_type,p_reference_id,auth.uid(),coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into v_transaction;

  update public.generated_identifiers
  set entity_type='bank_transaction',entity_id=v_transaction.id
  where community_id=v_account.community_id
    and readable_id=v_transaction_number;

  return v_transaction;
end;
$$;

grant execute on function public.post_bank_transaction(
  uuid,text,text,numeric,text,text,uuid,uuid,jsonb
) to authenticated;

create or replace function public.transfer_between_bank_accounts(
  p_from_account_id uuid,
  p_to_account_number text,
  p_amount numeric,
  p_description text default 'Account transfer'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_from public.bank_accounts%rowtype;
  v_to public.bank_accounts%rowtype;
  v_transfer_id uuid;
begin
  select * into v_from
  from public.bank_accounts
  where id=p_from_account_id
  for update;

  if v_from.id is null then
    raise exception 'Source account not found';
  end if;

  if not exists(
    select 1
    from public.characters c
    where c.id=v_from.character_id
      and c.owner_user_id=auth.uid()
  ) then
    raise exception 'Source account access denied';
  end if;

  select * into v_to
  from public.bank_accounts
  where community_id=v_from.community_id
    and upper(account_number)=upper(trim(p_to_account_number))
    and status='active'
  for update;

  if v_to.id is null then
    raise exception 'Receiving account not found';
  end if;

  if v_to.id=v_from.id then
    raise exception 'Cannot transfer to the same account';
  end if;

  insert into public.bank_transfer_requests(
    community_id,from_account_id,to_account_id,amount,description,
    status,requested_by_user_id
  )
  values(
    v_from.community_id,v_from.id,v_to.id,p_amount,
    nullif(trim(coalesce(p_description,'')),''),
    'pending',auth.uid()
  )
  returning id into v_transfer_id;

  perform public.post_bank_transaction(
    v_from.id,'transfer','debit',p_amount,
    coalesce(nullif(trim(p_description),''),'Account transfer'),
    'bank_transfer',v_transfer_id,v_to.id,
    jsonb_build_object('to_account_number',v_to.account_number)
  );

  perform public.post_bank_transaction(
    v_to.id,'transfer','credit',p_amount,
    coalesce(nullif(trim(p_description),''),'Account transfer'),
    'bank_transfer',v_transfer_id,v_from.id,
    jsonb_build_object('from_account_number',v_from.account_number)
  );

  update public.bank_transfer_requests
  set status='completed',processed_at=now()
  where id=v_transfer_id;

  return v_transfer_id;

exception when others then
  if v_transfer_id is not null then
    update public.bank_transfer_requests
    set status='failed',
        failure_reason=sqlerrm,
        processed_at=now()
    where id=v_transfer_id;
  end if;
  raise;
end;
$$;

grant execute on function public.transfer_between_bank_accounts(
  uuid,text,numeric,text
) to authenticated;

create or replace function public.update_bank_account_status(
  p_account_id uuid,
  p_status text,
  p_reason text default null
)
returns public.bank_accounts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_account public.bank_accounts%rowtype;
begin
  select * into v_account
  from public.bank_accounts
  where id=p_account_id
  for update;

  if v_account.id is null then
    raise exception 'Bank account not found';
  end if;

  if not (
    public.has_permission(v_account.community_id,'banking.manage')
    or public.is_community_owner(v_account.community_id)
  ) then
    raise exception 'Banking management permission required';
  end if;

  if p_status not in ('active','frozen','closed','restricted') then
    raise exception 'Invalid bank account status';
  end if;

  update public.bank_accounts
  set status=p_status,
      closed_at=case when p_status='closed' then now() else closed_at end,
      updated_at=now()
  where id=v_account.id
  returning * into v_account;

  insert into public.bank_account_notes(
    community_id,account_id,author_user_id,note
  )
  values(
    v_account.community_id,v_account.id,auth.uid(),
    'Status changed to '||p_status||
    case
      when nullif(trim(coalesce(p_reason,'')),'') is not null
      then ': '||trim(p_reason)
      else ''
    end
  );

  return v_account;
end;
$$;

grant execute on function public.update_bank_account_status(uuid,text,text)
to authenticated;

create policy "owners and authorized staff view bank accounts"
on public.bank_accounts for select to authenticated
using(
  exists(
    select 1
    from public.characters c
    where c.id=character_id
      and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'banking.view_all')
  or public.is_community_owner(community_id)
);

create policy "owners and authorized staff view bank transactions"
on public.bank_transactions for select to authenticated
using(
  exists(
    select 1
    from public.bank_accounts a
    join public.characters c on c.id=a.character_id
    where a.id=account_id
      and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'banking.view_all')
  or public.is_community_owner(community_id)
);

create policy "owners and staff view transfer requests"
on public.bank_transfer_requests for select to authenticated
using(
  exists(
    select 1
    from public.bank_accounts a
    join public.characters c on c.id=a.character_id
    where a.id in (from_account_id,to_account_id)
      and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'banking.view_all')
  or public.is_community_owner(community_id)
);

create policy "owners and staff view holds"
on public.bank_account_holds for select to authenticated
using(
  exists(
    select 1
    from public.bank_accounts a
    join public.characters c on c.id=a.character_id
    where a.id=account_id
      and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id,'banking.view_all')
  or public.is_community_owner(community_id)
);

create policy "banking staff view account notes"
on public.bank_account_notes for select to authenticated
using(
  public.has_permission(community_id,'banking.manage')
  or public.is_community_owner(community_id)
);

commit;
