import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchFinancialsByCuentaIds, type AccesorioSummary } from '@/hooks/useAccesoriosFinancials';

// Listas .in() más grandes se truncan/fallan silenciosamente contra PostgREST
// (URL demasiado larga) — mismo tamaño de lote que PldDashboard.tsx.
const BATCH = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Réplica de useAccesoriosFinancials pero agregada a TODO el proyecto (o a las
 * propiedades de un propietario dentro del proyecto, si se pasa propietarioId)
 * en vez de una sola propiedad — para las cards "Bodega" / "Cajón" en modo
 * global (sin unidad específica) de Relación de Pagos.
 *
 * Con cientos de propiedades, las listas .in() (propiedadIds, allProductIds,
 * cuentaIds…) fácilmente superan lo que PostgREST tolera en una sola consulta;
 * todo va en lotes de 30.
 */
export function useProyectoAccesoriosFinancials(proyectoId: number | null, propietarioId?: number | null) {
  return useQuery({
    queryKey: ['proyecto-accesorios-financials', proyectoId, propietarioId ?? null],
    enabled: !!proyectoId,
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Propiedades del proyecto — waterfall explícito (edificios → modelos → propiedades)
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id')
        .eq('id_proyecto', proyectoId!)
        .eq('activo', true);
      const edificioIds = (edificios ?? []).map((e) => e.id);
      if (!edificioIds.length) return { bodega: null, cajon: null };

      const modelos: { id: number }[] = [];
      for (const slice of chunk(edificioIds, BATCH)) {
        const { data } = await supabase.from('edificios_modelos').select('id').in('id_edificio', slice);
        modelos.push(...(data ?? []));
      }
      const modeloIds = modelos.map((m) => m.id);
      if (!modeloIds.length) return { bodega: null, cajon: null };

      const propiedades: { id: number }[] = [];
      for (const slice of chunk(modeloIds, BATCH)) {
        let q = supabase.from('propiedades').select('id').in('id_edificio_modelo', slice).eq('activo', true);
        if (propietarioId != null) q = q.eq('id_entidad_relacionada_dueno', propietarioId);
        const { data } = await q;
        propiedades.push(...(data ?? []));
      }
      const propiedadIds = propiedades.map((p) => p.id);
      if (!propiedadIds.length) return { bodega: null, cajon: null };

      // 2. Bodegas / estacionamientos de esas propiedades → id_producto
      const bodegas: { id_producto: number | null }[] = [];
      const estacionamientos: { id_producto: number | null }[] = [];
      for (const slice of chunk(propiedadIds, BATCH)) {
        const [{ data: bodegasSlice }, { data: estSlice }] = await Promise.all([
          supabase.from('bodegas').select('id_producto').in('id_propiedad', slice).eq('activo', true),
          supabase.from('estacionamientos').select('id_producto').in('id_propiedad', slice).eq('activo', true),
        ]);
        bodegas.push(...(bodegasSlice ?? []));
        estacionamientos.push(...(estSlice ?? []));
      }

      const bodegaProductIds = [...new Set(bodegas.map((b) => b.id_producto).filter(Boolean))] as number[];
      const estProductIds = [...new Set(estacionamientos.map((e) => e.id_producto).filter(Boolean))] as number[];
      const allProductIds = [...new Set([...bodegaProductIds, ...estProductIds])];

      if (!allProductIds.length) return { bodega: null, cajon: null };

      // 3. Ofertas de esos productos, scopeadas a las propiedades del proyecto — ambas
      // listas se acotan (producto x propiedad), así que se cruzan lotes de las dos.
      const ofertas: { id: number; id_producto: number | null }[] = [];
      for (const productSlice of chunk(allProductIds, BATCH)) {
        for (const propSlice of chunk(propiedadIds, BATCH)) {
          const { data } = await supabase
            .from('ofertas')
            .select('id, id_producto')
            .in('id_producto', productSlice)
            .in('id_propiedad', propSlice)
            .eq('activo', true);
          ofertas.push(...(data ?? []));
        }
      }

      const ofertasByProduct = new Map<number, number[]>();
      ofertas.forEach((o) => {
        const prev = ofertasByProduct.get(o.id_producto!) ?? [];
        prev.push(o.id);
        ofertasByProduct.set(o.id_producto!, prev);
      });

      // 4. cuentas_cobranza para esas ofertas
      const allOfertaIds = Array.from(ofertasByProduct.values()).flat();
      if (!allOfertaIds.length) return { bodega: null, cajon: null };

      const cuentasRaw: { id: number; id_oferta: number }[] = [];
      for (const slice of chunk(allOfertaIds, BATCH)) {
        const { data } = await supabase.from('cuentas_cobranza').select('id, id_oferta').in('id_oferta', slice).eq('activo', true);
        cuentasRaw.push(...(data ?? []));
      }

      const cuentaByOferta = new Map<number, number>();
      cuentasRaw.forEach((c) => cuentaByOferta.set(c.id_oferta, c.id));

      const cuentaIdsForProducts = (productIds: number[]) =>
        [...new Set(productIds.flatMap((pid) =>
          (ofertasByProduct.get(pid) ?? [])
            .map((oid) => cuentaByOferta.get(oid))
            .filter((id): id is number => id != null)
        ))];

      const bodegaCuentaIds = cuentaIdsForProducts(bodegaProductIds);
      const estCuentaIds = cuentaIdsForProducts(estProductIds);

      // 5. Financials en paralelo (fetchFinancialsByCuentaIds ya batchea internamente)
      const [bodegaFinancials, estFinancials] = await Promise.all([
        fetchFinancialsByCuentaIds(bodegaCuentaIds),
        fetchFinancialsByCuentaIds(estCuentaIds),
      ]);

      return {
        bodega: bodegaCuentaIds.length ? bodegaFinancials : null,
        cajon: estCuentaIds.length ? estFinancials : null,
      } as { bodega: AccesorioSummary | null; cajon: AccesorioSummary | null };
    },
  });
}
