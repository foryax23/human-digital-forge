-- Client RLS hardening (analysis 2026-10-03, section 2 item 11): a signed-in client keeps
-- full use of their own workspace but can no longer write the team's side of it.
--
-- ADDITIVE and SAFE TO RUN TWICE. Nothing is dropped except policies and triggers this same
-- file creates (drop ... if exists, then create). The existing permissive policies from
-- supabase/migrations/20260602123020_*.sql and 20260602131446_*.sql stay as they are; this
-- file adds RESTRICTIVE policies, which Postgres ANDs with every permissive one, so the
-- limits hold whatever other permissive policy exists. Five BEFORE triggers protect the
-- team-only columns. One column is added (project_files.uploaded_by).
--
-- Who is limited: only the client roles, anon and authenticated (the browser and the MCP
-- tools with the client's token). The server's service role (the admin panel, the webhook,
-- the contact pipeline), SECURITY DEFINER functions (handle_new_user) and the SQL editor are
-- not affected: the triggers return early for any other role, and RLS does not apply to them.
--
-- The app works before and after this is applied: the portal no longer sends the team-only
-- fields, reads project_files.uploaded_by only when the column exists (falls back on 42703),
-- and treats a refused delete (no row returned) as an error.
--
-- BEHAVIOUR CHANGE, policy by policy (before -> after), for a signed-in client on their OWN rows
-- (other accounts' rows were already invisible and untouchable):
--   messages
--     insert : any sender ('team' too), any project_id that exists (another client's project
--              too, which put the message under that project in the admin panel)
--           -> sender must be 'client'; project_id null or one of the client's own projects.
--     update : could rewrite any of their rows, team replies included (body, sender, project)
--           -> only `read` may change (trigger messages_client_guard).
--     delete : could delete team replies
--           -> only their own messages (sender 'client').
--   projects
--     insert : could create a project already "Completed", step 5, with any next action
--           -> status, current_step, next_action and created_at are set to the defaults
--              ('Request submitted', 0, null, now()) whatever the client sent (trigger).
--     update : could mark their project done or change the step and next action
--           -> status, current_step, next_action and created_at cannot change (error 42501);
--              title, description, service_type, budget and timeline still can.
--     delete : could delete a project, which cascades to the team's messages and file rows
--           -> no client deletes (the team deletes, e.g. after an account deletion request).
--   consultations
--     insert : could book themselves straight to 'scheduled' (the column default) or 'confirmed'
--           -> status is always 'requested' (trigger); the proposed time is kept.
--     update : could confirm their own consultation or move a confirmed time
--           -> status and created_at cannot change; scheduled_at only while still 'requested'.
--     delete : any consultation
--           -> only a consultation still 'requested' (withdrawing a request).
--   project_files (new column uploaded_by: 'client' or 'team')
--     insert : any project_id, any file_path
--           -> uploaded_by is always 'client' (trigger); project_id null or their own
--              project; file_path null or inside their own storage folder ("<user id>/...").
--     update : could edit or re-point any row, a team delivery too
--           -> only their own uploads, under the same project and folder rules.
--     delete : could delete a team delivery
--           -> only their own uploads.
--   storage.objects, bucket project-files
--     delete / update (overwrite) : any object in their folder
--           -> not an object that a project_files row marks as a team delivery. Other buckets
--              are not affected (the policies pass for bucket_id <> 'project-files').
--   profiles
--     update : could set profiles.email to any address; the admin panel's account search (plan
--              assignment) reads that column, so a client could pose as another company
--           -> email stays what it was (silently kept, so a profile save never fails);
--              a client-side insert takes the e-mail from the sign-in token.
-- Unchanged: every SELECT; invoices and subscribers (already read-only for clients);
-- contact_enquiries (server only); realtime.messages (broadcast stays open to signed-in users,
-- item 18; nothing uses it).
--
-- Existing project_files rows become uploaded_by = 'client' (the team has no screen to deliver
-- files, so every file so far came from a client). New rows written by the server default to
-- 'team'. If the team placed a delivery by hand earlier, mark it:
--   update public.project_files set uploaded_by = 'team' where id = '<file id>';
--
-- BEFORE APPLYING (owner, SQL editor, read only): the current policies on these tables.
--   select tablename, policyname, permissive, cmd from pg_policies
--    where (schemaname = 'public' and tablename in ('messages','projects','project_files','consultations','profiles'))
--       or (schemaname = 'storage' and tablename = 'objects')
--    order by tablename, cmd, policyname;
-- Expected: the "Users can ..." policies from the migrations above, all PERMISSIVE. Others may
-- exist; the restrictive policies below apply on top of them either way.
--
-- HOW TO APPLY (owner): in Lovable, ask:
--   "Apply drizzle/pending/client_rls_hardening.sql exactly as written. It adds restrictive RLS
--    policies, five BEFORE triggers with their functions and the column
--    project_files.uploaded_by. Do not change it, do not drop or rename any existing policy,
--    and do not add any grant. Then regenerate the Supabase types."
-- Lovable saves its own numbered copy in drizzle/migrations/; once it is there, this pending
-- file is deleted (drizzle/README.md). Nobody runs this SQL by hand.
--
-- CHECK AFTERWARDS (SQL editor), each must answer as noted:
--   select count(*) from pg_policies where permissive = 'RESTRICTIVE' and policyname in (
--     'Clients post only as client on their own projects', 'Clients delete only their own messages',
--     'Clients cannot delete projects', 'Clients withdraw only pending consultations',
--     'Clients add files only to their own projects and folder', 'Clients edit only their own uploads',
--     'Clients delete only their own uploads', 'Clients cannot remove team deliveries',
--     'Clients cannot overwrite team deliveries');                                            -- 9
--   select count(*) from pg_trigger where not tgisinternal and tgname in ('messages_client_guard',
--     'projects_client_guard', 'consultations_client_guard', 'project_files_client_guard',
--     'profiles_client_guard');                                                               -- 5
--   select column_default from information_schema.columns where table_schema = 'public'
--     and table_name = 'project_files' and column_name = 'uploaded_by';                        -- 'team'::text
--   select uploaded_by, count(*) from public.project_files group by 1;                         -- only 'client' at first
--
-- BEHAVIOUR TEST (SQL editor, run as ONE script; it ends with ROLLBACK, so nothing is kept).
-- Replace <CLIENT_ID> with the user ID of a test client account. Every line must say "ok".
--   begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', '<CLIENT_ID>', 'role', 'authenticated', 'email', 'test@example.com')::text, true);
--   set local role authenticated;
--   do $t$
--   declare
--     uid uuid := auth.uid();
--     pid uuid;
--     cid uuid;
--     n int;
--     v text;
--   begin
--     begin
--       insert into public.messages (user_id, sender, body) values (uid, 'team', 'rls test');
--       raise notice 'FAIL 1: a client posted as the team';
--     exception when insufficient_privilege then raise notice 'ok 1: posting as the team is refused';
--     end;
--     begin
--       insert into public.messages (user_id, project_id, sender, body)
--         values (uid, gen_random_uuid(), 'client', 'rls test');
--       raise notice 'FAIL 2: a message went to a project that is not the client''s';
--     exception when insufficient_privilege then raise notice 'ok 2: someone else''s project is refused';
--     end;
--     insert into public.messages (user_id, sender, body) values (uid, 'client', 'rls test');
--     raise notice 'ok 3: a client message is accepted';
--     insert into public.projects (user_id, title, status, current_step, next_action)
--       values (uid, 'rls test', 'Completed', 5, 'nothing') returning id, status into pid, v;
--     raise notice '% 4: a new project starts as "%"', case when v = 'Request submitted' then 'ok' else 'FAIL' end, v;
--     begin
--       update public.projects set status = 'Completed' where id = pid;
--       raise notice 'FAIL 5: a client changed a project status';
--     exception when insufficient_privilege then raise notice 'ok 5: project status is the team''s';
--     end;
--     update public.projects set title = 'rls test, renamed' where id = pid;
--     raise notice 'ok 6: the client can still rename the project';
--     delete from public.projects where id = pid;
--     get diagnostics n = row_count;
--     raise notice '% 7: deleting a project removed % rows', case when n = 0 then 'ok' else 'FAIL' end, n;
--     insert into public.consultations (user_id, title, status) values (uid, 'rls test', 'confirmed')
--       returning id, status into cid, v;
--     raise notice '% 8: a new consultation is "%"', case when v = 'requested' then 'ok' else 'FAIL' end, v;
--     begin
--       update public.consultations set status = 'confirmed' where id = cid;
--       raise notice 'FAIL 9: a client confirmed a consultation';
--     exception when insufficient_privilege then raise notice 'ok 9: confirming is the team''s';
--     end;
--     begin
--       insert into public.project_files (user_id, name, file_path) values (uid, 'rls test', 'someone-else/x.pdf');
--       raise notice 'FAIL 10: a file row points outside the client''s folder';
--     exception when insufficient_privilege then raise notice 'ok 10: other folders are refused';
--     end;
--     insert into public.project_files (user_id, name, file_path, uploaded_by)
--       values (uid, 'rls test', uid::text || '/rls-test.pdf', 'team') returning uploaded_by into v;
--     raise notice '% 11: a client upload is marked "%"', case when v = 'client' then 'ok' else 'FAIL' end, v;
--     update public.profiles set email = 'someone@else.test' where id = uid;
--     select email into v from public.profiles where id = uid;
--     raise notice '% 12: the profile e-mail is "%"', case when v is distinct from 'someone@else.test' then 'ok' else 'FAIL' end, v;
--     select count(*) into n from public.messages where user_id = uid and sender = 'team';
--     if n = 0 then
--       raise notice 'skip 13-14: this account has no team message to test with';
--     else
--       begin
--         update public.messages set body = 'changed' where user_id = uid and sender = 'team';
--         raise notice 'FAIL 13: a client edited a team reply';
--       exception when insufficient_privilege then raise notice 'ok 13: team replies cannot be edited';
--       end;
--       delete from public.messages where user_id = uid and sender = 'team';
--       get diagnostics n = row_count;
--       raise notice '% 14: deleting team replies removed % rows', case when n = 0 then 'ok' else 'FAIL' end, n;
--     end if;
--   end
--   $t$;
--   rollback;
--
-- Removal, if ever needed (the app keeps working; the old, looser behaviour comes back):
--   drop policy if exists "Clients post only as client on their own projects" on public.messages;
--   drop policy if exists "Clients delete only their own messages" on public.messages;
--   drop policy if exists "Clients cannot delete projects" on public.projects;
--   drop policy if exists "Clients withdraw only pending consultations" on public.consultations;
--   drop policy if exists "Clients add files only to their own projects and folder" on public.project_files;
--   drop policy if exists "Clients edit only their own uploads" on public.project_files;
--   drop policy if exists "Clients delete only their own uploads" on public.project_files;
--   drop policy if exists "Clients cannot remove team deliveries" on storage.objects;
--   drop policy if exists "Clients cannot overwrite team deliveries" on storage.objects;
--   drop trigger if exists messages_client_guard on public.messages;
--   drop trigger if exists projects_client_guard on public.projects;
--   drop trigger if exists consultations_client_guard on public.consultations;
--   drop trigger if exists project_files_client_guard on public.project_files;
--   drop trigger if exists profiles_client_guard on public.profiles;
--   (the functions and the uploaded_by column can stay; they do nothing without the triggers)

-- ============================================================ project_files.uploaded_by
-- Existing rows get 'client' from the column's first default; new rows default to 'team'
-- (the server), and the trigger below forces 'client' for every client insert.
alter table public.project_files add column if not exists uploaded_by text not null default 'client';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_files_uploaded_by_check'
                 and conrelid = 'public.project_files'::regclass) then
    alter table public.project_files add constraint project_files_uploaded_by_check
      check (uploaded_by in ('client', 'team'));
  end if;
end $$;

alter table public.project_files alter column uploaded_by set default 'team';

-- ============================================================ guard triggers
-- Each returns early for any role other than anon and authenticated (current_user is the
-- caller's role: these functions are SECURITY INVOKER).

create or replace function public.messages_client_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.project_id is distinct from old.project_id
     or new.sender is distinct from old.sender
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'messages: a client can only mark a message as read'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.projects_client_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'Request submitted';
    new.current_step := 0;
    new.next_action := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if new.status is distinct from old.status
     or new.current_step is distinct from old.current_step
     or new.next_action is distinct from old.next_action
     or new.created_at is distinct from old.created_at then
    raise exception 'projects: status, step and next action are set by the Vortex Hub team'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.consultations_client_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.created_at := now();
    return new;
  end if;
  if new.status is distinct from old.status
     or new.created_at is distinct from old.created_at
     or (new.scheduled_at is distinct from old.scheduled_at and old.status <> 'requested') then
    raise exception 'consultations: status and confirmed time are set by the Vortex Hub team'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.project_files_client_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.uploaded_by := 'client';
    new.created_at := now();
    return new;
  end if;
  if new.uploaded_by is distinct from old.uploaded_by
     or new.created_at is distinct from old.created_at then
    raise exception 'project_files: who uploaded a file cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.profiles_client_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.email := nullif(auth.jwt() ->> 'email', '');
    return new;
  end if;
  -- Kept silently: a profile save that sends the e-mail along still succeeds.
  new.email := old.email;
  return new;
end $$;

revoke all on function public.messages_client_guard() from public, anon, authenticated;
revoke all on function public.projects_client_guard() from public, anon, authenticated;
revoke all on function public.consultations_client_guard() from public, anon, authenticated;
revoke all on function public.project_files_client_guard() from public, anon, authenticated;
revoke all on function public.profiles_client_guard() from public, anon, authenticated;

-- Named so they fire before the tables' updated_at triggers (Postgres fires them by name).
drop trigger if exists messages_client_guard on public.messages;
create trigger messages_client_guard before update on public.messages
  for each row execute function public.messages_client_guard();

drop trigger if exists projects_client_guard on public.projects;
create trigger projects_client_guard before insert or update on public.projects
  for each row execute function public.projects_client_guard();

drop trigger if exists consultations_client_guard on public.consultations;
create trigger consultations_client_guard before insert or update on public.consultations
  for each row execute function public.consultations_client_guard();

drop trigger if exists project_files_client_guard on public.project_files;
create trigger project_files_client_guard before insert or update on public.project_files
  for each row execute function public.project_files_client_guard();

drop trigger if exists profiles_client_guard on public.profiles;
create trigger profiles_client_guard before insert or update on public.profiles
  for each row execute function public.profiles_client_guard();

-- ============================================================ restrictive policies
-- RLS checks WITH CHECK on the row as the BEFORE triggers left it, so the forced values above
-- (uploaded_by 'client', status 'requested') are what these policies see.

-- messages
drop policy if exists "Clients post only as client on their own projects" on public.messages;
create policy "Clients post only as client on their own projects" on public.messages
  as restrictive for insert to authenticated
  with check (
    sender = 'client'
    and (
      messages.project_id is null
      or exists (select 1 from public.projects p
                 where p.id = messages.project_id and p.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Clients delete only their own messages" on public.messages;
create policy "Clients delete only their own messages" on public.messages
  as restrictive for delete to authenticated
  using (sender = 'client');

-- projects
drop policy if exists "Clients cannot delete projects" on public.projects;
create policy "Clients cannot delete projects" on public.projects
  as restrictive for delete to authenticated
  using (false);

-- consultations
drop policy if exists "Clients withdraw only pending consultations" on public.consultations;
create policy "Clients withdraw only pending consultations" on public.consultations
  as restrictive for delete to authenticated
  using (status = 'requested');

-- project_files
drop policy if exists "Clients add files only to their own projects and folder" on public.project_files;
create policy "Clients add files only to their own projects and folder" on public.project_files
  as restrictive for insert to authenticated
  with check (
    uploaded_by = 'client'
    and (
      project_files.project_id is null
      or exists (select 1 from public.projects p
                 where p.id = project_files.project_id and p.user_id = (select auth.uid()))
    )
    and (
      project_files.file_path is null
      or split_part(project_files.file_path, '/', 1) = (select auth.uid())::text
    )
  );

drop policy if exists "Clients edit only their own uploads" on public.project_files;
create policy "Clients edit only their own uploads" on public.project_files
  as restrictive for update to authenticated
  using (uploaded_by = 'client')
  with check (
    uploaded_by = 'client'
    and (
      project_files.project_id is null
      or exists (select 1 from public.projects p
                 where p.id = project_files.project_id and p.user_id = (select auth.uid()))
    )
    and (
      project_files.file_path is null
      or split_part(project_files.file_path, '/', 1) = (select auth.uid())::text
    )
  );

drop policy if exists "Clients delete only their own uploads" on public.project_files;
create policy "Clients delete only their own uploads" on public.project_files
  as restrictive for delete to authenticated
  using (uploaded_by = 'client');

-- storage: a team delivery's object stays, even inside the client's folder
drop policy if exists "Clients cannot remove team deliveries" on storage.objects;
create policy "Clients cannot remove team deliveries" on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'project-files'
    or not exists (select 1 from public.project_files f
                   where f.file_path = objects.name and f.uploaded_by = 'team')
  );

drop policy if exists "Clients cannot overwrite team deliveries" on storage.objects;
create policy "Clients cannot overwrite team deliveries" on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'project-files'
    or not exists (select 1 from public.project_files f
                   where f.file_path = objects.name and f.uploaded_by = 'team')
  );
