import { describe, expect, it } from "vitest";
import { sniffImage, stripMetadata } from "./exif";

const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s, "latin1"));

function seg(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}

function jpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, enc("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")),
    ...seg(0xe1, enc("Exif\0\0GPS-41.0082,28.9784")),
    ...seg(0xe1, enc("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Konum</x:xmpmeta>")),
    ...seg(0xe2, enc("ICC_PROFILE\0\x01\x01renk")),
    ...seg(0xed, enc("Photoshop 3.0\0IPTC")),
    ...seg(0xfe, enc("Yorum: iPhone 15")),
    ...seg(0xdb, [0, ...new Array(64).fill(1)]),
    0xff, 0xff, // dolgu
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, // entropi verisi, bayt doldurma ve RST
    0xff, 0xd9,
  ]);
}

function crcFree(type: string, data: number[]): number[] {
  const len = data.length;
  return [(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...enc(type), ...data, 0, 0, 0, 0];
}

function png(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...crcFree("IHDR", new Array(13).fill(0)),
    ...crcFree("tEXt", enc("Author\0Gizli")),
    ...crcFree("eXIf", enc("MM\0*GPS")),
    ...crcFree("tIME", [7, 234, 11, 26, 10, 0, 0]),
    ...crcFree("IDAT", [1, 2, 3]),
    ...crcFree("iTXt", enc("XML:com.adobe.xmp\0\0\0\0\0<xmp/>")),
    ...crcFree("IEND", []),
  ]);
}

function riffChunk(type: string, data: number[]): number[] {
  const size = data.length;
  return [...enc(type), size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255, ...data, ...(size & 1 ? [0] : [])];
}

function webp(): Uint8Array {
  const body = [
    ...enc("WEBP"),
    ...riffChunk("VP8X", [0x08 | 0x04 | 0x10, 0, 0, 0, 9, 0, 0, 9, 0, 0]),
    ...riffChunk("VP8L", [0x2f, 1, 2, 3, 4]),
    ...riffChunk("EXIF", enc("MM\0*GPS")),
    ...riffChunk("XMP ", enc("<x:xmpmeta/>")),
  ];
  const size = body.length;
  return new Uint8Array([...enc("RIFF"), size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255, ...body]);
}

describe("sniffImage", () => {
  it("sihirli baytlardan türü tanır", () => {
    expect(sniffImage(jpeg())).toBe("jpeg");
    expect(sniffImage(png())).toBe("png");
    expect(sniffImage(webp())).toBe("webp");
  });

  it("desteklenmeyen ya da sahte içerikleri reddeder", () => {
    expect(sniffImage(new Uint8Array(enc("GIF89a")))).toBeNull();
    expect(sniffImage(new Uint8Array(enc("<svg xmlns=")))).toBeNull();
    expect(sniffImage(new Uint8Array(enc("%PDF-1.7")))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(new Uint8Array(enc("RIFF\0\0\0\0WAVE")))).toBeNull();
  });
});

describe("stripMetadata · JPEG", () => {
  it("EXIF, XMP, IPTC ve yorumları atar; JFIF, ICC, tablo ve tarama verisini korur", () => {
    const out = stripMetadata(jpeg())!;
    expect(out.kind).toBe("jpeg");
    for (const s of ["Exif", "GPS", "xmpmeta", "Photoshop", "iPhone"]) expect(has(out.bytes, s)).toBe(false);
    for (const s of ["JFIF", "ICC_PROFILE"]) expect(has(out.bytes, s)).toBe(true);
    const tail = Array.from(out.bytes.slice(-9));
    expect(tail).toEqual([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9]);
    expect(out.bytes[0]).toBe(0xff);
    expect(out.bytes[1]).toBe(0xd8);
  });

  it("temizlenmiş dosya tekrar temizlendiğinde değişmez", () => {
    const once = stripMetadata(jpeg())!.bytes;
    expect(Array.from(stripMetadata(once)!.bytes)).toEqual(Array.from(once));
  });

  it("kesik dosyayı reddeder", () => {
    expect(stripMetadata(jpeg().slice(0, 30))).toBeNull();
  });
});

describe("stripMetadata · PNG", () => {
  it("metin, eXIf ve tIME parçalarını atar; görüntü parçalarını korur", () => {
    const out = stripMetadata(png())!;
    expect(out.kind).toBe("png");
    for (const s of ["tEXt", "eXIf", "tIME", "iTXt", "Gizli", "xmp"]) expect(has(out.bytes, s)).toBe(false);
    for (const s of ["IHDR", "IDAT", "IEND"]) expect(has(out.bytes, s)).toBe(true);
    expect(out.bytes.length).toBe(8 + 25 + 15 + 12);
  });

  it("IEND olmayan dosyayı reddeder", () => {
    const b = png();
    expect(stripMetadata(b.slice(0, b.length - 12))).toBeNull();
  });
});

describe("stripMetadata · WebP", () => {
  it("EXIF ve XMP parçalarını atar, VP8X bayraklarını temizler, RIFF boyutunu düzeltir", () => {
    const out = stripMetadata(webp())!;
    expect(out.kind).toBe("webp");
    expect(has(out.bytes, "EXIF")).toBe(false);
    expect(has(out.bytes, "XMP ")).toBe(false);
    expect(has(out.bytes, "VP8L")).toBe(true);
    const view = new DataView(out.bytes.buffer);
    expect(view.getUint32(4, true)).toBe(out.bytes.length - 8);
    // VP8X verisinin ilk baytı: yalnızca alfa (0x10) kalır
    expect(out.bytes[20]).toBe(0x10);
  });

  it("RIFF boyutu dosyadan büyükse reddeder", () => {
    const b = webp();
    expect(stripMetadata(b.slice(0, b.length - 4))).toBeNull();
  });
});
