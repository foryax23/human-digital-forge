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

## Prices in the scan

Every price the scan, its PDF and deep research quote comes from the public list
(`src/lib/pricing.ts`) through `PRICE_BOOK` (`economics.ts`), so a visitor never reads a price the
pricing section contradicts. `scripts/scan/check-display.ts` fails when one falls outside.

- A simple automation 1.500–2.500 lei, a medium one 2.500–3.500 lei (public: 1.500–3.500 lei).
- The AI assistant, an automation with an AI step and a high-complexity automation: 3.000–6.000
  lei, the public assistant price, with the line "Are un pas cu AI, deci estimăm implementarea la
  prețul unui asistent AI" (or "Leagă mai multe sisteme, …").
- A new presentation site 4.500–7.500 lei ("de la 4.500 lei"); its line in the plan adds "(pentru
  un site mai mare facem oferta după discuție)".
- Website fixes, the Google profile and measurement: hours at the consultancy rate, 300 lei pe oră
  (1–3, 5–10, 2–4 and 3–6 hours); a project-size fix costs what a new site costs.
- Deep research "Cu Vortex Hub: de la X lei": the low end of the scan's price for the same work.

Words: a figure from the plan is "Estimarea din plan" or "≈ 7.000 lei", never a bare promise;
"de la" only for a fixed-price project; "preț fix, stabilit înainte să începem". Prices are final
(Vortex Hub is not a VAT payer); no VAT line until the accountant confirms the wording.

## Grammar reminders

- Numbers from 20 up take "de" unless the last two digits are 01–19: 20 de ore, 101 ore, 120 de
  ore (`roCount` / `roNeedsDe` in `format.ts`). This includes ranges: 12–24 de luni.
- Lower-case titles inside sentences with `lcFirst`; keep acronyms (AI, AWB, SEO) as they are.
- Business type in a sentence: `o afacere de tipul „Clinică stomatologică”`, or a parenthesis
  (`afacerea ta (clinică stomatologică)`), since the label has no article.

## Cercetare aprofundată (deep research)

The deep report reads the same word list as its verifier and templates
(`src/lib/deep/report/words.ts`), so the quick scan and the deep report never drift apart. The
"Cifre" and "Dovezi" tabs may use a technical term with an explanation on tap; the top layer
("Pe scurt", the PDF's first pages, the summary text) uses the words on the right.

| Avoid                                     | Write                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Vânzări                                   | Cifra de afaceri                                                                |
| marjă; "din 100 de lei încasați"          | "din fiecare 100 de lei facturați, îți rămân X"                                 |
| mediana, P25–P75, jumătatea din mijloc    | "o firmă obișnuită din activitatea ta", "majoritatea: între X și Y"             |
| peste 41% din clinici                     | "mai bine decât 41 din 100" (20 firms or more) or "a 3-a din 9" (fewer than 20) |
| reclamant / pârât; "2 dosare"             | "ai deschis 2 procese" / "ai fost dat în judecată"                              |
| raportul de lichiditate                   | (not shown in v1)                                                               |
| neprezentări                              | "clienți care nu vin la programare"                                             |
| PageSpeed, GA4, SEO, API, CAEN, CUI (top) | "testul de viteză Google", "statistici despre vizitatori", "apari în căutări"   |
| Calcul Vortex                             | "Estimarea noastră (vezi ipotezele)"                                            |
| Firma e sănătoasă                         | "Nu apar semnale de risc în registrele publice verificate"                      |
| Angajați 2025                             | "Salariați, medie 2025 (din bilanț)"                                            |
| date valabile la <azi>                    | "Verificat azi, <data> · bilanț 2025"                                           |
| Nu ai programare online                   | "Nu am găsit programare online pe cele N pagini citite"                         |
| Cu noi                                    | "Cu Vortex Hub"                                                                 |
| Premium · deschis pentru test             | "Gratuit în perioada de test" (open, code) / "Inclusă în abonamente" (premium)  |
| Nu facem dosare despre oameni             | "Nu facem profiluri despre persoane"                                            |
| partener (for a business contact)         | colaborator, client, furnizor                                                   |

Banned everywhere in the deep top layer: "fără clienți pierduți", "garantat", "singura
problemă", "Esențial", "Impact mare", "Recomandat", "Partener", "sănătos" (for a ratio).

**The five lines** use their own status set, separate from the quick scan's score tiers
(Bun / Acceptabil / Slab): ■ Bine, ◆ Atenție, ● De rezolvat, □ Neverificat. Each reason is at
most 40 characters ("îți rămân 9 lei din 100"). Third parties read the same reasons in the third
person ("rămân 9 lei din 100", "angajează").

**Confidence legend** ("Dovezi"): Confirmat (official source or the firm's own site), Probabil,
Calculat (our arithmetic on official figures), Estimare (our estimate, see the assumptions),
Declarat de tine.

**Money.** Three kinds of money are never added together: "valoarea orelor câștigate" (lei pe
lună), "profit în plus pe an, înainte de impozit" and cash collected sooner (not valued in v1).
The value of an hour of office work is the same on /scan and /scan/deep: 1,2 × salariul minim
brut + CAM, împărțit la 168 de ore (about 32 lei), or the activity's average pay when lower, said
next to the first lei figure ("presupunem 32 lei/oră pentru munca de birou · schimbă"). One
calendar: 21 de zile lucrătoare și 168 de ore pe lună.

**Sector words** (`src/lib/deep/vocab.ts`, by CAEN division): pacient / programare / recepție and
the line "Pacienți" (86); clientă sau client, programare (96); client sau oaspete, rezervare,
sală (56); oaspete, rezervare and the line "Oaspeți" (55); client, comandă, magazin (47); client,
cerere de ofertă, "Ca un client care cere o ofertă" (46); client sau distribuitor, comandă
(10–33); client, programare la service (45); client, cerere de ofertă, ofertare (41–43);
client, cerere de ofertă, dispecerat (49–53); client, proiect (62–63); client, întâlnire, birou
(69–74); client, cerere, echipă (everything else).
