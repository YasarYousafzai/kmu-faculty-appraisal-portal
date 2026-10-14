# KMU appraisal pilot database

This is a **pilot access-control design**, not an approved personnel system. The
faculty and assessor score summaries are calculated in the browser and stored
as **unverified, self-declared provisional values**. Supabase checks identity,
case ownership, assignment and structural completeness; it does **not**
independently recompute the KMU appraisal formula or verify evidence.

## Review and deployment

1. Use a dedicated Supabase project and complete KMU privacy/security and
   retention review before entering any real personnel or patient information.
2. Review and run `migrations/202610140001_kmu_pilot_accounts.sql` **once** in
   Supabase SQL Editor. It creates no users or administrator. Keep project
   secrets and service-role keys out of the public website.
3. Create your personal Auth account through the portal **or** send an invitation
   from **Authentication → Users**. The invited person must open the email link
   and choose their own password on the portal; the administrator must not enter
   or handle that password. Confirm the email, then find its Auth UID in
   **Authentication → Users**. In SQL Editor,
   verify the intended email and `email_confirmed_at`, then manually bootstrap
   that **exact UID**:

   ```sql
   select id, email, email_confirmed_at
   from auth.users
   where id = '<CONFIRMED_AUTH_UID>'::uuid;

   insert into public.app_administrators (user_id, bootstrap_note)
   select id, 'Manually verified pilot administrator'
   from auth.users
   where id = '<CONFIRMED_AUTH_UID>'::uuid
     and email_confirmed_at is not null;
   ```

   Do not use an email match alone to grant the role. No client-side signup
   field, Auth metadata or browser script can grant administrator access.
4. The administrator can grant an assessor role to a confirmed account using
   `grant_assessor(p_user_id)` and assign one active assessor to a submitted
   dossier using `assign_assessor(p_case_id, p_assessor_id)`. The administrator
   may use `unassign_assessor(p_case_id, p_assessor_id)` or
   `revoke_assessor(p_user_id)` to remove access. Completed reviews and audit
   history remain; former assessors lose case/review reads immediately.
5. Run `tests/001_rls_synthetic.sql` only in an **empty, isolated pilot database**
   after migration. It creates synthetic `example.invalid` Auth accounts and ends
   in `ROLLBACK`. On 14 October 2026 it completed without errors in this empty
   pilot project; a subsequent query confirmed zero synthetic Auth users,
   profiles, cases, assignments, reviews, or events remained. All nine created
   public tables had RLS enabled. This does not replace a KMU production audit.

The Supabase default email service is limited to project-team recipients and is
not suitable for broader faculty invitations. Configure and review a dedicated
SMTP service before expanding registration; keep email confirmation enabled.

The public RPC contract is `save_appraisal_draft(p_case_id, p_cycle_year,
p_designation, p_institute, p_objective_payload)`,
`submit_appraisal_case(p_case_id)`,
`submit_assessor_review(p_case_id, p_subjective_payload)`, and the administrator
functions listed above. `p_case_id = NULL` creates or resumes that faculty
member's draft for a year. Direct browser DML on these tables is revoked.

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
