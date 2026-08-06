-- UltimateCAD — Complete Business Management
-- Removes the remaining gaps in business banking and employee management.

begin;

alter table public.business_members
  add column if not exists role_level integer not null default 1,
  add column if not exists promoted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists business_members_business_status_idx
  on public.business_members(business_id,status,role_level desc);

-- Business owners may view transactions from their business operating accounts.
drop policy if exists "business owners view business transactions"
on public.bank_transactions;

create policy "business owners view business transactions"
on public.bank_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.bank_accounts a
    join public.businesses b on b.id = a.business_id
    join public.characters c on c.id = b.owner_character_id
    where a.id = account_id
      and c.owner_user_id = auth.uid()
  )
  or public.has_permission(community_id,'banking.view_all')
  or public.is_community_owner(community_id)
);

create or replace function public.business_owner_can_manage(
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    join public.characters c on c.id = b.owner_character_id
    where b.id = p_business_id
      and c.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        public.has_permission(b.community_id,'businesses.manage')
        or public.is_community_owner(b.community_id)
      )
  );
$$;

grant execute on function public.business_owner_can_manage(uuid)
to authenticated;

create or replace function public.update_business_employee(
  p_member_id uuid,
  p_action text,
  p_role_name text default null,
  p_pay_rate numeric default null,
  p_reason text default null
)
returns public.business_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.business_members%rowtype;
  v_business public.businesses%rowtype;
begin
  select * into v_member
  from public.business_members
  where id = p_member_id
  for update;

  if v_member.id is null then
    raise exception 'Employee record not found';
  end if;

  select * into v_business
  from public.businesses
  where id = v_member.business_id;

  if not public.business_owner_can_manage(v_business.id) then
    raise exception 'Business management permission required';
  end if;

  if v_member.character_id = v_business.owner_character_id then
    raise exception 'The business owner cannot be promoted, demoted, or fired';
  end if;

  case lower(p_action)
    when 'promote' then
      update public.business_members
      set role_level = role_level + 1,
          role_name = coalesce(nullif(trim(p_role_name),''),role_name),
          pay_rate = coalesce(p_pay_rate,pay_rate),
          promoted_at = now(),
          updated_at = now(),
          status = 'active',
          terminated_at = null
      where id = v_member.id
      returning * into v_member;

    when 'demote' then
      update public.business_members
      set role_level = greatest(1,role_level - 1),
          role_name = coalesce(nullif(trim(p_role_name),''),role_name),
          pay_rate = coalesce(p_pay_rate,pay_rate),
          updated_at = now()
      where id = v_member.id
      returning * into v_member;

    when 'fire' then
      update public.business_members
      set status = 'terminated',
          terminated_at = now(),
          updated_at = now()
      where id = v_member.id
      returning * into v_member;

      update public.employment_records
      set status = 'terminated',
          ended_at = now()
      where business_id = v_business.id
        and character_id = v_member.character_id
        and status = 'active';

    when 'rehire' then
      update public.business_members
      set status = 'active',
          terminated_at = null,
          role_name = coalesce(nullif(trim(p_role_name),''),role_name),
          pay_rate = coalesce(p_pay_rate,pay_rate),
          updated_at = now()
      where id = v_member.id
      returning * into v_member;

      insert into public.employment_records(
        community_id,character_id,business_id,employer_name,job_title,
        pay_type,pay_rate,status
      )
      select
        v_business.community_id,v_member.character_id,v_business.id,
        v_business.name,v_member.role_name,v_member.pay_type,
        v_member.pay_rate,'active'
      where not exists (
        select 1 from public.employment_records
        where business_id = v_business.id
          and character_id = v_member.character_id
          and status = 'active'
      );

    when 'update' then
      update public.business_members
      set role_name = coalesce(nullif(trim(p_role_name),''),role_name),
          pay_rate = coalesce(p_pay_rate,pay_rate),
          updated_at = now()
      where id = v_member.id
      returning * into v_member;

    else
      raise exception 'Unsupported employee action';
  end case;

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_business.community_id,auth.uid(),'employee_'||lower(p_action),
    'business_member',v_member.id,
    'Employee action completed for '||v_business.name||'.',
    jsonb_build_object(
      'business_id',v_business.id,
      'reason',p_reason,
      'role_name',v_member.role_name,
      'role_level',v_member.role_level,
      'pay_rate',v_member.pay_rate
    )
  );

  return v_member;
end;
$$;

grant execute on function public.update_business_employee(
  uuid,text,text,numeric,text
) to authenticated;

-- Internal ledger helper with explicit business-owner authorization.
create or replace function public.post_business_bank_entry(
  p_business_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_related_account_id uuid default null
)
returns public.bank_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.bank_accounts%rowtype;
  v_transaction public.bank_transactions;
  v_balance numeric(16,2);
  v_holds numeric(16,2);
  v_number text;
begin
  if not public.business_owner_can_manage(p_business_id) then
    raise exception 'Business banking permission required';
  end if;

  select * into v_account
  from public.bank_accounts
  where id = p_account_id
  for update;

  if v_account.id is null or v_account.status <> 'active' then
    raise exception 'Bank account is unavailable';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select coalesce(sum(amount),0) into v_holds
  from public.bank_account_holds
  where account_id = v_account.id
    and status = 'active';

  if p_direction = 'debit' then
    if v_account.balance - v_holds + v_account.overdraft_limit < p_amount then
      raise exception 'Insufficient business funds';
    end if;
    v_balance := v_account.balance - p_amount;
  elsif p_direction = 'credit' then
    v_balance := v_account.balance + p_amount;
  else
    raise exception 'Invalid transaction direction';
  end if;

  v_number := public.generate_cad_identifier(
    v_account.community_id,'bank_transaction'
  );

  update public.bank_accounts
  set balance = v_balance,
      available_balance = v_balance - v_holds,
      updated_at = now()
  where id = v_account.id;

  insert into public.bank_transactions(
    community_id,transaction_number,account_id,related_account_id,
    transaction_type,direction,amount,balance_after,description,
    reference_type,reference_id,initiated_by_user_id
  )
  values(
    v_account.community_id,v_number,v_account.id,p_related_account_id,
    p_transaction_type,p_direction,p_amount,v_balance,trim(p_description),
    p_reference_type,p_reference_id,auth.uid()
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

grant execute on function public.post_business_bank_entry(
  uuid,uuid,text,text,numeric,text,text,uuid,uuid
) to authenticated;

create or replace function public.pay_business_employee(
  p_member_id uuid,
  p_amount numeric,
  p_description text default 'Employee payment'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.business_members%rowtype;
  v_business public.businesses%rowtype;
  v_destination public.bank_accounts%rowtype;
  v_transfer_id uuid := gen_random_uuid();
begin
  select * into v_member
  from public.business_members
  where id = p_member_id
    and status = 'active';

  if v_member.id is null then
    raise exception 'Active employee record not found';
  end if;

  select * into v_business
  from public.businesses
  where id = v_member.business_id;

  if not public.business_owner_can_manage(v_business.id) then
    raise exception 'Business management permission required';
  end if;

  if v_business.business_bank_account_id is null then
    raise exception 'Business operating account is unavailable';
  end if;

  select * into v_destination
  from public.bank_accounts
  where character_id = v_member.character_id
    and account_type = 'checking'
    and status = 'active'
  order by opened_at
  limit 1;

  if v_destination.id is null then
    raise exception 'Employee does not have an active checking account';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- Directly authorize the business owner while preserving the immutable ledger.
  perform public.post_business_bank_entry(
    v_business.id,
    v_business.business_bank_account_id,
    'payroll',
    'debit',
    p_amount,
    coalesce(nullif(trim(p_description),''),'Employee payment'),
    'employee_payment',
    v_transfer_id,
    v_destination.id
  );

  perform public.post_business_bank_entry(
    v_business.id,
    v_destination.id,
    'payroll',
    'credit',
    p_amount,
    coalesce(nullif(trim(p_description),''),'Employee payment'),
    'employee_payment',
    v_transfer_id,
    v_business.business_bank_account_id
  );

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_business.community_id,auth.uid(),'employee_paid',
    'business_member',v_member.id,
    'Employee payment sent from '||v_business.name||'.',
    jsonb_build_object('amount',p_amount,'transfer_id',v_transfer_id)
  );

  return v_transfer_id;
end;
$$;



grant execute on function public.pay_business_employee(uuid,numeric,text)
to authenticated;

create or replace function public.transfer_business_funds(
  p_business_id uuid,
  p_to_account_number text,
  p_amount numeric,
  p_description text default 'Business transfer'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_to public.bank_accounts%rowtype;
  v_transfer_id uuid := gen_random_uuid();
begin
  select * into v_business
  from public.businesses
  where id = p_business_id;

  if v_business.id is null then
    raise exception 'Business not found';
  end if;

  if not public.business_owner_can_manage(v_business.id) then
    raise exception 'Business banking permission required';
  end if;

  select * into v_to
  from public.bank_accounts
  where community_id = v_business.community_id
    and upper(account_number) = upper(trim(p_to_account_number))
    and status = 'active'
  limit 1;

  if v_to.id is null then
    raise exception 'Receiving account not found';
  end if;

  if v_to.id = v_business.business_bank_account_id then
    raise exception 'Cannot transfer to the same account';
  end if;

  perform public.post_business_bank_entry(
    v_business.id,v_business.business_bank_account_id,
    'transfer','debit',p_amount,p_description,
    'business_transfer',v_transfer_id,v_to.id
  );

  perform public.post_business_bank_entry(
    v_business.id,v_to.id,
    'transfer','credit',p_amount,p_description,
    'business_transfer',v_transfer_id,v_business.business_bank_account_id
  );

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_business.community_id,auth.uid(),'business_transfer',
    'business',v_business.id,
    'Business bank transfer completed.',
    jsonb_build_object(
      'amount',p_amount,
      'to_account',v_to.account_number,
      'transfer_id',v_transfer_id
    )
  );

  return v_transfer_id;
end;
$$;

grant execute on function public.transfer_business_funds(
  uuid,text,numeric,text
) to authenticated;

commit;
