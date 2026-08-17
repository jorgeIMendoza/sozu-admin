import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Asignación del AGENTE EXTERNO / INMOBILIARIA que asume la comisión externa de
 * un Canal de Venta sobre una Cuenta de Cobranza concreta.
 *
 * La comisión externa del canal (`comisionExternaPct`) es solo un porcentaje sin
 * persona; quién la cobra vive en la tabla `comisionistas` (por cuenta + email),
 * la misma que administra la sección "Comisionistas" del detalle de la cuenta.
 * Por eso las mutaciones invalidan TAMBIÉN `["comisionistas", idCuenta]` (la clave
 * del diálogo) para que ambas vistas queden sincronizadas. La lectura usa su
 * propia clave para no chocar con el queryFn de esa sección (misma clave, distinto
 * shape, se pisarían).
 *
 * Clasificación de "externo" — idéntica a `useComisionesExternas`:
 *   - Inmobiliaria: `personas.tipo_persona === 'pm'`.
 *   - Agente externo: `usuarios.rol_id === 3` con dominio de correo NO interno.
 */

const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];

const esDominioInterno = (email?: string | null) => {
  if (!email) return true;
  const dom = email.split("@")[1]?.toLowerCase();
  return !dom || DOMINIOS_INTERNOS.includes(dom);
};

const EXTERNOS_KEY = "comisionistas-externos";
/** Clave del diálogo de Cuenta de Cobranza — se invalida para sincronizar. */
const COMISIONISTAS_DIALOGO_KEY = "comisionistas";

export interface ComisionistaExternoAsignado {
  email: string;
  nombre: string;
  esInmobiliaria: boolean;
  porcentaje: number;
  aprobada: boolean;
  pagada: boolean;
}

export interface AgenteExternoBusqueda {
  email: string;
  nombre: string;
  esInmobiliaria: boolean;
}

/** Comisionistas EXTERNOS (agente externo o inmobiliaria) ya asignados a la cuenta. */
export function useComisionistasExternosCuenta(idCuentaCobranza: number | null) {
  return useQuery<ComisionistaExternoAsignado[]>({
    queryKey: [EXTERNOS_KEY, idCuentaCobranza],
    enabled: idCuentaCobranza != null,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comisionistas")
        .select("email_usuario, porcentaje_comision, aprobada, pagada")
        .eq("id_cuenta_cobranza", idCuentaCobranza)
        .eq("activo", true);
      if (error || !data?.length) return [];

      const emails = Array.from(new Set(data.map((c: any) => c.email_usuario).filter(Boolean))) as string[];
      const [usuariosRes, personasRes] = await Promise.all([
        (supabase as any).from("usuarios").select("email, nombre, rol_id").in("email", emails),
        (supabase as any).from("personas").select("email, nombre_legal, nombre_comercial, tipo_persona").in("email", emails).eq("activo", true),
      ]);
      const uMap = new Map<string, any>((usuariosRes.data ?? []).map((u: any) => [u.email, u]));
      const pMap = new Map<string, any>((personasRes.data ?? []).map((p: any) => [p.email, p]));

      return (data as any[])
        .map((c) => {
          const p = pMap.get(c.email_usuario);
          const u = uMap.get(c.email_usuario);
          const esInmobiliaria = p?.tipo_persona === "pm";
          const esAgenteExterno = u?.rol_id === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(c.email_usuario);
          if (!esInmobiliaria && !esAgenteExterno) return null; // solo externos
          return {
            email: c.email_usuario as string,
            nombre: (p?.nombre_comercial || p?.nombre_legal || u?.nombre || c.email_usuario) as string,
            esInmobiliaria,
            porcentaje: Number(c.porcentaje_comision ?? 0),
            aprobada: !!c.aprobada,
            pagada: !!c.pagada,
          } as ComisionistaExternoAsignado;
        })
        .filter((x): x is ComisionistaExternoAsignado => x !== null);
    },
  });
}

/** Busca Agentes externos (rol 3, dominio externo) e Inmobiliarias (`personas` pm). */
export function useBuscarAgentesExternos(search: string) {
  const term = search.trim();
  return useQuery<AgenteExternoBusqueda[]>({
    queryKey: ["buscar-agentes-externos", term],
    enabled: term.length >= 2,
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${term}%`;
      const [agRes, inmobRes] = await Promise.all([
        (supabase as any)
          .from("usuarios")
          .select("email, nombre, rol_id")
          .eq("rol_id", AGENTE_INMOBILIARIO_ROL_ID)
          .eq("activo", true)
          .or(`email.ilike.${like},nombre.ilike.${like}`)
          .limit(20),
        (supabase as any)
          .from("personas")
          .select("email, nombre_legal, nombre_comercial, tipo_persona")
          .eq("tipo_persona", "pm")
          .eq("activo", true)
          .or(`email.ilike.${like},nombre_legal.ilike.${like},nombre_comercial.ilike.${like}`)
          .limit(20),
      ]);

      const inmobiliarias: AgenteExternoBusqueda[] = (inmobRes.data ?? [])
        .filter((p: any) => p.email)
        .map((p: any) => ({ email: p.email, nombre: p.nombre_comercial || p.nombre_legal || p.email, esInmobiliaria: true }));
      const agentes: AgenteExternoBusqueda[] = (agRes.data ?? [])
        .filter((u: any) => u.email && !esDominioInterno(u.email))
        .map((u: any) => ({ email: u.email, nombre: u.nombre || u.email, esInmobiliaria: false }));

      const vistos = new Set<string>();
      return [...inmobiliarias, ...agentes].filter((r) => (vistos.has(r.email) ? false : (vistos.add(r.email), true)));
    },
  });
}

/** Asigna (o reactiva) un externo a la cuenta con el % indicado (el externo del canal). */
export function useAsignarComisionistaExterno(idCuentaCobranza: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, porcentaje }: { email: string; porcentaje: number }) => {
      if (idCuentaCobranza == null) throw new Error("Cuenta no disponible");
      // Reactivar si quedó una baja lógica previa (misma llave natural).
      const { data: previa } = await (supabase as any)
        .from("comisionistas")
        .select("email_usuario")
        .eq("id_cuenta_cobranza", idCuentaCobranza)
        .eq("email_usuario", email)
        .eq("activo", false)
        .maybeSingle();
      if (previa) {
        const { error } = await (supabase as any)
          .from("comisionistas")
          .update({ activo: true, porcentaje_comision: porcentaje })
          .eq("id_cuenta_cobranza", idCuentaCobranza)
          .eq("email_usuario", email);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("comisionistas")
          .insert({ id_cuenta_cobranza: idCuentaCobranza, email_usuario: email, porcentaje_comision: porcentaje, activo: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXTERNOS_KEY, idCuentaCobranza] });
      qc.invalidateQueries({ queryKey: [COMISIONISTAS_DIALOGO_KEY, idCuentaCobranza] });
    },
  });
}

/** Baja lógica del externo en la cuenta. */
export function useEliminarComisionistaExterno(idCuentaCobranza: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      if (idCuentaCobranza == null) return;
      const { error } = await (supabase as any)
        .from("comisionistas")
        .update({ activo: false })
        .eq("id_cuenta_cobranza", idCuentaCobranza)
        .eq("email_usuario", email);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXTERNOS_KEY, idCuentaCobranza] });
      qc.invalidateQueries({ queryKey: [COMISIONISTAS_DIALOGO_KEY, idCuentaCobranza] });
    },
  });
}
