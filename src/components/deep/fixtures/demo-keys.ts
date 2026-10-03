/*
 * The ?demo= states and sample sectors of /scan/deep, with no imports: the route's
 * validateSearch reads them, and route options stay in the entry chunk every page loads,
 * so the report logic and the fictional sample must not come along (they load with the page).
 */

export const DEMO_STATES = [
  "exemplu",
  "intrare",
  "gate-oprit",
  "gate-cont",
  "gate-email",
  "gate-test",
  "gate-cod",
  "gate-premium",
  "gate-limita",
  "gate-indisponibil",
  "formular",
  "ruleaza",
  "site",
  "pauza",
  "raport",
  "raport-reguli",
  "raport-partial",
  "raport-tert",
  "raport-nou",
] as const;
export type DemoState = (typeof DEMO_STATES)[number];

export const DEMO_SECTORS = ["sanatate", "restaurant", "constructii", "comert"] as const;
export type DemoSector = (typeof DEMO_SECTORS)[number];
