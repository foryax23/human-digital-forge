import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

import {
  REQUEST_SERVICE,
  consultationRequest,
  deletionRequest,
} from "../../src/components/dashboard/account-requests";

/** The limits of submitContactEnquiry's schema (src/lib/contact.functions.ts). */
const contactSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  clientType: z.string().max(40).optional().nullable(),
  service: z.string().max(60).optional().nullable(),
  description: z.string().min(1).max(4000),
  budget: z.string().max(120).optional().nullable(),
  timeline: z.string().max(120).optional().nullable(),
});

const client = {
  id: "bbbbbbbb-0000-4000-8000-000000000002",
  email: "ana@firma-test.ro",
  fullName: "Ana Pop",
  company: "Firma Test SRL",
  clientType: "business",
};

test("deletion request: names the account and says invoices are kept", () => {
  const payload = deletionRequest(client, "  Nu mai am nevoie de cont.  ");
  assert.ok(payload);
  contactSchema.parse(payload);
  assert.equal(payload.service, REQUEST_SERVICE.deletion);
  assert.equal(payload.email, client.email);
  assert.equal(payload.fullName, "Ana Pop");
  assert.match(payload.description, /ștergere a contului/);
  assert.match(payload.description, new RegExp(client.id));
  assert.match(payload.description, /ana@firma-test\.ro/);
  assert.match(payload.description, /Firma Test SRL/);
  assert.match(payload.description, /Facturile și documentele contabile se păstrează/);
  assert.match(payload.description, /confirmă cererea prin e-mail/);
  assert.match(payload.description, /Motivul clientului: Nu mai am nevoie de cont\.$/);
});

test("deletion request: no reason line without a reason; none without an e-mail", () => {
  const payload = deletionRequest({ id: client.id, email: client.email }, "   ");
  assert.ok(payload);
  assert.doesNotMatch(payload.description, /Motivul/);
  assert.equal(payload.fullName, "ana");
  assert.equal(deletionRequest({ id: client.id, email: null }, "x"), null);
});

test("deletion request: long input stays inside the pipeline's limits", () => {
  const payload = deletionRequest(
    { ...client, fullName: "A".repeat(400), clientType: "b".repeat(90) },
    "x".repeat(10_000),
  );
  assert.ok(payload);
  contactSchema.parse(payload);
});

test("consultation request: topic, proposed time and account", () => {
  const payload = consultationRequest(client, {
    title: "Automatizarea programărilor",
    preferred: "luni, 12 octombrie, 10:00",
    notes: "Avem 3 cabinete.",
  });
  assert.ok(payload);
  contactSchema.parse(payload);
  assert.equal(payload.service, REQUEST_SERVICE.consultation);
  assert.equal(payload.timeline, "luni, 12 octombrie, 10:00");
  assert.match(payload.description, /Automatizarea programărilor/);
  assert.match(payload.description, /Ora propusă: luni, 12 octombrie, 10:00/);
  assert.match(payload.description, /Avem 3 cabinete\./);
  assert.match(payload.description, new RegExp(client.id));

  const open = consultationRequest(client, { title: "Idee", preferred: null, notes: null });
  assert.ok(open);
  assert.match(open.description, /Ora propusă: de stabilit/);
  assert.equal(open.timeline, null);
  assert.equal(consultationRequest(client, { title: "  ", preferred: null, notes: null }), null);
});
