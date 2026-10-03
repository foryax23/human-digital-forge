import type { SectorVocabId } from "../contracts";

/*
 * SECTOR VOLUME DEFAULTS: TO BE APPROVED BY THE OWNER (plan A8, D7).
 *
 * Used only when the owner has not given their own numbers in the start form
 * or the "Ajustează cifrele" panel, and always shown next to the estimate
 * ("presupunem ~25 de programări pe zi · schimbă"). They are deliberately
 * conservative: the estimate should be beaten in practice, never the other
 * way round. Mihai Dandea approves or changes each value before the test
 * round with real owners; until then every estimate built on them is marked
 * "Estimare" with its assumptions listed.
 */

export type SectorVolumes = {
  /** Bookings, reservations or appointments a day for a typical small firm. */
  bookingsPerDay: number;
  /** Share of them that arrive by phone today. */
  phoneShare: number;
  /** Minutes of front-desk time one phone booking takes. */
  minutesPerBooking: number;
  /** Share of phone bookings that would move online: low, central, high. */
  onlineShare: { low: number; value: number; high: number };
  /** Appointment sectors: share of appointments confirmed by a phone call today. */
  reminderShare?: number;
  /** Minutes one reminder call takes. */
  minutesPerReminder?: number;
};

/** Front-desk hours a month in a small firm: one person (21 days × 8 hours). */
export const DEFAULT_ROLE_HOURS = 168;

/** Automation never claims more than this share of a role's hours (same rule as the quick scan). */
export const MAX_SHARE_OF_ROLE_TIME = 0.2;

export const SECTOR_VOLUMES: Partial<Record<SectorVocabId, SectorVolumes>> = {
  health: {
    bookingsPerDay: 25,
    phoneShare: 0.7,
    minutesPerBooking: 3,
    onlineShare: { low: 0.2, value: 0.3, high: 0.4 },
    reminderShare: 0.5,
    minutesPerReminder: 1.5,
  },
  beauty: {
    bookingsPerDay: 15,
    phoneShare: 0.6,
    minutesPerBooking: 3,
    onlineShare: { low: 0.25, value: 0.35, high: 0.45 },
    reminderShare: 0.5,
    minutesPerReminder: 1.5,
  },
  auto: {
    bookingsPerDay: 8,
    phoneShare: 0.8,
    minutesPerBooking: 4,
    onlineShare: { low: 0.15, value: 0.25, high: 0.35 },
    reminderShare: 0.5,
    minutesPerReminder: 2,
  },
  professional: {
    bookingsPerDay: 4,
    phoneShare: 0.7,
    minutesPerBooking: 4,
    onlineShare: { low: 0.15, value: 0.25, high: 0.35 },
    reminderShare: 0.5,
    minutesPerReminder: 2,
  },
  food: {
    bookingsPerDay: 20,
    phoneShare: 0.7,
    minutesPerBooking: 2,
    onlineShare: { low: 0.2, value: 0.3, high: 0.4 },
  },
  accommodation: {
    bookingsPerDay: 6,
    phoneShare: 0.5,
    minutesPerBooking: 5,
    onlineShare: { low: 0.3, value: 0.4, high: 0.5 },
  },
};
