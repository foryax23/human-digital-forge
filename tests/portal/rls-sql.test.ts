import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/*
 * Static checks of drizzle/pending/client_rls_hardening.sql (there is no Postgres here; the
 * behaviour test for the owner is in the file's header). They hold the file to the
 * drizzle/README.md rules: additive, safe to run twice, and the header's checks match what
 * the file creates.
 */

const FILE = new URL("../../drizzle/pending/client_rls_hardening.sql", import.meta.url);
const raw = readFileSync(FILE, "utf8");
/** The SQL without comment lines (the header holds example statements). */
const sql = raw
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const header = raw
  .split("\n")
  .filter((line) => line.trimStart().startsWith("--"))
  .join("\n");

const policies = [...sql.matchAll(/create policy "([^"]+)" on ([a-z_.]+)\s+as (\w+)/gi)].map(
  (m) => ({ name: m[1], table: m[2], kind: m[3].toLowerCase() }),
);
const triggers = [...sql.matchAll(/create trigger (\w+) before ([a-z ]+?) on ([a-z_.]+)/gi)].map(
  (m) => ({ name: m[1], events: m[2], table: m[3] }),
);
const functions = [...sql.matchAll(/create or replace function (public\.\w+)\(\)/gi)].map(
  (m) => m[1],
);

test("nothing destructive: no table, column or row is dropped or rewritten", () => {
  for (const banned of [
    /\bdrop\s+table\b/i,
    /\bdrop\s+column\b/i,
    /\btruncate\b/i,
    /\bdelete\s+from\b/i,
    /\bupdate\s+public\./i,
    /\balter\s+table\s+\S+\s+rename\b/i,
    /\bgrant\b/i,
    /\bsecurity\s+definer\b/i,
  ])
    assert.doesNotMatch(sql, banned, String(banned));
  // The only drops are of this file's own policies and triggers.
  const drops = [...sql.matchAll(/\bdrop\s+(\w+)/gi)].map((m) => m[1].toLowerCase());
  assert.ok(
    drops.every((d) => d === "policy" || d === "trigger"),
    drops.join(","),
  );
});

test("every policy is restrictive, for the client role only, and dropped first by its own name", () => {
  assert.equal(policies.length, 9);
  for (const p of policies) {
    assert.equal(p.kind, "restrictive", p.name);
    const drop = `drop policy if exists "${p.name}" on ${p.table};`;
    const dropAt = sql.indexOf(drop);
    const createAt = sql.indexOf(`create policy "${p.name}" on ${p.table}`);
    assert.ok(dropAt >= 0 && dropAt < createAt, `drop before create: ${p.name}`);
    const statement = sql.slice(createAt, sql.indexOf(";", createAt));
    assert.match(statement, /\bto authenticated\b/, p.name);
  }
  // None of the original permissive policies is dropped or replaced.
  assert.doesNotMatch(sql, /drop policy if exists "Users can/i);
});

test("every trigger is dropped first and calls its own guard function", () => {
  assert.equal(triggers.length, 5);
  for (const tr of triggers) {
    const dropAt = sql.indexOf(`drop trigger if exists ${tr.name} on ${tr.table};`);
    const createAt = sql.indexOf(`create trigger ${tr.name} before`);
    assert.ok(dropAt >= 0 && dropAt < createAt, tr.name);
    assert.ok(functions.includes(`public.${tr.name}`), `function for ${tr.name}`);
  }
  assert.deepEqual(triggers.map((t) => `${t.table}:${t.events}`).sort(), [
    "public.consultations:insert or update",
    "public.messages:update",
    "public.profiles:insert or update",
    "public.project_files:insert or update",
    "public.projects:insert or update",
  ]);
});

test("guard functions: only client roles are limited, with a fixed search_path and no grants", () => {
  assert.equal(functions.length, 5);
  for (const fn of functions) {
    const at = sql.indexOf(`create or replace function ${fn}()`);
    const body = sql.slice(at, sql.indexOf("end $$;", at));
    assert.match(body, /set search_path = ''/, fn);
    assert.match(
      body,
      /if current_user not in \('anon', 'authenticated'\) then\s+return new;\s+end if;/,
      `${fn} returns early for the server`,
    );
    assert.ok(
      sql.includes(`revoke all on function ${fn}() from public, anon, authenticated;`),
      `${fn} revoked`,
    );
  }
});

test("team-only columns are the ones the triggers protect", () => {
  const body = (fn: string) => {
    const at = sql.indexOf(`create or replace function public.${fn}()`);
    return sql.slice(at, sql.indexOf("end $$;", at));
  };
  for (const col of ["status", "current_step", "next_action"])
    assert.match(
      body("projects_client_guard"),
      new RegExp(`new\\.${col} is distinct from old\\.${col}`),
    );
  assert.match(body("projects_client_guard"), /new\.status := 'Request submitted'/);
  assert.match(body("consultations_client_guard"), /new\.status := 'requested'/);
  assert.match(body("consultations_client_guard"), /old\.status <> 'requested'/);
  for (const col of ["user_id", "project_id", "sender", "body"])
    assert.match(
      body("messages_client_guard"),
      new RegExp(`new\\.${col} is distinct from old\\.${col}`),
    );
  assert.doesNotMatch(body("messages_client_guard"), /new\.read/);
  assert.match(body("project_files_client_guard"), /new\.uploaded_by := 'client'/);
  assert.match(body("profiles_client_guard"), /new\.email := old\.email/);
});

test("message and file policies check the project's owner and the sender", () => {
  const policy = (name: string) => {
    const at = sql.indexOf(`create policy "${name}"`);
    return sql.slice(at, sql.indexOf(";", at));
  };
  const post = policy("Clients post only as client on their own projects");
  assert.match(post, /for insert/);
  assert.match(post, /sender = 'client'/);
  assert.match(post, /p\.id = messages\.project_id and p\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(policy("Clients delete only their own messages"), /using \(sender = 'client'\)/);
  assert.match(policy("Clients cannot delete projects"), /for delete[\s\S]*using \(false\)/);
  const add = policy("Clients add files only to their own projects and folder");
  assert.match(add, /uploaded_by = 'client'/);
  assert.match(
    add,
    /split_part\(project_files\.file_path, '\/', 1\) = \(select auth\.uid\(\)\)::text/,
  );
  for (const name of [
    "Clients cannot remove team deliveries",
    "Clients cannot overwrite team deliveries",
  ]) {
    const p = policy(name);
    assert.match(p, /on storage\.objects/);
    assert.match(p, /bucket_id <> 'project-files'/, `${name} leaves other buckets alone`);
    assert.match(p, /f\.file_path = objects\.name and f\.uploaded_by = 'team'/);
  }
});

test("the new column is added safely and its constraint only once", () => {
  assert.match(
    sql,
    /alter table public\.project_files add column if not exists uploaded_by text not null default 'client';/,
  );
  assert.match(
    sql,
    /if not exists \(select 1 from pg_constraint where conname = 'project_files_uploaded_by_check'/,
  );
  const addAt = sql.indexOf("add column if not exists uploaded_by");
  const defaultAt = sql.indexOf("alter column uploaded_by set default 'team'");
  assert.ok(addAt >= 0 && defaultAt > addAt, "existing rows get 'client', new server rows 'team'");
});

test("the header's checks and removal list name exactly what the file creates", () => {
  for (const p of policies) {
    assert.ok(header.includes(`'${p.name}'`), `check query lists ${p.name}`);
    assert.ok(
      header.includes(`drop policy if exists "${p.name}" on ${p.table};`),
      `removal: ${p.name}`,
    );
  }
  assert.match(header, /permissive = 'RESTRICTIVE' and policyname in \(/);
  assert.match(header, /-- 9\b/);
  for (const tr of triggers) {
    assert.ok(header.includes(`'${tr.name}'`), `check query lists ${tr.name}`);
    assert.ok(
      header.includes(`drop trigger if exists ${tr.name} on ${tr.table};`),
      `removal: ${tr.name}`,
    );
  }
  // The behaviour test leaves nothing behind.
  const testBlock = header.slice(header.indexOf("BEHAVIOUR TEST"));
  assert.match(testBlock, /--\s+begin;/);
  assert.match(testBlock, /--\s+rollback;/);
  assert.match(header, /HOW TO APPLY/);
});
