const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

interface StorageImageOptions {
  width?: number;
  height?: number;
  quality?: number;
}

/**
 * Converts a Supabase Storage /object/public/ URL to the image render endpoint
 * with server-side WebP conversion + optional resize/quality.
 * Non-Supabase URLs pass through unchanged.
 */
export function buildStorageImageUrl(
  rawUrl: string | null | undefined,
  { width = 240, height, quality = 80 }: StorageImageOptions = {},
): string | undefined {
  if (!rawUrl) return undefined;
  if (!rawUrl.includes(OBJECT_SEGMENT)) return rawUrl;

  const base = rawUrl.replace(OBJECT_SEGMENT, RENDER_SEGMENT).split("?")[0];

  const p = new URLSearchParams({ width: String(width), quality: String(quality), format: "webp" });
  if (height !== undefined) p.set("height", String(height));

  return `${base}?${p.toString()}`;
}
