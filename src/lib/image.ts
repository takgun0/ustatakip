"use client";

/**
 * Tarayıcıda görseli yeniden kodlar: boyutu küçültür ve EXIF/konum gibi meta verileri atar
 * (canvas'a çizilen piksel verisi meta veri taşımaz). Sunucu tarafı temizlik ayrıca yapılır.
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function reencodeImage(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Yalnızca JPEG, PNG ya da WebP yükleyebilirsiniz.");
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Dosya en fazla 5 MB olabilir.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (blob && blob.type === "image/webp") return blob;
  // WebP desteklemeyen tarayıcılar için JPEG
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!jpeg) throw new Error("Görsel işlenemedi.");
  return jpeg;
}
