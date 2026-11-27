import { describe, expect, it } from "vitest";
import { resolveTheme, stageColor, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";

describe("tema", () => {
  it("kayıtlı seçim cihaz ayarından önce gelir", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme(null, "dark")).toBe("dark");
  });

  it("koyu zeminde kaybolan aşama renkleri değişkene çevrilir", () => {
    expect(stageColor("#1E3A5F")).toBe("var(--ut-stage-1e3a5f, #1E3A5F)");
    expect(stageColor("#6b7280")).toBe("var(--ut-stage-6b7280, #6b7280)");
    expect(stageColor("#2563EB")).toBe("#2563EB");
  });

  it("ilk boyama betiği aynı anahtarı okur ve hatayı yutar", () => {
    expect(THEME_SCRIPT).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    expect(THEME_SCRIPT).toMatch(/try\{.*\}catch\(e\)\{\}/);
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
  });
});
