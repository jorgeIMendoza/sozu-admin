/**
 * Hook de datos para el sheet de detalle de cuenta en el Portal Notaría.
 *
 * Responsabilidades:
 *   - Waterfall read-only: cuentas_cobranza → propiedades → edificios → proyectos
 *     → compradores → personas (titular + cónyuge si existe) → documento tipo 18 (contrato firmado)
 *   - Expone idPropiedad para que el componente pueda llamar a useAccesoriosFinancials
 *     y useCuentaCobranzaFinancials si lo necesita
 *   - Paso 0 (seguridad MVP): valida cc.id_notario = notarioId
 *
 * Sin mutations. Sin efectos secundarios de escritura.
 * El filtro id_notario NO es mecanismo de seguridad — ver notaria-download.service.ts.
 *
 * Excepción administrador: notarioId puede ser cualquier id cuando el usuario
 * es tomas.peterson@investimento.mx — el selector en AppNotariaDashboard lo gestiona.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotariaCompradorDetalle {
  idPersona: number;
  nombre: string;
  email: string | null;
  rfc: string | null;
  curp: string | null;
  esConyuge: boolean;
}

export interface NotariaCuentaDetalleData {
  // Cuenta de cobranza
  cuentaId: number;
  cuentaCode: string;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;
  tipoFinanciamiento: string | null;
  // Escrituración — 6 campos editables
  claveCatastral: string | null;
  numeroUnidadPrivativa: string | null;
  numeroEscritura: string | null;
  fechaEscritura: string | null;
  libro: string | null;
  hoja: string | null;
  // Propiedad
  idPropiedad: number | null;
  numeroPropiedad: string | null;
  m2Interiores: number | null;
  m2Exteriores: number | null;
  // Proyecto / Edificio / Modelo
  proyectoNombre: string | null;
  edificioNombre: string | null;
  modeloNombre: string | null;
  // Compradores (titular primero, cónyuge con esConyuge = true si aplica)
  compradores: NotariaCompradorDetalle[];
  // Contrato firmado (tipo_documento = 18)
  contratoFirmadoUrl: string | null;
}

export interface UseNotariaCuentaDetalleResult {
  data: NotariaCuentaDetalleData | null;
  isLoading: boolean;
  isError: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotariaCuentaDetalle({
  cuentaId,
  notarioId,
  enabled = true,
}: {
  cuentaId: number | null;
  notarioId: number | null;
  enabled?: boolean;
}): UseNotariaCuentaDetalleResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['notaria-cuenta-detalle', cuentaId, notarioId],
    enabled: enabled && !!cuentaId && !!notarioId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // ── Paso 0: Validación de pertenencia (seguridad MVP) ─────────────────
      // ESTE FILTRO NO ES UN MECANISMO DE SEGURIDAD — ver notaria-download.service.ts.
      const { data: ccRow, error: ccErr } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id, id_propiedad, tipo_financiamiento, clave_catastral, numero_unidad_privativa, numero_escritura, fecha_escritura, libro, hoja, fecha_creacion, fecha_actualizacion')
        .eq('id', cuentaId!)
        .eq('id_notario', notarioId!)
        .eq('activo', true)
        .single();

      if (ccErr || !ccRow) return null;

      const idPropiedad: number | null = ccRow.id_propiedad ?? null;

      // ── Paso 1: Propiedad ──────────────────────────────────────────────────
      let numeroPropiedad: string | null = null;
      let m2Interiores: number | null = null;
      let m2Exteriores: number | null = null;
      let idEdificioModelo: number | null = null;

      if (idPropiedad) {
        const { data: prop } = await supabase
          .from('propiedades')
          .select('numero_propiedad, m2_interiores, m2_exteriores, id_edificio_modelo')
          .eq('id', idPropiedad)
          .maybeSingle();
        if (prop) {
          numeroPropiedad = (prop as any).numero_propiedad ?? null;
          m2Interiores = Number((prop as any).m2_interiores ?? null) || null;
          m2Exteriores = Number((prop as any).m2_exteriores ?? null) || null;
          idEdificioModelo = (prop as any).id_edificio_modelo ?? null;
        }
      }

      // ── Paso 2: Edificio → Proyecto → Modelo ──────────────────────────────
      let proyectoNombre: string | null = null;
      let edificioNombre: string | null = null;
      let modeloNombre: string | null = null;

      if (idEdificioModelo) {
        const { data: edModelo } = await supabase
          .from('edificios_modelos')
          .select('id_edificio, id_modelo')
          .eq('id', idEdificioModelo)
          .maybeSingle();

        if (edModelo) {
          const [{ data: edificio }, { data: modelo }] = await Promise.all([
            supabase.from('edificios').select('id, nombre, id_proyecto').eq('id', (edModelo as any).id_edificio).maybeSingle(),
            supabase.from('modelos').select('nombre').eq('id', (edModelo as any).id_modelo).maybeSingle(),
          ]);

          if (edificio) {
            edificioNombre = (edificio as any).nombre ?? null;
            modeloNombre = (modelo as any)?.nombre ?? null;
            if ((edificio as any).id_proyecto) {
              const { data: proyecto } = await supabase
                .from('proyectos')
                .select('nombre')
                .eq('id', (edificio as any).id_proyecto)
                .maybeSingle();
              proyectoNombre = (proyecto as any)?.nombre ?? null;
            }
          }
        }
      }

      // ── Paso 3: Compradores ────────────────────────────────────────────────
      const { data: compradoresRows } = await supabase
        .from('compradores')
        .select('id_persona, activo')
        .eq('id_cuenta_cobranza' as any, cuentaId!)
        .eq('activo', true);

      const personaIds = (compradoresRows ?? [])
        .map((c: any) => c.id_persona as number)
        .filter(Boolean);

      let compradores: NotariaCompradorDetalle[] = [];

      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal, nombre_comercial, email, rfc, curp, id_persona_conyuge')
          .in('id', personaIds as any);

        const personaMap: Record<number, any> = {};
        for (const p of personas ?? []) personaMap[(p as any).id] = p;

        // Collect unique cónyuge IDs not already in compradores
        const conyugeIds = [...new Set(
          (personas ?? [])
            .map((p: any) => p.id_persona_conyuge)
            .filter((id: any) => id && !personaIds.includes(id)),
        )] as number[];

        const conyugeMap: Record<number, any> = {};
        if (conyugeIds.length) {
          const { data: conyuges } = await supabase
            .from('personas')
            .select('id, nombre_legal, nombre_comercial, email, rfc, curp')
            .in('id', conyugeIds as any);
          for (const c of conyuges ?? []) conyugeMap[(c as any).id] = c;
        }

        for (const personaId of personaIds) {
          const p = personaMap[personaId];
          if (!p) continue;
          compradores.push({
            idPersona: personaId,
            nombre: p.nombre_legal || p.nombre_comercial || `Comprador ${compradores.length + 1}`,
            email: p.email ?? null,
            rfc: p.rfc ?? null,
            curp: p.curp ?? null,
            esConyuge: false,
          });

          if (p.id_persona_conyuge && conyugeMap[p.id_persona_conyuge]) {
            const conyuge = conyugeMap[p.id_persona_conyuge];
            compradores.push({
              idPersona: conyuge.id,
              nombre: conyuge.nombre_legal || conyuge.nombre_comercial || 'Cónyuge',
              email: conyuge.email ?? null,
              rfc: conyuge.rfc ?? null,
              curp: conyuge.curp ?? null,
              esConyuge: true,
            });
          }
        }
      }

      // ── Paso 3.5: Resolver cuenta principal para el contrato ──────────────
      // El contrato firmado (tipo_documento=18) siempre reside en la cuenta
      // principal (ofertas.id_producto IS NULL). Si la cuenta recibida es una
      // accesoria (estacionamiento / bodega), el query de Paso 4 no encontraría
      // el contrato. Misma regla institucional que Paso 0.5 en RelacionPagos.
      let cuentaIdParaContrato: number = cuentaId!;

      if (idPropiedad) {
        const { data: todasCuentas } = await (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_oferta')
          .eq('id_propiedad', idPropiedad)
          .eq('activo', true);

        const ofertaIdsDetalle = ((todasCuentas ?? []) as { id: number; id_oferta: number | null }[])
          .map(c => c.id_oferta)
          .filter((id): id is number => id != null);

        if (ofertaIdsDetalle.length) {
          const { data: ofertasDetalle } = await supabase
            .from('ofertas')
            .select('id, id_producto')
            .in('id', ofertaIdsDetalle);

          const ofertaMapDetalle: Record<number, { id_producto: number | null }> = {};
          for (const o of ofertasDetalle ?? []) ofertaMapDetalle[(o as any).id] = o as any;

          const cuentaPrincipal = ((todasCuentas ?? []) as { id: number; id_oferta: number | null }[]).find(c => {
            const of = c.id_oferta != null ? ofertaMapDetalle[c.id_oferta] : undefined;
            return of !== undefined && of.id_producto === null;
          });

          if (typeof cuentaPrincipal?.id === 'number') {
            cuentaIdParaContrato = cuentaPrincipal.id;
          }
        }
      }

      // ── Paso 4: Contrato firmado (tipo_documento = 18) ─────────────────────
      // El contrato está vinculado a la CUENTA (id_persona = NULL), no a la persona.
      // Misma regla que DocumentsTab con entityType = 'cuenta_cobranza'.
      // Se usa cuentaIdParaContrato (cuenta principal resuelta) no la cuenta recibida.
      let contratoFirmadoUrl: string | null = null;

      const { data: contratos } = await (supabase as any)
        .from('documentos')
        .select('url, id_estatus_verificacion, fecha_creacion')
        .eq('id_cuenta_cobranza', cuentaIdParaContrato)
        .eq('id_tipo_documento', 18)
        .eq('activo', true)
        .eq('es_draft', false)
        .order('fecha_creacion', { ascending: false })
        .limit(1);

      const contrato = (contratos ?? [])[0] ?? null;
      // Mostrar el contrato más reciente, independientemente del estatus
      if (contrato?.url) contratoFirmadoUrl = contrato.url;

      return {
        cuentaId: cuentaId!,
        cuentaCode: `CC-${String(cuentaId!).padStart(6, '0')}`,
        fechaCreacion: ccRow.fecha_creacion ?? null,
        fechaActualizacion: ccRow.fecha_actualizacion ?? null,
        tipoFinanciamiento: ccRow.tipo_financiamiento ?? null,
        claveCatastral: ccRow.clave_catastral ?? null,
        numeroUnidadPrivativa: ccRow.numero_unidad_privativa ?? null,
        numeroEscritura: ccRow.numero_escritura ?? null,
        fechaEscritura: ccRow.fecha_escritura ?? null,
        libro: ccRow.libro ?? null,
        hoja: ccRow.hoja ?? null,
        idPropiedad,
        numeroPropiedad,
        m2Interiores,
        m2Exteriores,
        proyectoNombre,
        edificioNombre,
        modeloNombre,
        compradores,
        contratoFirmadoUrl,
      } satisfies NotariaCuentaDetalleData;
    },
  });

  return { data: data ?? null, isLoading, isError };
}
