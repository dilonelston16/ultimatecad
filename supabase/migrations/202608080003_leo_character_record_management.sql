-- UltimateCAD Milestone 3.3.1 — Character LEO record management
begin;

insert into public.permissions(key,name,description,category) values
 ('leo.clear_player_records','Clear player LEO records','Permanently clear LEO records attached to a character while preserving civilian/economy/DMV data.','Law Enforcement')
on conflict(key) do update set name=excluded.name,description=excluded.description,category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,'leo.clear_player_records',true
from public.roles r
where r.name in ('Founder','Owner','Community Admin','Agency Director','Department Command','Supervisor')
on conflict(role_id,permission_key) do update set allowed=true;

create or replace function public.clear_character_leo_records(
  p_community_id uuid,
  p_character_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_owner boolean := false;
  v_records integer := 0;
  v_warrants integer := 0;
  v_bookings integer := 0;
  v_stops integer := 0;
  v_timeline integer := 0;
  v_record_ids uuid[];
begin
  if v_user is null then raise exception 'Authentication required.'; end if;

  select exists(
    select 1 from public.community_memberships
    where community_id=p_community_id and user_id=v_user and status='active' and is_owner=true
  ) into v_owner;

  if not v_owner and not public.has_permission(p_community_id,'leo.clear_player_records') then
    raise exception 'Supervisor record-clear permission required.';
  end if;

  if not exists(select 1 from public.characters where id=p_character_id and community_id=p_community_id) then
    raise exception 'Character not found in this community.';
  end if;

  select coalesce(array_agg(id),array[]::uuid[]), count(*)
  into v_record_ids,v_records
  from public.leo_records
  where community_id=p_community_id and character_id=p_character_id;

  -- Charges cascade from leo_records. Bookings are cleared explicitly first so
  -- the reset behaves consistently even if a booking was detached from an arrest record.
  select count(*) into v_bookings from public.leo_bookings where community_id=p_community_id and character_id=p_character_id;
  delete from public.leo_bookings where community_id=p_community_id and character_id=p_character_id;

  select count(*) into v_warrants from public.leo_warrants where community_id=p_community_id and character_id=p_character_id;
  delete from public.leo_warrants where community_id=p_community_id and character_id=p_character_id;

  select count(*) into v_stops from public.leo_traffic_stops where community_id=p_community_id and character_id=p_character_id;
  delete from public.leo_traffic_stops where community_id=p_community_id and character_id=p_character_id;

  delete from public.leo_records where community_id=p_community_id and character_id=p_character_id;

  select count(*) into v_timeline
  from public.character_timeline
  where community_id=p_community_id and character_id=p_character_id
    and (event_type like 'leo_%' or event_type in ('leo_report','leo_citation','leo_arrest'));

  delete from public.character_timeline
  where community_id=p_community_id and character_id=p_character_id
    and (event_type like 'leo_%' or event_type in ('leo_report','leo_citation','leo_arrest'));

  insert into public.leo_officer_activity(
    community_id,user_id,activity_type,entity_type,entity_id,description,metadata
  ) values (
    p_community_id,v_user,'character_records_cleared','character',p_character_id,
    'Cleared all LEO records attached to character',
    jsonb_build_object('records',v_records,'warrants',v_warrants,'bookings',v_bookings,'traffic_stops',v_stops,'timeline_entries',v_timeline)
  );

  return jsonb_build_object(
    'records',v_records,
    'warrants',v_warrants,
    'bookings',v_bookings,
    'trafficStops',v_stops,
    'timelineEntries',v_timeline
  );
end $$;

grant execute on function public.clear_character_leo_records(uuid,uuid) to authenticated;

commit;
