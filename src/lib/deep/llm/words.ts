/*
 * Words the verifier enforces (plan A7, A8). The shared top-layer word list
 * lives in src/lib/deep/report/words.ts (Eng 3), read by the verifier, the
 * report templates, the banned-word grep and the glossary; this module only
 * re-exports it so the verifier's imports stay unchanged.
 */
export { BANNED_INFERENCES, BANNED_PHRASES, NUMBER_WORDS, TU_FORMS } from "../report/words";
