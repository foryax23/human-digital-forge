# Vortex Scan: Romanian glossary (EN → RO)

The terms the scan, the report and the PDF use in Romanian. Write the common business Romanian a
small-business owner uses, with correct diacritics (ș, ț with comma below; registry text with
cedillas goes through `withCommaBelow` in `src/lib/scan/localize.ts`). Do not use literal
translations or anglicisms when a common Romanian word exists. Product names stay as they are
(WhatsApp, SmartBill, e-Factura, SPV, CRM, Google, AWB, ITP, RCA). Avoid em dashes in both
languages: use commas, colons, full stops or parentheses. En dashes in ranges (2–4) are fine.

Every figure a visitor reads comes from `displayPlan()` (`display.ts`) and the helpers in
`format.ts`, so the words and the rounding below are applied in one place.

## Vocabulary (UI refresh, 2026-10-03)

| Concept                  | Use                                                              | Not                                                          |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| tools                    | instrumente                                                      | aplicații, unelte                                            |
| hours                    | ore câștigate                                                    | ore economisite, timp câștigat (as a label)                  |
| money value of the hours | valoarea orelor câștigate                                        | economisit, economii                                         |
| payback                  | Se recuperează în luna N                                         | Recuperare, Recuperarea investiției, Pragul de rentabilitate |
| currency                 | lei (EN: RON)                                                    | RON, LEI, € in Romanian                                      |
| deliverables             | raport (PDF), plan pe luni, abonament                            | blueprint, plan digital                                      |
| severity                 | Prioritate mare / medie / mică                                   | Ridicat, Prioritar                                           |
| score tiers              | Bun / Acceptabil / Slab                                          | Bine, Mediu, Solid                                           |
| e-mail                   | e-mail, e-mailuri                                                | email, emailul                                               |
| customers                | the type's word (`type.customers`: pacienți for a dental clinic) | clienți in universal templates                               |
| first phase              | the engine's phase title ("Site nou și profil Google")           | Fundație vs Bazele                                           |
| start marker             | Începem aici, always followed by the reason                      | Recomandat, Esențial, Impact mare                            |
| assumption marker        | De confirmat, Date de exemplu                                    | percentages we did not measure                               |

Banned in any form: Esențial, Impact mare, Creștere as a badge, Recomandat, Oportunitate,
Prioritar, Potențial ridicat, "Bun" on automation potential, €/€€/€€€ meters.

## Numbers and units

| Quantity             | Step                            | RO / EN                                         |
| -------------------- | ------------------------------- | ----------------------------------------------- |
| hours a month        | 5 (alone under 10: whole hours) | cam 35 de ore pe lună / about 35 hours a month  |
| money a month        | 100                             | cam 2.900 lei pe lună / about 2,900 RON a month |
| one-off cost         | 500                             | ≈ 8.000 lei / ≈ 8,000 RON                       |
| cumulative or yearly | 1.000                           | 63.000 lei / 63,000 RON                         |
| months               | whole                           | luna 14 / month 14 (never L14)                  |
| percentages          | whole, and only measured ones   |                                                 |

- Rows of a group add up to the total (`roundGroup`); a strategy card reads its Gantt row.
- Net is the displayed value minus the displayed cost.
- Non-breaking space between a number and its unit; real minus "−"; "≈" or "cam", not both.
- Money takes no "de" in figures ("1.000 lei"); counts do from 20 up ("35 de ore", "24 de luni").
- Axis unit "mii lei", never "50K"; "ore", never "h".

## Customers and sales

| EN                       | RO                                       |
| ------------------------ | ---------------------------------------- |
| customers / clients      | clienți                                  |
| business customers (B2B) | clienți firme                            |
| patients                 | pacienți                                 |
| guests (hotel)           | oaspeți                                  |
| lead                     | client potențial (never "lead")          |
| enquiry / request        | solicitare                               |
| quote                    | ofertă                                   |
| quote request            | cerere de ofertă                         |
| proposal (consulting)    | propunere                                |
| sales                    | vânzări                                  |
| deal (CRM)               | oportunitate de vânzare                  |
| pipeline                 | etapele de vânzare / evidența vânzărilor |
| follow-up                | revenire (la client), e-mail de revenire |
| reviews / Google rating  | recenzii / nota Google                   |
| testimonials             | testimoniale, păreri ale clienților      |
| social proof             | părerile altor clienți                   |
| loyalty                  | fidelizare                               |

## Operations

| EN                                               | RO                                |
| ------------------------------------------------ | --------------------------------- |
| appointment, booking (services)                  | programare                        |
| booking, reservation (hotel, restaurant, travel) | rezervare                         |
| online booking                                   | programare online                 |
| rebooking                                        | o nouă programare                 |
| reminder                                         | reamintire                        |
| no-shows                                         | neprezentări                      |
| check-up recall                                  | reamintire pentru control         |
| invoicing / invoices                             | facturare / facturi               |
| supplier invoices and receipts                   | facturi de la furnizori și bonuri |
| overdue invoices                                 | facturi restante                  |
| payment reminder                                 | reamintire de plată               |
| rota / timesheet                                 | program pe ture / pontaj          |
| checkout                                         | finalizarea comenzii              |
| abandoned cart                                   | coș abandonat                     |
| cash on delivery                                 | ramburs                           |
| shipping label                                   | AWB                               |
| ETA                                              | ora (estimată) de sosire          |
| front desk / reception                           | recepție                          |
| back office / admin                              | partea administrativă             |
| status (of a repair, job)                        | stadiu                            |
| retype by hand                                   | introduce manual / copia manual   |
| one tap / one click                              | dintr-un clic                     |

## Digital and marketing

| EN                          | RO                                                            |
| --------------------------- | ------------------------------------------------------------- |
| website                     | site (not "site web")                                         |
| email                       | e-mail (e-mailuri, e-mailul)                                  |
| inbox                       | căsuța de e-mail                                              |
| dashboard                   | panou de raportare                                            |
| insights / highlights       | concluzii                                                     |
| analytics (category)        | statistici de trafic (Google Analytics stays)                 |
| conversion tracking         | măsurarea conversiilor                                        |
| tracking scripts / trackers | scripturi de urmărire                                         |
| cookie consent              | acord pentru cookie-uri ("consimțământ" only in GDPR wording) |
| product feed / listing feed | listă de produse / anunțuri publicate dintr-un singur loc     |
| social posts                | postări pe rețelele sociale                                   |
| social media                | rețele sociale                                                |
| tone of voice               | stil de comunicare                                            |
| hand over to a person       | transferă conversația unui coleg                              |
| AI assistant                | asistent AI                                                   |
| footer / header             | subsol / antet                                                |
| click                       | clic                                                          |
| share link                  | link de distribuire                                           |
| mobile-first                | optimizat pentru mobil                                        |
| tools                       | instrumente (not "unelte")                                    |

## Plan and money

| EN                        | RO                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| roadmap                   | plan pe luni ("Planul pe 6 luni: ce facem și cât costă")                                                                                                                                                  |
| strategy options          | variante de strategie                                                                                                                                                                                     |
| phase names               | the phase title built from its work (see `roadmap.ts phaseTitle`), e.g. Site nou și profil Google / Programări și reamintiri automate / Asistent pe site și WhatsApp / Recenzii și evidența solicitărilor |
| kick-off                  | ședința de start                                                                                                                                                                                          |
| setup (one-off)           | implementare (unică)                                                                                                                                                                                      |
| payback, break-even       | se recuperează în luna N (the first month-end in profit)                                                                                                                                                  |
| net gain                  | câștig net                                                                                                                                                                                                |
| value of the hours        | valoarea orelor (câștigate)                                                                                                                                                                               |
| time to value             | primele rezultate (în …)                                                                                                                                                                                  |
| planning assumption       | ipoteză de calcul                                                                                                                                                                                         |
| estimates, not guarantees | estimări, nu garanții (said once, at the end of the notes)                                                                                                                                                |
| loaded staff cost         | cost total angajator                                                                                                                                                                                      |
| team size                 | mărimea echipei                                                                                                                                                                                           |
| playbook                  | model de lucru                                                                                                                                                                                            |
| price book                | lista de prețuri                                                                                                                                                                                          |
| discovery call            | discuție (gratuită) de evaluare                                                                                                                                                                           |
| consultation (CTA)        | discuție                                                                                                                                                                                                  |
| currency                  | "lei" everywhere in Romanian (sentences, figures, charts, tables); "RON" in English                                                                                                                       |

## Grammar reminders

- Numbers from 20 up take "de" unless the last two digits are 01–19: 20 de ore, 101 ore, 120 de
  ore (`roCount` / `roNeedsDe` in `format.ts`). This includes ranges: 12–24 de luni.
- Lower-case titles inside sentences with `lcFirst`; keep acronyms (AI, AWB, SEO) as they are.
- Business type in a sentence: `o afacere de tipul „Clinică stomatologică”`, or a parenthesis
  (`afacerea ta (clinică stomatologică)`), since the label has no article.
