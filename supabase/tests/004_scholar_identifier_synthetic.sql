-- Run after 202610200002_scholar_identifier.sql in an isolated pilot database.
-- Uses a fictional account and rolls everything back. Never COMMIT this file.
begin;

do $$
begin
  if to_regprocedure('public.save_employee_profile_with_scholar(text,text,text,text,text,text)') is null then
    raise exception 'Scholarly-profile save RPC is not installed';
  end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'kmu.scholar.synthetic@example.invalid', 'not-a-password',
  now(), '{}'::jsonb,
  '{"display_name":"Synthetic Scholar", "substantive_designation":"Professor",
    "leadership_role":"None",
    "institute":"KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar",
    "service_cadre":"BPS",
    "scholar_identifier":"0000-0002-1825-0097",
    "role":"administrator"}'::jsonb,
  now(), now()
);

do $$
begin
  if not exists (select 1 from public.app_user_profiles
    where id = '44444444-4444-4444-8444-444444444444'
      and scholar_identifier = '0000-0002-1825-0097') then
    raise exception 'Signup did not copy the scholarly identifier';
  end if;
  if exists (select 1 from public.app_administrators
    where user_id = '44444444-4444-4444-8444-444444444444') then
    raise exception 'Signup metadata improperly granted administrator access';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select public.save_employee_profile_with_scholar(
  'Synthetic Scholar', 'Professor', 'None',
  'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', 'BPS',
  'https://scholar.google.com/citations?user=synthetic');
reset role;

do $$
begin
  if not exists (select 1 from public.app_user_profiles
    where id = '44444444-4444-4444-8444-444444444444'
      and scholar_identifier = 'https://scholar.google.com/citations?user=synthetic') then
    raise exception 'Confirmed owner could not update the scholarly identifier';
  end if;
end;
$$;

rollback;
