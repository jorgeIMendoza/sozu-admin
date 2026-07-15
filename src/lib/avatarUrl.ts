// Normaliza una URL pública de avatar (bucket `avatar`) para que cargue igual en
// todos los navegadores. El folder del path es el email del agente e incluye '@'
// (y '.'); algunos navegadores / Cloudflare encodean esos chars y otros no, así
// que la imagen carga en unos y 404ea en otros. Aquí se codifica cada segmento
// de forma idempotente (decode→encode) para una URL consistente.
export function normalizeAvatarUrl(url: string | null | undefined): string {
  if (!url) return "";
  const marker = "/storage/v1/object/public/avatar/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const rawPath = url.slice(idx + marker.length).split("?")[0];
  const encPath = rawPath
    .split("/")
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
    .join("/");
  const origin = url.slice(0, idx); // host del entorno donde se guardó (dev/prod)
  return `${origin}${marker}${encPath}`;
}
