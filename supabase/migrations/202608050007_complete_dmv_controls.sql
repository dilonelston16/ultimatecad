-- UltimateCAD Milestone 1.6
-- DMV completion: randomized tests, application cleanup, licence actions,
-- renewals, points, suspensions and revocations.

create table if not exists public.dmv_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  written_question_count integer not null default 15 check (written_question_count between 5 and 50),
  written_pass_percent integer not null default 80 check (written_pass_percent between 50 and 100),
  warning_points integer not null default 10 check (warning_points >= 0),
  suspension_points integer not null default 15 check (suspension_points >= 1),
  revocation_points integer not null default 25 check (revocation_points >= 1),
  suspension_days integer not null default 7 check (suspension_days >= 1),
  updated_at timestamptz not null default now()
);

insert into public.dmv_settings (community_id)
select id from public.communities
on conflict (community_id) do nothing;

alter table public.dmv_settings enable row level security;

drop policy if exists "members read dmv settings" on public.dmv_settings;
create policy "members read dmv settings"
on public.dmv_settings for select to authenticated
using (public.is_active_community_member(community_id));

drop policy if exists "dmv staff update dmv settings" on public.dmv_settings;
create policy "dmv staff update dmv settings"
on public.dmv_settings for update to authenticated
using (public.has_permission(community_id, 'dmv.manage'))
with check (public.has_permission(community_id, 'dmv.manage'));

create table if not exists public.license_actions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  license_id uuid not null references public.licenses(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (
    action_type in (
      'issued','renewed','suspended','revoked','reinstated',
      'points_added','points_removed','expired','note_added'
    )
  ),
  previous_status text,
  new_status text,
  points_change integer not null default 0,
  reason text,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists license_actions_license_idx
  on public.license_actions(license_id, created_at desc);

alter table public.license_actions enable row level security;

drop policy if exists "members read permitted licence actions" on public.license_actions;
create policy "members read permitted licence actions"
on public.license_actions for select to authenticated
using (
  exists (
    select 1 from public.characters c
    where c.id=character_id and c.owner_user_id=auth.uid()
  )
  or public.has_permission(community_id, 'dmv.view')
);

-- Add more questions without duplicating existing question text.
create or replace function public.add_license_question(
  p_community_id uuid,
  p_code text,
  p_question text,
  p_a text,
  p_b text,
  p_c text,
  p_d text,
  p_correct text,
  p_explanation text,
  p_sort integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type_id uuid;
begin
  select id into v_type_id
  from public.license_types
  where community_id=p_community_id and code=p_code
  limit 1;

  if v_type_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.license_test_questions
    where license_type_id=v_type_id and lower(question)=lower(p_question)
  ) then
    insert into public.license_test_questions(
      community_id,license_type_id,question,option_a,option_b,option_c,option_d,
      correct_option,explanation,sort_order
    )
    values(
      p_community_id,v_type_id,p_question,p_a,p_b,p_c,p_d,
      upper(p_correct),p_explanation,p_sort
    );
  end if;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.communities loop
    -- Class C additions
    perform public.add_license_question(c.id,'DL-C','At a stop sign, the driver must:','Slow down only','Come to a complete stop','Stop only if another car is present','Use hazard lights','B','A stop sign requires a complete stop.',10);
    perform public.add_license_question(c.id,'DL-C','When following another vehicle, you should:','Leave a safe following distance','Drive as close as possible','Use high beams continuously','Follow on the shoulder','A','A safe following distance provides reaction time.',11);
    perform public.add_license_question(c.id,'DL-C','Before backing up, a driver should:','Only use the horn','Check mirrors and surroundings','Accelerate quickly','Turn off the lights','B','Check the full area before reversing.',12);
    perform public.add_license_question(c.id,'DL-C','A yellow traffic light means:','Speed up automatically','The signal is changing; stop if safe','Traffic laws no longer apply','Only trucks must stop','B','A yellow signal warns that the light is changing.',13);
    perform public.add_license_question(c.id,'DL-C','When visibility is reduced, drivers should:','Increase speed','Use appropriate lights and reduce speed','Drive without lights','Follow more closely','B','Reduced visibility requires slower speed and proper lighting.',14);
    perform public.add_license_question(c.id,'DL-C','A driver approaching a pedestrian crossing should:','Yield when required','Honk and continue','Drive around pedestrians','Stop only at night','A','Pedestrians must be protected at crossings.',15);
    perform public.add_license_question(c.id,'DL-C','If a tire suddenly fails, the driver should:','Brake and turn sharply','Hold the wheel firmly and slow gradually','Accelerate','Exit the vehicle immediately','B','Maintain control and reduce speed smoothly.',16);
    perform public.add_license_question(c.id,'DL-C','Seat belts should be worn by:','Only the driver','Only front passengers','All occupants where available','No one in the city','C','Seat belts reduce injury risk for all occupants.',17);
    perform public.add_license_question(c.id,'DL-C','Using a handheld phone while driving is:','Safe at any speed','Distracting and generally prohibited','Required in traffic','Allowed during turns','B','Handheld phone use creates dangerous distraction.',18);
    perform public.add_license_question(c.id,'DL-C','When entering a highway, you should:','Stop at the end of the ramp','Match traffic speed and merge safely','Drive on the shoulder','Force other vehicles to stop','B','Use the acceleration lane to merge safely.',19);
    perform public.add_license_question(c.id,'DL-C','At an uncontrolled intersection, drivers should:','Proceed without checking','Slow down and yield as required','Always turn left','Use only the horn','B','Uncontrolled intersections require caution and yielding.',20);
    perform public.add_license_question(c.id,'DL-C','If another driver is tailgating you, the safest response is to:','Brake-check them','Increase space ahead and allow them to pass','Race them','Stop in the lane','B','Create more space and avoid confrontation.',21);
    perform public.add_license_question(c.id,'DL-C','When parking downhill with a curb, turn the wheels:','Away from the curb','Toward the curb','Straight ahead only','Toward traffic','B','Turning toward the curb helps prevent a runaway vehicle.',22);
    perform public.add_license_question(c.id,'DL-C','A broken white line separates:','Traffic moving in the same direction','Opposing traffic only','Pedestrian lanes','Parking spaces only','A','Broken white lines commonly separate same-direction lanes.',23);
    perform public.add_license_question(c.id,'DL-C','If an intersection is blocked, you should:','Enter and wait inside it','Wait before entering','Drive onto the sidewalk','Use the wrong lane','B','Do not block an intersection.',24);
    perform public.add_license_question(c.id,'DL-C','Hydroplaning is more likely when:','Roads are wet and speed is too high','The vehicle is parked','Driving slowly on dry pavement','Using turn signals','A','Water can reduce tire contact with the road.',25);
    perform public.add_license_question(c.id,'DL-C','Before opening a vehicle door into traffic, check for:','Only parked cars','Vehicles, cyclists and pedestrians','Street lights only','Nothing','B','Check the travel path before opening the door.',26);
    perform public.add_license_question(c.id,'DL-C','If traffic signals are not working, treat the intersection as:','A race start','An all-way stop unless directed otherwise','A free turn','Closed only to trucks','B','A failed signal should be approached as an all-way stop.',27);
    perform public.add_license_question(c.id,'DL-C','Road markings and signs should be:','Ignored when traffic is light','Obeyed unless directed otherwise by an authorized official','Used only by police','Optional at night','B','Traffic controls apply unless superseded by authorized direction.',28);
    perform public.add_license_question(c.id,'DL-C','When passing a cyclist, a driver should:','Leave safe space','Drive as close as possible','Honk continuously','Force the cyclist off the road','A','Safe clearance protects vulnerable road users.',29);

    -- Motorcycle additions
    perform public.add_license_question(c.id,'DL-M','The best lane position for a motorcycle is:','Always the center','The position that maximizes visibility and safety','Always the shoulder','Between two moving cars','B','Lane position should be selected for visibility and escape space.',10);
    perform public.add_license_question(c.id,'DL-M','Motorcycle braking is most effective when:','Only the rear brake is used','Both brakes are applied smoothly','The engine is turned off','The front brake is never used','B','Both brakes provide the strongest controlled stop.',11);
    perform public.add_license_question(c.id,'DL-M','Passengers should:','Sit sideways','Keep feet on the passenger rests and follow rider instructions','Stand while moving','Control the handlebars','B','Passengers must remain stable and follow instructions.',12);
    perform public.add_license_question(c.id,'DL-M','Loose gravel can:','Increase traction','Reduce traction and steering control','Improve braking','Have no effect','B','Loose surfaces reduce tire grip.',13);
    perform public.add_license_question(c.id,'DL-M','Before carrying a passenger, the rider should:','Ignore tire pressure','Confirm the motorcycle is equipped and adjusted for a passenger','Remove the mirrors','Reduce visibility','B','Passenger operation requires proper equipment and adjustment.',14);
    perform public.add_license_question(c.id,'DL-M','In strong wind, a rider should:','Relax control completely','Maintain a firm, flexible grip and adjust lane position','Stop looking ahead','Ride beside large trucks','B','Controlled adjustments help manage crosswinds.',15);
    perform public.add_license_question(c.id,'DL-M','Night riding requires:','Less following distance','More caution and reduced speed','No headlights','Dark clothing only','B','Visibility is reduced at night.',16);
    perform public.add_license_question(c.id,'DL-M','Group riders should generally use:','A staggered formation where safe','One wheel directly behind another','The shoulder only','Every lane at once','A','A staggered formation improves spacing and visibility.',17);
    perform public.add_license_question(c.id,'DL-M','A rider should avoid staying in another vehicle''s:','Mirror area','Blind spot','Front view','Headlight beam','B','Blind spots reduce visibility to other drivers.',18);
    perform public.add_license_question(c.id,'DL-M','Emergency swerving should be practiced because:','It replaces braking in all cases','It may avoid a hazard when stopping is not possible','It is used for entertainment','It removes the need to scan ahead','B','Swerving is an emergency avoidance technique.',19);

    -- Commercial additions
    perform public.add_license_question(c.id,'CDL-A','Air-brake warning devices should be checked:','Only after a failure','During the pre-trip inspection','Once per year only','Never','B','Warning systems are part of the safety inspection.',10);
    perform public.add_license_question(c.id,'CDL-A','A commercial driver should check mirrors:','Regularly and before maneuvers','Only when parking','Only after a collision','Never on highways','A','Frequent mirror checks maintain situational awareness.',11);
    perform public.add_license_question(c.id,'CDL-A','Off-tracking occurs when:','Rear wheels follow a shorter path in a turn','The radio loses signal','Cargo is balanced','The vehicle is parked','A','Long vehicles require additional turning space.',12);
    perform public.add_license_question(c.id,'CDL-A','A longer commercial vehicle needs:','Less turning room','More turning room','No mirrors','A narrower lane','B','Vehicle length increases turning requirements.',13);
    perform public.add_license_question(c.id,'CDL-A','Brake fade is commonly caused by:','Excessive brake use and heat','Cold tires only','Using mirrors','Secured cargo','A','Overheated brakes lose effectiveness.',14);
    perform public.add_license_question(c.id,'CDL-A','Before crossing railway tracks, a driver should:','Race the train','Ensure there is enough space to clear the tracks','Stop on the tracks','Shift gears while crossing','B','Never enter unless the vehicle can fully clear the tracks.',15);
    perform public.add_license_question(c.id,'CDL-A','A load should be rechecked:','After beginning the trip and at required intervals','Only after delivery','Never','Only if it falls off','A','Cargo securement must be monitored.',16);
    perform public.add_license_question(c.id,'CDL-A','Following distance should increase with:','Speed and vehicle weight','Music volume','Paint color','Driver seniority','A','Higher speed and weight increase stopping distance.',17);
    perform public.add_license_question(c.id,'CDL-A','During a pre-trip inspection, fluid leaks are:','Normal','A condition that must be checked and addressed','Required for cooling','Ignored if small','B','Leaks may indicate unsafe mechanical conditions.',18);
    perform public.add_license_question(c.id,'CDL-A','A commercial vehicle should be parked:','Without setting the brake','With parking controls secured','In a travel lane','On railroad tracks','B','The vehicle must be secured against movement.',19);

    -- Weapon additions
    perform public.add_license_question(c.id,'WL-BASIC','Safe storage should prevent access by:','Authorized owners','Unauthorized persons and children','Law enforcement only','No one','B','Secure storage prevents unauthorized access.',10);
    perform public.add_license_question(c.id,'WL-BASIC','Before cleaning a firearm, you should:','Confirm it is unloaded','Pull the trigger immediately','Point it at another person','Leave ammunition in place','A','Unload and verify the firearm before maintenance.',11);
    perform public.add_license_question(c.id,'WL-BASIC','Ammunition should:','Match the firearm''s specified caliber','Be any size available','Be modified without training','Be stored in the chamber permanently','A','Only correct ammunition should be used.',12);
    perform public.add_license_question(c.id,'WL-BASIC','A firearm transfer should be:','Documented through the required process','Done anonymously in all cases','Hidden from records','Completed without checking the recipient','A','Transfers must follow community law and registration rules.',13);
    perform public.add_license_question(c.id,'WL-BASIC','Warning shots are:','Always safe','Dangerous and generally not permitted','Required before any use','A substitute for safe handling','B','Fired rounds remain dangerous wherever they travel.',14);
    perform public.add_license_question(c.id,'WL-BASIC','Alcohol or drugs and firearm handling:','Improve judgment','Should never be combined','Are allowed at home','Only matter outdoors','B','Impairment and firearm handling are unsafe.',15);
    perform public.add_license_question(c.id,'WL-BASIC','If a firearm malfunctions, keep it pointed:','In a safe direction','At another person','At the ceiling automatically','Anywhere convenient','A','Maintain safe muzzle direction during a malfunction.',16);
    perform public.add_license_question(c.id,'WL-BASIC','The owner of a registered weapon is responsible for:','Secure control and lawful use','Only the purchase receipt','Nothing after purchase','Allowing unrestricted access','A','Ownership includes responsibility for control and compliance.',17);
    perform public.add_license_question(c.id,'WL-BASIC','Before firing, identify:','The target and what is beyond it','Only the weapon model','Only the nearest wall','Nothing if it is dark','A','Know the target and backdrop before firing.',18);
    perform public.add_license_question(c.id,'WL-BASIC','A revoked weapon licence means the person:','May continue carrying normally','May not exercise the revoked privilege','Automatically receives a new weapon','Can ignore registration requirements','B','Revocation removes the licensed privilege.',19);
  end loop;
end $$;

-- Randomized question RPC. Questions are selected server-side.
create or replace function public.get_written_license_test_questions(
  p_application_id uuid
)
returns table(
  id uuid,
  question text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.license_applications%rowtype;
  question_limit integer;
begin
  select * into app
  from public.license_applications
  where license_applications.id=p_application_id;

  if app.id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1 from public.characters c
    where c.id=app.character_id
      and c.owner_user_id=auth.uid()
      and c.is_archived=false
  ) then
    raise exception 'Application access denied';
  end if;

  select written_question_count into question_limit
  from public.dmv_settings
  where community_id=app.community_id;

  question_limit := coalesce(question_limit, 15);

  return query
  select q.id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.sort_order
  from public.license_test_questions q
  where q.community_id=app.community_id
    and q.license_type_id=app.license_type_id
    and q.active=true
  order by random()
  limit question_limit;
end;
$$;

grant execute on function public.get_written_license_test_questions(uuid) to authenticated;

-- Replace scoring with configurable pass percentage.
create or replace function public.submit_written_license_test(
  p_application_id uuid,
  p_answers jsonb
)
returns table(score numeric, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.license_applications%rowtype;
  test_row public.license_tests%rowtype;
  total_count integer;
  correct_count integer;
  attempt_no integer;
  pass_percent integer;
  final_score numeric(5,2);
  did_pass boolean;
begin
  select * into app
  from public.license_applications
  where id=p_application_id;

  if app.id is null then raise exception 'Application not found'; end if;

  if not exists (
    select 1 from public.characters c
    where c.id=app.character_id and c.owner_user_id=auth.uid() and c.is_archived=false
  ) then raise exception 'Application access denied'; end if;

  select * into test_row
  from public.license_tests
  where application_id=app.id and test_type='written'
  for update;

  if test_row.id is null then raise exception 'Written test not found'; end if;
  if test_row.status='passed' then raise exception 'Written test already passed'; end if;

  select count(*),
         count(*) filter (
           where upper(coalesce(p_answers ->> q.id::text, ''))=q.correct_option
         )
  into total_count,correct_count
  from public.license_test_questions q
  where q.id::text in (select jsonb_object_keys(p_answers));

  if total_count=0 then raise exception 'No valid answers were submitted'; end if;

  select written_pass_percent into pass_percent
  from public.dmv_settings
  where community_id=app.community_id;

  pass_percent := coalesce(pass_percent,80);
  final_score := round((correct_count::numeric/total_count::numeric)*100,2);
  did_pass := final_score >= pass_percent;

  select coalesce(max(attempt_number),0)+1 into attempt_no
  from public.license_test_attempts
  where license_test_id=test_row.id;

  insert into public.license_test_attempts(
    community_id,application_id,license_test_id,character_id,user_id,
    attempt_number,answers,score,passed
  ) values(
    app.community_id,app.id,test_row.id,app.character_id,auth.uid(),
    attempt_no,p_answers,final_score,did_pass
  );

  update public.license_tests
  set status=case when did_pass then 'passed' else 'failed' end,
      score=final_score,
      completed_at=now(),
      notes=case when did_pass then 'Completed through civilian written test portal.'
                 else 'Written test failed; retake required.' end
  where id=test_row.id;

  update public.license_applications
  set written_status=case when did_pass then 'passed' else 'failed' end,
      status=case
        when did_pass and practical_status in ('passed','not_required') then 'ready_for_review'
        else 'testing'
      end,
      updated_at=now()
  where id=app.id;

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description
  ) values(
    app.community_id,app.character_id,auth.uid(),'license.test',
    case when did_pass then 'Written license test passed' else 'Written license test failed' end,
    'Score: '||final_score::text||'%.'
  );

  return query select final_score,did_pass;
end;
$$;

-- DMV action RPC. Keeps all status transitions and audits in one place.
create or replace function public.manage_license(
  p_license_id uuid,
  p_action text,
  p_reason text default null,
  p_points integer default 0,
  p_expiration timestamptz default null
)
returns public.licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  settings public.dmv_settings%rowtype;
  old_status text;
  new_status text;
  new_points integer;
begin
  select * into lic from public.licenses where id=p_license_id for update;
  if lic.id is null then raise exception 'License not found'; end if;

  if not public.has_permission(lic.community_id,'dmv.manage') then
    raise exception 'DMV management permission required';
  end if;

  select * into settings from public.dmv_settings where community_id=lic.community_id;
  old_status := lic.status;
  new_status := lic.status;
  new_points := greatest(0,coalesce(lic.points,0));

  case p_action
    when 'suspend' then new_status := 'suspended';
    when 'revoke' then new_status := 'revoked';
    when 'reinstate' then new_status := 'valid';
    when 'renew' then
      new_status := 'valid';
      lic.expires_at := coalesce(p_expiration,now()+interval '12 months');
    when 'add_points' then new_points := greatest(0,new_points+greatest(p_points,0));
    when 'remove_points' then new_points := greatest(0,new_points-abs(p_points));
    else raise exception 'Unsupported DMV action';
  end case;

  if p_action in ('add_points','remove_points') then
    if new_points >= coalesce(settings.revocation_points,25) then
      new_status := 'revoked';
    elsif new_points >= coalesce(settings.suspension_points,15) then
      new_status := 'suspended';
    end if;
  end if;

  update public.licenses
  set status=new_status,
      points=new_points,
      expires_at=lic.expires_at,
      updated_at=now()
  where id=lic.id
  returning * into lic;

  insert into public.license_actions(
    community_id,license_id,character_id,actor_user_id,action_type,
    previous_status,new_status,points_change,reason,expires_at
  ) values(
    lic.community_id,lic.id,lic.character_id,auth.uid(),
    case p_action
      when 'suspend' then 'suspended'
      when 'revoke' then 'revoked'
      when 'reinstate' then 'reinstated'
      when 'renew' then 'renewed'
      when 'add_points' then 'points_added'
      when 'remove_points' then 'points_removed'
    end,
    old_status,new_status,
    case when p_action='add_points' then greatest(p_points,0)
         when p_action='remove_points' then -abs(p_points)
         else 0 end,
    nullif(trim(coalesce(p_reason,'')),''),
    lic.expires_at
  );

  insert into public.character_timeline(
    community_id,character_id,actor_user_id,event_type,title,description
  ) values(
    lic.community_id,lic.character_id,auth.uid(),'license.action',
    'License '||replace(p_action,'_',' '),
    coalesce(p_reason,'DMV action completed.')||
    case when p_action in ('add_points','remove_points')
         then ' Current points: '||new_points::text||'.' else '' end
  );

  return lic;
end;
$$;

grant execute on function public.manage_license(uuid,text,text,integer,timestamptz) to authenticated;

-- Finalize applications so they no longer remain pending after issuance/denial.
create or replace function public.finalize_license_application(
  p_application_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.license_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.license_applications%rowtype;
  ltype public.license_types%rowtype;
  new_license_id uuid;
  generated_number text;
begin
  select * into app from public.license_applications where id=p_application_id for update;
  if app.id is null then raise exception 'Application not found'; end if;

  if not public.has_permission(app.community_id,'dmv.manage') then
    raise exception 'DMV management permission required';
  end if;

  if p_decision='approve' then
    if app.written_status not in ('passed','not_required')
       or app.practical_status not in ('passed','not_required') then
      raise exception 'Required tests are incomplete';
    end if;

    select * into ltype from public.license_types where id=app.license_type_id;
    generated_number := public.generate_record_number(
      app.community_id,
      case when ltype.category='weapon' then 'WL' else 'DL' end
    );

    insert into public.licenses(
      community_id,character_id,license_type_id,license_number,status,
      issued_at,expires_at,points,issued_by_user_id,application_id
    ) values(
      app.community_id,app.character_id,app.license_type_id,generated_number,'valid',
      now(),now()+(ltype.validity_months||' months')::interval,0,auth.uid(),app.id
    ) returning id into new_license_id;

    update public.license_applications
    set status='completed',
        decision='approved',
        decided_by_user_id=auth.uid(),
        decided_at=now(),
        staff_notes=nullif(trim(coalesce(p_notes,'')),''),
        updated_at=now()
    where id=app.id
    returning * into app;

    insert into public.license_actions(
      community_id,license_id,character_id,actor_user_id,action_type,
      previous_status,new_status,reason
    ) values(
      app.community_id,new_license_id,app.character_id,auth.uid(),'issued',
      null,'valid',nullif(trim(coalesce(p_notes,'')),'')
    );
  elsif p_decision='deny' then
    update public.license_applications
    set status='completed',
        decision='denied',
        decided_by_user_id=auth.uid(),
        decided_at=now(),
        staff_notes=nullif(trim(coalesce(p_notes,'')),''),
        updated_at=now()
    where id=app.id
    returning * into app;
  else
    raise exception 'Decision must be approve or deny';
  end if;

  return app;
end;
$$;

grant execute on function public.finalize_license_application(uuid,text,text) to authenticated;

-- Backfill old approved/denied applications so they leave pending queues.
update public.license_applications
set status='completed', updated_at=now()
where status in ('approved','denied');

