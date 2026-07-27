import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCondominios } from "@/hooks/condominio/useCondominioData";
import { useAuth } from "@/contexts/AuthContext";
import { useCondominioImpersonation } from "@/contexts/CondominioImpersonationContext";
import type { CondominioRef } from "@/types/condominio";

const STORAGE_KEY = "condominio.proyectoId";

interface CondominioContextValue {
  condominios: CondominioRef[];
  proyectoId: number | null;
  setProyectoId: (id: number) => void;
  isLoading: boolean;
  error: unknown;
  /** true = el usuario efectivo no tiene condominios asignados. */
  sinAcceso: boolean;
}

const CondominioContext = createContext<CondominioContextValue | undefined>(undefined);

/**
 * Provee los condominios visibles y el seleccionado.
 *
 * Requisito: cada usuario ve SOLO los condominios a los que tiene acceso
 * (proyectos_acceso por email). Bypass para roles privilegiados (Super Admin /
 * Administrador de Proyecto / roles.ver_todos_proyectos_propiedades), EXCEPTO
 * al impersonar (entonces se usa el acceso del usuario impersonado).
 * // TODO RLS: la frontera real por proyecto la debe imponer el RLS server-side.
 */
export function CondominioProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const { impersonatedEmail, isImpersonating } = useCondominioImpersonation();
  const { data: condominiosAll = [], isLoading, error } = useCondominios();

  const effectiveEmail = (isImpersonating ? impersonatedEmail : session?.user?.email) ?? null;

  const isSuperAdmin = profile?.rol_nombre === "Super Administrador";
  const isAdminProyecto = profile?.rol_nombre === "Administrador de Proyecto";

  // ver_todos_proyectos_propiedades del rol real (solo relevante sin impersonar).
  const { data: verTodos = false } = useQuery({
    queryKey: ["condominio-role-vertodos", profile?.rol_id],
    enabled: !!profile?.rol_id && !isImpersonating && !isSuperAdmin && !isAdminProyecto,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("roles")
        .select("ver_todos_proyectos_propiedades")
        .eq("id", profile!.rol_id)
        .maybeSingle();
      return !!data?.ver_todos_proyectos_propiedades;
    },
  });

  const hasUnrestricted = !isImpersonating && (isSuperAdmin || isAdminProyecto || verTodos);

  // Proyectos accesibles del usuario efectivo (proyectos_acceso.usuario_id = email).
  const { data: accessibleIds } = useQuery({
    queryKey: ["condominio-accesibles", effectiveEmail],
    enabled: !hasUnrestricted && !!effectiveEmail,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Set<number>> => {
      const { data, error } = await (supabase as any)
        .from("proyectos_acceso")
        .select("proyecto_id")
        .eq("usuario_id", effectiveEmail)
        .eq("activo", true);
      if (error) return new Set<number>();
      return new Set<number>(((data ?? []) as any[]).map((r) => r.proyecto_id as number));
    },
  });

  // Lista efectiva: todos (bypass) o solo los accesibles.
  const condominios = useMemo<CondominioRef[]>(() => {
    if (hasUnrestricted) return condominiosAll;
    if (!accessibleIds) return []; // aún cargando el acceso → sin fuga
    return condominiosAll.filter((c) => accessibleIds.has(c.id));
  }, [condominiosAll, hasUnrestricted, accessibleIds]);

  const scopeResolviendo = !hasUnrestricted && !!effectiveEmail && accessibleIds === undefined;

  const [proyectoId, setProyectoIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  // Selección por defecto / re-validación cuando cambia la lista accesible.
  useEffect(() => {
    if (scopeResolviendo) return;
    const valido = proyectoId != null && condominios.some((c) => c.id === proyectoId);
    if (valido) return;
    if (condominios.length > 0) {
      setProyectoIdState(condominios[0].id);
      localStorage.setItem(STORAGE_KEY, String(condominios[0].id));
    } else {
      // Sin condominios accesibles → sin selección (nunca default a 1).
      setProyectoIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [condominios, proyectoId, scopeResolviendo]);

  const setProyectoId = (id: number) => {
    setProyectoIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const value = useMemo<CondominioContextValue>(
    () => ({
      condominios,
      proyectoId,
      setProyectoId,
      isLoading: isLoading || scopeResolviendo,
      error,
      sinAcceso: !isLoading && !scopeResolviendo && condominios.length === 0,
    }),
    [condominios, proyectoId, isLoading, scopeResolviendo, error],
  );

  return <CondominioContext.Provider value={value}>{children}</CondominioContext.Provider>;
}

export function useCondominio() {
  const ctx = useContext(CondominioContext);
  if (!ctx) throw new Error("useCondominio debe usarse dentro de CondominioProvider");
  return ctx;
}
