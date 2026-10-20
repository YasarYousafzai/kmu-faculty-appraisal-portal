-- Run only after 202610200001_annual_clinical_evidence.sql in an isolated
-- pilot database. This test creates no faculty or patient records and rolls back.
begin;

do $$
declare
  v_payload jsonb := '{
    "teachingCourses": [{"title":"Synthetic annual MBBS module",
      "code":"", "specialty":"Medicine", "term":"MBBS Annual Year 3",
      "level":"MBBS", "theory":"0", "practical":"0",
      "hospitalHours":"64", "review":"85"}],
    "values": {"input_clin_opd_sessions":"120",
      "input_clin_patient_contact_hours":"480.5"}
  }'::jsonb;
  v_rejected boolean;
begin
  if to_regprocedure('kmu_internal.validate_objective_payload(jsonb)') is null then
    raise exception 'Annual-clinical validator is not installed';
  end if;
  perform kmu_internal.validate_objective_payload(v_payload);

  v_rejected := false;
  begin
    perform kmu_internal.validate_objective_payload(jsonb_set(
      v_payload, '{teachingCourses,0,practical}', '"1"'::jsonb));
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Practical credits plus hospital hours were not rejected';
  end if;

  v_rejected := false;
  begin
    perform kmu_internal.validate_objective_payload(jsonb_set(
      v_payload, '{values,input_clin_patient_contact_hours}', '"10000.01"'::jsonb));
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Out-of-range patient-contact hours were not rejected';
  end if;

  v_rejected := false;
  begin
    perform kmu_internal.validate_objective_payload(jsonb_set(
      v_payload, '{values,input_clin_opd_sessions}', '"1.5"'::jsonb));
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Fractional OPD session count was not rejected';
  end if;

  v_rejected := false;
  begin
    perform kmu_internal.validate_objective_payload(jsonb_set(
      v_payload, '{teachingCourses,0,hospitalHours}', '"3200.01"'::jsonb));
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Out-of-range hospital teaching hours were not rejected';
  end if;

  v_rejected := false;
  begin
    perform kmu_internal.validate_objective_payload(jsonb_set(
      v_payload, '{values,input_reviewer_secret}', '"50"'::jsonb));
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Officer-only value was not rejected';
  end if;
end;
$$;

rollback;
