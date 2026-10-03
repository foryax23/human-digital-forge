import { createContext, useContext } from "react";

import styles from "./deep.module.css";

/*
 * The deep page's theme context and its CSS module classes (D10), apart from the components
 * in theme.tsx. Portalled sheets and dialogs take `portalClass` so they match the page.
 */

export type ThemeChoice = "system" | "dark" | "light";

export type ThemeValue = {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  /** The light scope class, or "" (night tokens from .cinematic). */
  scopeClass: string;
  /** For content rendered in a portal (outside the scope). */
  portalClass: string;
};

export const ThemeContext = createContext<ThemeValue>({
  choice: "system",
  setChoice: () => undefined,
  scopeClass: "",
  portalClass: "cinematic",
});

export const useDeepTheme = () => useContext(ThemeContext);

export const themeClasses = {
  scope: styles.scope,
  light: styles.light,
  system: styles.system,
};
export const reportClass = styles.report;
export const noPrintClass = styles.noPrint;
