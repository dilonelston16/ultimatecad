begin;

create table if not exists public.economy_audit_log (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.economy_audit_log enable row level security;
drop policy if exists "economy managers read audit log" on public.economy_audit_log;
create policy "economy managers read audit log" on public.economy_audit_log
for select to authenticated using (
  public.has_permission(community_id,'economy.manage')
  or public.is_community_owner(community_id)
);

create or replace function public.add_business_employee(
  p_business_id uuid,
  p_state_id text,
  p_role_name text,
  p_pay_type text,
  p_pay_rate numeric
) returns public.business_members
language plpgsql security definer set search_path=public as $$
declare
  v_business public.businesses%rowtype;
  v_character public.characters%rowtype;
  v_member public.business_members;
  v_allowed boolean;
begin
  select * into v_business from public.businesses where id=p_business_id;
  if v_business.id is null then raise exception 'Business not found'; end if;

  select exists(
    select 1 from public.characters c
    where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid()
  ) into v_allowed;

  if not (v_allowed or public.has_permission(v_business.community_id,'businesses.manage') or public.is_community_owner(v_business.community_id)) then
    raise exception 'Business management permission required';
  end if;

  select * into v_character from public.characters
  where community_id=v_business.community_id
    and upper(state_id)=upper(trim(p_state_id))
    and is_archived=false limit 1;

  if v_character.id is null then raise exception 'Character not found'; end if;
  if p_pay_type not in ('hourly','salary','commission') then raise exception 'Invalid pay type'; end if;

  insert into public.business_members(community_id,business_id,character_id,role_name,pay_type,pay_rate,status)
  values(v_business.community_id,v_business.id,v_character.id,coalesce(nullif(trim(p_role_name),''),'Employee'),p_pay_type,greatest(0,p_pay_rate),'active')
  on conflict(business_id,character_id) do update set role_name=excluded.role_name,pay_type=excluded.pay_type,pay_rate=excluded.pay_rate,status='active',terminated_at=null
  returning * into v_member;

  insert into public.employment_records(community_id,character_id,business_id,employer_name,job_title,pay_type,pay_rate,status)
  values(v_business.community_id,v_character.id,v_business.id,v_business.name,v_member.role_name,v_member.pay_type,v_member.pay_rate,'active');

  insert into public.economy_audit_log(community_id,actor_user_id,action_type,entity_type,entity_id,description)
  values(v_business.community_id,auth.uid(),'employee_added','business',v_business.id,v_character.first_name||' '||v_character.last_name||' added to '||v_business.name||'.');

  return v_member;
end; $$;

grant execute on function public.add_business_employee(uuid,text,text,text,numeric) to authenticated;

create or replace function public.remove_business_employee(p_business_member_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_member public.business_members%rowtype;
  v_business public.businesses%rowtype;
  v_allowed boolean;
begin
  select * into v_member from public.business_members where id=p_business_member_id for update;
  if v_member.id is null then raise exception 'Business member not found'; end if;
  select * into v_business from public.businesses where id=v_member.business_id;
  select exists(select 1 from public.characters c where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid()) into v_allowed;
  if not (v_allowed or public.has_permission(v_business.community_id,'businesses.manage') or public.is_community_owner(v_business.community_id)) then raise exception 'Business management permission required'; end if;
  if v_member.character_id=v_business.owner_character_id then raise exception 'The owner cannot be removed'; end if;
  update public.business_members set status='terminated',terminated_at=now() where id=v_member.id;
  update public.employment_records set status='terminated',ended_at=now() where business_id=v_business.id and character_id=v_member.character_id and status='active';
end; $$;

grant execute on function public.remove_business_employee(uuid,text) to authenticated;

create or replace function public.create_store(p_business_id uuid,p_name text,p_description text default null)
returns public.stores language plpgsql security definer set search_path=public as $$
declare
  v_business public.businesses%rowtype;
  v_store public.stores;
  v_allowed boolean;
begin
  select * into v_business from public.businesses where id=p_business_id;
  if v_business.id is null then raise exception 'Business not found'; end if;
  select exists(select 1 from public.characters c where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid()) into v_allowed;
  if not (v_allowed or public.has_permission(v_business.community_id,'stores.manage') or public.is_community_owner(v_business.community_id)) then raise exception 'Store management permission required'; end if;
  insert into public.stores(community_id,business_id,name,description,status,bank_account_id)
  values(v_business.community_id,v_business.id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),'active',v_business.business_bank_account_id)
  returning * into v_store;
  return v_store;
end; $$;

grant execute on function public.create_store(uuid,text,text) to authenticated;

create or replace function public.upsert_store_product(
  p_store_id uuid,p_product_id uuid,p_sku text,p_name text,p_description text,p_category text,p_price numeric,p_stock_quantity integer,p_active boolean default true
) returns public.store_products
language plpgsql security definer set search_path=public as $$
declare
  v_store public.stores%rowtype;
  v_business public.businesses%rowtype;
  v_product public.store_products;
  v_allowed boolean:=false;
begin
  select * into v_store from public.stores where id=p_store_id;
  if v_store.id is null then raise exception 'Store not found'; end if;
  if v_store.business_id is not null then
    select * into v_business from public.businesses where id=v_store.business_id;
    select exists(select 1 from public.characters c where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid()) into v_allowed;
  end if;
  if not (v_allowed or public.has_permission(v_store.community_id,'stores.manage') or public.is_community_owner(v_store.community_id)) then raise exception 'Store management permission required'; end if;
  if p_price<0 or p_stock_quantity<0 then raise exception 'Price and stock cannot be negative'; end if;
  if p_product_id is null then
    insert into public.store_products(community_id,store_id,sku,name,description,category,price,stock_quantity,active)
    values(v_store.community_id,v_store.id,upper(trim(p_sku)),trim(p_name),nullif(trim(coalesce(p_description,'')),''),nullif(trim(coalesce(p_category,'')),''),p_price,p_stock_quantity,coalesce(p_active,true))
    returning * into v_product;
  else
    update public.store_products set sku=upper(trim(p_sku)),name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),category=nullif(trim(coalesce(p_category,'')),''),price=p_price,stock_quantity=p_stock_quantity,active=coalesce(p_active,true)
    where id=p_product_id and store_id=v_store.id returning * into v_product;
  end if;
  return v_product;
end; $$;

grant execute on function public.upsert_store_product(uuid,uuid,text,text,text,text,numeric,integer,boolean) to authenticated;

create or replace function public.create_payroll_run(p_business_id uuid,p_pay_period_start date,p_pay_period_end date)
returns public.payroll_runs language plpgsql security definer set search_path=public as $$
declare
  v_business public.businesses%rowtype;
  v_run public.payroll_runs;
  v_number text;
  v_allowed boolean;
begin
  select * into v_business from public.businesses where id=p_business_id;
  if v_business.id is null then raise exception 'Business not found'; end if;
  select exists(select 1 from public.characters c where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid()) into v_allowed;
  if not (v_allowed or public.has_permission(v_business.community_id,'payroll.manage') or public.is_community_owner(v_business.community_id)) then raise exception 'Payroll permission required'; end if;
  if p_pay_period_end<p_pay_period_start then raise exception 'Invalid pay period'; end if;
  v_number:=public.generate_cad_identifier(v_business.community_id,'payroll');
  insert into public.payroll_runs(community_id,business_id,payroll_number,pay_period_start,pay_period_end,status)
  values(v_business.community_id,v_business.id,v_number,p_pay_period_start,p_pay_period_end,'draft') returning * into v_run;

  insert into public.payroll_items(community_id,payroll_run_id,employment_record_id,character_id,destination_account_id,gross_amount,tax_amount,net_amount,status)
  select v_business.community_id,v_run.id,e.id,e.character_id,
    (select a.id from public.bank_accounts a where a.character_id=e.character_id and a.account_type='checking' and a.status='active' order by a.opened_at limit 1),
    case when e.pay_type='salary' then e.pay_rate when e.pay_type='hourly' then e.pay_rate*40 else e.pay_rate end,
    round((case when e.pay_type='salary' then e.pay_rate when e.pay_type='hourly' then e.pay_rate*40 else e.pay_rate end)*(coalesce((select income_tax_percent from public.economy_settings where community_id=v_business.community_id),10)/100),2),
    0,'pending'
  from public.employment_records e where e.business_id=v_business.id and e.status='active';

  update public.payroll_items set net_amount=gross_amount-tax_amount where payroll_run_id=v_run.id;
  update public.payroll_runs set
    gross_amount=(select coalesce(sum(gross_amount),0) from public.payroll_items where payroll_run_id=v_run.id),
    tax_amount=(select coalesce(sum(tax_amount),0) from public.payroll_items where payroll_run_id=v_run.id),
    net_amount=(select coalesce(sum(net_amount),0) from public.payroll_items where payroll_run_id=v_run.id)
  where id=v_run.id returning * into v_run;
  return v_run;
end; $$;

grant execute on function public.create_payroll_run(uuid,date,date) to authenticated;

create or replace function public.process_payroll_run(p_payroll_run_id uuid)
returns public.payroll_runs language plpgsql security definer set search_path=public as $$
declare
  v_run public.payroll_runs%rowtype;
  v_business public.businesses%rowtype;
  v_item public.payroll_items%rowtype;
begin
  select * into v_run from public.payroll_runs where id=p_payroll_run_id for update;
  if v_run.id is null then raise exception 'Payroll run not found'; end if;
  select * into v_business from public.businesses where id=v_run.business_id;
  if not (public.has_permission(v_run.community_id,'payroll.manage') or public.is_community_owner(v_run.community_id) or exists(select 1 from public.characters c where c.id=v_business.owner_character_id and c.owner_user_id=auth.uid())) then raise exception 'Payroll permission required'; end if;
  if v_business.business_bank_account_id is null then raise exception 'Business bank account unavailable'; end if;

  update public.payroll_runs set status='processing' where id=v_run.id;
  for v_item in select * from public.payroll_items where payroll_run_id=v_run.id and status='pending' loop
    begin
      if v_item.destination_account_id is null then raise exception 'Employee checking account unavailable'; end if;
      perform public.post_bank_transaction(v_business.business_bank_account_id,'payroll','debit',v_item.net_amount,'Payroll '||v_run.payroll_number,'payroll_item',v_item.id,v_item.destination_account_id,jsonb_build_object('character_id',v_item.character_id));
      perform public.post_bank_transaction(v_item.destination_account_id,'payroll','credit',v_item.net_amount,'Payroll deposit '||v_run.payroll_number,'payroll_item',v_item.id,v_business.business_bank_account_id,jsonb_build_object('business_id',v_business.id));
      update public.payroll_items set status='paid',failure_reason=null where id=v_item.id;
    exception when others then
      update public.payroll_items set status='failed',failure_reason=sqlerrm where id=v_item.id;
    end;
  end loop;

  update public.payroll_runs set status=case when exists(select 1 from public.payroll_items where payroll_run_id=v_run.id and status='failed') then 'failed' else 'completed' end,processed_by_user_id=auth.uid(),processed_at=now()
  where id=v_run.id returning * into v_run;
  return v_run;
end; $$;

grant execute on function public.process_payroll_run(uuid) to authenticated;

commit;
