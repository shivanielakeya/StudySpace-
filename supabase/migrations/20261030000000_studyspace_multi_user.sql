create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  email text not null,
  avatar_url text check (avatar_url is null or avatar_url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index if not exists subjects_user_name_unique
  on public.subjects (user_id, lower(name));

create table if not exists public.topics (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  subject_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '',
  status text not null check (status in ('Learning', 'To review', 'Completed')),
  level text not null check (level in ('Need to Relearn', 'Basic Understanding', 'Understand Well', 'Interview Ready')),
  last_studied date not null,
  next_revision date,
  revision_count integer not null default 0 check (revision_count >= 0),
  notes text not null default '',
  resource text not null default '' check (resource = '' or resource ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete restrict
);

create unique index if not exists topics_user_subject_name_unique
  on public.topics (user_id, subject_id, lower(name));
create index if not exists topics_user_next_revision_idx
  on public.topics (user_id, next_revision);

create table if not exists public.revision_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic_id text not null,
  revision_date date not null,
  level text not null check (level in ('Need to Relearn', 'Basic Understanding', 'Understand Well', 'Interview Ready')),
  note text not null default '',
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  foreign key (user_id, topic_id) references public.topics (user_id, id) on delete cascade,
  unique (user_id, topic_id, position)
);

create index if not exists revision_history_user_date_idx
  on public.revision_history (user_id, revision_date desc);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interval_days integer[] not null default array[1, 3, 7, 15, 30],
  theme_dark boolean not null default false,
  legacy_import_completed_at timestamptz,
  has_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(interval_days) = 5),
  check (interval_days[1] between 1 and 365 and interval_days[2] between 1 and 365
    and interval_days[3] between 1 and 365 and interval_days[4] between 1 and 365
    and interval_days[5] between 1 and 365)
);

create table if not exists public.study_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_text text not null check (char_length(activity_text) <= 200),
  topic_name text not null check (char_length(topic_name) <= 100),
  activity_date date not null,
  level text not null default '' check (level = '' or level in ('Need to Relearn', 'Basic Understanding', 'Understand Well', 'Interview Ready')),
  activity_type text not null default 'update' check (activity_type in ('update', 'revision')),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (user_id, position)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at before update on public.topics
for each row execute function public.set_updated_at();

create or replace function public.handle_new_studyspace_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles as existing_profile (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when existing_profile.full_name = '' then excluded.full_name else existing_profile.full_name end;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subjects (user_id, name)
  values
    (new.id, 'Python'), (new.id, 'SQL'), (new.id, 'Statistics'),
    (new.id, 'Excel'), (new.id, 'Power BI'), (new.id, 'Machine Learning')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_studyspace on auth.users;
create trigger on_auth_user_created_studyspace
after insert on auth.users
for each row execute function public.handle_new_studyspace_user();
revoke all on function public.handle_new_studyspace_user() from public, anon, authenticated;

create or replace function public.sync_studyspace_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  if new.raw_user_meta_data ->> 'full_name' is distinct from old.raw_user_meta_data ->> 'full_name'
    and coalesce(new.raw_user_meta_data ->> 'full_name', '') <> '' then
    update public.profiles set full_name = new.raw_user_meta_data ->> 'full_name' where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_studyspace on auth.users;
create trigger on_auth_user_updated_studyspace
after update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_studyspace_user_email();
revoke all on function public.sync_studyspace_user_email() from public, anon, authenticated;

insert into public.profiles (id, full_name, email)
select id, coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), ''), coalesce(email, '')
from auth.users
on conflict (id) do update set email = excluded.email;

insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.subjects (user_id, name)
select users.id, subject.name
from auth.users as users
cross join (values ('Python'), ('SQL'), ('Statistics'), ('Excel'), ('Power BI'), ('Machine Learning')) as subject(name)
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.revision_history enable row level security;
alter table public.user_settings enable row level security;
alter table public.study_activities enable row level security;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own subjects" on public.subjects;
create policy "Users manage their own subjects" on public.subjects
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own topics" on public.topics;
create policy "Users manage their own topics" on public.topics
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own revision history" on public.revision_history;
create policy "Users manage their own revision history" on public.revision_history
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own settings" on public.user_settings;
create policy "Users manage their own settings" on public.user_settings
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own activities" on public.study_activities;
create policy "Users manage their own activities" on public.study_activities
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.subjects, public.topics, public.revision_history,
  public.user_settings, public.study_activities from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.subjects, public.topics,
  public.revision_history, public.user_settings, public.study_activities to authenticated;

create or replace function public.save_studyspace_data(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_topics jsonb := coalesce(payload -> 'topics', '[]'::jsonb);
  v_subjects jsonb := coalesce(payload -> 'subjects', '[]'::jsonb);
  v_activities jsonb := coalesce(payload -> 'activities', '[]'::jsonb);
  v_intervals integer[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(v_topics) is distinct from 'array'
    or jsonb_typeof(v_subjects) is distinct from 'array'
    or jsonb_typeof(v_activities) is distinct from 'array'
    or jsonb_typeof(payload -> 'intervals') is distinct from 'array' then
    raise exception 'Invalid StudySpace data';
  end if;

  select array_agg(value::integer order by ordinal)
  into v_intervals
  from jsonb_array_elements_text(payload -> 'intervals') with ordinality as interval_value(value, ordinal);
  if coalesce(cardinality(v_intervals), 0) <> 5 or exists (
    select 1 from unnest(v_intervals) as days where days is null or days < 1 or days > 365
  ) then
    raise exception 'Revision intervals must contain five values between 1 and 365 days';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_subjects) as item(value)
    where jsonb_typeof(item.value) is distinct from 'string'
      or char_length(trim(item.value #>> '{}')) not between 1 and 30
  ) then
    raise exception 'Subject names must contain between 1 and 30 characters';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_topics) as topic(
      id text, name text, subject text, status text, level text,
      "lastStudied" date, "revisionCount" integer, history jsonb
    )
    where topic.id is null or char_length(topic.id) not between 1 and 100
      or topic.name is null or char_length(trim(topic.name)) not between 1 and 100
      or topic.subject is null or char_length(trim(topic.subject)) not between 1 and 30
      or topic.status is null or topic.status not in ('Learning', 'To review', 'Completed')
      or topic.level is null or topic.level not in ('Need to Relearn', 'Basic Understanding', 'Understand Well', 'Interview Ready')
      or topic."lastStudied" is null
      or topic."revisionCount" is null or topic."revisionCount" < 0
      or (topic.history is not null and jsonb_typeof(topic.history) is distinct from 'array')
  ) then
    raise exception 'One or more topics are invalid';
  end if;

  insert into public.subjects (user_id, name)
  select v_user_id, trim(subject_value.value)
  from jsonb_array_elements_text(v_subjects) as subject_value(value)
  where char_length(trim(subject_value.value)) between 1 and 30
  on conflict (user_id, (lower(name))) do nothing;

  if exists (
    select 1
    from jsonb_to_recordset(v_topics) as topic(id text, subject text)
    where not exists (
      select 1 from public.subjects as subject
      where subject.user_id = v_user_id and lower(subject.name) = lower(trim(topic.subject))
    )
  ) then
    raise exception 'Every topic must refer to one of the account subjects';
  end if;

  delete from public.topics as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1 from jsonb_array_elements(v_topics) as item(value)
      where item.value ->> 'id' = existing.id
    );

  insert into public.topics (
    user_id, id, subject_id, name, description, status, level, last_studied,
    next_revision, revision_count, notes, resource
  )
  select
    v_user_id, topic.id, subject.id, trim(topic.name), coalesce(topic.description, ''),
    topic.status, topic.level, topic."lastStudied", topic."nextRevision",
    topic."revisionCount", coalesce(topic.notes, ''), coalesce(topic.resource, '')
  from jsonb_to_recordset(v_topics) as topic(
    id text, name text, subject text, description text, status text, level text,
    "lastStudied" date, "nextRevision" date, "revisionCount" integer,
    notes text, resource text, history jsonb
  )
  join public.subjects as subject
    on subject.user_id = v_user_id and lower(subject.name) = lower(topic.subject)
  on conflict (user_id, id) do update set
    subject_id = excluded.subject_id,
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    level = excluded.level,
    last_studied = excluded.last_studied,
    next_revision = excluded.next_revision,
    revision_count = excluded.revision_count,
    notes = excluded.notes,
    resource = excluded.resource;

  delete from public.subjects as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1 from jsonb_array_elements_text(v_subjects) as item(value)
      where lower(trim(item.value)) = lower(existing.name)
    )
    and not exists (
      select 1 from public.topics as topic
      where topic.user_id = v_user_id and topic.subject_id = existing.id
    );

  delete from public.revision_history where user_id = v_user_id;
  insert into public.revision_history (user_id, topic_id, revision_date, level, note, position)
  select
    v_user_id, topic.id, (entry.value ->> 'date')::date,
    entry.value ->> 'level', coalesce(entry.value ->> 'note', ''), entry.ordinality::integer
  from jsonb_to_recordset(v_topics) as topic(id text, history jsonb)
  cross join lateral jsonb_array_elements(coalesce(topic.history, '[]'::jsonb))
    with ordinality as entry(value, ordinality);

  delete from public.study_activities where user_id = v_user_id;
  insert into public.study_activities (
    user_id, activity_text, topic_name, activity_date, level, activity_type, position
  )
  select
    v_user_id, activity.activity_text, activity.topic_name, activity.activity_date,
    coalesce(activity.level, ''), coalesce(activity.activity_type, 'update'), activity.position
  from jsonb_to_recordset(v_activities) as activity(
    activity_text text, topic_name text, activity_date date,
    level text, activity_type text, position integer
  );

  insert into public.user_settings as existing_settings (
    user_id, interval_days, theme_dark, legacy_import_completed_at, has_data
  ) values (
    v_user_id, v_intervals, coalesce((payload ->> 'dark')::boolean, false),
    nullif(payload ->> 'legacyImportCompletedAt', '')::timestamptz, true
  )
  on conflict (user_id) do update set
    interval_days = excluded.interval_days,
    theme_dark = excluded.theme_dark,
    legacy_import_completed_at = coalesce(
      existing_settings.legacy_import_completed_at,
      excluded.legacy_import_completed_at
    ),
    has_data = true;
end;
$$;

revoke all on function public.save_studyspace_data(jsonb) from public, anon;
grant execute on function public.save_studyspace_data(jsonb) to authenticated;
