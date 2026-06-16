import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resumen de Mediciones del Dashboard General (Portal Alta Dirección).
 *
 * Usa la RPC real `visitas_historicas_por_portal(p_desde, p_hasta)` —la misma
 * de la pantalla "Uso por portal"— acotada al mes en curso. Segmenta por
 * PORTAL: Clientes = portal `clientes`, Agentes = portal `agentes`.
 *
 *  - usuarios:               usuarios únicos conectados en el mes.
 *  - sesiones:               total de sesiones en el mes.
 *  - duracionPromedioMin:    duración promedio por sesión (minutos).
 *
 * Si la RPC no existe todavía (migración pendiente), devuelve ceros sin romper.
 */

type HistoricoRow = {
  portal: string;
  usuarios_unicos: number;
  total_sesiones: number;
  duracion_promedio_min: number | null;
};

export interface MedicionSegmento {
  usuarios: number;
  sesiones: number;
  duracionPromedioMin: number;
}

export interface ResumenMediciones {
  mesLabel: string;
  disponible: boolean;
  clientes: MedicionSegmento;
  agentes: MedicionSegmento;
}

function inicioDeMesISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

const VACIO: MedicionSegmento = { usuarios: 0, sesiones: 0, duracionPromedioMin: 0 };

function segmentoDe(rows: HistoricoRow[], portal: string): MedicionSegmento {
  const r = rows.find((x) => x.portal === portal);
  if (!r) return { ...VACIO };
  return {
    usuarios: Number(r.usuarios_unicos ?? 0),
    sesiones: Number(r.total_sesiones ?? 0),
    duracionPromedioMin: r.duracion_promedio_min != null
      ? +Number(r.duracion_promedio_min).toFixed(1)
      : 0,
  };
}

export function useResumenMediciones() {
  return useQuery<ResumenMediciones>({
    queryKey: ["resumen-mediciones-dashboard", inicioDeMesISO()],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const mesLabel = new Date().toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
      });
      const { data, error } = (await (supabase as any).rpc(
        "visitas_historicas_por_portal",
        { p_desde: inicioDeMesISO(), p_hasta: null },
      )) as any;
      if (error) {
        // RPC/migración no disponible — degradar a ceros sin romper la UI.
        return {
          mesLabel,
          disponible: false,
          clientes: { ...VACIO },
          agentes: { ...VACIO },
        };
      }
      const rows = (data ?? []) as HistoricoRow[];
      return {
        mesLabel,
        disponible: true,
        clientes: segmentoDe(rows, "clientes"),
        agentes: segmentoDe(rows, "agentes"),
      };
    },
  });
}
