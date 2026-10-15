-- Run ONLY after both pilot migrations in an isolated Supabase test database.
-- Every Auth account and profile in this test is synthetic and rolled back.
-- A failing assertion aborts the transaction; do not COMMIT this file.

begin;

create function pg_temp.kmu_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'KMU employee-profile test failed: %', p_message;
  end if;
end;
$$;

create function pg_temp.kmu_expect_failure(p_sql text, p_message text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'KMU employee-profile test unexpectedly succeeded: %', p_message;
end;
$$;

create function pg_temp.kmu_expect_failure_like(
  p_sql text, p_expected_fragment text, p_message text)
returns void language plpgsql as $$
declare
  v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_error = message_text;
    if position(p_expected_fragment in v_error) = 0 then
      raise exception 'KMU employee-profile test failed: %; expected error containing %, got %',
        p_message, p_expected_fragment, v_error;
    end if;
    return;
  end;
  raise exception 'KMU employee-profile test unexpectedly succeeded: %', p_message;
end;
$$;

do $$
begin
  execute format('grant usage on schema %I to anon, authenticated',
    pg_my_temp_schema()::regnamespace::text);
end;
$$;
grant execute on function pg_temp.kmu_assert(boolean, text),
  pg_temp.kmu_expect_failure(text, text),
  pg_temp.kmu_expect_failure_like(text, text, text) to anon, authenticated;

select pg_temp.kmu_assert(
  to_regprocedure('public.save_employee_profile(text,text,text,text,text)')
    is not null,
  'employee-profile migration and public RPC are installed');

-- A and B sign up with different self-declared job profiles. C deliberately
-- remains unconfirmed. A's malicious role metadata must never grant access.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.profile.a@example.invalid', 'not-a-password',
    now(), '{}'::jsonb,
    '{"display_name":"Synthetic Professor A",
      "substantive_designation":"Professor", "leadership_role":"None",
      "institute":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "service_cadre":"BPS", "role":"administrator", "is_admin":true}'::jsonb,
    now(), now()),
  ('66666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.profile.b@example.invalid', 'not-a-password',
    now(), '{}'::jsonb,
    '{"display_name":"Synthetic Lecturer B",
      "substantive_designation":"Lecturer", "leadership_role":"None",
      "institute":"KMU Institute of Pharmaceutical Sciences (KMU-IPS), Peshawar",
      "service_cadre":"TTS"}'::jsonb,
    now(), now()),
  ('77777777-7777-4777-8777-777777777777',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.profile.unconfirmed@example.invalid', 'not-a-password',
    null, '{}'::jsonb,
    '{"display_name":"Synthetic Unconfirmed C",
      "substantive_designation":"Assistant Professor", "leadership_role":"None",
      "institute":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "service_cadre":"Fixed Pay"}'::jsonb,
    now(), now());

select pg_temp.kmu_assert(
  (select display_name = 'Synthetic Professor A'
      and substantive_designation = 'Professor'
      and leadership_role = 'None'
      and institute = 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar'
      and service_cadre = 'BPS'
    from public.app_user_profiles
    where id = '55555555-5555-4555-8555-555555555555'),
  'signup metadata copies the five permitted employee fields');
select pg_temp.kmu_assert(
  not exists (select 1 from public.app_administrators
      where user_id = '55555555-5555-4555-8555-555555555555')
    and not exists (select 1 from public.app_assessors
      where user_id = '55555555-5555-4555-8555-555555555555'),
  'signup metadata cannot grant administrator or assessor authority');

-- Bad catalog values cannot enter through the signup trigger either.
select pg_temp.kmu_expect_failure($sql$
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '88888888-8888-4888-8888-888888888888',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.profile.invalid@example.invalid', 'not-a-password',
    now(), '{}'::jsonb,
    '{"display_name":"Synthetic Invalid", "substantive_designation":"Professor BPS"}'::jsonb,
    now(), now())
$sql$, 'invalid designation metadata is rejected');
select pg_temp.kmu_assert(
  not exists (select 1 from auth.users
    where id = '88888888-8888-4888-8888-888888888888'),
  'failed signup leaves no Auth user');

set local role anon;
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Anonymous', 'Professor', 'None',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS')$$,
  'anonymous visitor cannot save a profile');
select pg_temp.kmu_expect_failure(
  'select * from public.app_user_profiles',
  'anonymous visitor cannot browse employee profiles');
reset role;

select set_config('request.jwt.claim.sub',
  '77777777-7777-4777-8777-777777777777', true);
set local role authenticated;
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Unconfirmed', 'Assistant Professor', 'None',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'Fixed Pay')$$,
  'unconfirmed Auth identity cannot save a profile');
select pg_temp.kmu_assert(
  (select count(*) from public.app_user_profiles) = 0,
  'unconfirmed Auth identity cannot read even its stored profile');
reset role;

select set_config('request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555', true);
set local role authenticated;
select pg_temp.kmu_assert(
  (select count(*) from public.app_user_profiles) = 1,
  'faculty A reads only own profile');
select pg_temp.kmu_expect_failure(
  $$update public.app_user_profiles set display_name = 'Changed B'
    where id = '66666666-6666-4666-8666-666666666666'$$,
  'direct cross-user profile update is forbidden');
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Synthetic Professor A', 'Professor BPS', 'None',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS')$$,
  'designation must match the pilot catalog');
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Synthetic Professor A', 'Professor', 'Dean',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS')$$,
  'leadership appointment must match the pilot catalog');
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Synthetic Professor A', 'Professor', 'None',
    'Invented KMU Unit', 'BPS')$$,
  'institute must match the pilot catalog');
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('Synthetic Professor A', 'Professor', 'None',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS-20')$$,
  'service cadre must be BPS, TTS or Fixed Pay');
select pg_temp.kmu_expect_failure(
  $$select public.save_employee_profile('', 'Professor', 'None',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS')$$,
  'name cannot be blank');

-- A confirmed owner can correct the saved profile, but cannot choose another
-- user's UID: the RPC has no p_user_id and derives ownership from the JWT.
select public.save_employee_profile(
  'Synthetic Professor A', 'Professor', 'None',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS');

-- A dossier may not supply an identity different from A's stored profile.
select pg_temp.kmu_expect_failure($sql$
  select public.save_appraisal_draft(null, 2026, 'Associate Professor',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    '{"meta":{"name":"Synthetic Professor A","desig":"Professor",
      "leadershipRole":"None",
      "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "cadre":"BPS"}}'::jsonb)
$sql$, 'case designation argument cannot diverge from saved profile');
select pg_temp.kmu_expect_failure($sql$
  select public.save_appraisal_draft(null, 2026, 'Professor',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    '{"meta":{"name":"Other Faculty","desig":"Professor",
      "leadershipRole":"None",
      "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "cadre":"BPS"}}'::jsonb)
$sql$, 'forged dossier name cannot diverge from saved profile');
select pg_temp.kmu_expect_failure($sql$
  select public.save_appraisal_draft(null, 2026, 'Professor',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    '{"meta":{"name":"Synthetic Professor A","desig":"Professor",
      "leadershipRole":"None", "dept":"Invented KMU Unit", "cadre":"BPS"}}'::jsonb)
$sql$, 'forged dossier institute cannot diverge from saved profile');
select pg_temp.kmu_expect_failure($sql$
  select public.save_appraisal_draft(null, 2026, 'Professor',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    '{"meta":{"name":"Synthetic Professor A","desig":"Professor",
      "leadershipRole":"None",
      "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "cadre":"TTS"}}'::jsonb)
$sql$, 'forged dossier service cadre cannot diverge from saved profile');
select pg_temp.kmu_assert(
  (select count(*) from public.appraisal_cases) = 0,
  'rejected mismatches create no case');

-- Valid objective evidence and stored identity become the 2026 snapshot.
select public.save_appraisal_draft(
  null, 2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  '{
    "schemaVersion":5, "profile":"Balanced Profile",
    "meta":{
      "name":"Synthetic Professor A", "desig":"Professor",
      "leadershipRole":"None",
      "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
      "cadre":"BPS", "cycle":"Calendar Year 2026 (01 January – 31 December 2026)",
      "workAssignment":"Synthetic annual assignment"
    },
    "values":{},
    "teachingCourses":[{
      "title":"Synthetic course", "code":"SYN-101", "term":"Semester 1",
      "level":"Undergraduate", "specialty":"Synthetic medicine",
      "theory":"1", "practical":"0", "review":"80"
    }],
    "research":{"complete":true,"text":{"input_publications_ref":""}},
    "serviceComplete":true,
    "provisional":{"ready":true,"verifiedByServer":true}
  }'::jsonb);
select set_config('kmu.profile.test_case_id',
  (select id::text from public.appraisal_cases
    where faculty_id = '55555555-5555-4555-8555-555555555555'
      and cycle_year = 2026), true);

-- NULL means "new case", not "resume whatever exists for this year". In
-- particular, a fresh browser form cannot overwrite a saved year dossier.
select set_config('kmu.profile.original_payload',
  (select objective_payload::text from public.appraisal_cases
    where id = current_setting('kmu.profile.test_case_id')::uuid), true);
select pg_temp.kmu_expect_failure_like($sql$
  select public.save_appraisal_draft(
    null, 2026, 'Professor',
    'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    jsonb_set(current_setting('kmu.profile.original_payload')::jsonb,
      '{meta,workAssignment}', to_jsonb('Attempted overwrite'::text)))
$sql$, 'open it from your Employee Portal',
  'NULL case ID cannot resume or overwrite an existing year case');
select pg_temp.kmu_assert(
  (select count(*) = 1 and
      min(objective_payload #>> '{meta,workAssignment}') =
        'Synthetic annual assignment'
    from public.appraisal_cases
    where faculty_id = '55555555-5555-4555-8555-555555555555'
      and cycle_year = 2026),
  'failed NULL-ID save leaves the existing dossier unchanged');

-- Explicitly opening its ID must still permit normal draft edits.
select public.save_appraisal_draft(
  current_setting('kmu.profile.test_case_id')::uuid, 2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  jsonb_set(current_setting('kmu.profile.original_payload')::jsonb,
    '{meta,workAssignment}', to_jsonb('Explicit draft update'::text)));
select pg_temp.kmu_assert(
  (select objective_payload #>> '{meta,workAssignment}' =
      'Explicit draft update'
    from public.appraisal_cases
    where id = current_setting('kmu.profile.test_case_id')::uuid),
  'specific case ID can still update its own draft');

-- A stale draft may not be submitted after the owner's role/profile changes;
-- explicitly restore the saved identity before the final submission.
select public.save_employee_profile(
  'Synthetic Professor A', 'Professor', 'Dean of Faculty',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS');
select pg_temp.kmu_expect_failure(
  $$select public.submit_appraisal_case(
    current_setting('kmu.profile.test_case_id')::uuid)$$,
  'changed profile blocks direct submission of a stale draft');
select public.save_employee_profile(
  'Synthetic Professor A', 'Professor', 'None',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS');
select public.submit_appraisal_case(
  current_setting('kmu.profile.test_case_id')::uuid);
select pg_temp.kmu_assert(
  (select status = 'submitted' from public.appraisal_cases
    where id = current_setting('kmu.profile.test_case_id')::uuid),
  'valid profile-backed case can be submitted');

select public.save_employee_profile(
  'Synthetic Associate A', 'Associate Professor', 'None',
  'KMU Institute of Pharmaceutical Sciences (KMU-IPS), Peshawar', 'TTS');
select pg_temp.kmu_assert(
  (select designation = 'Professor'
      and institute = 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar'
      and objective_payload #>> '{meta,name}' = 'Synthetic Professor A'
      and objective_payload #>> '{meta,desig}' = 'Professor'
      and objective_payload #>> '{meta,dept}' =
        'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar'
      and objective_payload #>> '{meta,cadre}' = 'BPS'
    from public.appraisal_cases
    where id = current_setting('kmu.profile.test_case_id')::uuid),
  'later employee-profile correction does not rewrite a submitted case');
reset role;
select pg_temp.kmu_assert(
  (select display_name = 'Synthetic Lecturer B'
    from public.app_user_profiles
    where id = '66666666-6666-4666-8666-666666666666'),
  'saving A profile cannot modify B');

select set_config('request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666', true);
set local role authenticated;
select pg_temp.kmu_assert(
  (select count(*) from public.app_user_profiles) = 1
    and (select count(*) from public.appraisal_cases) = 0,
  'unassigned B cannot read A profile or dossier');
select pg_temp.kmu_expect_failure(
  $$select public.grant_assessor('66666666-6666-4666-8666-666666666666')$$,
  'employee profile never confers assessor-grant authority');
select pg_temp.kmu_expect_failure($sql$
  select public.save_appraisal_draft(
    current_setting('kmu.profile.test_case_id')::uuid, 2026, 'Lecturer',
    'KMU Institute of Pharmaceutical Sciences (KMU-IPS), Peshawar',
    '{"meta":{"name":"Synthetic Lecturer B","desig":"Lecturer",
      "leadershipRole":"None",
      "dept":"KMU Institute of Pharmaceutical Sciences (KMU-IPS), Peshawar",
      "cadre":"TTS"}}'::jsonb)
$sql$, 'B cannot overwrite A case even with B own valid profile');
reset role;

rollback;
