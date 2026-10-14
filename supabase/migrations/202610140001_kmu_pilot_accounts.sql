-- KMU faculty appraisal controlled pilot: private accounts and immutable handoff.
-- Run once in a NEW/EMPTY Supabase project after review. No user or admin is seeded.
-- Browser scores in objective_payload.provisional are SELF-CALCULATED CLAIMS, not
-- server-verified results or an official KMU personnel decision.

begin;

create schema if not exists kmu_internal;
revoke all on schema kmu_internal from public, anon;
grant usage on schema kmu_internal to authenticated;

create table public.app_user_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default '' check (char_length(display_name) <= 160),
  login_email text not null check (char_length(login_email) <= 320),
  created_at timestamptz not null default now()
);

-- These are database-owned authorizations, not client-selectable profile fields.
create table public.app_administrators (
  user_id uuid primary key references public.app_user_profiles(id) on delete restrict,
  bootstrapped_at timestamptz not null default now(),
  revoked_at timestamptz,
  bootstrap_note text not null default 'Manual verified-UID bootstrap'
    check (char_length(bootstrap_note) <= 500)
);

create table public.app_assessors (
  user_id uuid primary key references public.app_user_profiles(id) on delete restrict,
  granted_by uuid not null references public.app_administrators(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.app_administrators(user_id) on delete restrict
);

-- Exact option text is copied from the portal's 14 October 2026 dropdowns.
-- This is a pilot vocabulary, NOT a legal declaration that every appointment
-- or constituent unit has been independently notified. Appointment/posting
-- orders and current KMU notifications take precedence. Update by reviewed
-- migration only when the controlled portal options change.
create table public.pilot_designation_options (
  name text primary key,
  change_note text not null default 'Portal pilot option; verify appointment order'
);
insert into public.pilot_designation_options(name) values
  ('Meritorious Professor'), ('Professor'), ('Associate Professor'),
  ('Assistant Professor'), ('Lecturer'), ('Demonstrator'),
  ('Senior Registrar'), ('Medical Officer'), ('Consultant'),
  ('Research Scientist'), ('Research Associate'), ('Postdoctoral Fellow');

create table public.pilot_unit_options (
  name text primary key,
  change_note text not null default 'Portal pilot option; verify posting notification'
);
insert into public.pilot_unit_options(name, change_note) values
  ('KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Pharmaceutical Sciences (KMU-IPS), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Pathology and Diagnostic Medicine (KMU-IPDM), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Physical Medicine & Rehabilitation (KMU-IPM&R), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Nursing Sciences (KMU-INS), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Professions Education and Research (KMU-IHPER), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Public Health & Social Sciences (KMU-IPH&SS), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Paramedical Sciences (KMU-IPMS), Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Public Mental Health & Behavioral Sciences, Peshawar', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Medical Sciences (KIMS), Kohat', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Dental Sciences (KIDS), Kohat', 'Portal pilot option; verify posting notification'),
  ('KMU Hospital & Research Centre (KMU-H&RC), Peshawar', 'Portal pilot option; verify posting notification'),
  ('Khyber Pakhtunkhwa Public Health Reference Laboratory (KP-PHRL), KMU', 'Portal pilot option; verify posting notification'),
  ('Department of Family Medicine, KMU-IPH&SS', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Swat', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Swabi', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Hazara', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Bannu', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, D.I. Khan', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Kohat', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Mardan', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Thana', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Parachinar, Kurram', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Dir Upper', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Lower Dir', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Buner', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Health Sciences, Islamabad', 'Portal pilot option; verify posting notification'),
  ('KMU Institute of Paramedical Sciences, Lakki Marwat', 'Verify current notification before formal use');

create table public.appraisal_cases (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.app_user_profiles(id) on delete restrict,
  cycle_year integer not null check (cycle_year in (2025, 2026, 2027)),
  designation text not null references public.pilot_designation_options(name)
    check (char_length(designation) between 1 and 160),
  institute text not null references public.pilot_unit_options(name)
    check (char_length(institute) between 1 and 240),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  objective_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(objective_payload) = 'object'
      and octet_length(objective_payload::text) <= 250000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (faculty_id, cycle_year),
  check ((status = 'draft' and submitted_at is null)
      or (status in ('submitted', 'reviewed') and submitted_at is not null))
);

create table public.assessor_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.appraisal_cases(id) on delete restrict,
  assessor_id uuid not null references public.app_assessors(user_id) on delete restrict,
  assigned_by uuid not null references public.app_administrators(user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.app_administrators(user_id) on delete restrict
);

create index assessor_assignments_assessor_idx
  on public.assessor_assignments(assessor_id, case_id);
create unique index assessor_assignments_one_active_case_idx
  on public.assessor_assignments(case_id) where revoked_at is null;

create table public.assessor_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.appraisal_cases(id) on delete restrict,
  assessor_id uuid not null references public.app_assessors(user_id) on delete restrict,
  assignment_id uuid not null references public.assessor_assignments(id) on delete restrict,
  subjective_payload jsonb not null
    check (jsonb_typeof(subjective_payload) = 'object'
      and octet_length(subjective_payload::text) <= 64000),
  submitted_at timestamptz not null default now(),
  unique (case_id),
  unique (assignment_id)
);

create index assessor_reviews_case_idx on public.assessor_reviews(case_id);

-- Append-only, minimal metadata: no duplicate copy of faculty evidence or scores.
create table public.appraisal_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.appraisal_cases(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'administrator_bootstrapped', 'administrator_revoked',
    'assessor_granted', 'assessor_revoked', 'case_created',
    'draft_saved', 'faculty_submitted', 'assessor_assigned',
    'assessor_unassigned', 'assessment_submitted'
  )),
  subject_user_id uuid references auth.users(id) on delete restrict,
  event_at timestamptz not null default now()
);

create index appraisal_events_case_idx on public.appraisal_events(case_id, event_at);

-- A signup makes only a profile. User-supplied metadata never grants a role.
create function kmu_internal.handle_auth_user_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_user_profiles (id, display_name, login_email)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)), 160),
    left(coalesce(new.email, ''), 320)
  );
  return new;
end;
$$;

create trigger kmu_auth_user_insert
after insert on auth.users
for each row execute function kmu_internal.handle_auth_user_insert();

create function kmu_internal.handle_auth_user_email_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.app_user_profiles
  set login_email = left(coalesce(new.email, ''), 320)
  where id = new.id;
  return new;
end;
$$;

create trigger kmu_auth_user_email_update
after update of email on auth.users
for each row execute function kmu_internal.handle_auth_user_email_update();

-- Existing auth users (if any) start as assessees only; no assessor/admin seed.
insert into public.app_user_profiles (id, display_name, login_email)
select u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1)), 160),
  left(coalesce(u.email, ''), 320)
from auth.users u
on conflict (id) do nothing;

-- Admin bootstrap is an explicit SQL Editor action by UID, never a signup option.
create function kmu_internal.verify_admin_bootstrap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.revoked_at is null) and not exists (
    select 1 from auth.users u
    where u.id = new.user_id and u.email_confirmed_at is not null
  ) then
    raise exception 'Administrator account must have a confirmed Auth email'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Administrator UID cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.revoked_at is not null
    and new.revoked_at is null then
    raise exception 'Revoked administrator cannot be reactivated; manual review required'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger kmu_verify_admin_bootstrap
before insert or update on public.app_administrators
for each row execute function kmu_internal.verify_admin_bootstrap();

create function kmu_internal.audit_admin_bootstrap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.appraisal_events (actor_id, event_type, subject_user_id)
  values (auth.uid(), 'administrator_bootstrapped', new.user_id);
  return new;
end;
$$;

create trigger kmu_audit_admin_bootstrap
after insert on public.app_administrators
for each row execute function kmu_internal.audit_admin_bootstrap();

create function kmu_internal.audit_admin_revocation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    insert into public.appraisal_events (actor_id, event_type, subject_user_id)
    values (auth.uid(), 'administrator_revoked', new.user_id);
  end if;
  return new;
end;
$$;

create trigger kmu_audit_admin_revocation
after update of revoked_at on public.app_administrators
for each row execute function kmu_internal.audit_admin_revocation();

create function kmu_internal.current_verified_uid()
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
  limit 1;
$$;

create function kmu_internal.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_administrators a
    where a.user_id = kmu_internal.current_verified_uid()
      and a.revoked_at is null
  );
$$;

create function kmu_internal.is_assigned_assessor(p_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessor_assignments aa
    join public.app_assessors ar on ar.user_id = aa.assessor_id
    where aa.case_id = p_case_id
      and aa.assessor_id = kmu_internal.current_verified_uid()
      and aa.revoked_at is null and ar.revoked_at is null
  );
$$;

create function kmu_internal.is_case_faculty(p_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appraisal_cases c
    where c.id = p_case_id and c.faculty_id = kmu_internal.current_verified_uid()
  );
$$;

create function kmu_internal.can_read_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = kmu_internal.current_verified_uid()
    or kmu_internal.is_admin()
    or exists (
      select 1 from public.appraisal_cases c
      join public.assessor_assignments aa on aa.case_id = c.id
      join public.app_assessors ar on ar.user_id = aa.assessor_id
      where c.faculty_id = p_user_id
        and c.status in ('submitted', 'reviewed')
        and aa.assessor_id = kmu_internal.current_verified_uid()
        and aa.revoked_at is null and ar.revoked_at is null
    );
$$;

-- Even a privileged accidental UPDATE cannot rewrite a submitted objective.
create function kmu_internal.guard_case_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Submitted faculty evidence cannot be deleted'
        using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'draft' and (
    new.id is distinct from old.id or
    new.faculty_id is distinct from old.faculty_id or
    new.cycle_year is distinct from old.cycle_year or
    new.designation is distinct from old.designation or
    new.institute is distinct from old.institute or
    new.objective_payload is distinct from old.objective_payload or
    new.created_at is distinct from old.created_at or
    new.submitted_at is distinct from old.submitted_at
  ) then
    raise exception 'Submitted faculty evidence is immutable'
      using errcode = '42501';
  end if;
  if (old.status = 'draft' and new.status not in ('draft', 'submitted'))
    or (old.status = 'submitted' and new.status not in ('submitted', 'reviewed'))
    or (old.status = 'reviewed' and new.status <> 'reviewed') then
    raise exception 'Invalid appraisal status transition' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger kmu_guard_case_transition
before update or delete on public.appraisal_cases
for each row execute function kmu_internal.guard_case_transition();

create function kmu_internal.guard_review_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Submitted assessor reviews are immutable'
    using errcode = '42501';
end;
$$;

create trigger kmu_guard_review_immutable
before update or delete on public.assessor_reviews
for each row execute function kmu_internal.guard_review_immutable();

create function kmu_internal.validate_objective_payload(p_payload jsonb)
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
      'input_clin_oncall', 'input_clin_teaching'
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
    if v_key like 'input_clin_%' then
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
        'practical', 'review', 'term', 'level')) then
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
    foreach v_field in array array['theory','practical','review'] loop
      if v_course ? v_field and
        jsonb_typeof(v_course -> v_field) not in ('string','number') then
        raise exception 'Invalid teaching course number field %', v_field
          using errcode = '22023';
      end if;
      v_raw := coalesce(v_course ->> v_field, '');
      if v_raw <> '' then
        if v_raw !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
          raise exception 'Invalid teaching course number field %', v_field
            using errcode = '22023';
        end if;
        if v_raw::numeric > 100 then
          raise exception 'Teaching course value % exceeds 100', v_field
            using errcode = '22023';
        end if;
      end if;
    end loop;
  end loop;
end;
$$;

-- Internal implementations may bypass RLS, so every branch checks the JWT UID.
create function kmu_internal.save_appraisal_draft(
  p_case_id uuid, p_cycle_year integer, p_designation text,
  p_institute text, p_objective_payload jsonb
)
returns public.appraisal_cases language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
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
  if p_objective_payload ? 'provisional' then
    p_objective_payload := jsonb_set(
      p_objective_payload, '{provisional,verifiedByServer}', 'false'::jsonb, true);
  end if;

  if p_case_id is null then
    select * into v_case from public.appraisal_cases c
    where c.faculty_id = v_actor and c.cycle_year = p_cycle_year for update;
    if not found then
      insert into public.appraisal_cases
        (faculty_id, cycle_year, designation, institute, objective_payload)
      values (v_actor, p_cycle_year, btrim(p_designation),
        btrim(p_institute), p_objective_payload)
      returning * into v_case;
      v_new := true;
    end if;
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
    set designation = btrim(p_designation), institute = btrim(p_institute),
      objective_payload = p_objective_payload
    where c.id = v_case.id
    returning * into v_case;
  end if;
  insert into public.appraisal_events (case_id, actor_id, event_type)
  values (v_case.id, v_actor, case when v_new then 'case_created' else 'draft_saved' end);
  return v_case;
end;
$$;

create function kmu_internal.submit_appraisal_case(p_case_id uuid)
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
      or coalesce(nullif(v_course ->> 'theory', '')::numeric, 0) > 0
      or coalesce(nullif(v_course ->> 'practical', '')::numeric, 0) > 0;
    if not v_entered then continue; end if;
    if coalesce(btrim(v_course ->> 'title'), '') = ''
      or coalesce(btrim(v_course ->> 'code'), '') = ''
      or coalesce(btrim(v_course ->> 'term'), '') = ''
      or coalesce(btrim(v_course ->> 'level'), '') = ''
      or coalesce(btrim(v_course ->> 'specialty'), '') = ''
      or coalesce(v_course ->> 'theory', '') = ''
      or coalesce(v_course ->> 'practical', '') = ''
      or coalesce(v_course ->> 'review', '') = ''
      or coalesce(nullif(v_course ->> 'theory', '')::numeric, 0)
        + coalesce(nullif(v_course ->> 'practical', '')::numeric, 0) <= 0
    then
      raise exception 'Every entered course needs title, code, term, level, credits and review'
        using errcode = '22023';
    end if;
    v_complete_courses := v_complete_courses + 1;
  end loop;
  if v_complete_courses = 0 then
    raise exception 'At least one complete course with credits and a 0-100 review is required'
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

create function kmu_internal.grant_assessor(p_user_id uuid)
returns public.app_assessors language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_row public.app_assessors;
begin
  if v_actor is null or not kmu_internal.is_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
  ) then
    raise exception 'Assessor must have a confirmed Auth account'
      using errcode = '22023';
  end if;
  select * into v_row from public.app_assessors
  where user_id = p_user_id for update;
  if found and v_row.revoked_at is null then
    return v_row;
  elsif found then
    update public.app_assessors
    set granted_by = v_actor, granted_at = now(),
      revoked_at = null, revoked_by = null
    where user_id = p_user_id returning * into v_row;
  else
    insert into public.app_assessors (user_id, granted_by)
    values (p_user_id, v_actor) returning * into v_row;
  end if;
  insert into public.appraisal_events (actor_id, event_type, subject_user_id)
  values (v_actor, 'assessor_granted', p_user_id);
  return v_row;
end;
$$;

create function kmu_internal.revoke_assessor(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
begin
  if v_actor is null or not kmu_internal.is_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  update public.app_assessors
  set revoked_at = now(), revoked_by = v_actor
  where user_id = p_user_id and revoked_at is null;
  if not found then
    return false;
  end if;
  insert into public.appraisal_events (actor_id, event_type, subject_user_id)
  values (v_actor, 'assessor_revoked', p_user_id);
  insert into public.appraisal_events (case_id, actor_id, event_type, subject_user_id)
  select aa.case_id, v_actor, 'assessor_unassigned', p_user_id
  from public.assessor_assignments aa
  where aa.assessor_id = p_user_id and aa.revoked_at is null;
  update public.assessor_assignments
  set revoked_at = now(), revoked_by = v_actor
  where assessor_id = p_user_id and revoked_at is null;
  return true;
end;
$$;

create function kmu_internal.assign_assessor(p_case_id uuid, p_assessor_id uuid)
returns public.assessor_assignments language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_case public.appraisal_cases;
  v_row public.assessor_assignments;
begin
  if v_actor is null or not kmu_internal.is_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  select * into v_case from public.appraisal_cases where id = p_case_id;
  if not found or v_case.status <> 'submitted' then
    raise exception 'Only submitted, unreviewed cases can be assigned'
      using errcode = '22023';
  end if;
  if v_case.faculty_id = p_assessor_id then
    raise exception 'A faculty member cannot assess their own case'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.app_assessors
    where user_id = p_assessor_id and revoked_at is null) then
    raise exception 'Assessor role has not been granted' using errcode = '22023';
  end if;
  insert into public.assessor_assignments (case_id, assessor_id, assigned_by)
  values (p_case_id, p_assessor_id, v_actor)
  on conflict do nothing
  returning * into v_row;
  if found then
    insert into public.appraisal_events (case_id, actor_id, event_type, subject_user_id)
    values (p_case_id, v_actor, 'assessor_assigned', p_assessor_id);
  else
    select * into v_row from public.assessor_assignments
    where case_id = p_case_id and revoked_at is null;
    if not found then
      raise exception 'Concurrent assignment changed; retry' using errcode = '40001';
    end if;
    if v_row.assessor_id <> p_assessor_id then
      raise exception 'This case is already assigned to another assessor; unassign first'
        using errcode = '23505';
    end if;
  end if;
  return v_row;
end;
$$;

create function kmu_internal.unassign_assessor(p_case_id uuid, p_assessor_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_deleted boolean;
begin
  if v_actor is null or not kmu_internal.is_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  update public.assessor_assignments
  set revoked_at = now(), revoked_by = v_actor
  where case_id = p_case_id and assessor_id = p_assessor_id
    and revoked_at is null;
  v_deleted := found;
  if v_deleted then
    insert into public.appraisal_events (case_id, actor_id, event_type, subject_user_id)
    values (p_case_id, v_actor, 'assessor_unassigned', p_assessor_id);
  end if;
  return v_deleted;
end;
$$;

create function kmu_internal.submit_assessor_review(
  p_case_id uuid, p_subjective_payload jsonb
)
returns public.assessor_reviews language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_case public.appraisal_cases;
  v_review public.assessor_reviews;
  v_assignment_id uuid;
  v_payload jsonb;
  v_i integer;
  v_penalty text;
begin
  if v_actor is null then
    raise exception 'Confirmed sign-in required' using errcode = '42501';
  end if;
  if p_subjective_payload is null or jsonb_typeof(p_subjective_payload) <> 'object'
    or p_subjective_payload = '{}'::jsonb
    or octet_length(p_subjective_payload::text) > 64000 then
    raise exception 'Assessment must be a nonempty JSON object of at most 64000 bytes'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_subjective_payload) k
    where k not in (
      'configVersion', 'source', 'submittedBy', 'reviewerRole',
      'reviewerName', 'researchReviewReference', 'researchReviewConfirmed',
      'peerScores', 'cpdScores', 'nextCycleTargets',
      'disciplinaryDeclaration', 'provisional'
    )
  ) or jsonb_typeof(p_subjective_payload -> 'peerScores') is distinct from 'object'
    or jsonb_typeof(p_subjective_payload -> 'cpdScores') is distinct from 'object'
    or jsonb_typeof(p_subjective_payload -> 'provisional') is distinct from 'object'
    or jsonb_typeof(p_subjective_payload -> 'disciplinaryDeclaration') is distinct from 'object'
  then
    raise exception 'Assessment payload contains an unexpected section or type'
      using errcode = '22023';
  end if;
  if coalesce(btrim(p_subjective_payload ->> 'reviewerRole'), '') = ''
    or char_length(p_subjective_payload ->> 'reviewerRole') > 160
    or coalesce(btrim(p_subjective_payload ->> 'reviewerName'), '') = ''
    or char_length(p_subjective_payload ->> 'reviewerName') > 160
    or p_subjective_payload -> 'researchReviewConfirmed' is distinct from 'true'::jsonb
    or coalesce(btrim(p_subjective_payload ->> 'researchReviewReference'), '') = ''
    or char_length(p_subjective_payload ->> 'researchReviewReference') > 240
  then
    raise exception 'Reviewer identity and research-evidence confirmation are required'
      using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_subjective_payload -> 'peerScores')) <> 13
    or (select count(*) from jsonb_object_keys(p_subjective_payload -> 'cpdScores')) <> 5
  then
    raise exception 'All 13 professional and five CPD criteria are required'
      using errcode = '22023';
  end if;
  for v_i in 1..13 loop
    if coalesce(p_subjective_payload -> 'peerScores' ->> ('peer_' || v_i), '')
      !~ '^[1-6]$' then
      raise exception 'Professional criterion % must be an integer from 1 to 6', v_i
        using errcode = '22023';
    end if;
  end loop;
  for v_i in 1..5 loop
    if coalesce(p_subjective_payload -> 'cpdScores' ->> ('cpd_' || v_i), '')
      !~ '^[0-2]$' then
      raise exception 'CPD criterion % must be an integer from 0 to 2', v_i
        using errcode = '22023';
    end if;
  end loop;
  select * into v_case from public.appraisal_cases c
  where c.id = p_case_id for update;
  if not found or v_case.status not in ('submitted', 'reviewed') then
    raise exception 'Faculty evidence must be submitted first'
      using errcode = '22023';
  end if;
  v_penalty := coalesce(p_subjective_payload #>> '{disciplinaryDeclaration,penalty}', '0');
  if v_penalty not in ('0', '25', '50') then
    raise exception 'Disciplinary deduction must be 0, 25 or 50'
      using errcode = '22023';
  end if;
  if v_penalty <> '0' and (
    coalesce(btrim(p_subjective_payload #>> '{disciplinaryDeclaration,reference}'), '') = ''
    or coalesce(p_subjective_payload #>> '{disciplinaryDeclaration,date}', '')
      !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_subjective_payload #>> '{disciplinaryDeclaration,inquiryConcluded}' is distinct from 'Y'
    or p_subjective_payload #>> '{disciplinaryDeclaration,appealResolved}' is distinct from 'Y'
  ) then
    raise exception 'Notified penalty requires reference, date, inquiry and appeal declarations'
      using errcode = '22023';
  end if;
  if v_penalty <> '0' and (
    (p_subjective_payload #>> '{disciplinaryDeclaration,date}')::date
      not between make_date(v_case.cycle_year, 1, 1)
        and make_date(v_case.cycle_year, 12, 31)
  ) then
    raise exception 'Notified penalty date must be within the appraisal year'
      using errcode = '22023';
  end if;
  if v_case.faculty_id = v_actor then
    raise exception 'Only an assigned, distinct assessor may review this case'
      using errcode = '42501';
  end if;
  select aa.id into v_assignment_id
  from public.assessor_assignments aa
  join public.app_assessors ar on ar.user_id = aa.assessor_id
  where aa.case_id = p_case_id and aa.assessor_id = v_actor
    and aa.revoked_at is null and ar.revoked_at is null
  for share of aa, ar;
  if not found then
    raise exception 'Only an active assigned assessor may review this case'
      using errcode = '42501';
  end if;
  -- Identity and the lack of server score verification are server-controlled.
  v_payload := p_subjective_payload || jsonb_build_object('submittedBy', v_actor::text);
  v_payload := jsonb_set(v_payload, '{provisional,verifiedByServer}', 'false'::jsonb, true);
  insert into public.assessor_reviews
    (case_id, assessor_id, assignment_id, subjective_payload)
  values (p_case_id, v_actor, v_assignment_id, v_payload)
  returning * into v_review;
  update public.appraisal_cases set status = 'reviewed' where id = p_case_id;
  insert into public.appraisal_events (case_id, actor_id, event_type)
  values (p_case_id, v_actor, 'assessment_submitted');
  return v_review;
end;
$$;

-- Public Data API entry points are SECURITY INVOKER wrappers. Privileged bodies
-- remain outside exposed schemas and still check the signed-in JWT UID.
create function public.save_appraisal_draft(
  p_case_id uuid, p_cycle_year integer, p_designation text,
  p_institute text, p_objective_payload jsonb
)
returns public.appraisal_cases language sql security invoker set search_path = '' as $$
  select kmu_internal.save_appraisal_draft(
    p_case_id, p_cycle_year, p_designation, p_institute, p_objective_payload);
$$;

create function public.submit_appraisal_case(p_case_id uuid)
returns public.appraisal_cases language sql security invoker set search_path = '' as $$
  select kmu_internal.submit_appraisal_case(p_case_id);
$$;

create function public.grant_assessor(p_user_id uuid)
returns public.app_assessors language sql security invoker set search_path = '' as $$
  select kmu_internal.grant_assessor(p_user_id);
$$;

create function public.revoke_assessor(p_user_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select kmu_internal.revoke_assessor(p_user_id);
$$;

create function public.assign_assessor(p_case_id uuid, p_assessor_id uuid)
returns public.assessor_assignments language sql security invoker set search_path = '' as $$
  select kmu_internal.assign_assessor(p_case_id, p_assessor_id);
$$;

create function public.unassign_assessor(p_case_id uuid, p_assessor_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select kmu_internal.unassign_assessor(p_case_id, p_assessor_id);
$$;

create function public.submit_assessor_review(
  p_case_id uuid, p_subjective_payload jsonb
)
returns public.assessor_reviews language sql security invoker set search_path = '' as $$
  select kmu_internal.submit_assessor_review(p_case_id, p_subjective_payload);
$$;

-- Supabase can give new public tables broad default grants: explicitly remove
-- all client DML and all anonymous reads, then grant only RLS-filtered SELECT.
revoke all on public.pilot_designation_options, public.pilot_unit_options,
  public.app_user_profiles, public.app_administrators,
  public.app_assessors, public.appraisal_cases, public.assessor_assignments,
  public.assessor_reviews, public.appraisal_events from public, anon, authenticated;
grant select on public.pilot_designation_options, public.pilot_unit_options,
  public.app_user_profiles, public.app_administrators,
  public.app_assessors, public.appraisal_cases, public.assessor_assignments,
  public.assessor_reviews, public.appraisal_events to authenticated;

alter table public.pilot_designation_options enable row level security;
alter table public.pilot_unit_options enable row level security;
alter table public.app_user_profiles enable row level security;
alter table public.app_administrators enable row level security;
alter table public.app_assessors enable row level security;
alter table public.appraisal_cases enable row level security;
alter table public.assessor_assignments enable row level security;
alter table public.assessor_reviews enable row level security;
alter table public.appraisal_events enable row level security;

create policy kmu_designation_options_read on public.pilot_designation_options
for select to authenticated using (true);

create policy kmu_unit_options_read on public.pilot_unit_options
for select to authenticated using (true);

create policy kmu_profiles_read on public.app_user_profiles
for select to authenticated
using (kmu_internal.can_read_profile(id));

create policy kmu_admins_read on public.app_administrators
for select to authenticated
using ((user_id = (select kmu_internal.current_verified_uid())
    and revoked_at is null)
  or (select kmu_internal.is_admin()));

create policy kmu_assessors_read on public.app_assessors
for select to authenticated
using ((user_id = (select kmu_internal.current_verified_uid())
    and revoked_at is null)
  or (select kmu_internal.is_admin()));

create policy kmu_cases_read on public.appraisal_cases
for select to authenticated
using (
  faculty_id = (select kmu_internal.current_verified_uid())
  or (select kmu_internal.is_admin())
  or (status in ('submitted', 'reviewed')
      and kmu_internal.is_assigned_assessor(id))
);

create policy kmu_assignments_read on public.assessor_assignments
for select to authenticated
using (
  (assessor_id = (select kmu_internal.current_verified_uid())
    and revoked_at is null and kmu_internal.is_assigned_assessor(case_id))
  or (select kmu_internal.is_admin())
  or kmu_internal.is_case_faculty(case_id)
);

create policy kmu_reviews_read on public.assessor_reviews
for select to authenticated
using (
  (assessor_id = (select kmu_internal.current_verified_uid())
    and kmu_internal.is_assigned_assessor(case_id))
  or (select kmu_internal.is_admin())
  or (kmu_internal.is_case_faculty(case_id) and exists (
    select 1 from public.appraisal_cases c
    where c.id = case_id and c.status = 'reviewed'
  ))
);

create policy kmu_events_read on public.appraisal_events
for select to authenticated
using (
  (select kmu_internal.is_admin())
  or (case_id is not null and kmu_internal.is_case_faculty(case_id))
  or (case_id is not null and kmu_internal.is_assigned_assessor(case_id))
);

-- Definer functions are not exposed through PostgREST. Only authenticated may
-- execute the internal helpers/wrappers; the bodies still verify the UID.
revoke execute on all functions in schema kmu_internal from public, anon, authenticated;
grant execute on function kmu_internal.current_verified_uid(),
  kmu_internal.is_admin(), kmu_internal.is_assigned_assessor(uuid),
  kmu_internal.is_case_faculty(uuid), kmu_internal.can_read_profile(uuid),
  kmu_internal.validate_objective_payload(jsonb),
  kmu_internal.save_appraisal_draft(uuid, integer, text, text, jsonb),
  kmu_internal.submit_appraisal_case(uuid),
  kmu_internal.grant_assessor(uuid),
  kmu_internal.revoke_assessor(uuid),
  kmu_internal.assign_assessor(uuid, uuid),
  kmu_internal.unassign_assessor(uuid, uuid),
  kmu_internal.submit_assessor_review(uuid, jsonb)
to authenticated;

revoke execute on function public.save_appraisal_draft(uuid, integer, text, text, jsonb),
  public.submit_appraisal_case(uuid), public.grant_assessor(uuid),
  public.revoke_assessor(uuid),
  public.assign_assessor(uuid, uuid), public.unassign_assessor(uuid, uuid),
  public.submit_assessor_review(uuid, jsonb)
from public, anon;
grant execute on function public.save_appraisal_draft(uuid, integer, text, text, jsonb),
  public.submit_appraisal_case(uuid), public.grant_assessor(uuid),
  public.revoke_assessor(uuid),
  public.assign_assessor(uuid, uuid), public.unassign_assessor(uuid, uuid),
  public.submit_assessor_review(uuid, jsonb)
to authenticated;

commit;
