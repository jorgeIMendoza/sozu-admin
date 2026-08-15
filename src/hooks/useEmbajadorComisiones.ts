import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchComisionesPorEmail,
  type ComisionDetailedStatus,
  type ComisionPorEmailRow,
} from '@/hooks/useComisionesPorEmail';

/** Detecta si la columna url_factura ya existe en embajadores_referidos.
 *  Se cachea por 5 min para no repetir el probe en cada render. */
export function useReferidosFacturaColExists() {
  const { data } = useQuery({
    queryKey: ['emb-referidos-url-factura-probe'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { error } = await (supabase as any)
        .from('embajadores_referidos').select('url_factura').limit(0);
      return { exists: !error };
    },
  });
  return data?.exists ?? false;
}

// Comisiones del embajador entendido como COMISIONISTA (misma lógica que un agente:
// hook global useComisionesPorEmail), más las comisiones que solo existen como
// referido (`embajadores_referidos.estatus_comision`).

export type EmbComisionStatus = ComisionDetailedStatus;

export interface EmbComision extends ComisionPorEmailRow {
  /** Presente cuando la fila viene de `embajadores_referidos` (sin cuenta de cobranza). */
  referralId?: string;
  /** Embajador dueño de la comisión (se muestra en la vista global del admin). */
  embajadorNombre?: string;
  embajadorId?: string;
  embajadorIdPersona?: number | null;
  embajadorEmail?: string | null;
}

/** Embajador del que se consultan comisiones. */
export interface EmbajadorComisionTarget {
  id?: string | null;
  email?: string | null;
  nombre?: string;
  idPersona?: number | null;
}

const REF_STATUS_MAP: Record<string, EmbComisionStatus> = {
  generada:  'en_revision',
  autorizada: 'programada',
  pagada:    'pagada',
};

export function useEmbajadoresComisiones(targets: EmbajadorComisionTarget[]) {
  const key = targets
    .map((t) => `${t.id ?? ''}:${t.email ?? ''}`)
    .sort()
    .join('|');

  const query = useQuery({
    queryKey: ['embajadores-comisiones', key],
    enabled: targets.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<EmbComision[]> => {
      if (targets.length === 0) return [];

      const byEmail = new Map<string, EmbajadorComisionTarget>();
      targets.forEach((t) => { if (t.email) byEmail.set(t.email.toLowerCase(), t); });
      const byErId = new Map<number, EmbajadorComisionTarget>();
      targets.forEach((t) => { if (t.id) byErId.set(Number(t.id), t); });

      const stamp = (row: EmbComision, t?: EmbajadorComisionTarget): EmbComision => ({
        ...row,
        embajadorNombre: t?.nombre,
        embajadorId: t?.id ?? undefined,
        embajadorIdPersona: t?.idPersona ?? null,
        embajadorEmail: t?.email ?? null,
      });

      // 1) Comisiones formales (comisionistas) — misma fuente que el portal de agentes.
      const emails = [...byEmail.keys()];
      const comisionistasResult = ((await fetchComisionesPorEmail(emails)) as EmbComision[]).map((r) =>
        stamp(r, byEmail.get(String(r.email_usuario ?? '').toLowerCase())),
      );

      // 2) Comisiones que solo viven en el referido.
      let erIds = [...byErId.keys()].filter((n) => Number.isFinite(n));
      if (erIds.length === 0 && emails.length === 1) {
        // Sin ambassadorId: resolver la entidad del embajador por correo.
        const { data: personaRow } = await (supabase as any)
          .from('personas').select('id').eq('email', emails[0]).maybeSingle();
        const { data: tipoEmb } = await (supabase as any)
          .from('tipos_entidad').select('id').eq('nombre', 'Embajador').maybeSingle();
        if (personaRow?.id && tipoEmb?.id) {
          const { data: erRow } = await (supabase as any)
            .from('entidades_relacionadas').select('id')
            .eq('id_persona', personaRow.id).eq('id_tipo_entidad', tipoEmb.id)
            .eq('activo', true).maybeSingle();
          if (erRow?.id) {
            erIds = [Number(erRow.id)];
            byErId.set(Number(erRow.id), byEmail.get(emails[0])!);
          }
        }
      }
      if (erIds.length === 0) return comisionistasResult;

      // DDL probe: url_factura puede no existir aún si el ALTER TABLE no se ha ejecutado
      const facturaColProbe = await (supabase as any)
        .from('embajadores_referidos').select('url_factura').limit(0);
      const hasFacturaCol = !facturaColProbe.error;

      const refSelect = [
        'id', 'estatus_comision', 'monto_comision', 'monto_venta',
        'id_entidad_relacionada', 'id_entidad_relacionada_emb', 'producto_interes',
        ...(hasFacturaCol ? ['url_factura'] : []),
      ].join(', ');

      const { data: refRows } = await (supabase as any)
        .from('embajadores_referidos')
        .select(refSelect)
        .in('id_entidad_relacionada_emb', erIds)
        .in('estatus_comision', ['generada', 'autorizada', 'pagada'])
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });

      const referralCommissions: EmbComision[] = [];
      if (refRows && refRows.length > 0) {
        // Waterfall: entidades_relacionadas → personas para el nombre del cliente
        const clientErIds = refRows.map((r: any) => r.id_entidad_relacionada).filter(Boolean);
        const clientNameMap = new Map<number, string>();
        if (clientErIds.length > 0) {
          const { data: ers } = await (supabase as any)
            .from('entidades_relacionadas').select('id, id_persona').in('id', clientErIds);
          const personaIds = (ers || []).map((er: any) => er.id_persona).filter(Boolean);
          if (personaIds.length > 0) {
            const { data: personas } = await (supabase as any)
              .from('personas').select('id, nombre_legal').in('id', personaIds);
            const pMap = new Map((personas || []).map((p: any) => [p.id, p.nombre_legal as string]));
            (ers || []).forEach((er: any) => clientNameMap.set(er.id, (pMap.get(er.id_persona) as string) ?? 'Referido'));
          }
        }

        for (const r of refRows as any[]) {
          const clientName = clientNameMap.get(r.id_entidad_relacionada) ?? 'Referido';
          const s = r.estatus_comision as string;
          const status = REF_STATUS_MAP[s] ?? 'en_revision';
          referralCommissions.push(stamp({
            id_cuenta_cobranza: 0,
            referralId: String(r.id),
            porcentaje_comision: 0,
            aprobada: s === 'autorizada' || s === 'pagada',
            pagada: s === 'pagada',
            url_evidencia_pago: null,
            proyecto: '',
            propiedad: '',
            productoNombre: r.producto_interes || '',
            clientes: [{ nombre: clientName, porcentaje: 100 }],
            precio_final: r.monto_venta || 0,
            monto_comision: r.monto_comision || 0,
            detailed_status: status,
            fecha_pago: null,
            cuenta_cobranza_label: `Referido · ${clientName}`,
            factura_url: hasFacturaCol ? r.url_factura || null : null,
          }, byErId.get(Number(r.id_entidad_relacionada_emb))));
        }
      }

      // Comisionistas manda (registro formal); los referidos llenan el hueco.
      return [...comisionistasResult, ...referralCommissions];
    },
  });

  const comisiones = query.data ?? [];
  const totals = {
    generada:  comisiones.reduce((s, c) => s + c.monto_comision, 0),
    autorizada: comisiones
      .filter((c) => c.aprobada || ['factura_requerida', 'programada'].includes(c.detailed_status))
      .reduce((s, c) => s + c.monto_comision, 0),
    pagada: comisiones
      .filter((c) => c.pagada || c.detailed_status === 'pagada')
      .reduce((s, c) => s + c.monto_comision, 0),
  };

  return { comisiones, totals, isLoading: query.isLoading, refetch: query.refetch };
}

/** Atajo de un solo embajador (portal cuando se impersona o el propio embajador). */
export function useEmbajadorComisiones(email?: string | null, ambassadorId?: string | null) {
  return useEmbajadoresComisiones(email ? [{ email, id: ambassadorId ?? null }] : []);
}
