import { test } from "node:test";
import assert from "node:assert/strict";
import {
  processStripeEvent,
  periodEndIso,
  isMissingLedger,
  type WebhookDeps,
  type SubscriberFields,
  type LedgerEntry,
} from "../../../src/lib/stripe-webhook.server";

type Ev = Parameters<typeof processStripeEvent>[0];

const checkout = (id = "evt_1", created = 1_800_000_000): Ev =>
  ({
    id,
    type: "checkout.session.completed",
    created,
    livemode: false,
    data: {
      object: {
        customer_details: { email: "client@example.com" },
        customer: "cus_1",
        subscription: "sub_1",
        metadata: { plan: "growth", user_id: "u1" },
      },
    },
  }) as unknown as Ev;

const subEvent = (type: string, id: string, created: number, extra: object = {}): Ev =>
  ({
    id,
    type,
    created,
    livemode: false,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: {},
        items: { data: [{ current_period_end: 1_900_000_000 }] },
        ...extra,
      },
    },
  }) as unknown as Ev;

function fakeDeps(opts: {
  table?: boolean;
  failWrite?: boolean;
  failCheck?: boolean;
  failRecord?: boolean;
  email?: string | null;
}) {
  const writes: SubscriberFields[] = [];
  const ledgerRows: LedgerEntry[] = [];
  const logs: string[] = [];
  const deps: WebhookDeps = {
    async upsertSubscriber(fields) {
      if (opts.failWrite) throw { code: "08006", message: "connection failure" };
      writes.push(fields);
    },
    async customerEmail() {
      return opts.email === undefined ? "client@example.com" : opts.email;
    },
    ledger: {
      async check(eventId, objectId, createdIso) {
        if (opts.failCheck) throw { code: "08006", message: "down" };
        if (opts.table === false) return "missing";
        return {
          seen: ledgerRows.some((r) => r.id === eventId),
          newer:
            !!objectId &&
            ledgerRows.some(
              (r) =>
                r.object_id === objectId &&
                r.outcome === "written" &&
                r.stripe_created > createdIso,
            ),
        };
      },
      async record(entry) {
        if (opts.failRecord) throw { code: "08006", message: "down" };
        if (opts.table === false) return "missing";
        if (!ledgerRows.some((r) => r.id === entry.id)) ledgerRows.push(entry);
        return "ok";
      },
    },
    log: {
      info: (m: string) => logs.push(`info ${m}`),
      warn: (m: string) => logs.push(`warn ${m}`),
      error: (m: string) => logs.push(`error ${m}`),
    },
  };
  return { deps, writes, ledgerRows, logs };
}

test("database write failure answers 500 (Stripe retries) and records nothing", async () => {
  const f = fakeDeps({ failWrite: true });
  const r = await processStripeEvent(checkout(), f.deps);
  assert.equal(r.status, 500);
  assert.equal(f.ledgerRows.length, 0);
  assert.ok(f.logs.some((l) => l.startsWith("error") && l.includes("evt_1")));
});

test("a retry after the failure processes the event", async () => {
  const f = fakeDeps({});
  const r = await processStripeEvent(checkout(), f.deps);
  assert.equal(r.status, 200);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0], {
    email: "client@example.com",
    status: "active",
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    tier: "growth",
    user_id: "u1",
  });
  assert.equal(f.ledgerRows[0].outcome, "written");
});

test("the same event twice writes once (idempotent by event id)", async () => {
  const f = fakeDeps({});
  await processStripeEvent(checkout(), f.deps);
  const r = await processStripeEvent(checkout(), f.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.equal(f.writes.length, 1);
});

test("an older event arriving after a newer one for the same subscription is not applied", async () => {
  const f = fakeDeps({});
  await processStripeEvent(
    subEvent("customer.subscription.deleted", "evt_new", 1_800_000_100),
    f.deps,
  );
  const r = await processStripeEvent(checkout("evt_old", 1_800_000_000), f.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.stale, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].status, "canceled");
  assert.equal(f.ledgerRows.find((x) => x.id === "evt_old")?.outcome, "stale");
});

test("without the ledger table it still processes and warns", async () => {
  const f = fakeDeps({ table: false });
  const a = await processStripeEvent(checkout(), f.deps);
  const b = await processStripeEvent(checkout(), f.deps);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(f.writes.length, 2); // idempotent upsert, same row twice
  assert.ok(
    f.logs.some((l) => l.startsWith("warn") && l.includes("drizzle/pending/stripe_events.sql")),
  );
});

test("ledger read failure answers 500", async () => {
  const f = fakeDeps({ failCheck: true });
  const r = await processStripeEvent(checkout(), f.deps);
  assert.equal(r.status, 500);
  assert.equal(f.writes.length, 0);
});

test("ledger record failure after a good write still answers 200", async () => {
  const f = fakeDeps({ failRecord: true });
  const r = await processStripeEvent(checkout(), f.deps);
  assert.equal(r.status, 200);
  assert.equal(f.writes.length, 1);
});

test("subscription update: period end from the item, blanks never overwrite known data", async () => {
  const f = fakeDeps({});
  const r = await processStripeEvent(
    subEvent("customer.subscription.updated", "evt_u", 1_800_000_050),
    f.deps,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(f.writes[0], {
    email: "client@example.com",
    status: "active",
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    current_period_end: new Date(1_900_000_000 * 1000).toISOString(),
  });
});

test("deleted customer: acknowledged, nothing written", async () => {
  const f = fakeDeps({ email: null });
  const r = await processStripeEvent(
    subEvent("customer.subscription.updated", "evt_x", 1_800_000_050),
    f.deps,
  );
  assert.equal(r.status, 200);
  assert.equal(f.writes.length, 0);
  assert.equal(f.ledgerRows[0].outcome, "skipped_no_email");
});

test("unhandled types are acknowledged without touching the ledger", async () => {
  const f = fakeDeps({});
  const r = await processStripeEvent(
    { id: "evt_i", type: "invoice.paid", created: 1, data: { object: {} } } as unknown as Ev,
    f.deps,
  );
  assert.equal(r.status, 200);
  assert.equal(f.ledgerRows.length, 0);
});

test("period end from the legacy top-level field, and missing-table codes", () => {
  assert.equal(
    periodEndIso({ current_period_end: 1_800_000_000 } as never),
    new Date(1_800_000_000_000).toISOString(),
  );
  assert.equal(periodEndIso({ items: { data: [] } } as never), undefined);
  assert.ok(isMissingLedger({ code: "PGRST205" }));
  assert.ok(isMissingLedger({ code: "42P01" }));
  assert.ok(!isMissingLedger({ code: "23505" }));
  assert.ok(!isMissingLedger(null));
});

test("a newer event that wrote nothing does not make an older one stale", async () => {
  const f = fakeDeps({ email: null });
  await processStripeEvent(
    subEvent("customer.subscription.updated", "evt_skip", 1_800_000_100),
    f.deps,
  );
  assert.equal(f.ledgerRows[0].outcome, "skipped_no_email");
  const r = await processStripeEvent(checkout("evt_old", 1_800_000_000), f.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.stale, undefined);
  assert.equal(f.writes.length, 1);
});
