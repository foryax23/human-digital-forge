import { describe, expect, it } from "bun:test";
import { parseUkCompanyNumber } from "./uk-company";

describe("parseUkCompanyNumber", () => {
  it("accepts 8 digits", () => expect(parseUkCompanyNumber("00445790")).toBe("00445790"));
  it("pads short numbers", () => expect(parseUkCompanyNumber("445790")).toBe("00445790"));
  it("accepts a Scottish prefix", () => expect(parseUkCompanyNumber("sc123456")).toBe("SC123456"));
  it("rejects names", () => expect(parseUkCompanyNumber("Tesco")).toBeNull());
  it("rejects 9 digits", () => expect(parseUkCompanyNumber("123456789")).toBeNull());
});
