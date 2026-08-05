-- UltimateCAD Milestone 1.5.1
-- Real written license tests and attempt scoring.

create table if not exists public.license_test_questions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  license_type_id uuid not null references public.license_types(id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.license_test_attempts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  application_id uuid not null references public.license_applications(id) on delete cascade,
  license_test_id uuid not null references public.license_tests(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2) not null,
  passed boolean not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  unique (license_test_id, attempt_number)
);

create index if not exists license_test_questions_type_idx
  on public.license_test_questions(license_type_id, active, sort_order);

create index if not exists license_test_attempts_application_idx
  on public.license_test_attempts(application_id, completed_at desc);

alter table public.license_test_questions enable row level security;
alter table public.license_test_attempts enable row level security;

create policy "members read active test questions"
on public.license_test_questions
for select to authenticated
using (
  active = true
  and public.is_active_community_member(community_id)
);

create policy "owners read own test attempts"
on public.license_test_attempts
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_permission(community_id, 'dmv.view')
);

create or replace function public.seed_default_license_questions(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dl_c uuid;
  dl_m uuid;
  cdl_a uuid;
  wl uuid;
begin
  select id into dl_c from public.license_types where community_id=p_community_id and code='DL-C';
  select id into dl_m from public.license_types where community_id=p_community_id and code='DL-M';
  select id into cdl_a from public.license_types where community_id=p_community_id and code='CDL-A';
  select id into wl from public.license_types where community_id=p_community_id and code='WL-BASIC';

  if dl_c is not null and not exists (
    select 1 from public.license_test_questions where license_type_id=dl_c
  ) then
    insert into public.license_test_questions
      (community_id,license_type_id,question,option_a,option_b,option_c,option_d,correct_option,explanation,sort_order)
    values
      (p_community_id,dl_c,'At a red traffic light, a driver must:','Slow down and proceed','Stop and wait for a permitted signal','Honk before crossing','Turn left immediately','B','A red light requires a complete stop until movement is permitted.',1),
      (p_community_id,dl_c,'When an emergency vehicle approaches with lights and siren, you should:','Speed up','Stop in the travel lane','Move safely to the side and yield','Ignore it','C','Drivers must yield and provide a clear route.',2),
      (p_community_id,dl_c,'A solid double yellow line generally means:','Passing is allowed both ways','Passing is prohibited','Parking is allowed','The road is closed','B','Solid center lines prohibit passing unless community law states otherwise.',3),
      (p_community_id,dl_c,'Before changing lanes, you should:','Only check the mirror','Signal, check mirrors, and check the blind spot','Brake suddenly','Use the horn only','B','A safe lane change requires a signal and a full surroundings check.',4),
      (p_community_id,dl_c,'Driving while impaired is:','Allowed below the speed limit','Allowed with hazard lights','Unsafe and prohibited','Only prohibited at night','C','Impaired driving is prohibited.',5);

  end if;

  if dl_m is not null and not exists (
    select 1 from public.license_test_questions where license_type_id=dl_m
  ) then
    insert into public.license_test_questions
      (community_id,license_type_id,question,option_a,option_b,option_c,option_d,correct_option,explanation,sort_order)
    values
      (p_community_id,dl_m,'Motorcycle riders should maintain:','No following distance','A safe following distance','One wheel on the shoulder','Maximum speed at all times','B','Additional distance gives the rider more time to react.',1),
      (p_community_id,dl_m,'Before entering a turn, a rider should:','Accelerate sharply','Reduce speed and look through the turn','Close their eyes','Use the opposite lane','B','Set a safe speed before the turn and look where you intend to travel.',2),
      (p_community_id,dl_m,'Protective equipment should include:','An approved helmet','Only sunglasses','No gloves or footwear','A phone in hand','A','Protective equipment reduces injury risk.',3),
      (p_community_id,dl_m,'A motorcycle is entitled to:','No lane space','A full traffic lane','Only the shoulder','The center line','B','Motorcycles have the right to use a full lane.',4),
      (p_community_id,dl_m,'When roads are wet, riders should:','Increase speed','Reduce following distance','Use smoother controls and allow more distance','Ride on painted lines','C','Wet surfaces reduce traction.',5);
  end if;

  if cdl_a is not null and not exists (
    select 1 from public.license_test_questions where license_type_id=cdl_a
  ) then
    insert into public.license_test_questions
      (community_id,license_type_id,question,option_a,option_b,option_c,option_d,correct_option,explanation,sort_order)
    values
      (p_community_id,cdl_a,'Before operating a commercial vehicle, the driver should:','Skip inspection','Complete a pre-trip inspection','Only check the radio','Ask another driver to sign in','B','A pre-trip inspection identifies unsafe conditions.',1),
      (p_community_id,cdl_a,'A heavier vehicle generally requires:','Less stopping distance','More stopping distance','No brakes','A smaller following distance','B','Vehicle weight increases stopping distance.',2),
      (p_community_id,cdl_a,'Cargo must be:','Unsecured','Properly secured and balanced','Placed only on one side','Held by passengers','B','Secure and balanced cargo reduces loss of control.',3),
      (p_community_id,cdl_a,'When descending a steep grade, the driver should:','Select a safe gear before descending','Shift to neutral','Turn off the engine','Accelerate continuously','A','Select the correct gear before the descent.',4),
      (p_community_id,cdl_a,'Commercial drivers must account for:','Vehicle height and clearance','Only paint color','Passenger music','None of the above','A','Height and clearance are critical for safe routing.',5);
  end if;

  if wl is not null and not exists (
    select 1 from public.license_test_questions where license_type_id=wl
  ) then
    insert into public.license_test_questions
      (community_id,license_type_id,question,option_a,option_b,option_c,option_d,correct_option,explanation,sort_order)
    values
      (p_community_id,wl,'A firearm should always be treated as:','Unloaded','Loaded','A toy','Safe to point anywhere','B','Always treat every firearm as loaded.',1),
      (p_community_id,wl,'The muzzle should be pointed:','At anything nearby','In a safe direction','At the ground in every situation','At another person while checking it','B','Maintain a safe muzzle direction.',2),
      (p_community_id,wl,'Your finger should remain off the trigger until:','You are ready and legally justified to fire','You pick up the firearm','You enter a building','You begin speaking','A','Trigger discipline prevents negligent discharge.',3),
      (p_community_id,wl,'A weapon owner should know:','Their target and what is beyond it','Only the weapon color','Nothing about the surroundings','Only where the ammunition was bought','A','Know the target, surroundings, and backdrop.',4),
      (p_community_id,wl,'A lost or stolen registered weapon should be:','Ignored','Reported promptly','Replaced without documentation','Sold to another person','B','Prompt reporting allows the record to be flagged.',5);
  end if;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.communities loop
    perform public.seed_default_license_questions(c.id);
  end loop;
end $$;

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
  final_score numeric(5,2);
  did_pass boolean;
begin
  select * into app
  from public.license_applications
  where id=p_application_id;

  if app.id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1
    from public.characters c
    where c.id=app.character_id
      and c.owner_user_id=auth.uid()
      and c.is_archived=false
  ) then
    raise exception 'This application does not belong to your active account';
  end if;

  select * into test_row
  from public.license_tests
  where application_id=app.id and test_type='written'
  for update;

  if test_row.id is null then
    raise exception 'This application does not require a written test';
  end if;

  if test_row.status='passed' then
    raise exception 'Written test already passed';
  end if;

  select count(*),
         count(*) filter (
           where upper(coalesce(p_answers ->> q.id::text, '')) = q.correct_option
         )
  into total_count, correct_count
  from public.license_test_questions q
  where q.community_id=app.community_id
    and q.license_type_id=app.license_type_id
    and q.active=true;

  if total_count=0 then
    raise exception 'No written test questions are configured';
  end if;

  final_score := round((correct_count::numeric / total_count::numeric) * 100, 2);
  did_pass := final_score >= 80;

  select coalesce(max(attempt_number),0)+1
  into attempt_no
  from public.license_test_attempts
  where license_test_id=test_row.id;

  insert into public.license_test_attempts(
    community_id,application_id,license_test_id,character_id,user_id,
    attempt_number,answers,score,passed
  )
  values(
    app.community_id,app.id,test_row.id,app.character_id,auth.uid(),
    attempt_no,p_answers,final_score,did_pass
  );

  update public.license_tests
  set status=case when did_pass then 'passed' else 'failed' end,
      score=final_score,
      completed_at=now(),
      examiner_user_id=null,
      notes=case when did_pass then 'Completed through the civilian written test portal.'
                 else 'Written test failed. A retake is required.' end
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
  )
  values(
    app.community_id,app.character_id,auth.uid(),'license.test',
    case when did_pass then 'Written license test passed' else 'Written license test failed' end,
    'Score: '||final_score::text||'%.'
  );

  return query select final_score, did_pass;
end;
$$;

grant execute on function public.submit_written_license_test(uuid,jsonb) to authenticated;
