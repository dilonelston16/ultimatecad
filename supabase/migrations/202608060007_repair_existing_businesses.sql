-- UltimateCAD Milestone 2.1.1 — Repair existing business records
-- Safe to run after the Full Economy Foundation migration.

begin;

-- Ensure every business owner has an active owner membership.
insert into public.business_members (
  community_id,
  business_id,
  character_id,
  role_name,
  pay_type,
  pay_rate,
  status
)
select
  b.community_id,
  b.id,
  b.owner_character_id,
  'Owner',
  'salary',
  0,
  'active'
from public.businesses b
where not exists (
  select 1
  from public.business_members bm
  where bm.business_id = b.id
    and bm.character_id = b.owner_character_id
)
on conflict (business_id, character_id)
do update set
  role_name = 'Owner',
  status = 'active',
  terminated_at = null;

-- Repair businesses missing their operating account.
do $$
declare
  v_business public.businesses%rowtype;
  v_account_number text;
  v_account_id uuid;
begin
  for v_business in
    select *
    from public.businesses
    where business_bank_account_id is null
  loop
    v_account_number :=
      public.generate_cad_identifier(
        v_business.community_id,
        'bank_account'
      );

    insert into public.bank_accounts (
      community_id,
      business_id,
      account_number,
      account_type,
      name,
      balance,
      available_balance,
      status,
      opened_by_user_id
    )
    values (
      v_business.community_id,
      v_business.id,
      v_account_number,
      'business',
      v_business.name || ' Operating Account',
      0,
      0,
      'active',
      v_business.created_by_user_id
    )
    returning id into v_account_id;

    update public.businesses
    set business_bank_account_id = v_account_id,
        updated_at = now()
    where id = v_business.id;
  end loop;
end
$$;

-- Owners can always read and manage their own businesses.
drop policy if exists "business owners read own businesses" on public.businesses;
create policy "business owners read own businesses"
on public.businesses
for select
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = owner_character_id
      and c.owner_user_id = auth.uid()
  )
  or public.has_permission(community_id, 'businesses.manage')
  or public.is_community_owner(community_id)
);

drop policy if exists "business owners read own members" on public.business_members;
create policy "business owners read own members"
on public.business_members
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    join public.characters c
      on c.id = b.owner_character_id
    where b.id = business_id
      and c.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.characters c
    where c.id = character_id
      and c.owner_user_id = auth.uid()
  )
  or public.has_permission(community_id, 'businesses.manage')
  or public.is_community_owner(community_id)
);

-- Restore access to business operating accounts for the business owner.
drop policy if exists "business owners view business accounts" on public.bank_accounts;
create policy "business owners view business accounts"
on public.bank_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.characters c
    where c.id = character_id
      and c.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.businesses b
    join public.characters c
      on c.id = b.owner_character_id
    where b.id = business_id
      and c.owner_user_id = auth.uid()
  )
  or public.has_permission(community_id, 'banking.view_all')
  or public.is_community_owner(community_id)
);

commit;
