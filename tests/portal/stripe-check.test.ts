import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkoutOutcome,
  customerIdsFrom,
  isCheckoutSessionId,
  oneOffPayments,
  sessionBelongsTo,
  stripeErrorKind,
  type Owner,
  type SessionLike,
} from "../../src/lib/account.server";

const USER = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER = "cccccccc-0000-4000-8000-000000000003";
const owner: Owner = { userId: USER, customerIds: ["cus_ABC123"] };

const session = (extra: Partial<SessionLike> = {}): SessionLike => ({
  id: "cs_test_a1B2c3D4e5F6g7H8",
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  amount_total: 49000,
  currency: "ron",
  created: 1_790_000_000,
  client_reference_id: USER,
  customer: null,
  metadata: {},
  line_items: { data: [{ description: "Raport Deep Research suplimentar" }] },
  ...extra,
});

test("session IDs: only Stripe Checkout Session IDs pass", () => {
  assert.equal(isCheckoutSessionId("cs_test_a1B2c3D4e5F6g7H8"), true);
  assert.equal(isCheckoutSessionId("cs_live_a1B2c3D4e5F6g7H8i9"), true);
  for (const bad of [
    "",
    "cs_test_",
    "pi_test_a1B2c3D4e5F6g7H8",
    "cs_test_a1B2c3D4e5F6g7H8/../x",
    "cs_test_a1B2 c3D4e5F6",
    "{CHECKOUT_SESSION_ID}",
    `cs_test_${"a".repeat(300)}`,
    null,
    42,
  ])
    assert.equal(isCheckoutSessionId(bad), false, String(bad));
});

test("ownership: the account ID or the account's own Stripe customer, never an e-mail", () => {
  assert.equal(sessionBelongsTo(session(), owner), true);
  assert.equal(
    sessionBelongsTo(session({ client_reference_id: null, metadata: { user_id: USER } }), owner),
    true,
  );
  assert.equal(
    sessionBelongsTo(session({ client_reference_id: null, customer: "cus_ABC123" }), owner),
    true,
  );
  assert.equal(
    sessionBelongsTo(session({ client_reference_id: null, customer: { id: "cus_ABC123" } }), owner),
    true,
  );
  // Someone else's session, even with the same e-mail typed at checkout.
  const foreign = session({
    client_reference_id: OTHER,
    metadata: { user_id: OTHER },
    customer: "cus_OTHER99",
  });
  assert.equal(sessionBelongsTo(foreign, owner), false);
  assert.equal(sessionBelongsTo(session(), { userId: "", customerIds: [] }), false);
});

test("outcome: paid only when Stripe says paid", () => {
  const paid = checkoutOutcome(session(), owner);
  assert.deepEqual(paid, {
    status: "paid",
    mode: "payment",
    amountMinor: 49000,
    currency: "RON",
    description: "Raport Deep Research suplimentar",
    createdAt: new Date(1_790_000_000 * 1000).toISOString(),
  });
  // A delayed method: complete but unpaid.
  assert.deepEqual(checkoutOutcome(session({ payment_status: "unpaid" }), owner), {
    status: "pending",
  });
  assert.deepEqual(checkoutOutcome(session({ status: "open", payment_status: "unpaid" }), owner), {
    status: "pending",
  });
  assert.deepEqual(
    checkoutOutcome(session({ status: "expired", payment_status: "unpaid" }), owner),
    { status: "expired" },
  );
  // A 100% discount on a completed session counts; an open one does not.
  assert.equal(
    checkoutOutcome(session({ payment_status: "no_payment_required", amount_total: 0 }), owner)
      .status,
    "paid",
  );
  assert.equal(
    checkoutOutcome(
      session({ status: "open", payment_status: "no_payment_required", amount_total: 0 }),
      owner,
    ).status,
    "pending",
  );
});

test("outcome: someone else's paid session reads exactly like a missing one", () => {
  const foreign = session({ client_reference_id: OTHER, customer: "cus_OTHER99" });
  assert.deepEqual(checkoutOutcome(foreign, owner), { status: "not_found" });
  assert.deepEqual(checkoutOutcome({ ...foreign, status: "expired" }, owner), {
    status: "not_found",
  });
});

test("outcome: a subscription session and missing details", () => {
  const sub = checkoutOutcome(
    session({ mode: "subscription", line_items: null, created: null, currency: null }),
    owner,
  );
  assert.equal(sub.status, "paid");
  if (sub.status === "paid") {
    assert.equal(sub.mode, "subscription");
    assert.equal(sub.description, null);
    assert.equal(sub.createdAt, null);
    assert.equal(sub.currency, null);
  }
});

test("one-off payments: paid payment-mode sessions of this account, newest first", () => {
  const list = oneOffPayments(
    [
      session({ id: "cs_test_old00000001", created: 1_780_000_000 }),
      session({ id: "cs_test_new00000002", created: 1_795_000_000, amount_total: 12000 }),
      session({ id: "cs_test_sub00000003", mode: "subscription" }),
      session({ id: "cs_test_unp00000004", payment_status: "unpaid" }),
      session({ id: "cs_test_oth00000005", client_reference_id: OTHER }),
      session({ id: "cs_test_nil00000006", amount_total: null }),
    ],
    owner,
  );
  assert.deepEqual(
    list.map((p) => p.id),
    ["cs_test_new00000002", "cs_test_old00000001"],
  );
  assert.equal(list[0].amountMinor, 12000);
  assert.equal(list[0].currency, "RON");
});

test("errors: an unknown ID is 'missing', anything else is not", () => {
  assert.equal(stripeErrorKind({ code: "resource_missing", statusCode: 404 }), "missing");
  assert.equal(stripeErrorKind({ statusCode: 404 }), "missing");
  assert.equal(stripeErrorKind({ code: "api_key_expired", statusCode: 401 }), "other");
  assert.equal(stripeErrorKind(new Error("network")), "other");
  assert.equal(stripeErrorKind(null), "other");
});

test("customer IDs: only well-formed Stripe customer IDs from the account's rows", () => {
  assert.deepEqual(
    customerIdsFrom([
      { stripe_customer_id: "cus_ABC123" },
      { stripe_customer_id: "cus_ABC123" },
      { stripe_customer_id: null },
      { stripe_customer_id: "not-a-customer" },
      {},
    ]),
    ["cus_ABC123"],
  );
  assert.deepEqual(customerIdsFrom(null), []);
});
