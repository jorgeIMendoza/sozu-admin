import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";
import {
  fetchCanalesReales,
  fetchCanalesConfigProyecto,
} from "@/hooks/usePortalEstructuraComisiones/useMotorComisionesSync";
import { useValidacionesCanal } from "@/hooks/usePortalEstructuraComisiones/useComisionesValidacion";
import { useComisionistasPorId } from "@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador";

/**
 * Lo que ESTA persona comisiona, por canal de venta y por proyecto.
 *
 * Cadena de vinculación, toda real:
 *
 *   usuario logueado (o suplantado en "Ver como")
 *     → `personal_organizacional.email_usuario` = `usuarios.email`
 *     → `comisiones_reglas` (id_proyecto × id_canal × id_personal)  ← su %
 *     → `comisiones_canales` + `comisiones_canal_config`            ← el canal
 *     → `comisiones_validaciones` (filas por canal)                 ← si está validado
 *
 * Es la MISMA matriz que captura el Motor de Comisiones y que Alta Dirección
 * valida canal por canal: aquí sólo se lee el renglón de la persona.
 *
 * Unidades: `comisiones_reglas.porcentaje` está en **puntos de porcentaje sobre
 * el precio de venta** (0.38 = 0.38 %), igual que en el Motor. El monto es
 * `precio × porcentaje / 100`.
 *
 * INVARIANTE de privacidad: solo se devuelve el renglón de la persona. Nunca la
 * comisión total del canal dispersada al equipo, ni el renglón de otro.
 */

export interface PersonalVinculado {
  /** `personal_organizacional.id`. */
  id: number;
  nombre: string;
  tipoPersonal: "empleado_sozu" | "colaborador_investimento";
  /** Rol base del Directorio (Roles y Sueldos). */
  rolBase: string | null;
}

export type EstadoValidacionCanalPersonal = "validada" | "rechazada" | "pendiente";

export interface CanalComisionPersonal {
  idCanal: string;
  canal: string;
  categoria: string | null;
  /** Puntos de porcentaje sobre el precio de venta que le tocan a esta persona. */
  miPorcentaje: number;
  /** Puesto con el que participa en ese canal (el vigente en el Directorio). */
  rolNombre: string | null;
  pool: "sozu" | "project";
  /** Comisión total del canal en el proyecto — contexto, no es lo que gana. */
  comisionTotalPct: number;
  estadoValidacion: EstadoValidacionCanalPersonal;
  validadoPor: string | null;
  fechaValidacion: string | null;
}

/** Persona del Directorio ligada al usuario que está viendo el portal. */
export function usePersonalDelUsuario() {
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const email = ((isImpersonating ? impersonatedUser?.email : profile?.email) ?? "").trim();

  const query = useQuery<PersonalVinculado | null>({
    queryKey: ["portal-personal-vinculo", email.toLowerCase()],
    enabled: email.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // `ilike` sin comodines = igualdad sin distinguir mayúsculas: el correo del
      // directorio no siempre se capturó con el mismo case que en `usuarios`.
      const { data } = await (supabase as any)
        .from("personal_organizacional")
        .select("id, nombre, tipo_personal, id_rol")
        .ilike("email_usuario", email)
        .eq("activo", true)
        .limit(1);

      const fila = ((data as any[]) ?? [])[0];
      if (!fila) return null;

      let rolBase: string | null = null;
      if (fila.id_rol != null) {
        const { data: rol } = await (supabase as any)
          .from("roles_organizacionales")
          .select("nombre")
          .eq("id", fila.id_rol)
          .maybeSingle();
        rolBase = (rol?.nombre as string) ?? null;
      }

      return {
        id: fila.id as number,
        nombre: fila.nombre as string,
        tipoPersonal:
          fila.tipo_personal === "colaborador_investimento"
            ? "colaborador_investimento"
            : "empleado_sozu",
        rolBase,
      };
    },
  });

  return {
    personal: query.data ?? null,
    isLoading: email.length > 0 && query.isLoading,
    /** El usuario no está dado de alta en el Directorio de Personal. */
    sinVinculo: email.length > 0 && !query.isLoading && !query.data,
  };
}

/**
 * Canales del proyecto en los que la persona gana comisión, con su porcentaje y
 * el estado de validación de cada uno.
 */
export function useComisionesDelPersonal(idProyecto: number | null | undefined) {
  const { personal, isLoading: cargandoVinculo, sinVinculo } = usePersonalDelUsuario();
  const comisionistas = useComisionistasPorId(idProyecto ?? null);
  const { data: validaciones = [] } = useValidacionesCanal(idProyecto ?? null);

  const { data: canales = [], isLoading: cargandoCanales } = useQuery({
    queryKey: ["comisiones-canales-catalogo"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchCanalesReales()) ?? [],
  });

  const { data: config } = useQuery({
    queryKey: ["canales-config-proyecto", idProyecto],
    enabled: idProyecto != null,
    staleTime: 60_000,
    queryFn: () => fetchCanalesConfigProyecto(idProyecto as number),
  });

  const { data: reglas = [], isLoading: cargandoReglas } = useQuery({
    queryKey: ["portal-personal-reglas", idProyecto, personal?.id ?? null],
    enabled: idProyecto != null && personal?.id != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("comisiones_reglas")
        .select("id_canal, id_rol, porcentaje, pool")
        .eq("id_proyecto", idProyecto)
        .eq("id_personal", personal!.id);
      return ((data as any[]) ?? []).map((r) => ({
        idCanal: String(r.id_canal),
        roleId: r.id_rol as string,
        porcentaje: Number(r.porcentaje ?? 0),
        pool: (r.pool === "project" ? "project" : "sozu") as "sozu" | "project",
      }));
    },
  });

  const misCanales: CanalComisionPersonal[] = useMemo(() => {
    if (!personal) return [];

    const canalPorId = new Map(canales.map((c) => [c.id, c]));
    const configPorCanal = new Map((config ?? []).map((c) => [c.idCanal, c]));
    const validacionPorCanal = new Map(validaciones.map((v) => [v.id_canal, v]));
    // El puesto se resuelve contra el Directorio VIGENTE: si a la persona le
    // cambiaron el rol después de capturarse la regla, manda el actual.
    const yo = comisionistas.get(String(personal.id));

    return reglas
      // Sólo los canales donde efectivamente gana algo.
      .filter((r) => r.porcentaje > 0)
      .map((r) => {
        const canal = canalPorId.get(r.idCanal);
        const cfg = configPorCanal.get(r.idCanal);
        const validacion = validacionPorCanal.get(r.idCanal);
        const rol =
          yo?.roles.find((x) => x.roleId === r.roleId) ??
          yo?.roles.find((x) => x.origen === "base") ??
          yo?.roles[0] ??
          null;

        return {
          idCanal: r.idCanal,
          canal: canal?.name ?? `Canal ${r.idCanal}`,
          categoria: canal?.category ?? null,
          miPorcentaje: r.porcentaje,
          rolNombre: rol?.rolNombre ?? personal.rolBase,
          pool: r.pool,
          comisionTotalPct: cfg?.comisionTotalPct ?? 0,
          estadoValidacion: (validacion?.estado ?? "pendiente") as EstadoValidacionCanalPersonal,
          validadoPor: validacion?.validado_por ?? null,
          fechaValidacion: validacion?.fecha_validacion ?? null,
          // Un canal apagado en el catálogo o marcado como que no aplica al
          // proyecto no debe ofrecerse como fuente de ingreso.
          _visible: (canal?.active ?? true) && (cfg?.aplica ?? true),
        };
      })
      .filter((c) => c._visible)
      .map(({ _visible, ...c }) => c)
      // Validados primero; dentro de cada grupo, el que más paga arriba.
      .sort((a, b) => {
        const peso = (e: EstadoValidacionCanalPersonal) =>
          e === "validada" ? 0 : e === "pendiente" ? 1 : 2;
        return peso(a.estadoValidacion) - peso(b.estadoValidacion) || b.miPorcentaje - a.miPorcentaje;
      });
  }, [personal, reglas, canales, config, validaciones, comisionistas]);

  return {
    personal,
    canales: misCanales,
    validados: misCanales.filter((c) => c.estadoValidacion === "validada"),
    porValidar: misCanales.filter((c) => c.estadoValidacion !== "validada"),
    sinVinculo,
    isLoading: cargandoVinculo || cargandoCanales || (personal != null && cargandoReglas),
  };
}

/** Monto que le corresponde a la persona: precio × puntos de porcentaje / 100. */
export function montoComision(precio: number, puntosPorcentuales: number): number {
  return Math.round((precio * puntosPorcentuales) / 100);
}

/** El porcentaje siempre con 3 decimales, como en el Motor de Comisiones. */
export function pctComision(puntosPorcentuales: number): string {
  return `${puntosPorcentuales.toLocaleString("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}%`;
}
