import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHARED_MODULES, expected } from "../../scripts/sync-functions.mjs";

const root = join(__dirname, "..", "..");

describe("Edge Function ortak kodu", () => {
  for (const name of SHARED_MODULES as string[]) {
    if (!existsSync(join(root, "src/lib", name))) continue;
    it(`_shared/${name} src/lib ile aynı (npm run sync:functions)`, () => {
      const target = join(root, "supabase/functions/_shared", name);
      expect(existsSync(target)).toBe(true);
      expect(readFileSync(target, "utf8")).toBe(expected(name));
    });
  }
});
