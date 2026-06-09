import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCuentaCobranzaId } from '@/utils/cuentaCobranzaUtils';

// Comisiones del embajador entendido como COMISIONISTA (igual que un agente externo):
// filas en `comisionistas` ligadas a una cuenta de cobranza, enriquecidas con la venta
// (proyecto/propiedad/producto), la factura (documentos tipo 46) y el recibo de pago
// (comisionistas.url_evidencia_pago). Espeja la lógica de AgentComisiones.tsx.

export type EmbComisionStatus =
  | 'pendiente'
  | 'en_revision'
  | 'factura_requerida'
  | 'programada'
  | 'pagada';

export interface EmbComision {
  id_cuenta_cobranza: number;
  referralId?: string;       // set for referral-sourced entries
  porcentaje_comision: number;
  aprobada: boolean;
  pagada: boolean;
  url_evidencia_pago: string | null;
  proyecto: string;
  propiedad: string;
  productoNombre: string;
  precio_final: number;
  monto_comision: number;
  status: EmbComisionStatus;
  cuenta_cobranza_label: string;
  factura_url: string | null;
}

const REF_STATUS_MAP: Record<string, EmbComisionStatus> = {
  generada:  'en_revision',
  autorizada: 'programada',
  pagada:    'pagada',
};

export function useEmbajadorComisiones(email?: string | null) {
  const query = useQuery({
    queryKey: ['embajador-comisiones', email ?? null],
    enabled: !!email,
    staleTime: 30_000,
    queryFn: async (): Promise<EmbComision[]> => {
      if (!email) return [];

      const { data: comisionistas } = await (supabase as any)
        .from('comisionistas')
        .select('id_cuenta_cobranza, porcentaje_comision, aprobada, pagada, fecha_creacion, url_evidencia_pago')
        .eq('email_usuario', email)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });

      if (!comisionistas || comisionistas.length === 0) return [];

      const cuentaIds = [...new Set(comisionistas.map((c: any) => c.id_cuenta_cobranza).filter(Boolean))] as number[];
      const cuentaMap = new Map<number, any>();

      if (cuentaIds.length > 0) {
        const { data: cuentas } = await (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_oferta, precio_final')
          .in('id', cuentaIds);

        if (cuentas) {
          const ofertaIds = cuentas.map((c: any) => c.id_oferta).filter(Boolean);
          const ofertaMap = new Map<number, any>();

          if (ofertaIds.length > 0) {
            const { data: ofertas } = await (supabase as any)
              .from('ofertas')
              .select('id, id_propiedad, id_producto')
              .in('id', ofertaIds);

            const propIds = (ofertas || []).map((o: any) => o.id_propiedad).filter(Boolean);
            const prodIds = [...new Set((ofertas || []).map((o: any) => o.id_producto).filter(Boolean))] as number[];
            const propMap = new Map<number, any>();
            const prodMap = new Map<number, string>();

            if (prodIds.length > 0) {
              const { data: prods } = await (supabase as any)
                .from('productos_servicios')
                .select('id, nombre')
                .in('id', prodIds);
              (prods || []).forEach((p: any) => prodMap.set(p.id, p.nombre));
            }

            if (propIds.length > 0) {
              const { data: props } = await (supabase as any)
                .from('propiedades')
                .select('id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad')
                .in('id', propIds);

              const emIds = [...new Set((props || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))];
              const propToProject = new Map<number, string>();

              if (emIds.length > 0) {
                const { data: ems } = await (supabase as any).from('edificios_modelos').select('id, id_edificio').in('id', emIds);
                const edIds = [...new Set((ems || []).map((em: any) => em.id_edificio).filter(Boolean))];
                if (edIds.length > 0) {
                  const { data: eds } = await (supabase as any).from('edificios').select('id, id_proyecto').in('id', edIds);
                  const pjIds = [...new Set((eds || []).map((e: any) => e.id_proyecto).filter(Boolean))];
                  if (pjIds.length > 0) {
                    const { data: pjs } = await (supabase as any).from('proyectos').select('id, nombre').in('id', pjIds);
                    const pjMap = new Map((pjs || []).map((p: any) => [p.id, p.nombre]));
                    const edToP = new Map((eds || []).map((e: any) => [e.id, e.id_proyecto]));
                    const emToE = new Map((ems || []).map((em: any) => [em.id, em.id_edificio]));
                    (props || []).forEach((p: any) => {
                      const eId = emToE.get(p.id_edificio_modelo);
                      const pjId = eId ? edToP.get(eId) : null;
                      if (pjId) propToProject.set(p.id, (pjMap.get(pjId) as string) || '');
                    });
                  }
                }
              }

              (props || []).forEach((p: any) => propMap.set(p.id, { ...p, proyecto: propToProject.get(p.id) || '' }));
            }

            (ofertas || []).forEach((o: any) => {
              const prop = propMap.get(o.id_propiedad);
              const productoNombre = o.id_producto ? prodMap.get(o.id_producto) || '' : '';
              const tipoDerivado = o.id_producto ? 'Producto' : 'Propiedad';
              ofertaMap.set(o.id, { ...prop, productoNombre, tipoDerivado });
            });
          }

          cuentas.forEach((c: any) => {
            const info = ofertaMap.get(c.id_oferta);
            cuentaMap.set(c.id, {
              ...c,
              propiedad: info?.numero_propiedad,
              proyecto: info?.proyecto,
              precio_final: c.precio_final,
              tipo: info?.tipoDerivado || 'Propiedad',
              productoNombre: info?.productoNombre || '',
              id_estatus_disponibilidad: info?.id_estatus_disponibilidad,
            });
          });
        }
      }

      const cuentaIdsForFactura = comisionistas.map((c: any) => c.id_cuenta_cobranza).filter(Boolean);
      const { data: facturas } = cuentaIdsForFactura.length > 0
        ? await (supabase as any)
            .from('documentos')
            .select('id, id_cuenta_cobranza, url')
            .in('id_cuenta_cobranza', cuentaIdsForFactura)
            .eq('id_tipo_documento', 46)
            .eq('activo', true)
        : { data: [] };
      const facturaUrlMap = new Map<number, string>();
      (facturas || []).forEach((f: any) => {
        if (f.id_cuenta_cobranza) facturaUrlMap.set(f.id_cuenta_cobranza, f.url || '');
      });

      const comisionistasResult: EmbComision[] = comisionistas.map((c: any): EmbComision => {
        const cuenta = cuentaMap.get(c.id_cuenta_cobranza);
        const precioFinal = cuenta?.precio_final || 0;
        const montoComision = precioFinal * (c.porcentaje_comision || 0) / 100;
        const propSold = cuenta?.id_estatus_disponibilidad === 5;
        const facturaUrl = facturaUrlMap.get(c.id_cuenta_cobranza) || null;
        const hasFactura = facturaUrlMap.has(c.id_cuenta_cobranza);

        let status: EmbComisionStatus;
        if (c.pagada) status = 'pagada';
        else if (c.aprobada && hasFactura) status = 'programada';
        else if (c.aprobada && !hasFactura) status = 'factura_requerida';
        else if (propSold) status = 'en_revision';
        else status = 'pendiente';

        return {
          id_cuenta_cobranza: c.id_cuenta_cobranza,
          porcentaje_comision: c.porcentaje_comision || 0,
          aprobada: !!c.aprobada,
          pagada: !!c.pagada,
          url_evidencia_pago: c.url_evidencia_pago || null,
          proyecto: cuenta?.proyecto || '',
          propiedad: cuenta?.propiedad || '',
          productoNombre: cuenta?.productoNombre || '',
          precio_final: precioFinal,
          monto_comision: montoComision,
          status,
          cuenta_cobranza_label: formatCuentaCobranzaId(c.id_cuenta_cobranza, cuenta?.tipo),
          factura_url: facturaUrl,
        };
      });

      // ── Referral-sourced commissions (embajadores_referidos.estatus_comision) ──
      const { data: refRows } = await (supabase as any)
        .from('embajadores_referidos')
        .select('id, estatus_comision, monto_comision, monto_venta, id_entidad_relacionada, producto_interes')
        .eq('email_asesor', email)
        .in('estatus_comision', ['generada', 'autorizada', 'pagada'])
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });

      const referralCommissions: EmbComision[] = [];
      if (refRows && refRows.length > 0) {
        // Waterfall: entidades_relacionadas → personas for client names
        const erIds = refRows.map((r: any) => r.id_entidad_relacionada).filter(Boolean);
        const clientNameMap = new Map<number, string>();
        if (erIds.length > 0) {
          const { data: ers } = await (supabase as any)
            .from('entidades_relacionadas').select('id, id_persona').in('id', erIds);
          const personaIds = (ers || []).map((er: any) => er.id_persona).filter(Boolean);
          if (personaIds.length > 0) {
            const { data: personas } = await (supabase as any)
              .from('personas').select('id, nombre_legal').in('id', personaIds);
            const pMap = new Map((personas || []).map((p: any) => [p.id, p.nombre_legal as string]));
            (ers || []).forEach((er: any) => clientNameMap.set(er.id, pMap.get(er.id_persona) ?? 'Referido'));
          }
        }

        // Ids of comisionistas already shown (avoid duplicates when comisionistas exists)
        const existingReferralIds = new Set<string>();

        for (const r of refRows as any[]) {
          const refId = String(r.id);
          if (existingReferralIds.has(refId)) continue;
          const clientName = clientNameMap.get(r.id_entidad_relacionada) ?? 'Referido';
          const s = r.estatus_comision as string;
          referralCommissions.push({
            id_cuenta_cobranza: 0,
            referralId: refId,
            porcentaje_comision: 0,
            aprobada: s === 'autorizada' || s === 'pagada',
            pagada: s === 'pagada',
            url_evidencia_pago: null,
            proyecto: clientName,
            propiedad: '',
            productoNombre: r.producto_interes || '',
            precio_final: r.monto_venta || 0,
            monto_comision: r.monto_comision || 0,
            status: REF_STATUS_MAP[s] ?? 'en_revision',
            cuenta_cobranza_label: `Referido · ${clientName}`,
            factura_url: null,
          });
        }
      }

      // Comisionistas takes precedence (formal records); referral entries fill the gap
      return [...comisionistasResult, ...referralCommissions];
    },
  });

  const comisiones = query.data ?? [];
  const totals = {
    generada:  comisiones.reduce((s, c) => s + c.monto_comision, 0),
    autorizada: comisiones
      .filter((c) => c.aprobada || ['factura_requerida', 'programada'].includes(c.status))
      .reduce((s, c) => s + c.monto_comision, 0),
    pagada: comisiones
      .filter((c) => c.pagada || c.status === 'pagada')
      .reduce((s, c) => s + c.monto_comision, 0),
  };

  return { comisiones, totals, isLoading: query.isLoading, refetch: query.refetch };
}
