// src/lib altındaki bağımlılıksız modülleri Edge Function'ların _shared klasörüne kopyalar.
// Tek doğruluk kaynağı src/lib'dir; _shared kopyaları elle düzenlenmez.
// Kullanım: npm run sync:functions   (kontrol: node scripts/sync-functions.mjs --check)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SHARED_MODULES = ["money.ts", "tracking.ts", "phone.ts", "validation.ts", "offers.ts", "notifications.ts", "customer-view.ts", "exif.ts"];
export const HEADER = "// OTOMATİK KOPYA — kaynak: src/lib/{name}. Düzenlemeyin; `npm run sync:functions` çalıştırın.\n";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function expected(name) {
  return HEADER.replace("{name}", name) + readFileSync(join(root, "src/lib", name), "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const name of SHARED_MODULES) {
    if (!existsSync(join(root, "src/lib", name))) continue;
    const target = join(root, "supabase/functions/_shared", name);
    const want = expected(name);
    const have = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (have === want) continue;
    if (check) {
      console.error(`Güncel değil: supabase/functions/_shared/${name}`);
      stale++;
    } else {
      writeFileSync(target, want);
      console.log(`Kopyalandı: ${name}`);
    }
  }
  if (stale) process.exit(1);
}
