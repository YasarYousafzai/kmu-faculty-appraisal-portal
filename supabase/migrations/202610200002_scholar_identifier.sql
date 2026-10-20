-- Optional, self-declared scholarly identifier in the employee account.
-- Apply after 202610200001_annual_clinical_evidence.sql and before deploying
-- the matching registration/profile form. This never changes a saved dossier.
begin;

alter table public.app_user_profiles
  add column scholar_identifier text
    check (scholar_identifier is null or char_length(scholar_identifier) <= 240);

-- The existing Auth-user trigger inserts the employee profile. Copy only this
-- public identifier from its signup metadata; it is not an authorization claim.
create function kmu_internal.copy_signup_scholar_identifier()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_identifier text;
begin
  select nullif(btrim(u.raw_user_meta_data ->> 'scholar_identifier'), '')
  into v_identifier from auth.users u where u.id = new.id;
  if v_identifier is not null and (
    char_length(v_identifier) > 240
    or v_identifier !~* '^(https://scholar\.google\.com/citations\?[^[:space:]]+|(https://orcid\.org/)?[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9X]{4})$'
  ) then
    raise exception 'Use a Google Scholar citations URL or ORCID iD/URL'
      using errcode = '22023';
  end if;
  new.scholar_identifier := v_identifier;
  return new;
end;
$$;

create trigger kmu_copy_signup_scholar_identifier
before insert on public.app_user_profiles
for each row execute function kmu_internal.copy_signup_scholar_identifier();

-- Preserve the existing five-argument RPC for older clients. New clients use
-- this owner-checked six-argument RPC so profile and identifier save atomically.
create function kmu_internal.save_employee_profile_with_scholar(
  p_display_name text, p_substantive_designation text,
  p_leadership_role text, p_institute text, p_service_cadre text,
  p_scholar_identifier text
)
returns public.app_user_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := kmu_internal.current_verified_uid();
  v_identifier text := nullif(btrim(p_scholar_identifier), '');
  v_profile public.app_user_profiles;
begin
  if v_actor is null then
    raise exception 'Confirmed sign-in required' using errcode = '42501';
  end if;
  if v_identifier is not null and (
    char_length(v_identifier) > 240
    or v_identifier !~* '^(https://scholar\.google\.com/citations\?[^[:space:]]+|(https://orcid\.org/)?[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9X]{4})$'
  ) then
    raise exception 'Use a Google Scholar citations URL or ORCID iD/URL'
      using errcode = '22023';
  end if;

  perform kmu_internal.save_employee_profile(
    p_display_name, p_substantive_designation, p_leadership_role,
    p_institute, p_service_cadre);
  update public.app_user_profiles p
  set scholar_identifier = v_identifier
  where p.id = v_actor returning * into v_profile;
  if not found then
    raise exception 'Employee profile not found for this account'
      using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

create function public.save_employee_profile_with_scholar(
  p_display_name text, p_substantive_designation text,
  p_leadership_role text, p_institute text, p_service_cadre text,
  p_scholar_identifier text
)
returns public.app_user_profiles
language sql security invoker set search_path = '' as $$
  select kmu_internal.save_employee_profile_with_scholar(
    p_display_name, p_substantive_designation, p_leadership_role,
    p_institute, p_service_cadre, p_scholar_identifier);
$$;

revoke execute on function kmu_internal.copy_signup_scholar_identifier()
  from public, anon, authenticated;
revoke execute on function kmu_internal.save_employee_profile_with_scholar(
  text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function kmu_internal.save_employee_profile_with_scholar(
  text, text, text, text, text, text) to authenticated;
revoke execute on function public.save_employee_profile_with_scholar(
  text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_employee_profile_with_scholar(
  text, text, text, text, text, text) to authenticated;

commit;
