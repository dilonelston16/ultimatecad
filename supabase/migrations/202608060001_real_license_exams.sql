-- UltimateCAD Milestone 1.7 — Real licence exams

alter table public.license_test_attempts
  add column if not exists duration_seconds integer,
  add column if not exists question_ids jsonb not null default '[]'::jsonb;

alter table public.dmv_settings
  add column if not exists written_time_limit_minutes integer not null default 20,
  add column if not exists max_written_attempts integer not null default 5;

create or replace function public.add_real_exam_question(
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

  if v_type_id is null then return; end if;

  if not exists (
    select 1 from public.license_test_questions
    where license_type_id=v_type_id and lower(question)=lower(p_question)
  ) then
    insert into public.license_test_questions(
      community_id,license_type_id,question,option_a,option_b,option_c,option_d,
      correct_option,explanation,sort_order,active
    )
    values(
      p_community_id,v_type_id,p_question,p_a,p_b,p_c,p_d,
      upper(p_correct),p_explanation,p_sort,true
    );
  end if;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.communities loop
    perform public.add_real_exam_question(c.id,'DL-C','At a steady red traffic signal, you must:','Slow and continue','Stop completely and wait for a permitted signal','Honk before entering','Proceed if no police are present','B','A steady red signal requires a complete stop.',1);
    perform public.add_real_exam_question(c.id,'DL-C','Before changing lanes, you should:','Signal, check mirrors, and check the blind spot','Only look forward','Brake hard','Use the horn instead of signaling','A','A safe lane change requires a signal and a full surroundings check.',2);
    perform public.add_real_exam_question(c.id,'DL-C','When an emergency vehicle approaches with lights and siren, you should:','Speed up','Move safely aside and yield','Stop in the middle of the road','Ignore it','B','Drivers must yield and provide a clear route.',3);
    perform public.add_real_exam_question(c.id,'DL-C','A solid double yellow center line generally means:','Passing is allowed','Passing is prohibited','Parking is allowed','The road is one-way','B','Solid double yellow lines generally prohibit passing.',4);
    perform public.add_real_exam_question(c.id,'DL-C','At a stop sign, a driver must:','Slow only','Come to a complete stop','Stop only at night','Stop only if another vehicle is present','B','A stop sign requires a complete stop.',5);
    perform public.add_real_exam_question(c.id,'DL-C','When following another vehicle, you should:','Leave a safe following distance','Drive as close as possible','Use high beams','Follow on the shoulder','A','A safe following distance gives you reaction time.',6);
    perform public.add_real_exam_question(c.id,'DL-C','A yellow traffic signal means:','Speed up','The signal is changing; stop if safe','Traffic laws no longer apply','Only trucks must stop','B','A yellow signal warns that the light is changing.',7);
    perform public.add_real_exam_question(c.id,'DL-C','If traffic signals are not working, treat the intersection as:','A free pass','An all-way stop unless directed otherwise','A one-way road','Closed to cars','B','A failed signal should be treated as an all-way stop.',8);
    perform public.add_real_exam_question(c.id,'DL-C','When visibility is reduced, drivers should:','Increase speed','Use appropriate lights and reduce speed','Turn off all lights','Follow more closely','B','Reduced visibility requires lower speed and proper lighting.',9);
    perform public.add_real_exam_question(c.id,'DL-C','Before backing up, you should:','Only use the horn','Check mirrors and the area around the vehicle','Accelerate quickly','Open the door while moving','B','Check the full area before reversing.',10);
    perform public.add_real_exam_question(c.id,'DL-C','A driver approaching a pedestrian crossing should:','Yield when required','Honk and continue','Drive around pedestrians','Stop only at night','A','Pedestrians must be protected at crossings.',11);
    perform public.add_real_exam_question(c.id,'DL-C','If a tire suddenly fails, you should:','Brake and turn sharply','Hold the wheel firmly and slow gradually','Accelerate','Exit the vehicle immediately','B','Maintain control and reduce speed smoothly.',12);
    perform public.add_real_exam_question(c.id,'DL-C','Seat belts should be worn by:','Only the driver','Only front passengers','All occupants where available','No one in city traffic','C','Seat belts reduce injury risk.',13);
    perform public.add_real_exam_question(c.id,'DL-C','Using a handheld phone while driving is:','Safe at low speed','Distracting and generally prohibited','Required in traffic','Allowed during turns','B','Handheld phone use is a dangerous distraction.',14);
    perform public.add_real_exam_question(c.id,'DL-C','When entering a highway, you should:','Stop at the end of the ramp','Match traffic speed and merge safely','Drive on the shoulder','Force other vehicles to stop','B','Use the acceleration lane to merge safely.',15);
    perform public.add_real_exam_question(c.id,'DL-C','At an uncontrolled intersection, drivers should:','Proceed without checking','Slow down and yield as required','Always turn left','Use only the horn','B','Uncontrolled intersections require caution.',16);
    perform public.add_real_exam_question(c.id,'DL-C','If another driver is tailgating you, the safest response is to:','Brake-check them','Increase space ahead and let them pass','Race them','Stop in the lane','B','Create space and avoid confrontation.',17);
    perform public.add_real_exam_question(c.id,'DL-C','When parking downhill with a curb, turn the wheels:','Away from the curb','Toward the curb','Straight ahead','Toward traffic','B','Turning toward the curb helps prevent a runaway vehicle.',18);
    perform public.add_real_exam_question(c.id,'DL-C','A broken white line usually separates:','Traffic moving in the same direction','Opposing traffic','Pedestrian areas','Rail lanes','A','Broken white lines commonly separate same-direction lanes.',19);
    perform public.add_real_exam_question(c.id,'DL-C','If an intersection is blocked, you should:','Enter and wait inside it','Wait before entering','Drive onto the sidewalk','Use the wrong lane','B','Do not block an intersection.',20);
    perform public.add_real_exam_question(c.id,'DL-C','Hydroplaning is more likely when:','Roads are wet and speed is too high','The vehicle is parked','Driving slowly on dry pavement','Using turn signals','A','Water can reduce tire contact with the road.',21);
    perform public.add_real_exam_question(c.id,'DL-C','Before opening a door into traffic, check for:','Only parked cars','Vehicles, cyclists, and pedestrians','Street lights only','Nothing','B','Check the travel path before opening the door.',22);
    perform public.add_real_exam_question(c.id,'DL-C','When passing a cyclist, a driver should:','Leave safe space','Drive as close as possible','Honk continuously','Force the cyclist off the road','A','Safe clearance protects vulnerable road users.',23);
    perform public.add_real_exam_question(c.id,'DL-C','Driving while impaired is:','Allowed below the speed limit','Unsafe and prohibited','Allowed with hazard lights','Only prohibited at night','B','Impaired driving is prohibited.',24);
    perform public.add_real_exam_question(c.id,'DL-C','Road signs and markings should be:','Ignored when traffic is light','Obeyed unless directed otherwise by an authorized official','Used only by police','Optional at night','B','Traffic controls apply unless superseded by authorized direction.',25);
    perform public.add_real_exam_question(c.id,'DL-M','A motorcycle is entitled to:','No lane space','A full traffic lane','Only the shoulder','The center line','B','Motorcycles have the right to use a full lane.',1);
    perform public.add_real_exam_question(c.id,'DL-M','The best lane position is:','Always the center','The position that maximizes visibility and safety','Always the shoulder','Between moving cars','B','Lane position should support visibility and escape space.',2);
    perform public.add_real_exam_question(c.id,'DL-M','Motorcycle braking is most effective when:','Only the rear brake is used','Both brakes are applied smoothly','The engine is turned off','The front brake is never used','B','Both brakes provide the strongest controlled stop.',3);
    perform public.add_real_exam_question(c.id,'DL-M','Before entering a turn, a rider should:','Accelerate sharply','Reduce speed and look through the turn','Close their eyes','Use the opposite lane','B','Set a safe speed before the turn.',4);
    perform public.add_real_exam_question(c.id,'DL-M','Loose gravel can:','Increase traction','Reduce traction and steering control','Improve braking','Have no effect','B','Loose surfaces reduce tire grip.',5);
    perform public.add_real_exam_question(c.id,'DL-M','Protective equipment should include:','An approved helmet','Only sunglasses','No gloves or footwear','A phone in hand','A','Protective equipment reduces injury risk.',6);
    perform public.add_real_exam_question(c.id,'DL-M','A rider should avoid staying in another vehicle''s:','Mirror area','Blind spot','Front view','Headlight beam','B','Blind spots reduce visibility to other drivers.',7);
    perform public.add_real_exam_question(c.id,'DL-M','When roads are wet, riders should:','Increase speed','Use smoother controls and allow more distance','Ride on painted lines','Brake harder in turns','B','Wet surfaces reduce traction.',8);
    perform public.add_real_exam_question(c.id,'DL-M','Passengers should:','Sit sideways','Keep feet on passenger rests and follow instructions','Stand while moving','Control the handlebars','B','Passengers must remain stable.',9);
    perform public.add_real_exam_question(c.id,'DL-M','Before carrying a passenger, the rider should:','Ignore tire pressure','Confirm the motorcycle is equipped and adjusted','Remove mirrors','Reduce visibility','B','Passenger operation requires proper setup.',10);
    perform public.add_real_exam_question(c.id,'DL-M','In strong wind, a rider should:','Relax control completely','Maintain a firm, flexible grip and adjust position','Stop looking ahead','Ride beside large trucks','B','Controlled adjustments help manage crosswinds.',11);
    perform public.add_real_exam_question(c.id,'DL-M','Night riding requires:','Less following distance','More caution and reduced speed','No headlights','Dark clothing only','B','Visibility is reduced at night.',12);
    perform public.add_real_exam_question(c.id,'DL-M','Group riders should generally use:','A staggered formation where safe','One wheel directly behind another','The shoulder only','Every lane at once','A','A staggered formation improves spacing.',13);
    perform public.add_real_exam_question(c.id,'DL-M','Emergency swerving may be used when:','Stopping is not possible','You want to pass traffic','You are bored','The road is empty','A','Swerving can avoid a hazard when stopping is not possible.',14);
    perform public.add_real_exam_question(c.id,'DL-M','A rider should scan:','Only the road directly ahead','Well ahead and around for hazards','Only mirrors','Only traffic lights','B','Scanning early provides reaction time.',15);
    perform public.add_real_exam_question(c.id,'DL-M','When crossing railroad tracks, approach them:','At the safest angle possible','Parallel to the rails','At full speed','Without looking','A','A safer crossing angle reduces wheel trapping.',16);
    perform public.add_real_exam_question(c.id,'DL-M','The clutch friction zone helps with:','Low-speed control','High-speed braking only','Turning off lights','Fueling','A','The friction zone improves low-speed control.',17);
    perform public.add_real_exam_question(c.id,'DL-M','A motorcycle following distance should:','Be shorter than a car''s','Allow enough time to react and stop','Be zero in traffic','Only matter at night','B','Safe spacing is essential.',18);
    perform public.add_real_exam_question(c.id,'DL-M','When stopped in traffic, a rider should:','Remain in neutral with no escape path','Keep an escape path in mind','Stand beside the bike','Turn around','B','An escape path can help avoid rear impacts.',19);
    perform public.add_real_exam_question(c.id,'DL-M','A rider''s head and eyes should:','Look through the turn','Look at the front wheel','Stay fixed straight down','Close during braking','A','Look where you intend to travel.',20);
    perform public.add_real_exam_question(c.id,'CDL-A','Before operating a commercial vehicle, the driver should:','Skip inspection','Complete a pre-trip inspection','Only check the radio','Ask another driver to sign in','B','A pre-trip inspection identifies unsafe conditions.',1);
    perform public.add_real_exam_question(c.id,'CDL-A','A heavier vehicle generally requires:','Less stopping distance','More stopping distance','No brakes','A smaller following distance','B','Vehicle weight increases stopping distance.',2);
    perform public.add_real_exam_question(c.id,'CDL-A','Cargo must be:','Unsecured','Properly secured and balanced','Placed only on one side','Held by passengers','B','Secure and balanced cargo reduces loss of control.',3);
    perform public.add_real_exam_question(c.id,'CDL-A','When descending a steep grade, the driver should:','Select a safe gear before descending','Shift to neutral','Turn off the engine','Accelerate continuously','A','Select the correct gear before the descent.',4);
    perform public.add_real_exam_question(c.id,'CDL-A','Commercial drivers must account for:','Vehicle height and clearance','Only paint color','Passenger music','None of the above','A','Height and clearance are critical.',5);
    perform public.add_real_exam_question(c.id,'CDL-A','Air-brake warning devices should be checked:','Only after failure','During the pre-trip inspection','Once per year','Never','B','Warning systems are part of the safety inspection.',6);
    perform public.add_real_exam_question(c.id,'CDL-A','A commercial driver should check mirrors:','Regularly and before maneuvers','Only when parking','Only after a collision','Never on highways','A','Frequent mirror checks maintain awareness.',7);
    perform public.add_real_exam_question(c.id,'CDL-A','Off-tracking occurs when:','Rear wheels follow a shorter path in a turn','The radio loses signal','Cargo is balanced','The vehicle is parked','A','Long vehicles require additional turning space.',8);
    perform public.add_real_exam_question(c.id,'CDL-A','Brake fade is commonly caused by:','Excessive brake use and heat','Cold tires only','Using mirrors','Secured cargo','A','Overheated brakes lose effectiveness.',9);
    perform public.add_real_exam_question(c.id,'CDL-A','Before crossing railway tracks, a driver should:','Race the train','Ensure there is enough space to clear the tracks','Stop on the tracks','Shift gears while crossing','B','Never enter unless the vehicle can fully clear.',10);
    perform public.add_real_exam_question(c.id,'CDL-A','A load should be rechecked:','After beginning the trip and at required intervals','Only after delivery','Never','Only if it falls off','A','Cargo securement must be monitored.',11);
    perform public.add_real_exam_question(c.id,'CDL-A','Following distance should increase with:','Speed and vehicle weight','Music volume','Paint color','Driver seniority','A','Higher speed and weight increase stopping distance.',12);
    perform public.add_real_exam_question(c.id,'CDL-A','During a pre-trip inspection, fluid leaks are:','Normal','A condition that must be checked','Required for cooling','Ignored if small','B','Leaks may indicate unsafe conditions.',13);
    perform public.add_real_exam_question(c.id,'CDL-A','A commercial vehicle should be parked:','Without setting the brake','With parking controls secured','In a travel lane','On railroad tracks','B','The vehicle must be secured.',14);
    perform public.add_real_exam_question(c.id,'CDL-A','The driver is responsible for:','Safe vehicle operation','Only paperwork','Only the route','Nothing once cargo is loaded','A','The driver is responsible for safe operation.',15);
    perform public.add_real_exam_question(c.id,'CDL-A','A long vehicle turning right may need to:','Swing wide while protecting the lane','Use the sidewalk','Stop all traffic manually','Ignore mirrors','A','Wide turns must be controlled safely.',16);
    perform public.add_real_exam_question(c.id,'CDL-A','Before backing a commercial vehicle, the driver should:','Back without checking','Get out and look or use a spotter when possible','Honk only','Turn off mirrors','B','Backing requires full area awareness.',17);
    perform public.add_real_exam_question(c.id,'CDL-A','A low-clearance warning should be:','Ignored','Taken seriously and route changed if needed','Used only by buses','Followed at full speed','B','Clearance limits protect the vehicle and structures.',18);
    perform public.add_real_exam_question(c.id,'CDL-A','Tire condition should be checked for:','Damage, inflation, and tread','Color only','Brand only','Nothing during inspection','A','Tires are critical safety components.',19);
    perform public.add_real_exam_question(c.id,'CDL-A','Driver fatigue should be handled by:','Continuing without rest','Stopping and resting safely','Increasing music volume','Driving faster','B','Fatigue impairs safe operation.',20);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A firearm should always be treated as:','Unloaded','Loaded','A toy','Safe to point anywhere','B','Always treat every firearm as loaded.',1);
    perform public.add_real_exam_question(c.id,'WL-BASIC','The muzzle should be pointed:','At anything nearby','In a safe direction','At another person while checking it','Anywhere when unloaded','B','Maintain safe muzzle direction.',2);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Your finger should remain off the trigger until:','You are ready and legally justified to fire','You pick up the firearm','You enter a building','You begin speaking','A','Trigger discipline prevents negligent discharge.',3);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Before firing, identify:','The target and what is beyond it','Only the weapon model','Only the nearest wall','Nothing if it is dark','A','Know the target and backdrop.',4);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Safe storage should prevent access by:','Authorized owners','Unauthorized persons and children','Law enforcement only','No one','B','Secure storage prevents unauthorized access.',5);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Before cleaning a firearm, you should:','Confirm it is unloaded','Pull the trigger immediately','Point it at another person','Leave ammunition in place','A','Unload and verify the firearm first.',6);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Ammunition should:','Match the firearm''s specified caliber','Be any size available','Be modified without training','Remain in the chamber permanently','A','Only correct ammunition should be used.',7);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A firearm transfer should be:','Documented through the required process','Done anonymously in all cases','Hidden from records','Completed without checking the recipient','A','Transfers must follow required procedures.',8);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Warning shots are:','Always safe','Dangerous and generally not permitted','Required before any use','A substitute for safe handling','B','Fired rounds remain dangerous.',9);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Alcohol or drugs and firearm handling:','Improve judgment','Should never be combined','Are allowed at home','Only matter outdoors','B','Impairment and firearm handling are unsafe.',10);
    perform public.add_real_exam_question(c.id,'WL-BASIC','If a firearm malfunctions, keep it pointed:','In a safe direction','At another person','At the ceiling automatically','Anywhere convenient','A','Maintain safe muzzle direction during a malfunction.',11);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A registered weapon owner is responsible for:','Secure control and lawful use','Only the purchase receipt','Nothing after purchase','Allowing unrestricted access','A','Ownership includes responsibility.',12);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A lost or stolen registered weapon should be:','Ignored','Reported promptly','Replaced without documentation','Sold to another person','B','Prompt reporting allows the record to be flagged.',13);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A revoked weapon licence means the person:','May continue carrying normally','May not exercise the revoked privilege','Automatically receives a new weapon','Can ignore registration rules','B','Revocation removes the licensed privilege.',14);
    perform public.add_real_exam_question(c.id,'WL-BASIC','When handing a firearm to another person, you should:','Point it at them','Open the action and show it is clear','Keep a round chambered','Throw it','B','Verify and demonstrate that the firearm is clear.',15);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A firearm should be stored:','Loaded and unattended','Secured according to community rules','Under a vehicle seat without locking','In public view','B','Secure storage protects the public.',16);
    perform public.add_real_exam_question(c.id,'WL-BASIC','If you are unsure whether a firearm is loaded, you should:','Assume it is loaded','Assume it is empty','Pull the trigger','Point it upward','A','Treat uncertain firearms as loaded.',17);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Use of force must be:','Lawful, necessary, and proportionate','Based on anger','Used to win arguments','Unreported','A','Force must meet legal and policy standards.',18);
    perform public.add_real_exam_question(c.id,'WL-BASIC','Before transporting a firearm, you should:','Follow storage and transport requirements','Hide it without securing it','Give it to any passenger','Remove identifying records','A','Transport must follow applicable rules.',19);
    perform public.add_real_exam_question(c.id,'WL-BASIC','A damaged firearm should be:','Used until it fails','Inspected and repaired by a qualified person','Dropped to test it','Loaded for storage','B','Damaged firearms should not be used.',20);
  end loop;
end $$;

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
  attempt_limit integer;
  attempts_used integer;
begin
  select * into app
  from public.license_applications
  where id=p_application_id;

  if app.id is null then raise exception 'Application not found'; end if;

  if not exists (
    select 1 from public.characters c
    where c.id=app.character_id and c.owner_user_id=auth.uid() and c.is_archived=false
  ) then raise exception 'Application access denied'; end if;

  select written_question_count,max_written_attempts
  into question_limit,attempt_limit
  from public.dmv_settings
  where community_id=app.community_id;

  question_limit := greatest(10,coalesce(question_limit,15));
  attempt_limit := coalesce(attempt_limit,5);

  select count(*) into attempts_used
  from public.license_test_attempts
  where application_id=app.id;

  if attempts_used >= attempt_limit then
    raise exception 'Maximum written-test attempts reached';
  end if;

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
