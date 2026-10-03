/**
 * Vortex Hub's own identity, in one place (Legea 365/2002 art. 5: name, CUI and trade
 * register number on every page). The footers, the auth pages, the legal pages and the
 * PDF all read it, so a change here reaches every one of them.
 */
export const COMPANY = {
  legalName: "Vortex Hub S.R.L.",
  cui: "54747928",
  /** Date of registration, as on the ONRC certificate. */
  registeredOn: "22.05.2026",
  regNo: "J2026033767000",
  euid: "ROONRC.J2026033767000",
  city: "Timișoara",
  seat: "Municipiul Timișoara, Jud. Timiș, Strada Armoniei, Nr. 23A, Ap. B1",
  email: "hello@vortexhub.ro",
  signatory: "Mihai Dandea",
  role: { en: "Director", ro: "Director" },
} as const;

/** The one-line legal identity under every footer: "© Vortex Hub S.R.L., CUI …, J…, Timișoara". */
export const COMPANY_LINE = `© ${COMPANY.legalName}, CUI ${COMPANY.cui}, ${COMPANY.regNo}, ${COMPANY.city}`;
