import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonationOpcional } from "@/contexts/PortalPersonalImpersonationContext";

export const CRM_CONTACTOS_BASE = "/admin/portal-crm/ventas/contactos";
export const CRM_NEGOCIOS_BASE = "/admin/portal-crm/ventas/negocios";
export const PERSONAL_REFERIDOS_BASE = "/admin/portal-personal/referidos";
export const PERSONAL_NEGOCIOS_BASE = "/admin/portal-personal/negocios";

/**
 * Las vistas de Contactos y Negocios del Portal CRM se comparten con "Mis
 * referidos" y "Negocios" del Portal del Personal: misma funcionalidad, mismos
 * datos. Lo único que cambia es el portal desde el que se entra y el ALCANCE:
 *
 *   - Portal CRM → el pool completo, como siempre.
 *   - Portal del Personal → solo lo de la persona. En Contactos, los que ella
 *     posee (`crm_leads_atribucion.id_propietario`); en Negocios, los de esos
 *     mismos contactos.
 *
 * Al suplantar en el Portal del Personal ("Ver como") el propietario es el del
 * usuario suplantado, que es justo lo que se quiere comprobar.
 */
function useCrmPortalScope() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const personal = usePortalPersonalImpersonationOpcional();

  const esPortalPersonal = pathname.startsWith("/admin/portal-personal");

  return useMemo(() => {
    const suplantado = personal?.isImpersonating ? personal.impersonatedUser : null;
    // Sin `auth_user_id` del suplantado no se puede resolver su propiedad: se
    // deja en null y la vista sale vacía, en vez de mostrar la del admin.
    const ownerObligatorio = esPortalPersonal
      ? (suplantado ? suplantado.auth_user_id ?? null : user?.id ?? null)
      : null;

    return {
      esPortalPersonal,
      ownerObligatorio,
      /** Se está suplantando a alguien sin `auth_user_id` resuelto. */
      ownerNoResuelto: esPortalPersonal && ownerObligatorio == null,
    };
  }, [esPortalPersonal, personal?.isImpersonating, personal?.impersonatedUser, user?.id]);
}

export function useCrmContactosPortal() {
  const scope = useCrmPortalScope();
  return useMemo(
    () => ({
      ...scope,
      basePath: scope.esPortalPersonal ? PERSONAL_REFERIDOS_BASE : CRM_CONTACTOS_BASE,
      permisosPath: scope.esPortalPersonal ? PERSONAL_REFERIDOS_BASE : CRM_CONTACTOS_BASE,
      titulo: scope.esPortalPersonal ? "Mis referidos" : "Contactos",
    }),
    [scope],
  );
}

export function useCrmNegociosPortal() {
  const scope = useCrmPortalScope();
  return useMemo(
    () => ({
      ...scope,
      basePath: scope.esPortalPersonal ? PERSONAL_NEGOCIOS_BASE : CRM_NEGOCIOS_BASE,
      permisosPath: scope.esPortalPersonal ? PERSONAL_NEGOCIOS_BASE : CRM_NEGOCIOS_BASE,
      /** A dónde va la ficha del contacto desde un negocio. */
      contactosBasePath: scope.esPortalPersonal ? PERSONAL_REFERIDOS_BASE : CRM_CONTACTOS_BASE,
    }),
    [scope],
  );
}

/**
 * Ids de `entidades_relacionadas` (contactos) de los que la persona es
 * propietaria — el universo que delimita sus Negocios.
 *
 * Solo se consulta dentro del Portal del Personal; en el CRM devuelve `null`,
 * que significa "sin acotar".
 */
export function useMisContactosIds() {
  const { esPortalPersonal, ownerObligatorio, ownerNoResuelto } = useCrmPortalScope();

  const { data, isLoading } = useQuery({
    queryKey: ["mis-contactos-er-ids", ownerObligatorio],
    enabled: esPortalPersonal && !!ownerObligatorio,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_leads_atribucion")
        .select("id_entidad_relacionada")
        .eq("id_propietario", ownerObligatorio)
        .eq("activo", true);
      if (error) throw error;
      return Array.from(
        new Set(((data as any[]) ?? []).map((r) => Number(r.id_entidad_relacionada)).filter(Boolean)),
      );
    },
  });

  return {
    /** `null` = sin acotar (Portal CRM). Array vacío = no tiene contactos. */
    erIds: esPortalPersonal ? (data ?? null) : null,
    acota: esPortalPersonal,
    ownerNoResuelto,
    isLoading: esPortalPersonal && !ownerNoResuelto && isLoading,
  };
}

/**
 * `.in()` por lotes. Una persona puede poseer más de mil contactos y meterlos
 * todos en un solo `.in()` genera una URL que PostgREST rechaza.
 */
export async function enLotes<T>(
  ids: number[],
  tamano: number,
  consulta: (lote: number[]) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += tamano) {
    out.push(...(await consulta(ids.slice(i, i + tamano))));
  }
  return out;
}
