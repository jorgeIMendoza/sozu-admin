import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Motivos de no avance de una oferta (Pipeline — Portal de Agentes).
 *
 * Cuando una oferta expira sin llegar a apartado se le pide al agente la razón
 * comercial por la que no avanzó. El catálogo vive en BD
 * (`motivos_no_avance_oferta`) y el registro por oferta en `ofertas_no_avance`.
 *
 * DDL: `Ejecuciones_manuales/20260804_ofertas_motivo_no_avance.md`.
 *
 * Mientras ese DDL no se ejecute, las tablas no existen: se aplica el patrón de
 * DDL probe — el catálogo cae al fallback local (para que la UI se vea y se
 * pueda revisar) y `disponible` queda en false, lo que deshabilita el guardado
 * y muestra el aviso correspondiente en lugar de reventar la vista.
 */

export interface MotivoNoAvance {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  requiere_comentario: boolean;
  es_recuperable: boolean;
  orden: number;
}

/** Espejo del seed del DDL. Solo se usa si la tabla aún no existe. */
export const MOTIVOS_NO_AVANCE_FALLBACK: MotivoNoAvance[] = [
  { id: -1, clave: 'fuera_presupuesto', nombre: 'Está fuera de presupuesto', descripcion: 'El precio total supera lo que el prospecto puede o quiere pagar.', requiere_comentario: false, es_recuperable: true, orden: 10 },
  { id: -2, clave: 'no_listo_compra', nombre: 'No está listo para la compra', descripcion: 'Interesado, pero pospone la decisión (timing, trámites, venta previa).', requiere_comentario: false, es_recuperable: true, orden: 20 },
  { id: -3, clave: 'no_es_el_producto', nombre: 'No es el producto que busca', descripcion: 'Metros, recámaras, piso, vista o amenidades no corresponden a lo que quiere.', requiere_comentario: false, es_recuperable: true, orden: 30 },
  { id: -4, clave: 'financiamiento', nombre: 'No le agradó el financiamiento', descripcion: 'Enganche, plazo, mensualidad o tasa del esquema de pago no le funcionaron.', requiere_comentario: false, es_recuperable: true, orden: 40 },
  { id: -5, clave: 'contrato', nombre: 'No le gustó el contrato', descripcion: 'Cláusulas, penalizaciones o condiciones legales frenaron el cierre.', requiere_comentario: false, es_recuperable: true, orden: 50 },
  { id: -6, clave: 'ubicacion', nombre: 'No le convenció la ubicación', descripcion: 'Zona, entorno o distancia del proyecto.', requiere_comentario: false, es_recuperable: true, orden: 60 },
  { id: -7, clave: 'fecha_entrega', nombre: 'La fecha de entrega no le funciona', descripcion: 'Necesita ocuparla antes de lo que el proyecto puede entregar.', requiere_comentario: false, es_recuperable: true, orden: 70 },
  { id: -8, clave: 'credito_rechazado', nombre: 'No calificó al crédito', descripcion: 'Rechazo o insuficiencia de crédito hipotecario / buró.', requiere_comentario: false, es_recuperable: true, orden: 80 },
  { id: -9, clave: 'eligio_competencia', nombre: 'Eligió otra opción / competencia', descripcion: 'Compró o apartó con otro desarrollo o desarrollador.', requiere_comentario: false, es_recuperable: false, orden: 90 },
  { id: -10, clave: 'sin_respuesta', nombre: 'Dejó de responder', descripcion: 'Se perdió contacto con el prospecto tras enviar la oferta.', requiere_comentario: false, es_recuperable: true, orden: 100 },
  { id: -11, clave: 'unidad_no_disponible', nombre: 'La unidad ya no estaba disponible', descripcion: 'Se apartó o vendió a otro prospecto antes del cierre.', requiere_comentario: false, es_recuperable: true, orden: 110 },
  { id: -12, clave: 'oferta_duplicada', nombre: 'Oferta duplicada o generada por error', descripcion: 'Se emitió por error, con datos incorrectos o se sustituyó por otra oferta.', requiere_comentario: false, es_recuperable: false, orden: 120 },
  { id: -13, clave: 'otro', nombre: 'Otro motivo', descripcion: 'Cualquier razón no contemplada; requiere detalle escrito.', requiere_comentario: true, es_recuperable: true, orden: 999 },
];

export interface CatalogoNoAvance {
  /** false = el DDL todavía no corre en este ambiente; no se puede guardar. */
  disponible: boolean;
  motivos: MotivoNoAvance[];
}

export function useMotivosNoAvance(enabled = true) {
  return useQuery<CatalogoNoAvance>({
    queryKey: ['motivos-no-avance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('motivos_no_avance_oferta')
        .select('id, clave, nombre, descripcion, requiere_comentario, es_recuperable, orden')
        .eq('activo', true)
        .order('orden', { ascending: true });

      // Tabla inexistente (DDL pendiente) → catálogo local, solo lectura.
      if (error) return { disponible: false, motivos: MOTIVOS_NO_AVANCE_FALLBACK };
      return { disponible: true, motivos: (data || []) as MotivoNoAvance[] };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Razón vigente de cada oferta. Devuelve un mapa id_oferta → registro.
 * Silencioso si la tabla no existe todavía.
 */
export async function fetchNoAvancePorOferta(ofertaIds: number[]) {
  const map = new Map<number, { id_motivo: number; motivo_nombre: string; motivo_clave: string; comentario: string | null; registrado_por: string | null; fecha_registro: string }>();
  if (ofertaIds.length === 0) return map;

  const { data, error } = await (supabase as any)
    .from('ofertas_no_avance')
    .select('id_oferta, id_motivo, comentario, registrado_por, fecha_registro, motivos_no_avance_oferta(nombre, clave)')
    .in('id_oferta', ofertaIds)
    .eq('activo', true);

  if (error) return map;

  (data || []).forEach((r: any) => {
    map.set(r.id_oferta, {
      id_motivo: r.id_motivo,
      motivo_nombre: r.motivos_no_avance_oferta?.nombre || '',
      motivo_clave: r.motivos_no_avance_oferta?.clave || '',
      comentario: r.comentario ?? null,
      registrado_por: r.registrado_por ?? null,
      fecha_registro: r.fecha_registro,
    });
  });
  return map;
}

/**
 * Guarda (o corrige) la razón por la que la oferta no avanzó.
 * El índice único parcial garantiza una sola razón vigente por oferta, por eso
 * primero se intenta actualizar la existente y solo se inserta si no hay.
 */
export function useGuardarNoAvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      idOferta: number;
      idMotivo: number;
      comentario?: string | null;
      registradoPor?: string | null;
    }) => {
      const { idOferta, idMotivo, comentario, registradoPor } = params;
      const payload = {
        id_motivo: idMotivo,
        comentario: comentario?.trim() ? comentario.trim() : null,
        registrado_por: registradoPor || null,
      };

      const { data: existente, error: selError } = await (supabase as any)
        .from('ofertas_no_avance')
        .select('id')
        .eq('id_oferta', idOferta)
        .eq('activo', true)
        .maybeSingle();
      if (selError) throw selError;

      if (existente?.id) {
        const { error } = await (supabase as any)
          .from('ofertas_no_avance')
          .update(payload)
          .eq('id', existente.id);
        if (error) throw error;
        return;
      }

      const { error } = await (supabase as any)
        .from('ofertas_no_avance')
        .insert({ id_oferta: idOferta, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-pipeline'] });
    },
  });
}
