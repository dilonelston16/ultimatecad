-- UltimateCAD — Store Catalogue Administration

begin;

alter table public.store_products
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz;

insert into public.permissions(key,name,description,category)
values
 ('stores.create_items','Create store items','Create new products in system or business stores.','Stores'),
 ('stores.edit_items','Edit store items','Edit prices, stock, categories, restrictions, and visibility.','Stores'),
 ('stores.delete_items','Delete store items','Soft-delete products from the catalogue.','Stores'),
 ('stores.bulk_import','Bulk import store items','Import structured catalogue files.','Stores')
on conflict(key) do update
set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.key,true
from public.roles r
cross join (
  values
    ('stores.create_items'),
    ('stores.edit_items'),
    ('stores.delete_items'),
    ('stores.bulk_import')
) p(key)
where r.name in ('Founder','Owner','Community Admin')
on conflict(role_id,permission_key) do update set allowed=true;

create or replace function public.can_manage_store_catalog(
  p_store_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.stores s
    where s.id=p_store_id
      and (
        public.is_community_owner(s.community_id)
        or public.has_permission(s.community_id,'stores.manage_catalog')
        or public.has_permission(s.community_id,'stores.create_items')
        or (
          s.business_id is not null
          and exists(
            select 1
            from public.businesses b
            join public.characters c on c.id=b.owner_character_id
            where b.id=s.business_id
              and c.owner_user_id=auth.uid()
          )
        )
      )
  );
$$;

grant execute on function public.can_manage_store_catalog(uuid)
to authenticated;

create or replace function public.admin_upsert_store_product(
  p_store_id uuid,
  p_product_id uuid,
  p_sku text,
  p_name text,
  p_description text,
  p_category text,
  p_product_type text,
  p_price numeric,
  p_stock_quantity integer,
  p_active boolean,
  p_restricted boolean,
  p_asset_template jsonb default '{}'::jsonb
)
returns public.store_products
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store public.stores%rowtype;
  v_product public.store_products;
begin
  select * into v_store
  from public.stores
  where id=p_store_id;

  if v_store.id is null then raise exception 'Store not found'; end if;
  if not public.can_manage_store_catalog(v_store.id) then
    raise exception 'Store catalogue management permission required';
  end if;

  if nullif(trim(coalesce(p_name,'')),'') is null then
    raise exception 'Product name is required';
  end if;

  if p_price<0 or p_stock_quantity<0 then
    raise exception 'Price and stock cannot be negative';
  end if;

  if p_product_type not in ('item','vehicle','weapon','property','service','document') then
    raise exception 'Invalid product type';
  end if;

  if p_product_id is null then
    insert into public.store_products(
      community_id,store_id,sku,name,description,category,product_type,
      price,stock_quantity,active,restricted,asset_template,
      created_by_user_id,deleted_at,updated_at
    )
    values(
      v_store.community_id,v_store.id,upper(trim(p_sku)),trim(p_name),
      nullif(trim(coalesce(p_description,'')),''),
      coalesce(nullif(trim(p_category),''),'Other'),
      p_product_type,p_price,p_stock_quantity,coalesce(p_active,true),
      coalesce(p_restricted,false),coalesce(p_asset_template,'{}'::jsonb),
      auth.uid(),null,now()
    )
    returning * into v_product;
  else
    update public.store_products
    set sku=upper(trim(p_sku)),
        name=trim(p_name),
        description=nullif(trim(coalesce(p_description,'')),''),
        category=coalesce(nullif(trim(p_category),''),'Other'),
        product_type=p_product_type,
        price=p_price,
        stock_quantity=p_stock_quantity,
        active=coalesce(p_active,true),
        restricted=coalesce(p_restricted,false),
        asset_template=coalesce(p_asset_template,'{}'::jsonb),
        deleted_at=null,
        updated_at=now()
    where id=p_product_id
      and store_id=v_store.id
    returning * into v_product;
  end if;

  if v_product.id is null then raise exception 'Product update failed'; end if;

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_store.community_id,auth.uid(),
    case when p_product_id is null then 'store_product_created' else 'store_product_updated' end,
    'store_product',v_product.id,
    v_product.name||' catalogue record saved.',
    jsonb_build_object('store_id',v_store.id,'sku',v_product.sku)
  );

  return v_product;
end;
$$;

grant execute on function public.admin_upsert_store_product(
  uuid,uuid,text,text,text,text,text,numeric,integer,boolean,boolean,jsonb
) to authenticated;

create or replace function public.admin_delete_store_product(
  p_product_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_product public.store_products%rowtype;
begin
  select * into v_product
  from public.store_products
  where id=p_product_id
  for update;

  if v_product.id is null then raise exception 'Product not found'; end if;

  if not public.can_manage_store_catalog(v_product.store_id) then
    raise exception 'Store catalogue management permission required';
  end if;

  update public.store_products
  set active=false,
      deleted_at=now(),
      updated_at=now()
  where id=v_product.id;

  insert into public.economy_audit_log(
    community_id,actor_user_id,action_type,entity_type,entity_id,
    description,metadata
  )
  values(
    v_product.community_id,auth.uid(),'store_product_deleted',
    'store_product',v_product.id,
    coalesce(nullif(trim(p_reason),''),'Product removed from catalogue.'),
    jsonb_build_object('store_id',v_product.store_id,'sku',v_product.sku)
  );
end;
$$;

grant execute on function public.admin_delete_store_product(uuid,text)
to authenticated;

create or replace function public.admin_bulk_import_store_catalog(
  p_community_id uuid,
  p_catalog jsonb
)
returns table(imported integer,updated integer,failed integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item jsonb;
  v_store public.stores%rowtype;
  v_product_id uuid;
  v_imported integer:=0;
  v_updated integer:=0;
  v_failed integer:=0;
begin
  if not (
    public.is_community_owner(p_community_id)
    or public.has_permission(p_community_id,'stores.bulk_import')
    or public.has_permission(p_community_id,'stores.manage_catalog')
  ) then raise exception 'Bulk catalogue import permission required'; end if;

  if jsonb_typeof(p_catalog)<>'array' then
    raise exception 'Catalogue payload must be a JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(p_catalog)
  loop
    begin
      select * into v_store
      from public.stores
      where community_id=p_community_id
        and name=v_item->>'store_name'
      limit 1;

      if v_store.id is null then
        raise exception 'Store not found: %',v_item->>'store_name';
      end if;

      select id into v_product_id
      from public.store_products
      where store_id=v_store.id
        and upper(sku)=upper(v_item->>'sku')
      limit 1;

      perform public.admin_upsert_store_product(
        v_store.id,
        v_product_id,
        v_item->>'sku',
        v_item->>'name',
        v_item->>'description',
        v_item->>'category',
        coalesce(v_item->>'product_type','item'),
        coalesce((v_item->>'price')::numeric,0),
        coalesce((v_item->>'stock_quantity')::integer,0),
        coalesce((v_item->>'active')::boolean,true),
        coalesce((v_item->>'restricted')::boolean,false),
        coalesce(v_item->'asset_template','{}'::jsonb)
      );

      if v_product_id is null then
        v_imported:=v_imported+1;
      else
        v_updated:=v_updated+1;
      end if;

    exception when others then
      v_failed:=v_failed+1;
    end;
  end loop;

  return query select v_imported,v_updated,v_failed;
end;
$$;

grant execute on function public.admin_bulk_import_store_catalog(uuid,jsonb)
to authenticated;

commit;
