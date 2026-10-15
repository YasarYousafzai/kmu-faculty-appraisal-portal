-- Add a self-declared employee profile to the controlled KMU pilot.
-- Apply AFTER 202610140001_kmu_pilot_accounts.sql. This is not an HR-verified
-- service record, appointment notification, or approval of a reporting line.
-- Existing accounts remain nullable/incomplete until their owners update them.

begin;

alter table public.app_user_profiles
  add column substantive_designation text
    references public.pilot_designation_options(name)
    check (char_length(substantive_designation) between 1 and 160),
  add column leadership_role text
    check (leadership_role in (
      'None', 'Dean of Faculty', 'Director / Principal / Head of Institute',
      'Chairperson / Head of Department'
    )),
  add column institute text
    references public.pilot_unit_options(name)
    check (char_length(institute) between 1 and 240),
  add column service_cadre text
    check (service_cadre in ('BPS', 'TTS', 'Fixed Pay')),
  add column profile_updated_at timestamptz not null default now();

-- Signup metadata is user supplied. Copy only the five profile keys named
-- below and reject values outside the pilot catalogs; never copy any role,
-- assignment, appraisal score, or privileged authorization from metadata.
create or replace function kmu_internal.handle_auth_user_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb;
  v_designation text;
  v_leadership text;
  v_institute text;
  v_cadre text;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_designation := nullif(btrim(v_meta ->> 'substantive_designation'), '');
  v_leadership := nullif(btrim(v_meta ->> 'leadership_role'), '');
  v_institute := nullif(btrim(v_meta ->> 'institute'), '');
  v_cadre := nullif(btrim(v_meta ->> 'service_cadre'), '');

  if v_designation is not null and not exists (
    select 1 from public.pilot_designation_options d where d.name = v_designation
  ) then
    raise exception 'Select a current pilot substantive designation'
      using errcode = '22023';
  end if;
  if v_leadership is not null and v_leadership not in (
    'None', 'Dean of Faculty', 'Director / Principal / Head of Institute',
    'Chairperson / Head of Department'
  ) then
    raise exception 'Select a current pilot additional leadership appointment'
      using errcode = '22023';
  end if;
  if v_institute is not null and not exists (
    select 1 from public.pilot_unit_options i where i.name = v_institute
  ) then
    raise exception 'Select a current pilot institute or unit'
      using errcode = '22023';
  end if;
  if v_cadre is not null and v_cadre not in ('BPS', 'TTS', 'Fixed Pay') then
    raise exception 'Select BPS, TTS, or Fixed Pay'
      using errcode = '22023';
  end if;

  insert into public.app_user_profiles (
    id, display_name, login_email, substantive_designation,
    leadership_role, institute, service_cadre
  ) values (
    new.id,
    left(coalesce(nullif(btrim(v_meta ->> 'display_name'), ''),
      nullif(btrim(v_meta ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)), 160),
    left(coalesce(new.email, ''), 320),
    v_designation, v_leadership, v_institute, v_cadre
  );
  return new;
end;
$$;

-- Owners may correct their own self-declared profile after email confirmation.
-- Direct client UPDATE remains revoked. A corrected profile does not rewrite
-- any earlier case or any submitted evidence snapshot.
create function kmu_internal.save_employee_profile(
  p_display_name text, p_substantive_designation text,
  p_leadership_role text, p_institute text, p_service_cadre text
)
returns public.app_user_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_profile public.app_user_profiles;
begin
  if v_actor is null then
    raise exception 'Confirmed sign-in required' using errcode = '42501';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 160
    or p_substantive_designation is null
    or not exists (select 1 from public.pilot_designation_options d
      where d.name = p_substantive_designation)
    or p_leadership_role is null or p_leadership_role not in (
      'None', 'Dean of Faculty', 'Director / Principal / Head of Institute',
      'Chairperson / Head of Department'
    )
    or p_institute is null
    or not exists (select 1 from public.pilot_unit_options i
      where i.name = p_institute)
    or p_service_cadre is null
    or p_service_cadre not in ('BPS', 'TTS', 'Fixed Pay')
  then
    raise exception 'Complete the self-declared employee profile using current pilot options'
      using errcode = '22023';
  end if;

  update public.app_user_profiles p
  set display_name = btrim(p_display_name),
    substantive_designation = p_substantive_designation,
    leadership_role = p_leadership_role,
    institute = p_institute,
    service_cadre = p_service_cadre,
    profile_updated_at = now()
  where p.id = v_actor
  returning * into v_profile;
  if not found then
    raise exception 'Employee profile not found for this account'
      using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

create function public.save_employee_profile(
  p_display_name text, p_substantive_designation text,
  p_leadership_role text, p_institute text, p_service_cadre text
)
returns public.app_user_profiles
language sql security invoker set search_path = '' as $$
  select kmu_internal.save_employee_profile(
    p_display_name, p_substantive_designation, p_leadership_role,
    p_institute, p_service_cadre);
$$;

-- Keep the existing public RPC signature for the deployed client. A case's
-- identity fields must match the current confirmed user's profile at SAVE;
-- an employee may edit the profile later, but submitted case snapshots remain
-- immutable under kmu_internal.guard_case_transition().
create or replace function kmu_internal.save_appraisal_draft(
  p_case_id uuid, p_cycle_year integer, p_designation text,
  p_institute text, p_objective_payload jsonb
)
returns public.appraisal_cases
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_profile public.app_user_profiles;
  v_case public.appraisal_cases;
  v_new boolean := false;
begin
  if v_actor is null then
    raise exception 'Confirmed sign-in required' using errcode = '42501';
  end if;
  if p_cycle_year is null or p_cycle_year not in (2025, 2026, 2027)
    or p_designation is null or char_length(btrim(p_designation)) not between 1 and 160
    or p_institute is null or char_length(btrim(p_institute)) not between 1 and 240 then
    raise exception 'Cycle year, designation and institute are required'
      using errcode = '22023';
  end if;
  perform kmu_internal.validate_objective_payload(p_objective_payload);

  -- SHARE serializes a concurrent profile correction with this draft save.
  select * into v_profile from public.app_user_profiles p
  where p.id = v_actor for share;
  if not found or coalesce(btrim(v_profile.display_name), '') = ''
    or v_profile.substantive_designation is null
    or v_profile.leadership_role is null
    or v_profile.institute is null
    or v_profile.service_cadre is null then
    raise exception 'Complete your employee registration profile before saving an appraisal'
      using errcode = '22023';
  end if;
  if p_designation is distinct from v_profile.substantive_designation
    or p_institute is distinct from v_profile.institute
    or p_objective_payload #>> '{meta,name}' is distinct from v_profile.display_name
    or p_objective_payload #>> '{meta,desig}' is distinct from v_profile.substantive_designation
    or p_objective_payload #>> '{meta,leadershipRole}' is distinct from v_profile.leadership_role
    or p_objective_payload #>> '{meta,dept}' is distinct from v_profile.institute
    or p_objective_payload #>> '{meta,cadre}' is distinct from v_profile.service_cadre
  then
    raise exception 'Appraisal identity does not match your saved employee profile; refresh it before saving'
      using errcode = '22023';
  end if;

  if p_objective_payload ? 'provisional' then
    p_objective_payload := jsonb_set(
      p_objective_payload, '{provisional,verifiedByServer}', 'false'::jsonb, true);
  end if;

  if p_case_id is null then
    select * into v_case from public.appraisal_cases c
    where c.faculty_id = v_actor and c.cycle_year = p_cycle_year for update;
    if found then
      raise exception 'An appraisal for this year already exists; open it from your Employee Portal to view it or continue its draft'
        using errcode = '22023';
    end if;
    begin
      insert into public.appraisal_cases
        (faculty_id, cycle_year, designation, institute, objective_payload)
      values (v_actor, p_cycle_year, p_designation,
        p_institute, p_objective_payload)
      returning * into v_case;
    exception when unique_violation then
      -- A simultaneous first-save request may have created the year case
      -- after the lookup. Never convert NULL into an implicit update.
      raise exception 'An appraisal for this year already exists; open it from your Employee Portal to view it or continue its draft'
        using errcode = '22023';
    end;
    v_new := true;
  else
    select * into v_case from public.appraisal_cases c
    where c.id = p_case_id for update;
    if not found or v_case.faculty_id <> v_actor then
      raise exception 'Appraisal case not found for this faculty account'
        using errcode = '42501';
    end if;
  end if;

  if v_case.faculty_id <> v_actor then
    raise exception 'Only the faculty owner may save this draft'
      using errcode = '42501';
  end if;
  if v_case.status <> 'draft' then
    raise exception 'Submitted faculty evidence is immutable'
      using errcode = '42501';
  end if;
  if v_case.cycle_year <> p_cycle_year then
    raise exception 'Cannot move a case to another appraisal year'
      using errcode = '22023';
  end if;

  if not v_new then
    update public.appraisal_cases c
    set designation = p_designation, institute = p_institute,
      objective_payload = p_objective_payload
    where c.id = v_case.id
    returning * into v_case;
  end if;
  insert into public.appraisal_events (case_id, actor_id, event_type)
  values (v_case.id, v_actor, case when v_new then 'case_created' else 'draft_saved' end);
  return v_case;
end;
$$;

-- A direct call to submit_appraisal_case must not bypass the profile match
-- checked at the last draft save. This fires only on draft -> submitted, so
-- later profile corrections do not mutate or revalidate historical cases.
create function kmu_internal.guard_profile_on_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.app_user_profiles;
begin
  select * into v_profile from public.app_user_profiles p
  where p.id = new.faculty_id for share;
  if not found or coalesce(btrim(v_profile.display_name), '') = ''
    or v_profile.substantive_designation is null
    or v_profile.leadership_role is null
    or v_profile.institute is null
    or v_profile.service_cadre is null then
    raise exception 'Complete your employee registration profile before submitting an appraisal'
      using errcode = '22023';
  end if;
  if new.designation is distinct from v_profile.substantive_designation
    or new.institute is distinct from v_profile.institute
    or new.objective_payload #>> '{meta,name}' is distinct from v_profile.display_name
    or new.objective_payload #>> '{meta,desig}' is distinct from v_profile.substantive_designation
    or new.objective_payload #>> '{meta,leadershipRole}' is distinct from v_profile.leadership_role
    or new.objective_payload #>> '{meta,dept}' is distinct from v_profile.institute
    or new.objective_payload #>> '{meta,cadre}' is distinct from v_profile.service_cadre
  then
    raise exception 'Appraisal identity no longer matches your saved employee profile; refresh and save the draft before submission'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger kmu_guard_profile_on_submission
before update of status on public.appraisal_cases
for each row when (old.status = 'draft' and new.status = 'submitted')
execute function kmu_internal.guard_profile_on_submission();

-- The initial migration already grants SELECT under restrictive RLS and no
-- client DML on app_user_profiles. New privileges are only for this RPC.
revoke execute on function kmu_internal.guard_profile_on_submission()
  from public, anon, authenticated;
revoke execute on function kmu_internal.save_employee_profile(
  text, text, text, text, text) from public, anon, authenticated;
grant execute on function kmu_internal.save_employee_profile(
  text, text, text, text, text) to authenticated;
revoke execute on function public.save_employee_profile(
  text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_employee_profile(
  text, text, text, text, text) to authenticated;

-- Explicitly preserve the existing authenticated-only draft RPC contract.
revoke execute on function kmu_internal.save_appraisal_draft(
  uuid, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function kmu_internal.save_appraisal_draft(
  uuid, integer, text, text, jsonb) to authenticated;

commit;
