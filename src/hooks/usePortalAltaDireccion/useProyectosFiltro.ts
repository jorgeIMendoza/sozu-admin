import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProyectoFiltro {
  id: number;
  nombre: string;
}

const PAGE_SIZE = 1000;

/**
 * Lista de proyectos que tienen al menos una cuenta de cobranza
 * vinculada. Alimenta el `<Select>` de filtros en las páginas de
 * Análisis del Portal Alta Dirección.
 *
 * Pipeline:
 *   cuentas_cobranza → ofertas.id_propiedad (fallback de cc.id_propiedad)
 *   → propiedades.id_edificio_modelo
 *   → edificios_modelos.id_edificio
 *   → edificios.id_proyecto
 *   → proyectos
 *
 * Se hace en cliente porque el volumen es pequeño (cuentas ~1.5k,
 * proyectos <100) y evita la dependencia de una RPC.
 */
export function useProyectosFiltro() {
  return useQuery({
    queryKey: ["proyectos-filtro-con-cuentas"],
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: fetchProyectosConCuentas,
  });
}

async function fetchProyectosConCuentas(): Promise<ProyectoFiltro[]> {
  // 1) Cuentas activas — sólo necesitamos id_oferta + id_propiedad.
  const cuentas: Array<any> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("cuentas_cobranza")
      .select("id_oferta, id_propiedad")
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    cuentas.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (offset > 100_000) break;
  }
  if (cuentas.length === 0) return [];

  // 2) Ofertas para resolver id_propiedad cuando la cuenta no lo tiene.
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const ofertas: Array<any> = [];
  for (let i = 0; i < ofertaIds.length; i += PAGE_SIZE) {
    const slice = ofertaIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad")
      .in("id", slice);
    if (error) throw error;
    ofertas.push(...((data || []) as Array<any>));
  }
  const ofPropMap = new Map<number, number | null>(
    ofertas.map((o) => [o.id as number, (o.id_propiedad ?? null) as number | null]),
  );

  // 3) Set de id_propiedad efectivo por cuenta.
  const propIds = Array.from(
    new Set(
      cuentas
        .map((c) => c.id_propiedad ?? (c.id_oferta ? ofPropMap.get(c.id_oferta) : null) ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  if (propIds.length === 0) return [];

  // 4) Propiedades → id_edificio_modelo.
  const propsRows: Array<any> = [];
  for (let i = 0; i < propIds.length; i += PAGE_SIZE) {
    const slice = propIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("propiedades")
      .select("id, id_edificio_modelo")
      .in("id", slice);
    if (error) throw error;
    propsRows.push(...((data || []) as Array<any>));
  }
  const emIds = Array.from(
    new Set(propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
  );
  if (emIds.length === 0) return [];

  // 5) edificios_modelos → id_edificio.
  const { data: emRows, error: emErr } = await (supabase as any)
    .from("edificios_modelos")
    .select("id, id_edificio")
    .in("id", emIds);
  if (emErr) throw emErr;
  const edIds = Array.from(
    new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
  );
  if (edIds.length === 0) return [];

  // 6) edificios → id_proyecto.
  const { data: edRows, error: edErr } = await (supabase as any)
    .from("edificios")
    .select("id, id_proyecto")
    .in("id", edIds);
  if (edErr) throw edErr;
  const projIds = Array.from(
    new Set(((edRows || []) as Array<any>).map((e) => e.id_proyecto).filter((v): v is number => !!v)),
  );
  if (projIds.length === 0) return [];

  // 7) proyectos por id (sólo los que sí tienen cuentas).
  const { data: projRows, error: projErr } = await (supabase as any)
    .from("proyectos")
    .select("id, nombre, activo")
    .in("id", projIds)
    .order("nombre");
  if (projErr) throw projErr;
  return ((projRows || []) as Array<any>)
    .filter((p) => p.activo)
    .map((p) => ({ id: p.id as number, nombre: p.nombre as string }));
}
