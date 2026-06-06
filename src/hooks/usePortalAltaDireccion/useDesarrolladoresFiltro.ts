import { useQuery } from "@tanstack/react-query";
import { fetchCobranzaBase, listarDesarrolladores } from "./_cobranzaBase";

/**
 * Lista de desarrolladores que tienen al menos una cuenta de cobranza.
 * Reusa la query key `cobranza-base` para no duplicar el fetch contra BD.
 */
export function useDesarrolladoresFiltro() {
  // El listado de desarrolladores se calcula sobre el dataset completo
  // (sin idProyecto). Si más adelante se quiere restringir a los
  // desarrolladores de un proyecto, se puede aceptar idProyecto y pasarlo
  // a fetchCobranzaBase como en los otros hooks.
  return useQuery({
    queryKey: ["cobranza-base", null],
    queryFn: () => fetchCobranzaBase(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    select: (dataset) => listarDesarrolladores(dataset.rows),
  });
}
