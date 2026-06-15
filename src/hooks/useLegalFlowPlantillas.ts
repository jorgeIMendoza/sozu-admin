import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Catálogo de Plantillas del SOZU Legal Flow — datos reales.
 *
 * Fuente: tabla `cartas_acuerdo` (las plantillas legales configurables del
 * sistema). Los "usos" se derivan de `firmas_digitales` (firmas emitidas
 * sobre cada carta), igual que la pantalla `legal/CartaAcuerdos`.
 *
 * Sólo se exponen campos con respaldo real en BD. Los conceptos del mock
 * legacy que NO existen en la tabla (proyecto, tipo contrato/convenio,
 * versión, KYC, MiFiel, responsable, categoría) se eliminaron.
 *
 * El queryKey comparte prefijo `cartas-acuerdo` con el resto de la app, así
 * que crear/editar cartas (que invalida `["cartas-acuerdo"]`) también
 * refresca este catálogo por coincidencia de prefijo.
 */

export interface PlantillaLegal {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Firmantes configurados en la plantilla (de `firmantes_config`). */
  numFirmantes: number;
  requiereBiometrica: boolean;
  requiereFirmaAutografa: boolean;
  activa: boolean;
  /** Número de firmas digitales emitidas con esta carta (uso real). */
  usos: number;
  actualizada: string | null;
}

export function useLegalFlowPlantillas() {
  return useQuery<PlantillaLegal[]>({
    queryKey: ["cartas-acuerdo", "catalogo-plantillas"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: cartas, error } = (await (supabase as any)
        .from("cartas_acuerdo")
        .select(
          "id, nombre, descripcion, firmantes_config, requiere_firma_autografa, requiere_validacion_biometrica, activo, updated_at",
        )
        .order("updated_at", { ascending: false })) as any;
      if (error) throw error;
      const rows = (cartas || []) as Array<any>;
      if (rows.length === 0) return [];

      // Usos reales: firmas digitales emitidas por carta.
      const { data: firmas } = (await (supabase as any)
        .from("firmas_digitales")
        .select("carta_acuerdo_id")
        .eq("tipo_documento", "carta_acuerdos")
        .not("carta_acuerdo_id", "is", null)) as any;
      const usosPorCarta: Record<string, number> = {};
      (firmas || []).forEach((f: any) => {
        const id = f.carta_acuerdo_id as string;
        usosPorCarta[id] = (usosPorCarta[id] ?? 0) + 1;
      });

      return rows.map<PlantillaLegal>((c) => ({
        id: String(c.id),
        nombre: c.nombre,
        descripcion: c.descripcion ?? null,
        numFirmantes: Array.isArray(c.firmantes_config)
          ? c.firmantes_config.length
          : 0,
        requiereBiometrica: !!c.requiere_validacion_biometrica,
        requiereFirmaAutografa: !!c.requiere_firma_autografa,
        // `activo` puede venir null (default de BD) → se considera activa.
        activa: c.activo !== false,
        usos: usosPorCarta[String(c.id)] ?? 0,
        actualizada: c.updated_at ?? null,
      }));
    },
  });
}
