import assert from "node:assert/strict";
import { test } from "node:test";

import { safeNext } from "../../../src/components/deep/safe-next";

/* /login and /register accept `next` only as a path on this site (plan A10, D4). */

test("paths on this site pass", () => {
  for (const ok of ["/scan/deep", "/dashboard", "/scan?cui=3365133", "/scan/deep#cifre"])
    assert.equal(safeNext(ok), ok);
});

test("other hosts, schemes and tricks are refused", () => {
  for (const bad of [
    "//evil.com",
    "@evil.com",
    "/@evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/scan\u0000",
    "/scan\n//evil.com",
    "",
    " ",
    "/" + "a".repeat(600),
  ])
    assert.equal(safeNext(bad), undefined, JSON.stringify(bad));
  assert.equal(safeNext(42), undefined);
  assert.equal(safeNext(undefined), undefined);
});
