/**
 * Görsel türünü sihirli baytlardan tanır ve meta verileri (EXIF, XMP, yorum, metin) atar.
 * Piksel verisine dokunmaz; yalnızca kapsayıcıdaki meta veri bölümlerini çıkarır.
 * Bağımlılıksızdır: hem tarayıcı/Node testlerinde hem de Edge Function'da (Deno) çalışır.
 */

export type ImageKind = "jpeg" | "png" | "webp";

export const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const IMAGE_EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp" };

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && at + i < b.length; i++) s += String.fromCharCode(b[at + i]!);
  return s;
}

/** Dosyanın gerçek türü; uzantıya ya da istemcinin bildirdiği MIME'a güvenilmez. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && PNG_SIG.every((v, i) => b[i] === v)) return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

/** Meta verisi atılmış kopya; yapı bozuksa null döner (yükleme reddedilir). */
export function stripMetadata(b: Uint8Array): { kind: ImageKind; bytes: Uint8Array } | null {
  const kind = sniffImage(b);
  if (!kind) return null;
  const bytes = kind === "jpeg" ? stripJpeg(b) : kind === "png" ? stripPng(b) : stripWebp(b);
  return bytes ? { kind, bytes } : null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// JPEG: APP0 (JFIF), APP2 (ICC renk profili) ve APP14 (Adobe renk dönüşümü) korunur;
// APP1 (EXIF/XMP), diğer APPn ve COM (yorum) atılır. SOS'tan sonrası olduğu gibi kopyalanır.
const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]);

function stripJpeg(b: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    // Dolgu baytları (0xFF 0xFF …)
    while (i + 1 < b.length && b[i + 1] === 0xff) i++;
    if (i + 1 >= b.length) return null;
    const marker = b[i + 1]!;
    // Uzunluğu olmayan işaretler
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      parts.push(b.subarray(i, i + 2));
      return concat(parts);
    }
    if (i + 3 >= b.length) return null;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2 || i + 2 + len > b.length) return null;
    const end = i + 2 + len;
    if (marker === 0xda) {
      // Tarama verisi: dosyanın kalanı (EOI dahil) değiştirilmeden
      parts.push(b.subarray(i));
      return concat(parts);
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const drop = (isApp && !JPEG_KEEP_APP.has(marker)) || marker === 0xfe;
    if (!drop) parts.push(b.subarray(i, end));
    i = end;
  }
  return null;
}

// PNG: metin, EXIF ve zaman damgası parçaları atılır; CRC'ler parça bazında olduğundan bozulmaz.
const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") return concat(parts);
  }
  return null;
}

// WebP: "EXIF" ve "XMP " parçaları atılır, VP8X bayraklarından ilgili bitler temizlenir,
// RIFF boyutu yeniden hesaplanır.
const WEBP_DROP = new Set(["EXIF", "XMP "]);
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(b: Uint8Array): Uint8Array | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > b.length || riffEnd < 12) return null;
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= riffEnd) {
    const type = ascii(b, i, 4);
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (i + 8 + size > riffEnd) return null;
    if (!WEBP_DROP.has(type)) {
      const chunk = b.slice(i, Math.min(end, riffEnd));
      if (type === "VP8X" && size >= 1) chunk[8] = chunk[8]! & ~(VP8X_EXIF | VP8X_XMP);
      parts.push(chunk);
    }
    i = end;
  }
  if (parts.length === 0) return null;
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12), 0);
  out.set(body, 12);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}
