// Optimiza imágenes de Supabase Storage vía el endpoint de transformación
// (render/image): redimensiona + calidad + WebP automático (por header Accept).
// URLs que no sean de Supabase Storage público se devuelven sin cambios.

interface OptimizeOpts {
  width?: number;
  height?: number;
  quality?: number; // 20-100, default 90
  resize?: "cover" | "contain" | "fill";
}

const PUBLIC_MARKER = "/storage/v1/object/public/";

export function optimizedImage(url: string | null | undefined, opts: OptimizeOpts = {}): string {
  if (!url) return "";
  // El endpoint render/image solo existe en Supabase Cloud (*.supabase.co).
  // En self-hosted (dev: supabase-dev.sozu.com) 404ea y rompe la imagen.
  if (!url.includes(".supabase.co/")) return url;
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return url; // no es storage público de Supabase → dejar igual

  const { width, height, quality = 90, resize } = opts;
  const base = url.slice(0, idx);
  const path = url.slice(idx + PUBLIC_MARKER.length);

  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  params.set("quality", String(quality));
  if (resize) params.set("resize", resize);

  return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`;
}
