# KMU appraisal pilot database

This is a **pilot access-control design**, not an approved personnel system. The
faculty and assessor score summaries are calculated in the browser and stored
as **unverified, self-declared provisional values**. Supabase checks identity,
case ownership, assignment and structural completeness; it does **not**
independently recompute the KMU appraisal formula or verify evidence.

## Review and deployment

1. Use a dedicated Supabase project and complete KMU privacy/security and
   retention review before entering any real personnel or patient information.
2. Review and run `migrations/202610140001_kmu_pilot_accounts.sql` **once**, then
   `migrations/202610150001_employee_profiles.sql` **once**, then
   `migrations/202610200001_annual_clinical_evidence.sql` **once**, then
   `migrations/202610200002_scholar_identifier.sql` **once**, in that order in
   Supabase SQL Editor. The second migration adds self-declared employee job
   fields to existing profiles without backfilling or changing submitted cases.
   The third only widens the faculty-payload validator and submission check to
   accept annual/module teaching without an issued code, hospital teaching
   hours, OPD session counts and aggregate patient-contact hours. It does not
   rewrite stored cases, scores, roles, RLS policies or staff profiles.
   The fourth adds an optional self-declared Google Scholar URL or ORCID iD/URL
   to employee profiles and a new owner-checked save RPC; it does not alter
   previously saved cases or the five-field registration requirements.
   Apply and test both new migrations **before** publishing their matching
   frontend; otherwise saving the new evidence fields will fail.
   Existing invited/registered users must complete their employee profile before
   saving another cloud appraisal draft. Neither migration creates an
   administrator. Keep project
   secrets and service-role keys out of the public website. In
   **Authentication → URL Configuration**, set both the Site URL and an allowed
   Redirect URL to `https://yasaryousafzai.github.io/kmu-faculty-appraisal-portal/`.
   Check a real invitation or recovery redirect before wider use.
3. Create your personal Auth account through the portal **or** send an invitation
   from **Authentication → Users**. The invited person must open the email link
   and choose their own password on the portal; the administrator must not enter
   or handle that password. After the person signs in to the portal, find the
   Auth UID in **Authentication → Users**. In SQL Editor, verify the intended
   email, `email_confirmed_at` and `last_sign_in_at`, then manually bootstrap
   that **exact UID**:

   ```sql
   select id, email, email_confirmed_at, last_sign_in_at
   from auth.users
   where id = '<CONFIRMED_AUTH_UID>'::uuid;

   insert into public.app_administrators (user_id, bootstrap_note)
   select id, 'Manually verified pilot administrator'
   from auth.users
   where id = '<CONFIRMED_AUTH_UID>'::uuid
     and email_confirmed_at is not null
     and last_sign_in_at is not null;
   ```

   Do not use an email match alone to grant the role. No client-side signup
   field, Auth metadata or browser script can grant administrator access.
4. The administrator can grant an assessor role to a confirmed account using
   `grant_assessor(p_user_id)` and assign one active assessor to a submitted
   dossier using `assign_assessor(p_case_id, p_assessor_id)`. The administrator
   may use `unassign_assessor(p_case_id, p_assessor_id)` or
   `revoke_assessor(p_user_id)` to remove access. Completed reviews and audit
   history remain; former assessors lose case/review reads immediately.
   In the portal, the administrator opens **Administrator → Faculty records and
   dossiers** to see registered pilot profiles and all saved cases, then opens
   a case read-only. The same workspace contains role-grant and case-assignment
   controls. A portal role grant is operational access, not a KMU statutory
   appointment or substitute for a current reporting order. Passwords are not
   shown in the administrator roster.
5. Run `tests/001_rls_synthetic.sql` and `tests/002_employee_profiles_synthetic.sql`
   only in an **empty, isolated pilot database** after all migrations. Run
   `tests/003_annual_clinical_evidence_synthetic.sql` to check the additive
   validator; it creates no faculty records and also ends in `ROLLBACK`.
   Run `tests/004_scholar_identifier_synthetic.sql` to check the new
   scholar-profile RPC with a rollback-only fictional account before inviting
   real users.
   They create synthetic `example.invalid` Auth accounts and end
   in `ROLLBACK`. The original 14 October 2026 baseline test completed without
   errors before the employee-profile migration; a subsequent query confirmed
   zero synthetic Auth users, profiles, cases, assignments, reviews, or events
   remained. Re-run the updated suites after applying the new migration. This
   does not replace a KMU production audit.

The Supabase default email service is limited to project-team recipients and
two authentication emails per hour project-wide. It is not suitable for broader
faculty registration. The lowest-cost practical path is to keep the pilot
Supabase project and connect a reviewed, free-tier transactional SMTP sender
under a domain the sender is authorized to use. Verify the sending domain's
DNS and test one confirmation and one password-reset message. For example,
Resend lists a free tier of 3,000 emails/month with a 100/day cap; Brevo lists
300/day with SMTP relay on its free tier (branding applies). Provider terms
and quotas can change. In Supabase, configure **Authentication → SMTP
Settings** with the provider's credentials, then adjust the project's Auth
email-rate limit only to a value within the provider's verified quota. Keep
email confirmation enabled. Never place SMTP credentials, a service-role key
or raw passwords in this public repository or GitHub Pages. Agree a KMU-owned
sender/domain and privacy review before inviting actual faculty; a personal
Gmail address is not an institutional sender policy.

The 32 hospital-teaching-hours = one practical-credit equivalent is a **pilot
calculation**, not an approved KMU workload rule. A teaching entry may use
practical/lab credits or hospital teaching hours, not both. OPD sessions and
patient-contact hours are aggregate clinical evidence only, with no extra
automatic points. Avoid entering patient identifiers or claiming the same
hours as both teaching and service. Annual MBBS subjects and teaching modules
do not require an invented course code; enter the actual title and academic
period. Existing saved cases with no hospital-hours field calculate as zero
hospital hours, so this additive change does not alter their scores.

The public RPC contract includes
`save_employee_profile(p_display_name, p_substantive_designation,
p_leadership_role, p_institute, p_service_cadre)` and
`save_employee_profile_with_scholar(p_display_name,
p_substantive_designation, p_leadership_role, p_institute, p_service_cadre,
p_scholar_identifier)` (used by the current client), plus
`save_appraisal_draft(p_case_id, p_cycle_year,
p_designation, p_institute, p_objective_payload)`,
`submit_appraisal_case(p_case_id)`,
`submit_assessor_review(p_case_id, p_subjective_payload)`, and the administrator
functions listed above. `p_case_id = NULL` creates a new year case only. If
one already exists, the RPC rejects that request and tells the faculty member
to open it from their Employee Portal. Editing an existing draft requires its
specific case ID; this prevents an unsaved/new browser form from silently
overwriting a different draft for the same year. Direct browser DML on these
tables is revoked.
Only the confirmed account owner can update their employee profile through the
RPC; even an administrator cannot use that RPC to edit someone else's profile.
The profile captures the user's **self-declared** name, substantive designation,
additional leadership role, KMU unit and BPS/TTS/Fixed Pay appointment basis.
These values are not HR-verified. Registration metadata contains only these
profile fields and cannot grant an assessor or administrator role. An invited or
older account with missing fields remains profile-incomplete until the signed-in
owner saves them. Annual appraisal cycle, work assignment and reference,
clinical-service evidence, committee membership and proposed reporting lines
remain case-specific rather than permanent employee profile attributes.
The optional public Google Scholar citations URL or ORCID iD/URL is stored on
the employee profile and copied into the research reference of a new appraisal
only when that field is blank. It does not verify publications or award points.

Draft saving checks the designation and institute arguments and five identity
fields in the objective payload against the owner's current employee profile.
The database also checks that same match when the case moves from draft to
submitted, including when submission is called directly through the RPC. If
the profile changes during an open draft, the user must refresh those fields
and save again before submitting. A later profile correction never rewrites a
submitted case: its recorded designation, institute and objective evidence
remain an immutable historical snapshot. The assessor should evaluate that case
snapshot, not silently substitute the employee's newer profile.
The **Save and return** control confirms a cloud draft save before closing the
appraisal and returning to the Employee Portal case list. A failed save leaves
the case open and displays an error; it must not imply that data reached the
database. In local demo mode, saving remains browser-only and the confirmation
dialog offers a return-to-start action.

The designation and institute catalogs reproduce the current portal's **pilot
dropdown vocabulary only**. They do not certify statutory notification;
appointment orders and current KMU notifications prevail. Update catalogs and
matching portal options together by reviewed change-control migration. In
particular, the Lakki Marwat option is explicitly marked for notification
verification.

This pilot intentionally has no amendment workflow: faculty evidence is
immutable after submission, and each assessor review is final. A formal system
needs approved correction, appeal, backup, retention and audit procedures, plus
server-side score recomputation and evidence verification.
