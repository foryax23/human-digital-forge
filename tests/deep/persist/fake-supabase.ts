/*
 * A fake Supabase client for the persistence tests: in-memory tables behind
 * the subset of the supabase-js query builder the deep stores use (select with
 * head counts, insert/upsert/update/delete with returning, eq/neq/gte/lt/lte/in
 * on columns and on JSON paths "answers->>key", order, limit, maybeSingle,
 * single), column defaults per table (as the SQL declares them), the primary key on
 * insert (23505), HEAD requests to a missing table answered as the real client
 * does (no error, no count), scripted RPC
 * handlers (fake-lovable-sql.ts ports the applied SQL functions) and error
 * injection. It never talks to a network: the real database is never touched by
 * a test.
 */

type Row = Record<string, unknown>;
export type DbError = { code?: string; message?: string };
type Op = "select" | "insert" | "upsert" | "update" | "delete";

export type FakeOptions = {
  now?: () => number;
  /** Return an error for an operation (table, op) or an RPC (fn): injected failures. */
  fail?: (target: { table?: string; fn?: string; op?: Op }) => DbError | null;
  /** Called before an update is applied (simulates a concurrent writer). */
  beforeUpdate?: (table: string, rows: Row[]) => void;
};

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

function read(row: Row, column: string): unknown {
  if (column.includes("->>")) {
    const [col, key] = column.split("->>");
    const v = (row[col] as Record<string, unknown> | undefined)?.[key];
    return v === undefined || v === null
      ? null
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  }
  return row[column];
}

function compare(a: unknown, b: unknown): number {
  const da = typeof a === "string" ? Date.parse(a) : NaN;
  const db = typeof b === "string" ? Date.parse(b) : NaN;
  if (Number.isFinite(da) && Number.isFinite(db) && /\d{4}-\d{2}-\d{2}T/.test(String(a)))
    return da - db;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  rpcs: Record<
    string,
    (args: Record<string, unknown>) => { data: unknown; error: DbError | null }
  > = {};
  log: Array<{ table?: string; fn?: string; op?: Op; args?: unknown }> = [];
  /** Column defaults per table, applied on insert before the given values (SQL `default`). */
  defaults: Record<string, (now: number) => Row> = {};
  constructor(public opts: FakeOptions = {}) {}

  now() {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  from(table: string) {
    return new Query(this, table);
  }

  async rpc(fn: string, args: Record<string, unknown> = {}) {
    this.log.push({ fn, args });
    const err = this.opts.fail?.({ fn });
    if (err) return { data: null, error: err };
    const handler = this.rpcs[fn];
    if (!handler)
      return { data: null, error: { code: "PGRST202", message: `function ${fn} not found` } };
    return handler(clone(args));
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  /** A new row as the database would store it: id, created_at, then the table's defaults. */
  newRow(table: string, values: Row): Row {
    return {
      id: globalThis.crypto.randomUUID(),
      created_at: new Date(this.now()).toISOString(),
      ...(this.defaults[table]?.(this.now()) ?? {}),
      ...clone(values),
    };
  }
}

class Query implements PromiseLike<{ data: unknown; error: DbError | null; count: number | null }> {
  private op: Op | undefined;
  private payload: unknown;
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | undefined;
  private limitN: number | undefined;
  private mode: "many" | "maybe" | "single" = "many";
  private returning = false;
  private head = false;
  private count = false;
  private conflict: string[] = ["id"];

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select(_columns?: string, opts?: { head?: boolean; count?: string }) {
    if (!this.op) this.op = "select";
    else this.returning = true;
    if (opts?.head) this.head = true;
    if (opts?.count) this.count = true;
    return this;
  }
  insert(rows: unknown) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: unknown, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    if (opts?.onConflict) this.conflict = opts.onConflict.split(",").map((c) => c.trim());
    return this;
  }
  update(patch: unknown) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => {
      const v = read(row, column);
      return v !== null && v !== undefined && String(v) === String(value);
    });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => {
      const v = read(row, column);
      return v === null || v === undefined || String(v) !== String(value);
    });
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((row) => compare(read(row, column), value) >= 0);
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push((row) => compare(read(row, column), value) < 0);
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push((row) => compare(read(row, column), value) <= 0);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.map(String).includes(String(read(row, column))));
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }

  then<A = { data: unknown; error: DbError | null; count: number | null }, B = never>(
    resolve?:
      | ((value: {
          data: unknown;
          error: DbError | null;
          count: number | null;
        }) => A | PromiseLike<A>)
      | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }

  private run(): { data: unknown; error: DbError | null; count: number | null } {
    const op = this.op ?? "select";
    this.db.log.push({ table: this.table, op });
    const err = this.db.opts.fail?.({ table: this.table, op });
    // As the real client does: a HEAD request to a missing table gets a 404 with no body,
    // which postgrest-js reports as success with no count (status 204, error null).
    if (err && this.head && op === "select" && err.code === "PGRST205")
      return { data: null, error: null, count: null };
    if (err) return { data: null, error: err, count: null };
    const all = this.db.rows(this.table);
    const match = () => all.filter((row) => this.filters.every((f) => f(row)));
    const shape = (rows: Row[]) => {
      let list = rows;
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        list = [...list].sort(
          (a, b) => (ascending ? 1 : -1) * compare(read(a, column), read(b, column)),
        );
      }
      if (this.limitN !== undefined) list = list.slice(0, this.limitN);
      const data = clone(list);
      if (this.head) return { data: null, error: null, count: rows.length };
      if (this.mode === "maybe")
        return { data: data[0] ?? null, error: null, count: this.count ? rows.length : null };
      if (this.mode === "single")
        return data.length === 1
          ? { data: data[0], error: null, count: null }
          : { data: null, error: { code: "PGRST116", message: "not one row" }, count: null };
      return { data, error: null, count: this.count ? rows.length : null };
    };
    switch (op) {
      case "select":
        return shape(match());
      case "insert": {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const inserted = list.map((r) => this.db.newRow(this.table, r));
        // The primary key: an id already present is refused, and nothing is inserted.
        if (inserted.some((r) => all.some((row) => String(row.id) === String(r.id))))
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
            count: null,
          };
        all.push(...inserted);
        return this.returning ? shape(inserted) : { data: null, error: null, count: null };
      }
      case "upsert": {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const out: Row[] = [];
        for (const r of list) {
          const hit = all.find((row) =>
            this.conflict.every((c) => String(row[c]) === String(r[c])),
          );
          if (hit) {
            Object.assign(hit, clone(r));
            out.push(hit);
          } else {
            const row = this.db.newRow(this.table, r);
            all.push(row);
            out.push(row);
          }
        }
        return this.returning ? shape(out) : { data: null, error: null, count: null };
      }
      case "update": {
        const rows = match();
        this.db.opts.beforeUpdate?.(this.table, rows);
        // Filters are evaluated again after the hook (a concurrent writer may have changed the row).
        const now = match();
        for (const row of now) Object.assign(row, clone(this.payload as Row));
        return this.returning ? shape(now) : { data: null, error: null, count: null };
      }
      case "delete": {
        const rows = match();
        this.db.tables[this.table] = all.filter((r) => !rows.includes(r));
        return { data: null, error: null, count: rows.length };
      }
    }
  }
}
