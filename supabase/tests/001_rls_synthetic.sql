-- Run ONLY against an isolated Supabase test database AFTER the migration.
-- Synthetic Auth rows and all test records are rolled back at the end.
-- This intentionally fails fast if any assertion is false.

begin;

create temporary table kmu_test_anchor (id integer) on commit drop;

create function pg_temp.kmu_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'KMU RLS test failed: %', p_message;
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
  raise exception 'KMU RLS test failed (unexpected success): %', p_message;
end;
$$;

create function pg_temp.kmu_valid_review_payload()
returns jsonb language sql as $$
  select jsonb_build_object(
    'reviewerRole', 'Appraising Officer',
    'reviewerName', 'Synthetic Assessor B',
    'researchReviewConfirmed', true,
    'researchReviewReference', 'Synthetic evidence register',
    'peerScores', (select jsonb_object_agg('peer_' || i, 4)
      from generate_series(1, 13) i),
    'cpdScores', (select jsonb_object_agg('cpd_' || i, 1)
      from generate_series(1, 5) i),
    'disciplinaryDeclaration', jsonb_build_object('penalty', '0'),
    'provisional', jsonb_build_object('verifiedByServer', true)
  );
$$;

-- SQL Editor creates temp helpers as postgres; role-switched assertions need
-- explicit access to the session's temporary schema and these helpers.
do $$
begin
  execute format('grant usage on schema %I to anon, authenticated',
    pg_my_temp_schema()::regnamespace::text);
end;
$$;
grant execute on function pg_temp.kmu_assert(boolean, text),
  pg_temp.kmu_expect_failure(text, text),
  pg_temp.kmu_valid_review_payload()
to anon, authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.synthetic.a@example.invalid', 'not-a-password',
    now(), '{}'::jsonb, '{"display_name":"Synthetic Faculty A"}'::jsonb,
    now(), now()),
  ('22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.synthetic.b@example.invalid', 'not-a-password',
    now(), '{}'::jsonb, '{"display_name":"Synthetic Assessor B"}'::jsonb,
    now(), now()),
  ('33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.synthetic.c@example.invalid', 'not-a-password',
    now(), '{}'::jsonb, '{"display_name":"Synthetic Outsider C"}'::jsonb,
    now(), now()),
  ('44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'kmu.synthetic.admin@example.invalid', 'not-a-password',
    now(), '{}'::jsonb, '{"display_name":"Synthetic Administrator D"}'::jsonb,
    now(), now());

select pg_temp.kmu_assert(
  (select count(*) from public.app_user_profiles
    where id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444')) = 4,
  'signup trigger created all assessee profiles');

insert into public.app_administrators(user_id)
values ('44444444-4444-4444-8444-444444444444');

set local role anon;
select pg_temp.kmu_expect_failure(
  'select * from public.appraisal_cases', 'anonymous case SELECT is denied');
select pg_temp.kmu_expect_failure(
  'select public.grant_assessor(''22222222-2222-4222-8222-222222222222'')',
  'anonymous role grant is denied');
reset role;

select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select pg_temp.kmu_assert(
  (select count(*) from public.app_user_profiles) = 1,
  'faculty sees only own profile before assignment');
select pg_temp.kmu_expect_failure(
  'insert into public.app_administrators(user_id) values
   (''11111111-1111-4111-8111-111111111111'')',
  'faculty cannot self-appoint administrator');
select pg_temp.kmu_expect_failure(
  'select public.grant_assessor(''11111111-1111-4111-8111-111111111111'')',
  'faculty cannot self-appoint assessor');

-- The follow-up employee-profile migration requires a complete, owner-saved
-- personnel profile before a cloud appraisal draft may be created. This is
-- synthetic data and remains inside this transaction.
select public.save_employee_profile(
  'Synthetic Faculty A',
  'Professor',
  'None',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  'BPS');

select public.save_appraisal_draft(
  null, 2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  '{"meta":{"name":"Synthetic Faculty A","desig":"Professor",
    "leadershipRole":"None",
    "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
    "cadre":"BPS"},"provisional":{"ready":true}}'::jsonb);
select set_config('kmu.test.case_id',
  (select id::text from public.appraisal_cases
    where faculty_id = '11111111-1111-4111-8111-111111111111'
      and cycle_year = 2026), true);
select pg_temp.kmu_expect_failure(
  'select public.submit_appraisal_case(
    current_setting(''kmu.test.case_id'')::uuid)',
  'a forged ready flag cannot submit empty evidence');
select pg_temp.kmu_expect_failure(
  'select public.save_appraisal_draft(
    current_setting(''kmu.test.case_id'')::uuid,
    2026, ''Professor'',
    ''KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar'',
    ''{"meta":{"name":"Synthetic Faculty A","desig":"Professor",
       "leadershipRole":"None",
       "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
       "cadre":"BPS"},"values":{"input_pub_high_lead":"NaN"}}''::jsonb)',
  'malformed research count cannot be saved');

select public.save_appraisal_draft(
  current_setting('kmu.test.case_id')::uuid,
  2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  '{
    "schemaVersion":5,
    "meta":{
      "name":"Synthetic Faculty A", "desig":"Professor",
      "leadershipRole":"None",
      "dept":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar", "cadre":"BPS",
      "cycle":"Calendar Year 2026 (01 January – 31 December 2026)",
      "workAssignment":"Synthetic annual assignment"
    },
    "values":{},
    "teachingCourses":[{
      "title":"Synthetic course", "code":"SYN-001",
      "term":"Semester 1", "level":"Undergraduate",
      "specialty":"Synthetic medicine", "theory":"1",
      "practical":"0", "review":"80"
    }],
    "research":{"complete":true,"text":{"input_publications_ref":""}},
    "serviceComplete":true,
    "provisional":{"ready":true,"verifiedByServer":true}
  }'::jsonb);
select pg_temp.kmu_assert(
  (select objective_payload #> '{provisional,verifiedByServer}'
    from public.appraisal_cases
    where id = current_setting('kmu.test.case_id')::uuid) = 'false'::jsonb,
  'server overwrites false verification flag');
select set_config('kmu.test.valid_payload',
  (select objective_payload::text from public.appraisal_cases
    where id = current_setting('kmu.test.case_id')::uuid), true);
select public.save_appraisal_draft(
  current_setting('kmu.test.case_id')::uuid,
  2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  jsonb_set(current_setting('kmu.test.valid_payload')::jsonb,
    '{teachingCourses}',
    (current_setting('kmu.test.valid_payload')::jsonb -> 'teachingCourses')
      || '[{"title":"Incomplete extra course","theory":"0",
           "practical":"0","review":""}]'::jsonb));
select pg_temp.kmu_expect_failure(
  'select public.submit_appraisal_case(
    current_setting(''kmu.test.case_id'')::uuid)',
  'an incomplete extra course cannot be submitted');
select public.save_appraisal_draft(
  current_setting('kmu.test.case_id')::uuid,
  2026, 'Professor',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
  current_setting('kmu.test.valid_payload')::jsonb);
select public.submit_appraisal_case(current_setting('kmu.test.case_id')::uuid);
select pg_temp.kmu_expect_failure(
  'select public.save_appraisal_draft(
    current_setting(''kmu.test.case_id'')::uuid,
    2026, ''Professor'',
    ''KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar'',
    ''{}''::jsonb)',
  'faculty cannot revise submitted evidence');
select pg_temp.kmu_expect_failure(
  'update public.appraisal_cases set objective_payload = ''{}''::jsonb
   where id = current_setting(''kmu.test.case_id'')::uuid',
  'direct case UPDATE is denied');
select pg_temp.kmu_expect_failure(
  'select public.submit_assessor_review(
    current_setting(''kmu.test.case_id'')::uuid,
    ''{"peerScores":{},"cpdScores":{},"provisional":{}}''::jsonb)',
  'faculty cannot self-assess');
reset role;

select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.appraisal_cases) = 0,
  'unassigned assessor cannot read faculty case');
select pg_temp.kmu_assert((select count(*) from public.app_user_profiles) = 1,
  'unassigned assessor cannot browse faculty profiles');
select pg_temp.kmu_expect_failure(
  'select public.submit_assessor_review(
    current_setting(''kmu.test.case_id'')::uuid,
    ''{"peerScores":{},"cpdScores":{},"provisional":{}}''::jsonb)',
  'unassigned assessor cannot review');
reset role;

select set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.app_user_profiles) = 4,
  'administrator can identify accounts for assignment');
select public.grant_assessor('22222222-2222-4222-8222-222222222222');
select public.grant_assessor('33333333-3333-4333-8333-333333333333');
select public.assign_assessor(
  current_setting('kmu.test.case_id')::uuid,
  '22222222-2222-4222-8222-222222222222');
select pg_temp.kmu_expect_failure(
  'select public.assign_assessor(
    current_setting(''kmu.test.case_id'')::uuid,
    ''33333333-3333-4333-8333-333333333333'')',
  'only one active assessor is permitted');
reset role;

select set_config('request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.appraisal_cases) = 0,
  'other faculty cannot read assigned case');
select pg_temp.kmu_assert((select count(*) from public.assessor_assignments) = 0,
  'other faculty cannot see assignment');
reset role;

select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.appraisal_cases) = 1,
  'active assigned assessor can read submitted case');
select pg_temp.kmu_assert((select count(*) from public.app_user_profiles) = 2,
  'active assigned assessor can read own and assigned faculty profile');
select pg_temp.kmu_expect_failure(
  'select public.submit_assessor_review(
    current_setting(''kmu.test.case_id'')::uuid,
    ''{"source":"forged minimal review"}''::jsonb)',
  'a forged minimal subjective payload cannot complete review');
select public.submit_assessor_review(
  current_setting('kmu.test.case_id')::uuid,
  pg_temp.kmu_valid_review_payload());
select pg_temp.kmu_assert(
  (select subjective_payload #> '{provisional,verifiedByServer}'
    from public.assessor_reviews
    where case_id = current_setting('kmu.test.case_id')::uuid) = 'false'::jsonb,
  'server marks subjective calculation unverified');
select pg_temp.kmu_expect_failure(
  'select public.submit_assessor_review(
    current_setting(''kmu.test.case_id'')::uuid,
    pg_temp.kmu_valid_review_payload())',
  'completed review cannot be overwritten');
reset role;

select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.assessor_reviews) = 1,
  'faculty can read completed review of own case');
reset role;

select set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select pg_temp.kmu_assert(
  public.revoke_assessor('22222222-2222-4222-8222-222222222222'),
  'admin can revoke assessor role');
select pg_temp.kmu_assert(
  (select count(*) from public.assessor_assignments
    where case_id = current_setting('kmu.test.case_id')::uuid
      and revoked_at is not null) = 1,
  'revocation preserves and closes assignment history');
reset role;

select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.appraisal_cases) = 0,
  'revoked assessor loses faculty case access');
select pg_temp.kmu_assert((select count(*) from public.assessor_reviews) = 0,
  'revoked assessor loses completed review access');
select pg_temp.kmu_assert((select count(*) from public.assessor_assignments) = 0,
  'revoked assessor loses queue access');
reset role;

-- Test emergency administrator revocation without deleting audit history.
select set_config('request.jwt.claim.sub', '', true);
update public.app_administrators set revoked_at = now()
where user_id = '44444444-4444-4444-8444-444444444444';
select set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select pg_temp.kmu_assert((select count(*) from public.app_administrators) = 0,
  'revoked administrator loses role visibility');
select pg_temp.kmu_expect_failure(
  'select public.grant_assessor(''33333333-3333-4333-8333-333333333333'')',
  'revoked administrator loses grant power');
reset role;

rollback;
