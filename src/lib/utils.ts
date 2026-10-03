import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge with the UI refresh's named radius and shadow (src/styles.css), so a
 * screen's `rounded-xl` replaces the menus' `rounded-menu` instead of both applying.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ["menu"], shadow: ["pop"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
