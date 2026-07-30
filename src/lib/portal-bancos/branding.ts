import type { CSSProperties } from "react";

/**
 * Tematización del Portal Bancos por marca del banco.
 *
 * El design system del admin usa variables CSS en formato HSL **sin** la función
 * `hsl()` (ej. `--primary: 158 64% 38%`), y Tailwind las consume como
 * `hsl(var(--primary))`. Para pintar el portal con los colores del banco basta
 * con sobrescribir esas variables en el contenedor raíz del portal: todo lo que
 * use `bg-primary`, `text-primary`, `border-primary`, `ring-*`, etc. hereda sin
 * tocar un solo componente.
 *
 * El color de marca vive en `bancos_convenio.color_marca` (#hex).
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Convierte `#RGB` / `#RRGGBB` a HSL. Devuelve `null` si el hex es inválido. */
export function hexToHsl(hex: string | null | undefined): Hsl | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Luminancia relativa (WCAG) del hex, 0 = negro, 1 = blanco. */
export function relativeLuminance(hex: string): number | null {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Variables CSS a inyectar en el contenedor raíz del portal para que herede el
 * color de marca del banco. Devuelve `{}` si el banco no tiene color válido, de
 * modo que el portal conserva el verde SOZU por defecto.
 *
 * Contraste: el color de texto sobre la marca (`--primary-foreground`) se elige
 * por luminancia, así un banco de marca clara (ej. amarillo) no queda con texto
 * blanco ilegible.
 */
export function bancoThemeVars(colorMarca: string | null | undefined): CSSProperties {
  if (!colorMarca) return {};
  const hsl = hexToHsl(colorMarca);
  if (!hsl) return {};

  const { h, s, l } = hsl;
  const base = `${h} ${s}% ${l}%`;
  const hover = `${h} ${s}% ${clamp(l - 8, 8, 92)}%`;
  const lum = relativeLuminance(colorMarca) ?? 0;
  // Umbral 0.5 ≈ el punto donde el negro empieza a contrastar mejor que el blanco.
  const foreground = lum > 0.5 ? "0 0% 10%" : "0 0% 100%";

  return {
    "--primary": base,
    "--primary-foreground": foreground,
    "--primary-hover": hover,
    "--primary-soft": `${base} / 0.1`,
    "--ring": base,
    "--sidebar-primary": base,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": base,
  } as CSSProperties;
}
