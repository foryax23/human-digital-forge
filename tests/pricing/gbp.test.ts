import { describe, expect, test } from "bun:test";
import { FIXED_PROJECTS, monthlyText, PLAN_CATALOG, projectPriceText, leiText, EXTRA_HOUR_LEI, CONSULTANCY_HOUR_LEI } from "../../src/lib/pricing";

describe("UK prices in pounds", () => {
  test("Starter is £49 a month", () => expect(monthlyText(PLAN_CATALOG.starter.priceLei, "uk").en).toBe("£49 a month"));
  test("Growth is £135 a month", () => expect(monthlyText(PLAN_CATALOG.growth.priceLei, "uk").en).toBe("£135 a month"));
  test("Pro is £339 a month", () => expect(monthlyText(PLAN_CATALOG.pro.priceLei, "uk").en).toBe("£339 a month"));
  test("extra hour is £35", () => expect(leiText(EXTRA_HOUR_LEI, "uk").en).toBe("£35"));
  test("consultancy hour is £52", () => expect(leiText(CONSULTANCY_HOUR_LEI, "uk").en).toBe("£52"));
  test("website from £775", () => expect(projectPriceText(FIXED_PROJECTS[0], "uk").en).toBe("from £775"));
  test("Romania keeps lei", () => expect(monthlyText(290).ro).toBe("290\u00a0lei pe lună"));
});
