import { supabase } from "@/integrations/supabase/client";

/**
 * Servicio de Verificación Antilavado — Lista SAT (Art. 69-B del CFF).
 *
 * Consulta el RFC de cada comprador en antilavado.com.mx a través de la Edge
 * Function `trigger-antilavado`, que descarga el comprobante oficial en PDF y
 * lo registra en `documentos` con `id_tipo_documento = 65` ("Verificacion
 * Antilavado"), ligado al comprador (`id_persona`) y a la cuenta de cobranza.
 *
 * Es un servicio informativo: NO bloquea el flujo de notificación al SAT.
 */

/** Tipo de documento para el comprobante de verificación antilavado. */
export const TIPO_DOC_VERIFICACION_ANTILAVADO = 65;

/** Días de vigencia de un comprobante de verificación antilavado. */
export const DIAS_VIGENCIA_ANTILAVADO = 90;

export interface CompradorAntilavadoStatus {
  id_persona: number;
  nombre_legal: string;
  rfc: string | null;
  tieneVerificacion: boolean;
  fechaVerificacion: string | null;
  urlVerificacion: string | null;
  docId: number | null;
  /** true si el comprobante más reciente tiene menos de 90 días. */
  vigente: boolean;
}

export interface AntilavadoStatus {
  compradores: CompradorAntilavadoStatus[];
  totalCompradores: number;
  /** Compradores con al menos un comprobante activo. */
  verificados: number;
  /** Compradores con comprobante vigente (< 90 días). */
  vigentes: number;
  /** Propiedad de la cuenta (para enviarla a la Edge Function). */
  idPropiedad: number | null;
}

export interface AntilavadoComprobante {
  numero: string;
  fecha_consulta: string;
  resultado: string;
  url_verificacion?: string;
}

/**
 * Payload que devuelve la Edge Function `trigger-antilavado`, tal cual.
 * En caso de excepción se devuelve `{ success: false, error }`.
 */
export interface AntilavadoConsultaResult {
  success: boolean;
  rfc?: string;
  encontrado_en_sat?: boolean;
  reutilizado?: boolean;
  comprobante?: AntilavadoComprobante;
  documento?: { id: number; url: string } | null;
  message?: string;
  processing_time?: number;
  error?: string;
}

export interface AntilavadoConsultaParams {
  rfc: string;
  id_cuenta_cobranza: number;
  id_persona: number;
  id_propiedad?: number | null;
  /** Fuerza una nueva consulta aunque ya exista comprobante vigente. */
  force?: boolean;
}

/** Devuelve true si la fecha tiene menos de `DIAS_VIGENCIA_ANTILAVADO` días. */
function esVigente(fecha: string | null): boolean {
  if (!fecha) return false;
  const ts = new Date(fecha).getTime();
  if (Number.isNaN(ts)) return false;
  const dias = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return dias < DIAS_VIGENCIA_ANTILAVADO;
}

export const AntilavadoService = {
  /**
   * Resuelve la propiedad de una cuenta de cobranza.
   * Prioriza `cuentas_cobranza.id_propiedad`; si viene nulo cae al camino
   * histórico `cuentas_cobranza.id_oferta` → `ofertas.id_propiedad`
   * (mismo criterio que usa el resto del panel).
   */
  async getIdPropiedad(cuentaCobranzaId: number): Promise<number | null> {
    const { data: cuenta, error } = await supabase
      .from('cuentas_cobranza')
      .select(`
        id,
        id_propiedad,
        ofertas:ofertas!fk_ccob_oferta(
          id_propiedad
        )
      `)
      .eq('id', cuentaCobranzaId)
      .eq('activo', true)
      .maybeSingle();

    if (error || !cuenta) {
      console.error('[Antilavado Service] Error obteniendo la propiedad de la cuenta:', error);
      return null;
    }

    return cuenta.id_propiedad ?? (cuenta.ofertas as any)?.id_propiedad ?? null;
  },

  /**
   * Estado de verificación antilavado por comprador activo de la cuenta.
   */
  async getStatus(cuentaCobranzaId: number): Promise<AntilavadoStatus> {
    const vacio: AntilavadoStatus = {
      compradores: [],
      totalCompradores: 0,
      verificados: 0,
      vigentes: 0,
      idPropiedad: null,
    };

    // Compradores activos de la cuenta + datos fiscales de la persona
    const { data: compradores, error: compradoresError } = await supabase
      .from('compradores')
      .select(`
        id_persona,
        personas:personas!fk_compradores_persona(
          nombre_legal,
          rfc
        )
      `)
      .eq('id_cuenta_cobranza', cuentaCobranzaId)
      .eq('activo', true);

    if (compradoresError) {
      console.error('[Antilavado Service] Error obteniendo compradores:', compradoresError);
      return vacio;
    }

    const idPropiedad = await this.getIdPropiedad(cuentaCobranzaId);

    if (!compradores?.length) {
      return { ...vacio, idPropiedad };
    }

    const personaIds = compradores.map(c => c.id_persona);

    // Comprobantes de verificación antilavado (tipo 65) de esta cuenta
    const { data: docs, error: docsError } = await supabase
      .from('documentos')
      .select('id, url, id_persona, fecha_creacion')
      .eq('id_cuenta_cobranza', cuentaCobranzaId)
      .eq('id_tipo_documento', TIPO_DOC_VERIFICACION_ANTILAVADO)
      .in('id_persona', personaIds)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false });

    if (docsError) {
      console.error('[Antilavado Service] Error obteniendo comprobantes antilavado:', docsError);
    }

    const compradoresStatus: CompradorAntilavadoStatus[] = compradores.map(comprador => {
      const persona = comprador.personas as any;
      // Los docs vienen ordenados desc por fecha → el primero es el más reciente.
      const doc = (docs || []).find(d => d.id_persona === comprador.id_persona) || null;
      const fechaVerificacion = doc?.fecha_creacion ?? null;

      return {
        id_persona: comprador.id_persona,
        nombre_legal: persona?.nombre_legal || 'Sin nombre',
        rfc: persona?.rfc || null,
        tieneVerificacion: !!doc,
        fechaVerificacion,
        urlVerificacion: doc?.url ?? null,
        docId: doc?.id ?? null,
        vigente: esVigente(fechaVerificacion),
      };
    });

    return {
      compradores: compradoresStatus,
      totalCompradores: compradoresStatus.length,
      verificados: compradoresStatus.filter(c => c.tieneVerificacion).length,
      vigentes: compradoresStatus.filter(c => c.vigente).length,
      idPropiedad,
    };
  },

  /**
   * Ejecuta la consulta antilavado de UN comprador contra la Edge Function.
   * Devuelve el payload del backend tal cual; ante error, `{ success:false, error }`.
   */
  async consultar(params: AntilavadoConsultaParams): Promise<AntilavadoConsultaResult> {
    try {
      if (!params.rfc) {
        throw new Error('El comprador no tiene RFC registrado');
      }

      // Si no nos pasan la propiedad, la resolvemos desde la cuenta.
      const idPropiedad = params.id_propiedad ?? await this.getIdPropiedad(params.id_cuenta_cobranza);

      const { data, error } = await supabase.functions.invoke('trigger-antilavado', {
        body: {
          rfc: params.rfc,
          id_cuenta_cobranza: params.id_cuenta_cobranza,
          id_persona: params.id_persona,
          id_propiedad: idPropiedad ?? undefined,
          force: params.force ?? false,
        }
      });

      if (error) {
        throw new Error(`Error from Edge Function: ${error.message}`);
      }

      if (!data) {
        throw new Error('La Edge Function no devolvió respuesta');
      }

      if (!data.success) {
        throw new Error(data.error || data.message || 'Error desconocido en la consulta antilavado');
      }

      return data as AntilavadoConsultaResult;
    } catch (error) {
      console.error('Error en consulta antilavado:', error);
      const mensaje = error instanceof Error
        ? error.message
        : 'Error desconocido en la consulta antilavado';
      return { success: false, error: mensaje };
    }
  }
};
