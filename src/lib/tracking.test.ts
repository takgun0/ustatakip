import { describe, expect, it } from "vitest";
import {
  CROCKFORD_ALPHABET,
  formatCode,
  generateTrackingCode,
  generateTrackingToken,
  isTokenExpired,
  isTrackingCode,
  isTrackingToken,
  normalizeTrackingCode,
  verifyLastFour,
} from "./tracking";

describe("generateTrackingCode", () => {
  it("UT- + 6 Crockford karakteri üretir", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateTrackingCode();
      expect(isTrackingCode(code)).toBe(true);
      expect(code).toMatch(/^UT-[0-9A-HJKMNP-TV-Z]{6}$/);
    }
  });

  it("karışan harfleri (I, L, O, U) hiç kullanmaz", () => {
    expect(CROCKFORD_ALPHABET).toHaveLength(32);
    expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/);
    const all = Array.from({ length: 2000 }, () => generateTrackingCode().slice(3)).join("");
    expect(all).not.toMatch(/[ILOU]/);
  });

  it("baytı 5 bite indirger (yanlılık yok)", () => {
    const fixed = (b: Uint8Array) => b.fill(255);
    expect(generateTrackingCode(fixed)).toBe("UT-ZZZZZZ");
    const zero = (b: Uint8Array) => b.fill(32);
    expect(generateTrackingCode(zero)).toBe("UT-000000");
  });
});

describe("generateTrackingToken", () => {
  it("en az 128 bit: 32 bayt → 43 karakter base64url", () => {
    const token = generateTrackingToken();
    expect(token).toHaveLength(43);
    expect(isTrackingToken(token)).toBe(true);
    expect(token).not.toMatch(/[+/=]/);
  });

  it("her seferinde farklıdır", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateTrackingToken()));
    expect(set.size).toBe(1000);
  });

  it("rastgele kaynağı kullanır", () => {
    const token = generateTrackingToken((b) => b.fill(0));
    expect(token).toBe("A".repeat(43));
  });
});

describe("normalizeTrackingCode", () => {
  it.each([
    ["UT-7K4M29", "UT-7K4M29"],
    ["ut-7k4m-29", "UT-7K4M29"],
    ["UT 7K4M 29", "UT-7K4M29"],
    ["7k4m29", "UT-7K4M29"],
    ["UT-OIL123", "UT-011123"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTrackingCode(input)).toBe(expected);
  });

  it.each(["", "UT-", "UT-12345", "UT-1234567", "UT-ABCU12", "UT-ABC!12"])("%s geçersiz", (input) => {
    expect(normalizeTrackingCode(input)).toBeNull();
  });
});

describe("formatCode", () => {
  it("tasarımdaki gibi gruplar", () => {
    expect(formatCode("UT-7K4M29")).toBe("UT-7K4M-29");
  });
});

describe("verifyLastFour", () => {
  const phone = "+905321112233";
  it("doğru son 4 haneyi kabul eder", () => {
    expect(verifyLastFour(phone, "2233")).toBe(true);
    expect(verifyLastFour(phone, " 22 33 ")).toBe(true);
  });
  it("yanlış ya da eksik girdiyi reddeder", () => {
    expect(verifyLastFour(phone, "2234")).toBe(false);
    expect(verifyLastFour(phone, "233")).toBe(false);
    expect(verifyLastFour(phone, "12233")).toBe(false);
    expect(verifyLastFour(phone, "")).toBe(false);
  });
});

describe("isTokenExpired", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("süresi tanımsızsa geçerlidir", () => {
    expect(isTokenExpired(null, now)).toBe(false);
  });
  it("teslimden 30 gün sonra geçersizdir", () => {
    expect(isTokenExpired("2026-11-30T23:59:59Z", now)).toBe(true);
    expect(isTokenExpired("2026-12-01T00:00:01Z", now)).toBe(false);
  });
});
