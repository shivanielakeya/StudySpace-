# StudySpace

StudySpace is a static HTML, CSS, and vanilla JavaScript study tracker. The dashboard and revision workflow stay client-rendered; Supabase provides invite-only authentication and a PostgreSQL database protected with Row Level Security (RLS). No application server or public sign-up flow is used.

## Architecture

- `index.html` loads the Supabase JavaScript client and the local scripts.
- `app.js` renders the existing dashboard, topic library, revision room, progress views, settings, and authentication screens.
- `auth.js` contains Supabase Auth operations.
- `study-data.js` loads and saves the signed-in user's study data.
- `supabase-client.js` creates the shared Supabase client.
- `supabase-config.js` contains only the public project URL and publishable/anon key.
- `supabase/migrations/20261030000000_studyspace_multi_user.sql` creates the tables, constraints, account triggers, save function, and RLS policies.

Passwords are sent directly to Supabase Auth over HTTPS and are never stored by StudySpace. The browser persists the Supabase session using the Supabase client. The frontend contains no service-role key, database password, or administrator credential.

## Supabase setup

1. The current [supabase-config.js](./supabase-config.js) is already populated with a Supabase project URL and publishable key. These browser values are public; never put a `service_role` key or database password there.
2. In the Supabase SQL Editor, run the complete migration at [`supabase/migrations/20261030000000_studyspace_multi_user.sql`](./supabase/migrations/20261030000000_studyspace_multi_user.sql).
3. In **Authentication → Providers → Email**, keep email/password and email confirmation enabled, and disable **Allow new users to sign up**. Do not use a client-side sign-up form as an invitation check.
4. In **Authentication → URL Configuration**, set:
   - Site URL: `https://shivanielakeya.github.io/StudySpace-/`
   - Redirect URL: `https://shivanielakeya.github.io/StudySpace-/**`
   - Redirect URL: `http://localhost:5500/**`
   The wildcard permits password-reset query parameters. Invite links should point to the deployed app URL.
5. To create an account, use **Authentication → Users → Invite user** in the Supabase Dashboard. The invite link opens this app, where the recipient sets a password. There is intentionally no public registration option.
6. Publish the static files at `https://shivanielakeya.github.io/StudySpace-/`. For local testing, serve the repository at `http://localhost:5500/`, for example with VS Code Live Server configured to port 5500.

The application accepts the invitation callback session and requires an invited account to set a password before opening the dashboard. Password recovery sends a Supabase email link back to the configured app URL. Verify the invitation and recovery templates/redirects in the Supabase project before inviting real users.

**Important:** a live check of this project's public Auth settings currently reports `disable_signup: false`. Turn off **Allow new users to sign up** in the Dashboard before treating the project as invite-only or deploying it for real users. The app has no public sign-up form, but that alone does not disable Supabase's public signup API.

## Data model and migration

The app's in-memory data keeps the existing shape: subjects, topics, per-topic revision history, revision intervals, theme, and recent activities. `study-data.js` maps that model to `profiles`, `subjects`, `topics`, `revision_history`, `user_settings`, and `study_activities`. A database function saves a user's snapshot in one transaction; its security-invoker behavior remains subject to each table's RLS policy.

Existing data remains in the browser under `studyspace-data-v1`. After sign-in, open **Settings → Import browser data**:

1. Download the browser backup.
2. Confirm that the backup was downloaded.
3. If this account already has cloud study data, explicitly acknowledge replacement and confirm the final prompt.

The migration preserves topic IDs, revision history, subjects, settings, and activities where represented in the existing export. It records a per-account completion timestamp to prevent accidental repeat imports. It does not remove or modify the LocalStorage copy. Normal JSON imports and exports remain available; importing a JSON file replaces cloud data only after confirmation.

## RLS verification

Run the migration first, create two invited test accounts, and add at least one topic for each. Obtain their UUIDs and the topic ID for User B from **Authentication → Users** and the `topics` table. Run these checks in the SQL Editor as the database owner, switching to the `authenticated` role before querying. Replace the example UUIDs/topic ID:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select user_id, id from public.topics;
-- Every returned row must belong to User A.
select user_id, id from public.subjects;
select user_id, topic_id from public.revision_history;
select user_id from public.user_settings;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
update public.topics set name = 'Not allowed'
where user_id = 'USER_B_UUID' and id = 'USER_B_TOPIC_ID';
-- Expected: UPDATE 0 (no row is visible to User A).
delete from public.topics
where user_id = 'USER_B_UUID' and id = 'USER_B_TOPIC_ID';
-- Expected: DELETE 0 (no row is visible to User A).
rollback;
```

To test an insert ownership check, run this separately; the insert should fail with an RLS violation:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
do $$
begin
  begin
    insert into public.study_activities
      (user_id, activity_text, topic_name, activity_date, activity_type, position)
    values
      ('USER_B_UUID', 'Unauthorized write test', 'Test', current_date, 'update', 999999);
  exception when insufficient_privilege then
    raise notice 'RLS rejected the cross-user insert as expected.';
    return;
  end;
  raise exception 'RLS failed: the cross-user insert unexpectedly succeeded.';
end
$$;
rollback;
```

Repeat the read checks with User B's UUID. Do not treat frontend filtering as a security test. The SQL policies and direct-database checks are essential before production use.

## Local verification and deployment checklist

- Run `node --check app.js`, `node --check auth.js`, `node --check study-data.js`, and `node --check supabase-client.js`.
- Configure a real Supabase project and test invited setup, login/logout, session refresh, reset links, and both accounts.
- Run the RLS checks above with two distinct users, including cross-user update/delete attempts.
- Exercise topic CRUD, duplicate prevention, revision scheduling/history, settings, migration, JSON import/export, and mobile/desktop layouts.
- Confirm the deployed URL and local URL are in the Supabase Auth Redirect URLs allow-list.

This repository does not include Supabase credentials or a configured test project. Authentication, live database behavior, and RLS therefore need the manual project-level verification above; they should not be considered production-verified until those tests pass.
