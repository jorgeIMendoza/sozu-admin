import { SOZU_LOGO_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface SozuLogoProps {
  /** Clases extra. Define la altura (ej. "h-6", "h-7"); el ancho se deriva del aspect-ratio. */
  className?: string;
}

/**
 * Logo SOZU estándar para menús/headers de todos los portales.
 *
 * Usa una máscara CSS coloreada con `--foreground` en lugar de `dark:invert`.
 * Así el logo SIEMPRE contrasta con el fondo de su contenedor:
 * - Superficies claras → logo casi negro.
 * - Modo oscuro global → `--foreground` se vuelve casi blanco → logo blanco.
 * - Portales con tokens propios siempre claros (ej. `.inmob-portal`, que fija
 *   `--foreground` near-black y nunca aplica `.dark`) → logo casi negro siempre.
 *
 * `dark:invert` fallaba porque dependía de la clase `.dark` global, que en
 * portales always-light dejaba el logo blanco sobre fondo blanco (invisible).
 */
export const SozuLogo = ({ className }: SozuLogoProps) => (
  <span
    role="img"
    aria-label="SOZU"
    className={cn("block w-auto bg-foreground", className)}
    style={{
      aspectRatio: "932 / 268",
      WebkitMaskImage: `url(${SOZU_LOGO_URL})`,
      maskImage: `url(${SOZU_LOGO_URL})`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskPosition: "left center",
      maskPosition: "left center",
    }}
  />
);

export default SozuLogo;
