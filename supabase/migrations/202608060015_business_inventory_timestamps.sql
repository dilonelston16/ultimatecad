-- UltimateCAD — Business Inventory Timestamp Compatibility

begin;

alter table public.business_inventory
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.business_inventory
set created_at = coalesce(
      created_at,
      (metadata->>'purchased_at')::timestamptz,
      now()
    ),
    updated_at = coalesce(
      updated_at,
      created_at,
      (metadata->>'purchased_at')::timestamptz,
      now()
    )
where created_at is null
   or updated_at is null;

alter table public.business_inventory
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists business_inventory_updated_idx
  on public.business_inventory(business_id,updated_at desc);

commit;
