const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

interface StorageImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  /** Modo de reescalado. Default "contain" = preserva aspect ratio (no deforma). */
  resize?: "cover" | "contain" | "fill";
}

/**
 * Converts a Supabase Storage /object/public/ URL to the image render endpoint
 * with server-side WebP conversion + optional resize/quality.
 * Non-Supabase URLs pass through unchanged.
 *
 * IMPORTANTE: sin `resize`, el endpoint de render devuelve `width × alto_original`
 * y deforma la imagen (ver `@/lib/image-transform`). Por eso el default es
 * "contain" (escala proporcional).
 */
export function buildStorageImageUrl(
  rawUrl: string | null | undefined,
  { width = 240, height, quality = 80, resize = "contain" }: StorageImageOptions = {},
): string | undefined {
  if (!rawUrl) return undefined;
  if (!rawUrl.includes(OBJECT_SEGMENT)) return rawUrl;

  const base = rawUrl.replace(OBJECT_SEGMENT, RENDER_SEGMENT).split("?")[0];

  const p = new URLSearchParams({ width: String(width), quality: String(quality), format: "webp", resize });
  if (height !== undefined) p.set("height", String(height));

  return `${base}?${p.toString()}`;
}
