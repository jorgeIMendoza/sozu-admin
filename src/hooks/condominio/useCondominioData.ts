import { useQuery } from "@tanstack/react-query";
import { fetchCondominios, fetchCondominioDataset, fetchCondominioConfig, type CondominioConfig } from "@/lib/portal-condominio/queries";
import type { CondominioDataset, CondominioRef } from "@/types/condominio";

// Lista de condominios (proyectos entregados con cuentas de mantenimiento).
export function useCondominios() {
  return useQuery<CondominioRef[]>({
    queryKey: ["condominios"],
    queryFn: fetchCondominios,
    staleTime: 30 * 60 * 1000,
  });
}

// Dataset completo del condominio seleccionado. Todas las vistas derivan de aquí.
export function useCondominioDataset(proyectoId: number | null) {
  return useQuery<CondominioDataset>({
    queryKey: ["condominio-dataset", proyectoId],
    queryFn: () => fetchCondominioDataset(proyectoId as number),
    enabled: proyectoId != null,
    staleTime: 5 * 60 * 1000,
  });
}

// Parámetros de configuración del condominio (proyecto).
export function useCondominioConfig(proyectoId: number | null) {
  return useQuery<CondominioConfig>({
    queryKey: ["condominio-config", proyectoId],
    queryFn: () => fetchCondominioConfig(proyectoId as number),
    enabled: proyectoId != null,
    staleTime: 30 * 60 * 1000,
  });
}
