import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { defaultRoles } from "@/lib/portal-estructura-comisiones/utils/seed-data";
import type { Channel } from "@/lib/portal-estructura-comisiones/types/simulator";
import { fetchCanalesReales, fetchCanalesConfigProyecto } from "./useMotorComisionesSync";
import { resolverCanalesDeProyecto } from "./useCanalesPorProyecto";
import {
  useEstructuraRealRaw, derivarRolesSimulador,
} from "./useEstructuraRealSimulador";
import {
  useComisionesPropuestas, useValidacionesCanal, fingerprintCanal, type EstadoValidacionCanal,
} from "./useComisionesValidacion";
import type { TipoPersonal } from "./useDirectorioPuestos";

/**
 * Estructura de Comisiones **por Canal de Venta** de un proyecto, ya resuelta y
 * lista para consultarse desde fuera del Portal Estructura de comisiones (hoy,
 * desde el detalle de una Cuenta de Cobranza).
 *
 * Cruza cuatro fuentes, todas por proyecto y en waterfall explícito
 * (patrón #1 de CLAUDE.md):
 *
 *   `comisiones_canales`        catálogo maestro global del canal
 *   `comisiones_canal_config`   qué canales aplican al proyecto y sus %
 *   `comisiones_reglas`         comisionistas del canal y su % sobre venta
 *   `personal_organizacional`   quién es cada comisionista y de quién es su costo
 *
 * y le agrega el estado de validación por canal (`comisiones_validaciones`), que
 * es lo que distingue una propuesta capturada de una estructura ya autorizada.
 *
 * Es de **solo lectura**: aquí nada se edita. La captura vive en su portal.
 */

/** Comisionista dado de alta en un canal, con lo que cobra por una venta. */
export interface ComisionistaCanal {
  /** `null` = regla heredada del modelo por rol, sin persona asignada. */
  idPersonal: string | null;
  nombre: string;
  rol: string;
  /**
   * Empleado directo o colaborador del Grupo Investimento. El colaborador
   * comisiona igual, pero su sueldo no lo paga SOZU.
   */
  tipoPersonal: TipoPersonal | null;
  /** % sobre el precio de venta final. */
  porcentaje: number;
  pool: "sozu" | "project";
}

/**
 * Estado de validación de un canal **frente a la versión vigente** de la
 * estructura, no frente a cualquier decisión histórica:
 *
 * - `validada` / `rechazada` — la decisión se tomó sobre la propuesta vigente.
 * - `obsoleta` — el canal sí se decidió alguna vez, pero la estructura se
 *   modificó y se reenvió a validar después. Esa decisión ya no aplica y el
 *   canal vuelve a requerir validación.
 * - `pendiente` — nunca se tomó una decisión sobre este canal.
 */
export type EstadoCanalValidacion = EstadoValidacionCanal | "pendiente" | "obsoleta";

export interface CanalEstructuraCuenta {
  id: string;
  nombre: string;
  categoria: string | null;
  /** La comisión total del canal nunca se capturó para este proyecto. */
  totalSinDefinir: boolean;
  comisionTotalPct: number;
  comisionExternaPct: number;
  /** Lo que queda para el equipo interno: total − externa. */
  comisionInternaPct: number;
  /** Suma de lo asignado a los comisionistas. */
  dispersadaPct: number;
  /** Interna aún sin repartir. Negativo = excedido. */
  remanentePct: number;
  /** El % externo es propio del proyecto y no heredado del catálogo. */
  externaEsPropia: boolean;
  comisionistas: ComisionistaCanal[];
  empleadosSozu: ComisionistaCanal[];
  colaboradoresInvestimento: ComisionistaCanal[];
  /** Reglas sin persona asignada: suman a la dispersión pero no tienen a quién. */
  sinComisionista: ComisionistaCanal[];
  validacion: {
    estado: EstadoCanalValidacion;
    /** Autor y fecha de la última decisión, aunque haya quedado obsoleta. */
    validadoPor: string | null;
    fecha: string | null;
    notas: string | null;
    /** Estado de esa última decisión, para poder decir qué fue lo que caducó. */
    estadoPrevio: EstadoValidacionCanal | null;
    /** `fecha_actualizacion` de la propuesta vigente: cuándo se reenvió a validar. */
    reenviadaEl: string | null;
  };
  /** Último guardado de la configuración del canal en este proyecto. */
  fechaActualizacion: string | null;
}

/** Regla de comisión tal como vive en `comisiones_reglas`. */
interface ReglaCanal {
  idCanal: string;
  idRol: string;
  idPersonal: string | null;
  porcentaje: number;
  pool: "sozu" | "project";
}

const CATALOGO_KEY = "cuenta-canales-catalogo";
const CONFIG_KEY = "cuenta-canales-config";
const REGLAS_KEY = "cuenta-comisiones-reglas";

/** Catálogo maestro de canales. `null` = la tabla aún no existe (DDL pendiente). */
function useCatalogoCanales() {
  return useQuery<Channel[] | null>({
    queryKey: [CATALOGO_KEY],
    staleTime: 5 * 60_000,
    queryFn: fetchCanalesReales,
  });
}

/**
 * Reglas vigentes del proyecto.
 *
 * Se filtra por `activo`: una regla dada de baja sigue en la tabla y sumarla
 * inflaría la dispersión del canal con comisionistas que ya no cobran.
 */
function useReglasComisionProyecto(idProyecto: number | null) {
  return useQuery<ReglaCanal[] | null>({
    queryKey: [REGLAS_KEY, idProyecto],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comisiones_reglas")
        .select("id_canal, id_rol, id_personal, porcentaje, pool")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true);
      if (error || !data) return null;
      return (data as any[]).map(r => ({
        idCanal: String(r.id_canal),
        idRol: String(r.id_rol ?? ""),
        idPersonal: r.id_personal != null ? String(r.id_personal) : null,
        porcentaje: Number(r.porcentaje ?? 0),
        pool: r.pool === "sozu" ? "sozu" : "project",
      } as ReglaCanal));
    },
  });
}

export interface EstructuraCanalesCuenta {
  /** Canales que aplican al proyecto, validados y no validados. */
  canales: CanalEstructuraCuenta[];
  /** Solo los que Alta Dirección ya validó. */
  validados: CanalEstructuraCuenta[];
  isLoading: boolean;
  /**
   * El catálogo de canales no está en la BD (DDL pendiente): no hay estructura
   * que mostrar y la pantalla debe decirlo en vez de aparentar que no hay canales.
   */
  schemaMissing: boolean;
}

/**
 * Canales de venta del proyecto con su desglose completo de comisión.
 *
 * Los comisionistas se separan por tipo de personal porque no son lo mismo:
 * el empleado directo es costo de SOZU y el colaborador de Investimento cobra
 * su comisión como bono por el soporte que da, con su sueldo pagado por
 * Investimento.
 */
export function useEstructuraCanalesCuenta(idProyecto: number | null): EstructuraCanalesCuenta {
  const catalogo = useCatalogoCanales();
  const config = useQuery({
    queryKey: [CONFIG_KEY, idProyecto],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: () => fetchCanalesConfigProyecto(idProyecto as number),
  });
  const reglas = useReglasComisionProyecto(idProyecto);
  const { data: raw, isLoading: cargandoPersonal } = useEstructuraRealRaw();
  const { data: validaciones } = useValidacionesCanal(idProyecto);
  // La propuesta vigente marca la **versión** de la estructura que está a
  // validación. Una decisión tomada sobre una versión anterior ya no vale.
  const { data: propuestas, isLoading: cargandoPropuesta } = useComisionesPropuestas(idProyecto);

  const canales = useMemo<CanalEstructuraCuenta[]>(() => {
    // Sin proyecto no hay nada que resolver: el catálogo es global y sin la
    // configuración del proyecto se leería como "todos los canales aplican".
    if (idProyecto == null || !catalogo.data?.length) return [];

    // Persona y rol se resuelven aparte: la regla guarda el id de la persona y
    // el id del rol **del simulador** (texto, ej. `rol-org-9`), no el id real.
    const personaPorId = new Map(
      (raw?.personal ?? []).map(p => [String(p.id), p]),
    );
    const rolesSimulador = derivarRolesSimulador(raw, defaultRoles) ?? defaultRoles;
    const nombreRolPorSimId = new Map(rolesSimulador.map(r => [r.id, r.name]));
    // Rol VIGENTE de la persona en el Directorio (Roles y Sueldos). La regla
    // guarda el `id_rol` de cuando se creó, que puede haber quedado obsoleto
    // (ej. Alma Castellón como "Data & IA" siendo ya "Administración y
    // Contabilidad"). El nombre correcto es el del rol base actual de la persona.
    const nombreRolRealPorId = new Map((raw?.rolesReales ?? []).map(r => [r.id, r.nombre]));

    const validacionPorCanal = new Map((validaciones ?? []).map(v => [v.id_canal, v]));

    /*
     * Versión vigente de la estructura enviada a validar.
     *
     * Cada decisión por canal guardó el `fecha_actualizacion` de la propuesta
     * que estaba validando. Al reenviar a validar (upsert por proyecto) esa
     * fecha cambia, así que comparar contra ella es lo que distingue una
     * validación viva de una que quedó atrás. Mismo criterio que el Portal
     * Alta Dirección: sin él, un canal modificado seguiría luciendo validado.
     */
    const versionVigente = propuestas?.[0]?.fecha_actualizacion ?? null;
    const reglasPorCanal = new Map<string, ReglaCanal[]>();
    for (const r of reglas.data ?? []) {
      const lista = reglasPorCanal.get(r.idCanal);
      if (lista) lista.push(r);
      else reglasPorCanal.set(r.idCanal, [r]);
    }

    const resueltos = resolverCanalesDeProyecto(catalogo.data, config.data);

    return resueltos
      .filter(c => c.aplica && c.canal.active)
      .map<CanalEstructuraCuenta>(c => {
        const delCanal = reglasPorCanal.get(c.canal.id) ?? [];

        const comisionistas: ComisionistaCanal[] = delCanal
          .map<ComisionistaCanal>(r => {
            const persona = r.idPersonal ? personaPorId.get(r.idPersonal) : undefined;
            // Rol vigente de la persona; si no se resuelve, el de la regla.
            const rolActual = persona && persona.id_rol != null ? nombreRolRealPorId.get(persona.id_rol) : null;
            return {
              idPersonal: r.idPersonal,
              // El directorio solo trae personal activo: una regla que apunta a
              // alguien que no está ahí es de una persona dada de baja.
              nombre: persona?.nombre ?? (r.idPersonal ? "Persona dada de baja" : "Sin comisionista asignado"),
              rol: rolActual ?? nombreRolPorSimId.get(r.idRol) ?? "—",
              tipoPersonal: persona
                ? (persona.tipo_personal === "colaborador_investimento"
                  ? "colaborador_investimento"
                  : "empleado_sozu")
                : null,
              porcentaje: r.porcentaje,
              pool: r.pool,
            };
          })
          // De mayor a menor: quien más cobra encabeza la lista.
          .sort((a, b) => b.porcentaje - a.porcentaje || a.nombre.localeCompare(b.nombre));

        // La dispersión suma TODAS las reglas, incluidas las de 0% y las que
        // aún no tienen persona: es lo comprometido del canal, no lo repartido
        // entre los que se alcanzan a identificar.
        const dispersadaPct = comisionistas.reduce((s, r) => s + r.porcentaje, 0);
        const comisionInternaPct = c.comisionTotalPct - c.comisionExternaPct;

        // Una decisión sigue vigente mientras la HUELLA del canal no cambie,
        // aunque la propuesta se haya reenviado por cambios en OTROS canales.
        // Solo el canal modificado queda "obsoleta". Filas viejas sin
        // `canal_hash` caen al criterio anterior (por fecha de la propuesta).
        const v = validacionPorCanal.get(c.canal.id);
        const hashActual = fingerprintCanal(propuestas?.[0]?.snapshot, c.canal.id);
        const vigente = !!v && (v.canal_hash != null
          ? v.canal_hash === hashActual
          : versionVigente != null && v.snapshot_fecha === versionVigente);
        const estado: EstadoCanalValidacion = !v
          ? "pendiente"
          : vigente ? v.estado : "obsoleta";

        return {
          id: c.canal.id,
          nombre: c.canal.name,
          categoria: c.canal.category ?? null,
          totalSinDefinir: c.sinConfigurar || c.comisionTotalPct <= 0,
          comisionTotalPct: c.comisionTotalPct,
          comisionExternaPct: c.comisionExternaPct,
          comisionInternaPct,
          dispersadaPct,
          remanentePct: comisionInternaPct - dispersadaPct,
          externaEsPropia: c.overrides.externa,
          comisionistas,
          empleadosSozu: comisionistas.filter(r => r.tipoPersonal === "empleado_sozu"),
          colaboradoresInvestimento: comisionistas.filter(r => r.tipoPersonal === "colaborador_investimento"),
          sinComisionista: comisionistas.filter(r => r.tipoPersonal === null),
          validacion: {
            estado,
            validadoPor: v?.validado_por ?? null,
            fecha: v?.fecha_validacion ?? null,
            notas: v?.notas ?? null,
            estadoPrevio: v?.estado ?? null,
            reenviadaEl: versionVigente,
          },
          fechaActualizacion: c.fechaActualizacion,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [idProyecto, catalogo.data, config.data, reglas.data, raw, validaciones, propuestas]);

  return {
    canales,
    validados: canales.filter(c => c.validacion.estado === "validada"),
    isLoading:
      idProyecto != null &&
      (catalogo.isLoading || config.isLoading || reglas.isLoading ||
        cargandoPersonal || cargandoPropuesta),
    schemaMissing: !catalogo.isLoading && catalogo.data === null,
  };
}
