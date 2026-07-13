/**
 * Optimización de imágenes servidas desde Supabase Storage (plan Pro).
 *
 * Reescribe una URL pública de objeto (`/storage/v1/object/public/...`) al
 * endpoint de transformación (`/storage/v1/render/image/public/...`) y agrega
 * `quality` + `width`/`height`. El endpoint de render entrega **WebP
 * automáticamente** a los navegadores que lo soportan (negociación por el header
 * `Accept`), por lo que la imagen baja como WebP aunque la URL no lleve la
 * extensión literal — así carga más rápido sin duplicar assets.
 *
 * - Solo transforma objetos públicos de **Supabase Cloud** (`*.supabase.co`),
 *   donde las transformaciones de imagen están garantizadas con el plan Pro.
 *   URLs de la BD self-hosted de desarrollo, links externos, `blob:`/`data:` o
 *   render URLs ya formados se devuelven intactos (evita 404 si el entorno no
 *   tiene el servicio de render habilitado).
 */
const OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";
// Solo el hosting cloud de Supabase garantiza el endpoint de render (Pro).
const CLOUD_HOST = ".supabase.co";

export interface ImageTransformOpts {
  /** Ancho objetivo en px (se recomienda ~2x del tamaño renderizado para retina). */
  width?: number;
  /** Alto objetivo en px. */
  height?: number;
  /** Calidad 20–100. Default 90. */
  quality?: number;
  /** Modo de reescalado cuando se pasan width y height. */
  resize?: "cover" | "contain" | "fill";
}

export function optimizedImage(url?: string | null, opts: ImageTransformOpts = {}): string {
  if (!url) return "";
  // Solo objetos públicos de Supabase Storage en el hosting cloud (Pro).
  if (!url.includes(OBJECT_MARKER)) return url;
  try {
    if (!new URL(url).hostname.endsWith(CLOUD_HOST)) return url;
  } catch {
    return url;
  }

  const { width, height, quality = 90, resize } = opts;
  const [base] = url.split("?");
  const rendered = base.replace(OBJECT_MARKER, RENDER_MARKER);

  const params = new URLSearchParams();
  if (width) params.set("width", String(Math.round(width)));
  if (height) params.set("height", String(Math.round(height)));
  params.set("quality", String(quality));
  if (resize) params.set("resize", resize);

  const qs = params.toString();
  return qs ? `${rendered}?${qs}` : rendered;
}

export default optimizedImage;
