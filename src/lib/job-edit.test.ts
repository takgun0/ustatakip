import { describe, expect, it } from "vitest";
import { jobEditSchema } from "./validation";
import { isoToLocalInput, localInputToIso } from "./dates";

const valid = {
  customerName: "  Ayşe Kaya ",
  customerPhone: "0532 111 22 33",
  title: "Fren bakımı",
  itemLabel: "",
  description: "",
  estimatedDelivery: null,
};

describe("jobEditSchema", () => {
  it("telefonu +90 biçimine çevirir, boş alanları null yapar", () => {
    const r = jobEditSchema.parse(valid);
    expect(r.customerName).toBe("Ayşe Kaya");
    expect(r.customerPhone).toBe("+905321112233");
    expect(r.itemLabel).toBeNull();
    expect(r.description).toBeNull();
  });

  it("geçersiz telefon ve kısa adı reddeder", () => {
    const r = jobEditSchema.safeParse({ ...valid, customerName: "A", customerPhone: "123" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["customerName", "customerPhone"]));
  });

  it("şablon, kod gibi düzenlenemeyen alanları kabul etmez", () => {
    expect(Object.keys(jobEditSchema.shape).sort()).toEqual(
      ["customerName", "customerPhone", "description", "estimatedDelivery", "itemLabel", "title"].sort(),
    );
  });
});

describe("isoToLocalInput", () => {
  it("datetime-local değeriyle gidip gelir", () => {
    const local = "2026-12-03T14:30";
    expect(isoToLocalInput(localInputToIso(local))).toBe(local);
  });

  it("boş ya da bozuk değerde boş metin döner", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("bozuk")).toBe("");
  });
});
