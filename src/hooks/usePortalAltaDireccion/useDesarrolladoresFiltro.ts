import { useQuery } from "@tanstack/react-query";
import { fetchCobranzaBase, listarDesarrolladores } from "./_cobranzaBase";

/**
 * Lista de desarrolladores que tienen al menos una cuenta de cobranza.
 * Reusa la query key `cobranza-base` para no duplicar el fetch contra BD.
 */
export function useDesarrolladoresFiltro() {
  return useQuery({
    queryKey: ["cobranza-base"],
    queryFn: fetchCobranzaBase,
    staleTime: 60_000,
    select: (dataset) => listarDesarrolladores(dataset.rows),
  });
}
