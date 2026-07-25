import { useState, useEffect } from "react";
import { optimizedImage } from "@/utils/optimizedImage";

interface OptImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "width" | "height"> {
  src?: string | null;
  /** Ancho objetivo para la transformación de Supabase (px). */
  w?: number;
  /** Alto objetivo para la transformación (px). */
  h?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/**
 * Imagen optimizada (WebP + resize + quality vía Supabase render/image).
 * Si la transformación falla (algunas imágenes no la soportan), cae al URL original.
 */
export function OptImg({ src, w, h, quality, resize, loading = "lazy", decoding = "async", ...rest }: OptImgProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const finalSrc = failed || !src ? (src || "") : optimizedImage(src, { width: w, height: h, quality, resize });
  return (
    <img
      src={finalSrc}
      loading={loading}
      decoding={decoding}
      onError={() => { if (!failed) setFailed(true); }}
      {...rest}
    />
  );
}
