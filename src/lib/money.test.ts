import { describe, expect, it } from "vitest";
import { formatTRY, parseTRY } from "./money";
import { normalizePhone } from "./phone";

describe("formatTRY", () => {
  it.each([
    [125000, "1.250,00 ₺"],
    [0, "0,00 ₺"],
    [5, "0,05 ₺"],
    [310000, "3.100,00 ₺"],
    [123456789, "1.234.567,89 ₺"],
  ])("%i kuruş → %s", (k, s) => expect(formatTRY(k)).toBe(s));

  it("kesirli kuruşu reddeder", () => {
    expect(() => formatTRY(1.5)).toThrow();
  });
});

describe("parseTRY", () => {
  it.each([
    ["1.250,00", 125000],
    ["1250", 125000],
    ["1250,5", 125050],
    ["2.900,00 ₺", 290000],
    ["0,99", 99],
  ])("%s → %i", (s, k) => expect(parseTRY(s)).toBe(k));

  it.each(["", "abc", "1,234", "12.34", "-5", "1.2345,00"])("%s geçersiz", (s) => expect(parseTRY(s)).toBeNull());
});

describe("normalizePhone", () => {
  it.each([
    ["0532 111 22 33", "+905321112233"],
    ["532 111 2233", "+905321112233"],
    ["+90 (532) 111-22-33", "+905321112233"],
    ["905321112233", "+905321112233"],
  ])("%s → %s", (i, o) => expect(normalizePhone(i)).toBe(o));

  it.each(["0212 111 22 33", "12345", ""])("%s geçersiz", (i) => expect(normalizePhone(i)).toBeNull());
});
