import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Resolver de los desarrollos (proyectos) que el socio bancario puede ver.
 *
 * DIAGNÓSTICO (2026-07-18): el Portal Socio Bancario mostraba "Desarrollo no
 * asignado" en todas las pantallas porque la cadena de scope se rompía en el
 * paso 1/2: el usuario autenticado no está mapeado a ningún banco/desarrollo.
 * En la base NO existían las tablas del modelo. La solución correcta NO es
 * hardcodear un desarrollo, sino crear el vínculo real con el Admin de Socios
 * Bancarios (/admin/socios-bancarios).
 *
 * Cadena de resolución (modelo M:N vigente — migrations#372):
 *   auth.users → usuarios (por auth_user_id) → usuarios.id_socio_bancario
 *   → socio_bancario_desarrollos (activo = true) → lista de id_desarrollo
 *   (= id de proyecto) → proyectos (nombre).
 *   Los usuarios de banco viven en `usuarios` (rol 'Socio Bancario'), no en una
 *   tabla aparte. Ya NO existe usuarios.id_proyecto_socio ni usuarios_socio_bancario.
 *
 * Un banco puede financiar varios desarrollos: se expone la lista + un
 * "activo" seleccionable (el portal muestra selector si hay más de uno). Los
 * hooks downstream siguen recibiendo un solo `idProyecto` (el activo).
 *
 * // SWAP POINT: nombres reales de tablas/columnas (confirmar con Jorge) — ver
 * // Ejecuciones_manuales/portal_socio_bancario_admin.md. Probe graceful: si las
 * // tablas aún no existen, se devuelve noAsignado (sin fuga, sin hardcode).
 * // TODO RLS: la lectura real debe acotarse server-side por desarrollo activo.
 */

const ACTIVO_KEY = "sozu-sb-desarrollo-activo";
const DEV_OVERRIDE_KEY = "sozu-sb-proyecto-override";

function devOverrideId(): number | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEV_OVERRIDE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface DesarrolloSocio {
  id: number;
  nombre: string | null;
}

export interface SocioProyecto {
  /** Desarrollo activo (el que consumen los módulos), o null si no hay. */
  idProyecto: number | null;
  nombre: string | null;
  /** Todos los desarrollos activos del banco del usuario. */
  desarrollos: DesarrolloSocio[];
  setDesarrolloActivo: (id: number) => void;
  desarrollador: string | null;
  isLoading: boolean;
  /** true = sin desarrollo vinculado (mostrar estado vacío honesto). */
  noAsignado: boolean;
}

async function fetchDesarrollosSocio(authUserId: string): Promise<DesarrolloSocio[]> {
  // 1) Banco del usuario: usuarios.id_socio_bancario (por auth_user_id). Probe graceful.
  const { data: usuario, error: uErr } = await (supabase as any)
    .from("usuarios")
    .select("id_socio_bancario, activo")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (uErr || !usuario?.id_socio_bancario || usuario.activo === false) return [];

  // 2) Desarrollos activos asignados al banco.
  const { data: asigns, error: aErr } = await (supabase as any)
    .from("socio_bancario_desarrollos")
    .select("id_desarrollo")
    .eq("id_socio_bancario", usuario.id_socio_bancario)
    .eq("activo", true);
  if (aErr || !asigns?.length) return [];
  const ids = Array.from(
    new Set((asigns as any[]).map((r) => r.id_desarrollo).filter((v): v is number => v != null)),
  );
  if (!ids.length) return [];

  // 3) Nombres de proyecto.
  const { data: proys } = await (supabase as any)
    .from("proyectos")
    .select("id, nombre")
    .in("id", ids)
    .eq("activo", true);
  const nombreById = new Map<number, string | null>(
    ((proys ?? []) as any[]).map((p) => [p.id as number, (p.nombre ?? null) as string | null]),
  );
  // Conservar solo proyectos activos existentes.
  return ids
    .filter((id) => nombreById.has(id))
    .map((id) => ({ id, nombre: nombreById.get(id) ?? null }));
}

export function useSocioProyecto(): SocioProyecto {
  const { user } = useAuth();
  const authUserId = user?.id ?? null;

  const { data: desarrollos = [], isLoading } = useQuery({
    queryKey: ["socio-bancario-desarrollos", authUserId],
    enabled: !!authUserId,
    staleTime: 5 * 60_000,
    queryFn: () => fetchDesarrollosSocio(authUserId as string),
  });

  // Override DEV (auditoría por pantalla, solo dev): inyecta un desarrollo.
  const override = devOverrideId();
  const lista: DesarrolloSocio[] =
    override != null && desarrollos.length === 0
      ? [{ id: override, nombre: null }]
      : desarrollos;

  const [activoId, setActivoId] = useState<number | null>(null);

  // Selección activa: persistida si sigue válida; si no, el primero.
  useEffect(() => {
    if (lista.length === 0) {
      setActivoId(null);
      return;
    }
    const stored = typeof window !== "undefined" ? Number(window.localStorage.getItem(ACTIVO_KEY)) : NaN;
    const valido = lista.find((d) => d.id === stored);
    setActivoId(valido ? stored : lista[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.map((d) => d.id).join(",")]);

  const setDesarrolloActivo = (id: number) => {
    setActivoId(id);
    try {
      window.localStorage.setItem(ACTIVO_KEY, String(id));
    } catch {
      /* noop */
    }
  };

  const activo = lista.find((d) => d.id === activoId) ?? lista[0] ?? null;

  return {
    idProyecto: activo?.id ?? null,
    nombre: activo?.nombre ?? null,
    desarrollos: lista,
    setDesarrolloActivo,
    desarrollador: null, // SWAP POINT: relación desarrollador↔proyecto
    isLoading: !!authUserId && isLoading,
    noAsignado: !isLoading && lista.length === 0,
  };
}
