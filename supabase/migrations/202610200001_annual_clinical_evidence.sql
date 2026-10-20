-- Additive pilot evidence fields. Apply after 202610150001_employee_profiles.sql.
-- This does not change RLS, roles, submitted records, or existing scores.
-- Apply and test before publishing the matching frontend; old saved cases remain valid.

begin;

create or replace function kmu_internal.validate_objective_payload(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_value jsonb;
  v_raw text;
  v_course jsonb;
  v_field text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 250000 then
    raise exception 'Objective payload must be a JSON object of at most 250000 bytes'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) k
    where k not in (
      'schemaVersion', 'configVersion', 'profile', 'manualProfileOverride',
      'meta', 'values', 'teachingCourses', 'research', 'wuExempted',
      'serviceComplete', 'serviceAdditionalAppointment', 'provisional'
    )
  ) then
    raise exception 'Objective payload includes a non-faculty section'
      using errcode = '22023';
  end if;
  if p_payload ? 'meta' and jsonb_typeof(p_payload -> 'meta') <> 'object'
    or p_payload ? 'values' and jsonb_typeof(p_payload -> 'values') <> 'object'
    or p_payload ? 'teachingCourses' and jsonb_typeof(p_payload -> 'teachingCourses') <> 'array'
    or p_payload ? 'research' and jsonb_typeof(p_payload -> 'research') <> 'object'
    or p_payload ? 'provisional' and jsonb_typeof(p_payload -> 'provisional') <> 'object'
  then
    raise exception 'Objective payload has an invalid section type'
      using errcode = '22023';
  end if;
  if p_payload ? 'meta' and exists (
    select 1 from jsonb_object_keys(p_payload -> 'meta') k
    where k not in (
      'name', 'desig', 'leadershipRole', 'dept', 'cadre', 'cycle',
      'workAssignment', 'profileAssignmentRef', 'clinicalServiceMode',
      'clinicalEvidenceRef', 'appraiser', 'reviewer', 'finalAuthority',
      'committeeMember1', 'committeeMember2', 'committeeMember3'
    )
  ) then
    raise exception 'Objective profile contains an officer-only field'
      using errcode = '22023';
  end if;
  if p_payload ? 'research' and exists (
    select 1 from jsonb_object_keys(p_payload -> 'research') k
    where k not in ('text', 'complete')
  ) then
    raise exception 'Research section contains an officer-only field'
      using errcode = '22023';
  end if;
  if p_payload ? 'research' and (p_payload -> 'research') ? 'text'
    and jsonb_typeof(p_payload #> '{research,text}') <> 'object' then
    raise exception 'Research text must be a JSON object' using errcode = '22023';
  end if;
  if p_payload ? 'research' and (p_payload -> 'research') ? 'text'
    and exists (
      select 1 from jsonb_object_keys(p_payload #> '{research,text}') k
      where k <> 'input_publications_ref'
    )
  then
    raise exception 'Research text contains an officer-only field'
      using errcode = '22023';
  end if;
  if p_payload ? 'meta' and exists (
    select 1 from jsonb_each(p_payload -> 'meta') field
    where jsonb_typeof(field.value) <> 'string'
      or char_length(field.value #>> '{}') > 1000
  ) then
    raise exception 'Faculty profile display fields must be bounded text'
      using errcode = '22023';
  end if;
  if p_payload ? 'research' and (p_payload -> 'research') ? 'text'
    and exists (
      select 1 from jsonb_each(p_payload #> '{research,text}') field
      where jsonb_typeof(field.value) <> 'string'
        or char_length(field.value #>> '{}') > 240
    ) then
    raise exception 'Publication reference must be bounded text'
      using errcode = '22023';
  end if;
  if p_payload ? 'values' and exists (
    select 1 from jsonb_object_keys(p_payload -> 'values') k
    where k not in (
      'input_pub_high_lead', 'input_pub_high_co', 'input_pub_mod_lead',
      'input_pub_mod_co', 'input_pub_low_lead', 'input_pub_low_co',
      'input_grant_int_pi', 'input_grant_int_copi', 'input_grant_nat_pi',
      'input_grant_nat_copi', 'input_grant_small_pi', 'input_grant_applied',
      'input_book_int', 'input_book_nat', 'input_chapter_int',
      'input_chapter_nat', 'input_sup_phd', 'input_sup_mphil',
      'input_sup_clin_sr', 'input_sup_clin_jr', 'input_innov_patent_int',
      'input_innov_patent_nat', 'input_innov_project', 'input_innov_overhead',
      'input_comm_member', 'input_comm_chair', 'input_policy_doc',
      'input_facility_charge', 'input_clin_admin', 'input_clin_volume',
      'input_clin_oncall', 'input_clin_teaching',
      'input_clin_opd_sessions', 'input_clin_patient_contact_hours'
    )
  ) then
    raise exception 'Objective values contain a non-faculty field'
      using errcode = '22023';
  end if;
  if p_payload ? 'teachingCourses'
    and jsonb_array_length(p_payload -> 'teachingCourses') > 10 then
    raise exception 'At most 10 courses are supported' using errcode = '22023';
  end if;
  for v_key, v_value in
    select key, value from jsonb_each(coalesce(p_payload -> 'values', '{}'::jsonb))
  loop
    if jsonb_typeof(v_value) not in ('string', 'number') then
      raise exception 'Objective number % has an invalid type', v_key
        using errcode = '22023';
    end if;
    v_raw := v_value #>> '{}';
    if v_raw = '' then continue; end if;
    if v_key = 'input_clin_patient_contact_hours' then
      if v_raw !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' or v_raw::numeric > 10000 then
        raise exception 'Patient-contact hours must be between 0 and 10000'
          using errcode = '22023';
      end if;
    elsif v_key like 'input_clin_%' and v_key <> 'input_clin_opd_sessions' then
      if v_raw !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
        raise exception 'Clinical value % is not a valid percentage', v_key
          using errcode = '22023';
      end if;
      if v_raw::numeric > 100 then
        raise exception 'Clinical value % exceeds 100', v_key
          using errcode = '22023';
      end if;
    else
      if v_raw !~ '^[0-9]{1,5}$' then
        raise exception 'Activity count % must be a whole number', v_key
          using errcode = '22023';
      end if;
      if v_raw::numeric > 10000 then
        raise exception 'Activity count % exceeds 10000', v_key
          using errcode = '22023';
      end if;
    end if;
  end loop;
  for v_course in
    select value from jsonb_array_elements(
      coalesce(p_payload -> 'teachingCourses', '[]'::jsonb))
  loop
    if jsonb_typeof(v_course) <> 'object' then
      raise exception 'Every teaching course must be an object'
        using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(v_course) k
      where k not in ('title', 'code', 'specialty', 'theory',
        'practical', 'hospitalHours', 'review', 'term', 'level')) then
      raise exception 'A teaching course contains an unexpected field'
        using errcode = '22023';
    end if;
    foreach v_field in array array['title','code','specialty','term','level'] loop
      if v_course ? v_field and
        (jsonb_typeof(v_course -> v_field) <> 'string'
          or char_length(v_course ->> v_field) > 240) then
        raise exception 'Invalid teaching course text field %', v_field
          using errcode = '22023';
      end if;
    end loop;
    foreach v_field in array array['theory','practical','hospitalHours','review'] loop
      if v_course ? v_field and
        jsonb_typeof(v_course -> v_field) not in ('string','number') then
        raise exception 'Invalid teaching course number field %', v_field
          using errcode = '22023';
      end if;
      v_raw := coalesce(v_course ->> v_field, '');
      if v_raw <> '' then
        if v_raw !~ (case when v_field = 'hospitalHours'
            then '^[0-9]{1,4}(\.[0-9]{1,2})?$'
            else '^[0-9]{1,3}(\.[0-9]{1,2})?$' end) then
          raise exception 'Invalid teaching course number field %', v_field
            using errcode = '22023';
        end if;
        if v_raw::numeric > (case when v_field = 'hospitalHours' then 3200 else 100 end) then
          raise exception 'Teaching course value % exceeds its limit', v_field
            using errcode = '22023';
        end if;
      end if;
    end loop;
    if coalesce(nullif(v_course ->> 'hospitalHours', '')::numeric, 0) > 0
      and coalesce(nullif(v_course ->> 'practical', '')::numeric, 0) > 0 then
      raise exception 'Hospital teaching hours and practical credits cannot both be claimed in one entry'
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

create or replace function kmu_internal.submit_appraisal_case(p_case_id uuid)
returns public.appraisal_cases language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_case public.appraisal_cases;
  v_course jsonb;
  v_complete_courses integer := 0;
  v_entered boolean;
begin
  if v_actor is null then
    raise exception 'Confirmed sign-in required' using errcode = '42501';
  end if;
  select * into v_case from public.appraisal_cases c
  where c.id = p_case_id for update;
  if not found or v_case.faculty_id <> v_actor then
    raise exception 'Appraisal case not found for this faculty account'
      using errcode = '42501';
  end if;
  if v_case.status <> 'draft' then
    raise exception 'Faculty submission already completed' using errcode = '42501';
  end if;
  if v_case.objective_payload = '{}'::jsonb
    or coalesce(v_case.objective_payload -> 'provisional' ->> 'ready', 'false') <> 'true'
  then
    raise exception 'Complete the faculty objective sections before submission'
      using errcode = '22023';
  end if;
  perform kmu_internal.validate_objective_payload(v_case.objective_payload);
  -- Structural completeness only. No publication or score is independently
  -- validated by this server; submitted evidence remains self-declared.
  if coalesce(btrim(v_case.objective_payload #>> '{meta,name}'), '') = ''
    or v_case.objective_payload #>> '{meta,desig}' is distinct from v_case.designation
    or v_case.objective_payload #>> '{meta,dept}' is distinct from v_case.institute
    or coalesce(v_case.objective_payload #>> '{meta,cadre}', '')
      not in ('BPS', 'TTS', 'Fixed Pay')
    or coalesce(v_case.objective_payload #>> '{meta,cycle}', '')
      not like 'Calendar Year ' || v_case.cycle_year::text || ' (%'
    or v_case.objective_payload #> '{research,complete}' is distinct from 'true'::jsonb
    or v_case.objective_payload -> 'serviceComplete' is distinct from 'true'::jsonb
  then
    raise exception 'Required faculty profile, research or service declaration is incomplete'
      using errcode = '22023';
  end if;
  if (
    select coalesce(sum(coalesce(nullif(v_case.objective_payload -> 'values' ->> publication_keys.k, '')::numeric, 0)), 0)
    from unnest(array[
      'input_pub_high_lead', 'input_pub_high_co',
      'input_pub_mod_lead', 'input_pub_mod_co',
      'input_pub_low_lead', 'input_pub_low_co'
    ]) as publication_keys(k)
  ) > 0 and coalesce(btrim(v_case.objective_payload #>> '{research,text,input_publications_ref}'), '') = ''
  then
    raise exception 'Publication counts require a citation or reference'
      using errcode = '22023';
  end if;
  if v_case.objective_payload ->> 'profile' = 'Clinical-Focused Profile (Hospital Faculty)'
    and (
      coalesce(btrim(v_case.objective_payload #>> '{meta,clinicalServiceMode}'), '') = ''
      or coalesce(btrim(v_case.objective_payload #>> '{meta,clinicalEvidenceRef}'), '') = ''
      or coalesce(v_case.objective_payload #>> '{values,input_clin_admin}', '') = ''
      or coalesce(v_case.objective_payload #>> '{values,input_clin_volume}', '') = ''
      or coalesce(v_case.objective_payload #>> '{values,input_clin_oncall}', '') = ''
      or coalesce(v_case.objective_payload #>> '{values,input_clin_teaching}', '') = ''
    )
  then
    raise exception 'Clinical profile requires mode, reference and all four service scores'
      using errcode = '22023';
  end if;
  for v_course in
    select value from jsonb_array_elements(
      coalesce(v_case.objective_payload -> 'teachingCourses', '[]'::jsonb))
  loop
    v_entered := coalesce(btrim(v_course ->> 'title'), '') <> ''
      or coalesce(btrim(v_course ->> 'code'), '') <> ''
      or coalesce(btrim(v_course ->> 'term'), '') <> ''
      or coalesce(btrim(v_course ->> 'level'), '') <> ''
      or coalesce(btrim(v_course ->> 'specialty'), '') <> ''
      or coalesce(v_course ->> 'review', '') <> ''
      or coalesce(nullif(v_course ->> 'hospitalHours', '')::numeric, 0) > 0
      or coalesce(nullif(v_course ->> 'theory', '')::numeric, 0) > 0
      or coalesce(nullif(v_course ->> 'practical', '')::numeric, 0) > 0;
    if not v_entered then continue; end if;
    if coalesce(btrim(v_course ->> 'title'), '') = ''
      or coalesce(btrim(v_course ->> 'term'), '') = ''
      or coalesce(btrim(v_course ->> 'level'), '') = ''
      or coalesce(btrim(v_course ->> 'specialty'), '') = ''
      or coalesce(v_course ->> 'theory', '') = ''
      or coalesce(v_course ->> 'practical', '') = ''
      or coalesce(v_course ->> 'review', '') = ''
      or (coalesce(nullif(v_course ->> 'theory', '')::numeric, 0)
        + coalesce(nullif(v_course ->> 'practical', '')::numeric, 0)
        + coalesce(nullif(v_course ->> 'hospitalHours', '')::numeric, 0) / 32) <= 0
    then
      raise exception 'Every entered teaching entry needs title, period, level, discipline, teaching time and review'
        using errcode = '22023';
    end if;
    v_complete_courses := v_complete_courses + 1;
  end loop;
  if v_complete_courses = 0 then
    raise exception 'At least one complete teaching entry with credited time and a 0-100 review is required'
      using errcode = '22023';
  end if;
  update public.appraisal_cases c
  set status = 'submitted', submitted_at = now()
  where c.id = v_case.id returning * into v_case;
  insert into public.appraisal_events (case_id, actor_id, event_type)
  values (v_case.id, v_actor, 'faculty_submitted');
  return v_case;
end;
$$;

commit;
