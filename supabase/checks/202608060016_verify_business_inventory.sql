select
  b.name as business_name,
  bi.id,
  bi.item_name,
  bi.quantity,
  bi.reserved_quantity,
  bi.average_cost,
  bi.status,
  bi.created_at,
  bi.updated_at,
  sp.sku,
  sp.category
from public.business_inventory bi
join public.businesses b on b.id=bi.business_id
left join public.store_products sp on sp.id=bi.product_id
order by bi.updated_at desc;
