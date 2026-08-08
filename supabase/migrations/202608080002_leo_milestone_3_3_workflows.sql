-- UltimateCAD Milestone 3.3 — LEO workflow controls and panic resolution
begin;

create or replace function public.resolve_leo_panic(p_alert_id uuid)
returns public.leo_panic_alerts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_alert public.leo_panic_alerts%rowtype;
  v_owner boolean;
begin
  select * into v_alert from public.leo_panic_alerts where id=p_alert_id;
  if v_alert.id is null then raise exception 'Panic alert not found'; end if;

  select public.is_community_owner(v_alert.community_id) into v_owner;
  if not (
    v_alert.activated_by_user_id = auth.uid()
    or v_owner
    or public.has_permission(v_alert.community_id,'leo.manage_units')
    or public.has_permission(v_alert.community_id,'leo.manage_calls')
  ) then
    raise exception 'Supervisor or originating officer required to resolve panic';
  end if;

  update public.leo_panic_alerts
  set status='resolved', resolved_at=now(), acknowledged_by_user_id=coalesce(acknowledged_by_user_id,auth.uid()), acknowledged_at=coalesce(acknowledged_at,now())
  where id=p_alert_id
  returning * into v_alert;

  update public.leo_shifts
  set current_assignment=null, status='available', last_status_at=now()
  where id=v_alert.shift_id and clocked_out_at is null;

  return v_alert;
end;
$$;

grant execute on function public.resolve_leo_panic(uuid) to authenticated;


-- Table-specific write policies for Milestone 3.3 operational actions.
drop policy if exists "leo write leo_backup_requests" on public.leo_backup_requests;
create policy "leo write leo_backup_requests" on public.leo_backup_requests
for all to authenticated
using (public.has_permission(community_id,'leo.request_backup') or public.has_permission(community_id,'leo.manage_units') or public.is_community_owner(community_id))
with check (public.has_permission(community_id,'leo.request_backup') or public.has_permission(community_id,'leo.manage_units') or public.is_community_owner(community_id));

drop policy if exists "leo write leo_traffic_stops" on public.leo_traffic_stops;
create policy "leo write leo_traffic_stops" on public.leo_traffic_stops
for all to authenticated
using (public.has_permission(community_id,'leo.manage_traffic') or public.is_community_owner(community_id))
with check (public.has_permission(community_id,'leo.manage_traffic') or public.is_community_owner(community_id));

drop policy if exists "leo write leo_tow_requests" on public.leo_tow_requests;
create policy "leo write leo_tow_requests" on public.leo_tow_requests
for all to authenticated
using (public.has_permission(community_id,'leo.manage_tow') or public.is_community_owner(community_id))
with check (public.has_permission(community_id,'leo.manage_tow') or public.is_community_owner(community_id));

create or replace function public.next_leo_entity_number(p_community_id uuid,p_prefix text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v integer := 1;
  p text := upper(coalesce(p_prefix,''));
begin
  if p='TS' then select count(*)+1 into v from public.leo_traffic_stops where community_id=p_community_id;
  elsif p='TOW' then select count(*)+1 into v from public.leo_tow_requests where community_id=p_community_id;
  elsif p='IMP' then select count(*)+1 into v from public.leo_impounds where community_id=p_community_id;
  elsif p='BKG' then select count(*)+1 into v from public.leo_bookings where community_id=p_community_id;
  else select count(*)+1 into v from public.leo_officer_activity where community_id=p_community_id;
  end if;
  return p||'-'||to_char(now(),'YY')||'-'||lpad(v::text,6,'0');
end;
$$;

grant execute on function public.next_leo_entity_number(uuid,text) to authenticated;

commit;
