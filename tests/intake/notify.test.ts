import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alertMessage,
  clean,
  confirmationMessage,
  contractPlan,
  type IntakeEvent,
} from "../../src/lib/notify/messages.server";
import {
  anyChannel,
  channelsOn,
  deliverIntake,
  readNotifyEnv,
} from "../../src/lib/notify/send.server";

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

/** A fetch that records every call and answers `status` (or hangs, or throws). */
function fakeFetch(behaviour: "ok" | "500" | "hang" | "throw" = "ok") {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init, body: JSON.parse(String(init.body ?? "{}")) });
    if (behaviour === "throw") throw new TypeError("network down");
    if (behaviour === "hang") {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    return new Response("{}", { status: behaviour === "ok" ? 200 : 500 });
  }) as typeof fetch;
  return { fn, calls };
}

const ALL_KEYS = {
  TELEGRAM_BOT_TOKEN: "123:secret-token",
  TELEGRAM_CHAT_ID: "-100200300",
  RESEND_API_KEY: "re_test_key",
  ALERT_EMAIL_FROM: "Vortex Hub <alerte@vortexhub.ro>",
  ALERT_EMAIL_TO: "mihai@vortexhub.ro, echipa@vortexhub.ro, not-an-address",
};

const contact: IntakeEvent = {
  kind: "contact",
  name: "Ana Popescu",
  email: "ana@firma.ro",
  service: "website",
  clientType: "business",
  budget: "2.500–7.500 lei",
  timeline: "în 4 săptămâni",
  description: "Avem nevoie de un site nou.\nCu programări online.",
  lang: "ro",
};

const contract: IntakeEvent = {
  ...contact,
  service: "plan-growth",
  clientType: null,
  budget: null,
  timeline: null,
  description: "Aș vrea contractul pentru abonamentul Growth.",
};

const lead: IntakeEvent = {
  kind: "scan_lead",
  email: "lead@firma.ro",
  name: "Ion",
  company: "Firma SRL",
  cui: "12345678",
  website: "https://firma.ro",
  recommendedPlan: "growth",
  digitalMaturity: 42.4,
  marketingConsent: false,
  lang: "ro",
};

const call: IntakeEvent = {
  kind: "deep_call",
  email: "client@firma.ro",
  phone: "+40 712 345 678",
  when: "dupa_amiaza",
  cui: "12345678",
  lang: "ro",
  runId: "7b0e7c1e-1111-4222-8333-944445555666",
};

test("no secrets: every channel is off and nothing is fetched", async () => {
  const env = readNotifyEnv({});
  assert.equal(anyChannel(env), false);
  const { fn, calls } = fakeFetch();
  const lines: string[] = [];
  const report = await deliverIntake(contact, env, { fetch: fn, log: (l) => lines.push(l) });
  assert.deepEqual(report, { telegram: "off", email: "off", confirmation: "off" });
  assert.equal(calls.length, 0);
});

test("env: only valid alert addresses, Resend needs a sender", () => {
  const env = readNotifyEnv(ALL_KEYS);
  assert.deepEqual(env.alertTo, ["mihai@vortexhub.ro", "echipa@vortexhub.ro"]);
  assert.deepEqual(channelsOn(env), { telegram: true, email: true, confirmation: true });
  const noSender = readNotifyEnv({ ...ALL_KEYS, ALERT_EMAIL_FROM: "" });
  assert.deepEqual(channelsOn(noSender), { telegram: true, email: false, confirmation: false });
  const telegramHalf = readNotifyEnv({ TELEGRAM_BOT_TOKEN: "x" });
  assert.equal(anyChannel(telegramHalf), false);
});

test("contact: Telegram, alert e-mail and confirmation are sent with the right payloads", async () => {
  const env = readNotifyEnv(ALL_KEYS);
  const { fn, calls } = fakeFetch();
  const lines: string[] = [];
  const report = await deliverIntake(contact, env, { fetch: fn, log: (l) => lines.push(l) });
  assert.deepEqual(report, { telegram: "sent", email: "sent", confirmation: "sent" });
  assert.equal(calls.length, 3);

  const telegram = calls.find((c) => c.url.startsWith("https://api.telegram.org/"));
  assert.ok(telegram);
  assert.equal(telegram.url, "https://api.telegram.org/bot123:secret-token/sendMessage");
  assert.equal(telegram.body.chat_id, "-100200300");
  assert.equal(telegram.body.parse_mode, undefined, "plain text, no formatting");
  const text = String(telegram.body.text);
  assert.match(text, /^Cerere nouă de pe site/);
  assert.match(text, /Nume: Ana Popescu/);
  assert.match(text, /E-mail: ana@firma\.ro/);
  assert.match(text, /Serviciu: Site web/);
  assert.match(text, /Tip client: Firmă/);
  assert.match(text, /Mesaj:\nAvem nevoie de un site nou\.\nCu programări online\./);

  const emails = calls.filter((c) => c.url === "https://api.resend.com/emails");
  assert.equal(emails.length, 2);
  for (const e of emails) {
    const headers = e.init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer re_test_key");
    assert.equal(e.body.from, "Vortex Hub <alerte@vortexhub.ro>");
  }
  const alert = emails.find((e) => (e.body.to as string[]).includes("mihai@vortexhub.ro"));
  assert.ok(alert);
  assert.equal(alert.body.reply_to, "ana@firma.ro", "the team replies straight to the visitor");
  assert.match(String(alert.body.subject), /^\[Vortex Hub\] Cerere nouă de pe site · Ana Popescu$/);

  const confirmation = emails.find((e) => (e.body.to as string[])[0] === "ana@firma.ro");
  assert.ok(confirmation);
  assert.equal(confirmation.body.reply_to, "hello@vortexhub.ro");
  assert.equal(confirmation.body.subject, "Am primit cererea ta | Vortex Hub");
  const body = String(confirmation.body.text);
  assert.match(body, /Îți răspundem în cel mult o zi lucrătoare/);
  assert.match(body, /Vortex Hub S\.R\.L\./);
  assert.match(body, /hello@vortexhub\.ro/);
  assert.doesNotMatch(body, /Ana|programări/, "the confirmation repeats nothing the visitor typed");
  assert.doesNotMatch(body, /nelimitat|garantat|newsletter|ofert/i);

  // One log line, outcomes only.
  assert.deepEqual(lines, ["[notify] contact telegram=sent email=sent confirmation=sent"]);
});

test("contract request: the alert and the confirmation name the plan", async () => {
  assert.equal(contractPlan("plan-growth"), "growth");
  assert.equal(contractPlan("plan-unknown"), null);
  assert.equal(contractPlan("website"), null);
  const alert = alertMessage(contract);
  // The amount and "lei" are joined by a no-break space (src/lib/pricing.ts), which \s matches.
  assert.match(alert.text, /^Cerere de contract: abonamentul Growth \(.+\slei pe lună\)/);
  assert.match(alert.text, /Abonament: Growth/);
  assert.doesNotMatch(alert.text, /Serviciu:/);
  const confirmation = confirmationMessage(contract);
  assert.ok(confirmation);
  assert.equal(confirmation.subject, "Am primit cererea pentru contractul Growth | Vortex Hub");
  assert.match(confirmation.text, /contractul abonamentului Growth/);
});

test("English visitors get the confirmation in English", () => {
  const confirmation = confirmationMessage({ ...contact, lang: "en" });
  assert.ok(confirmation);
  assert.equal(confirmation.subject, "We received your request | Vortex Hub");
  assert.match(confirmation.text, /We reply within one working day/);
});

test("scan lead: an alert, never a confirmation", async () => {
  assert.equal(confirmationMessage(lead), null);
  const env = readNotifyEnv(ALL_KEYS);
  const { fn, calls } = fakeFetch();
  const report = await deliverIntake(lead, env, { fetch: fn, log: () => {} });
  assert.deepEqual(report, { telegram: "sent", email: "sent", confirmation: "skipped" });
  assert.equal(calls.length, 2);
  const text = String(calls[0].body.text ?? calls[1].body.text);
  assert.match(text, /Lead nou din Vortex Scan/);
  assert.match(text, /Maturitate digitală: 42\/100/);
  assert.match(text, /Acord pentru noutăți \(marketing\): nu/);
});

test("Deep Research call request: phone and time in the alert, a short confirmation", () => {
  const alert = alertMessage(call);
  assert.match(alert.text, /^„Sună-mă” din Deep Research/);
  assert.match(alert.text, /Telefon: \+40 712 345 678/);
  assert.match(alert.text, /Când: după-amiaza/);
  const confirmation = confirmationMessage(call);
  assert.ok(confirmation);
  assert.match(confirmation.text, /Te sunăm în cel mult o zi lucrătoare, după-amiaza/);
  assert.doesNotMatch(confirmation.text, /712/);
});

test("consultation: confirmation only with an address", () => {
  const event: IntakeEvent = {
    kind: "consultation",
    title: "Strategie site",
    preferredAt: "2026-10-10T09:00:00Z",
    notes: null,
  };
  assert.equal(confirmationMessage(event), null);
  assert.match(alertMessage(event).text, /Subiect: Strategie site/);
  const withEmail = confirmationMessage({ ...event, email: "client@firma.ro" });
  assert.ok(withEmail);
  assert.match(withEmail.text, /Îți confirmăm ziua și ora în cel mult o zi lucrătoare/);
});

test("visitor text cannot add lines or markup to an alert", () => {
  const sneaky: IntakeEvent = {
    ...contact,
    name: "Ana\nTelefon: 0700 000 000",
    description: "<b>bold</b> & more",
  };
  const alert = alertMessage(sneaky);
  assert.match(alert.text, /Nume: Ana Telefon: 0700 000 000/);
  assert.doesNotMatch(alert.text, /\nTelefon:/);
  assert.match(alert.html, /&lt;b&gt;bold&lt;\/b&gt; &amp; more/);
  assert.equal(clean("a".repeat(300), 10).length, 10);
});

test("a service that fails or hangs never throws and is bounded by the timeout", async () => {
  const env = readNotifyEnv(ALL_KEYS);
  for (const behaviour of ["500", "throw"] as const) {
    const { fn } = fakeFetch(behaviour);
    const report = await deliverIntake(contact, env, { fetch: fn, log: () => {} });
    assert.deepEqual(report, { telegram: "failed", email: "failed", confirmation: "failed" });
  }
  const { fn } = fakeFetch("hang");
  const started = Date.now();
  const report = await deliverIntake(contact, env, { fetch: fn, timeoutMs: 50, log: () => {} });
  assert.ok(Date.now() - started < 1000, "all channels give up together after the timeout");
  assert.deepEqual(report, { telegram: "failed", email: "failed", confirmation: "failed" });
});

test("caps: the e-mail cap and the per-recipient limit skip e-mails, Telegram still goes", async () => {
  const env = readNotifyEnv(ALL_KEYS);
  const { fn, calls } = fakeFetch();
  const report = await deliverIntake(contact, env, {
    fetch: fn,
    log: () => {},
    allowEmail: async () => false,
  });
  assert.deepEqual(report, { telegram: "sent", email: "skipped", confirmation: "skipped" });
  assert.equal(calls.length, 1);

  const second = fakeFetch();
  const seen: string[] = [];
  const limited = await deliverIntake(contact, env, {
    fetch: second.fn,
    log: () => {},
    allowConfirmation: async (to) => {
      seen.push(to);
      return false;
    },
  });
  assert.deepEqual(limited, { telegram: "sent", email: "sent", confirmation: "skipped" });
  assert.deepEqual(seen, ["ana@firma.ro"]);
});

test("logs never carry addresses, phone numbers, message text or tokens", async () => {
  const env = readNotifyEnv(ALL_KEYS);
  const lines: string[] = [];
  for (const event of [contact, contract, lead, call]) {
    const { fn } = fakeFetch("500");
    await deliverIntake(event, env, { fetch: fn, log: (l) => lines.push(l) });
  }
  const all = lines.join("\n");
  for (const secret of [
    "ana@firma.ro",
    "lead@firma.ro",
    "client@firma.ro",
    "712",
    "Ana",
    "programări",
    "secret-token",
    "re_test_key",
  ]) {
    assert.ok(!all.includes(secret), `log contains ${secret}`);
  }
});
