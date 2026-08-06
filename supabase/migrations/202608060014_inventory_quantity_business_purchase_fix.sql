-- UltimateCAD — Inventory Quantity, Use Item, and Business Purchase Repair

begin;

-- Consolidate duplicate personal inventory rows for the same character/product.
with grouped as (
  select
    character_id,
    product_id,
    min(id::text)::uuid as keep_id,
    sum(quantity) as total_quantity,
    sum(coalesce(listed_quantity,0)) as total_listed
  from public.character_inventory
  where product_id is not null
    and status not in ('consumed','transferred')
  group by character_id,product_id
  having count(*) > 1
),
updated as (
  update public.character_inventory ci
  set quantity=g.total_quantity,
      listed_quantity=least(g.total_quantity,g.total_listed),
      status=case
        when g.total_quantity <= g.total_listed then 'listed'
        else 'owned'
      end,
      updated_at=now()
  from grouped g
  where ci.id=g.keep_id
  returning ci.id
)
delete from public.character_inventory ci
using grouped g
where ci.character_id=g.character_id
  and ci.product_id=g.product_id
  and ci.id<>g.keep_id;

-- Consolidate duplicate business inventory rows if an earlier partial schema
-- allowed them to be created.
with grouped as (
  select
    business_id,
    product_id,
    min(id::text)::uuid as keep_id,
    sum(quantity) as total_quantity,
    sum(reserved_quantity) as total_reserved,
    case
      when sum(quantity)>0
      then round(sum(quantity*average_cost)/sum(quantity),2)
      else 0
    end as combined_cost
  from public.business_inventory
  where product_id is not null
  group by business_id,product_id
  having count(*) > 1
),
updated as (
  update public.business_inventory bi
  set quantity=g.total_quantity,
      reserved_quantity=least(g.total_quantity,g.total_reserved),
      average_cost=g.combined_cost,
      status=case when g.total_quantity>0 then 'available' else 'depleted' end,
      updated_at=now()
  from grouped g
  where bi.id=g.keep_id
  returning bi.id
)
delete from public.business_inventory bi
using grouped g
where bi.business_id=g.business_id
  and bi.product_id=g.product_id
  and bi.id<>g.keep_id;

create unique index if not exists character_inventory_character_product_unique
on public.character_inventory(character_id,product_id)
where product_id is not null
  and status not in ('consumed','transferred');

create unique index if not exists business_inventory_business_product_unique
on public.business_inventory(business_id,product_id)
where product_id is not null;

-- Add one quantity to an existing personal stack rather than creating another
-- card for the same item.
create or replace function public.add_personal_inventory_quantity(
  p_community_id uuid,
  p_character_id uuid,
  p_product_id uuid,
  p_item_name text,
  p_quantity integer,
  p_metadata jsonb default '{}'::jsonb
)
returns public.character_inventory
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inventory public.character_inventory;
begin
  if p_quantity is null or p_quantity<=0 then
    raise exception 'Inventory quantity must be positive';
  end if;

  insert into public.character_inventory(
    community_id,character_id,product_id,item_name,quantity,metadata,status
  )
  values(
    p_community_id,p_character_id,p_product_id,p_item_name,p_quantity,
    coalesce(p_metadata,'{}'::jsonb),'owned'
  )
  on conflict (character_id,product_id)
  where product_id is not null
    and status not in ('consumed','transferred')
  do update set
    quantity=public.character_inventory.quantity+excluded.quantity,
    metadata=public.character_inventory.metadata||excluded.metadata,
    status='owned',
    updated_at=now()
  returning * into v_inventory;

  return v_inventory;
end;
$$;

grant execute on function public.add_personal_inventory_quantity(
  uuid,uuid,uuid,text,integer,jsonb
) to authenticated;

-- Use one unit from a personal inventory stack.
create or replace function public.use_character_inventory_item(
  p_inventory_id uuid
)
returns public.character_inventory
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inventory public.character_inventory;
begin
  select ci.* into v_inventory
  from public.character_inventory ci
  join public.characters c on c.id=ci.character_id
  where ci.id=p_inventory_id
    and c.owner_user_id=auth.uid()
  for update;

  if v_inventory.id is null then
    raise exception 'Inventory item not found';
  end if;

  if v_inventory.status not in ('owned','listed') then
    raise exception 'This item cannot be used';
  end if;

  if v_inventory.quantity-v_inventory.listed_quantity<=0 then
    raise exception 'No unlisted quantity is available to use';
  end if;

  update public.character_inventory
  set quantity=quantity-1,
      status=case
        when quantity-1<=0 then 'consumed'
        when quantity-1<=listed_quantity then 'listed'
        else 'owned'
      end,
      updated_at=now(),
      metadata=metadata||jsonb_build_object(
        'last_used_at',now(),
        'last_used_by',auth.uid()
      )
  where id=v_inventory.id
  returning * into v_inventory;

  return v_inventory;
end;
$$;

grant execute on function public.use_character_inventory_item(uuid)
to authenticated;

-- Rebuild destination purchasing. This version:
-- 1. debits the authorized personal/business buyer account;
-- 2. credits the seller account internally without requiring the buyer to
--    manage the seller's business;
-- 3. stacks personal and business quantities;
-- 4. records business expenses.
create or replace function public.purchase_store_product_for_destination(
  p_character_id uuid,
  p_account_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_destination_type text default 'personal',
  p_business_id uuid default null
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
  v_buyer_transaction_number text;
  v_seller_transaction_number text;
  v_new_buyer_balance numeric(16,2);
  v_new_seller_balance numeric(16,2);
  v_holds numeric(16,2);
  v_existing public.business_inventory%rowtype;
begin
  select * into v_character
  from public.characters
  where id=p_character_id
    and owner_user_id=auth.uid()
    and is_archived=false;

  if v_character.id is null then
    raise exception 'Character unavailable';
  end if;

  select * into v_product
  from public.store_products
  where id=p_product_id
    and active=true
  for update;

  if v_product.id is null then
    raise exception 'Product unavailable';
  end if;

  select * into v_store
  from public.stores
  where id=v_product.store_id
    and status='active';

  if v_store.id is null then
    raise exception 'Store unavailable';
  end if;

  if p_quantity is null or p_quantity<=0 then
    raise exception 'Quantity must be positive';
  end if;

  if v_product.product_type in ('vehicle','weapon','property','service','document')
     and p_quantity<>1 then
    raise exception 'This product can only be purchased one at a time';
  end if;

  if v_product.stock_quantity<p_quantity then
    raise exception 'Insufficient stock';
  end if;

  if p_destination_type='business' then
    if p_business_id is null
       or not public.can_manage_business_inventory(p_business_id) then
      raise exception 'Business purchasing permission required';
    end if;

    select * into v_account
    from public.bank_accounts
    where id=p_account_id
      and business_id=p_business_id
      and status='active'
    for update;

    if v_account.id is null then
      raise exception 'Business account unavailable';
    end if;
  else
    select * into v_account
    from public.bank_accounts
    where id=p_account_id
      and character_id=v_character.id
      and status='active'
    for update;

    if v_account.id is null then
      raise exception 'Personal account unavailable';
    end if;
  end if;

  select coalesce(sum(amount),0)
  into v_holds
  from public.bank_account_holds
  where account_id=v_account.id
    and status='active';

  select * into v_settings
  from public.economy_settings
  where community_id=v_character.community_id;

  v_subtotal:=v_product.price*p_quantity;
  v_tax:=round(
    v_subtotal*(coalesce(v_settings.sales_tax_percent,5)/100),
    2
  );
  v_total:=v_subtotal+v_tax;

  if v_account.balance-v_holds+v_account.overdraft_limit<v_total then
    raise exception 'Insufficient available balance';
  end if;

  v_sale_number:=
    public.generate_cad_identifier(
      v_character.community_id,'store_sale'
    );

  v_buyer_transaction_number:=
    public.generate_cad_identifier(
      v_character.community_id,'bank_transaction'
    );

  v_new_buyer_balance:=v_account.balance-v_total;

  update public.bank_accounts
  set balance=v_new_buyer_balance,
      available_balance=v_new_buyer_balance-v_holds,
      updated_at=now()
  where id=v_account.id;

  insert into public.bank_transactions(
    community_id,transaction_number,account_id,related_account_id,
    transaction_type,direction,amount,balance_after,description,
    reference_type,initiated_by_user_id,metadata
  )
  values(
    v_character.community_id,v_buyer_transaction_number,v_account.id,
    v_store.bank_account_id,'purchase','debit',v_total,
    v_new_buyer_balance,
    case
      when p_destination_type='business'
      then 'Business inventory purchase from '||v_store.name
      else 'Purchase from '||v_store.name
    end,
    'store_sale',auth.uid(),
    jsonb_build_object(
      'product_id',v_product.id,
      'quantity',p_quantity,
      'destination_type',p_destination_type,
      'business_id',p_business_id
    )
  );

  -- Credit the seller directly inside this security-definer transaction.
  -- This avoids requiring the customer to manage the seller's business.
  if v_store.bank_account_id is not null
     and v_store.bank_account_id<>v_account.id then

    select balance+v_subtotal
    into v_new_seller_balance
    from public.bank_accounts
    where id=v_store.bank_account_id
    for update;

    if v_new_seller_balance is not null then
      update public.bank_accounts
      set balance=v_new_seller_balance,
          available_balance=available_balance+v_subtotal,
          updated_at=now()
      where id=v_store.bank_account_id;

      v_seller_transaction_number:=
        public.generate_cad_identifier(
          v_character.community_id,'bank_transaction'
        );

      insert into public.bank_transactions(
        community_id,transaction_number,account_id,related_account_id,
        transaction_type,direction,amount,balance_after,description,
        reference_type,initiated_by_user_id,metadata
      )
      values(
        v_character.community_id,v_seller_transaction_number,
        v_store.bank_account_id,v_account.id,'purchase','credit',
        v_subtotal,v_new_seller_balance,'Sale at '||v_store.name,
        'store_sale',auth.uid(),
        jsonb_build_object(
          'product_id',v_product.id,
          'quantity',p_quantity,
          'customer_character_id',v_character.id
        )
      );
    end if;
  end if;

  update public.store_products
  set stock_quantity=stock_quantity-p_quantity,
      updated_at=now()
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

  update public.bank_transactions
  set reference_id=v_sale_id
  where community_id=v_character.community_id
    and transaction_number in (
      v_buyer_transaction_number,
      v_seller_transaction_number
    );

  insert into public.store_sale_items(
    sale_id,product_id,quantity,unit_price,line_total
  )
  values(
    v_sale_id,v_product.id,p_quantity,v_product.price,v_subtotal
  );

  if p_destination_type='business' then
    select * into v_existing
    from public.business_inventory
    where business_id=p_business_id
      and product_id=v_product.id
    for update;

    if v_existing.id is null then
      insert into public.business_inventory(
        community_id,business_id,product_id,item_name,quantity,
        reserved_quantity,average_cost,metadata,status
      )
      values(
        v_character.community_id,p_business_id,v_product.id,
        v_product.name,p_quantity,0,v_product.price,
        jsonb_build_object(
          'source_store_id',v_store.id,
          'last_sale_id',v_sale_id,
          'last_purchase_total',v_total
        ),
        'available'
      );
    else
      update public.business_inventory
      set average_cost=round(
            (
              (quantity*average_cost)
              +(p_quantity*v_product.price)
            )/(quantity+p_quantity),
            2
          ),
          quantity=quantity+p_quantity,
          status='available',
          updated_at=now(),
          metadata=metadata||jsonb_build_object(
            'source_store_id',v_store.id,
            'last_sale_id',v_sale_id,
            'last_purchase_total',v_total
          )
      where id=v_existing.id;
    end if;

    insert into public.business_expenses(
      community_id,business_id,bank_account_id,sale_id,expense_type,
      description,amount,created_by_user_id
    )
    values(
      v_character.community_id,p_business_id,v_account.id,v_sale_id,
      'inventory','Inventory purchase: '||v_product.name,
      v_total,auth.uid()
    );
  else
    perform public.add_personal_inventory_quantity(
      v_character.community_id,
      v_character.id,
      v_product.id,
      v_product.name,
      p_quantity,
      jsonb_build_object(
        'sale_id',v_sale_id,
        'store_id',v_store.id,
        'last_purchase_total',v_total
      )
    );
  end if;

  return v_sale_id;
end;
$$;

grant execute on function public.purchase_store_product_for_destination(
  uuid,uuid,uuid,integer,text,uuid
) to authenticated;

-- Keep a published business-store product synchronized with the quantity that
-- remains in business inventory.
create or replace function public.publish_business_inventory_product(
  p_inventory_id uuid,
  p_category_id uuid,
  p_price numeric,
  p_description text default null,
  p_active boolean default true
)
returns public.store_products
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inv public.business_inventory%rowtype;
  v_store public.stores%rowtype;
  v_product public.store_products;
  v_sku text;
begin
  select * into v_inv
  from public.business_inventory
  where id=p_inventory_id
  for update;

  if v_inv.id is null then
    raise exception 'Business inventory item not found';
  end if;

  if not public.can_manage_business_inventory(v_inv.business_id) then
    raise exception 'Business inventory permission required';
  end if;

  if v_inv.quantity-v_inv.reserved_quantity<=0 then
    raise exception 'No available quantity can be added to the store';
  end if;

  if p_price is null or p_price<0 then
    raise exception 'Price cannot be negative';
  end if;

  select * into v_store
  from public.stores
  where business_id=v_inv.business_id
    and status='active'
  order by created_at
  limit 1;

  if v_store.id is null then
    raise exception 'Business storefront unavailable';
  end if;

  if p_category_id is not null
     and not exists(
       select 1
       from public.store_categories
       where id=p_category_id
         and store_id=v_store.id
         and active=true
     ) then
    raise exception 'Category unavailable';
  end if;

  v_sku:='BIZ-'||upper(substr(replace(v_inv.id::text,'-',''),1,12));

  insert into public.store_products(
    community_id,store_id,sku,name,description,category,category_id,
    price,stock_quantity,active,product_type,source_inventory_id
  )
  values(
    v_inv.community_id,v_store.id,v_sku,v_inv.item_name,
    nullif(trim(coalesce(p_description,'')),''),
    coalesce(
      (
        select name
        from public.store_categories
        where id=p_category_id
      ),
      'General'
    ),
    p_category_id,p_price,
    greatest(0,v_inv.quantity-v_inv.reserved_quantity),
    p_active,'item',v_inv.id
  )
  on conflict(store_id,sku)
  do update set
    description=excluded.description,
    category=excluded.category,
    category_id=excluded.category_id,
    price=excluded.price,
    stock_quantity=greatest(
      0,
      (
        select quantity-reserved_quantity
        from public.business_inventory
        where id=p_inventory_id
      )
    ),
    active=excluded.active,
    updated_at=now()
  returning * into v_product;

  return v_product;
end;
$$;

grant execute on function public.publish_business_inventory_product(
  uuid,uuid,numeric,text,boolean
) to authenticated;

commit;
