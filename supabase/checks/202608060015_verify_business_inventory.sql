-- Run this in Supabase SQL Editor to confirm business purchases are present.

select
  b.name as business_name,
  b.business_number,
  bi.id as inventory_id,
  bi.item_name,
  bi.quantity,
  bi.reserved_quantity,
  bi.average_cost,
  bi.status,
  sp.sku,
  sp.category,
  bi.updated_at
from public.business_inventory bi
join public.businesses b on b.id=bi.business_id
left join public.store_products sp on sp.id=bi.product_id
order by bi.updated_at desc;

-- Confirm business inventory policies exist.
select
  policyname,
  cmd,
  qual
from pg_policies
where schemaname='public'
  and tablename='business_inventory'
order by policyname;
