import { createElement, Fragment, type ReactNode } from "react";

/** A word joined by hyphens: "site-uri", "într-un", "e-mail", "PDF-ul". */
const HYPHENATED = /([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+)/gu;

/**
 * Romanian joins words with hyphens ("într-un", "site-uri", "s-a"); a line must never
 * break there. Wraps each hyphenated word in a no-wrap span, so the text keeps its real
 * hyphen (find-in-page, copy and search engines see "site-uri", not U+2011). Strings
 * only; other nodes pass through unchanged.
 */
export function keepHyphens(node: ReactNode): ReactNode {
  if (typeof node !== "string" || !node.includes("-")) return node;
  const parts = node.split(HYPHENATED);
  if (parts.length === 1) return node;
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) =>
      i % 2 === 1 ? createElement("span", { key: i, className: "whitespace-nowrap" }, part) : part,
    ),
  );
}
