import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ENVIRONMENT } from '@/lib/config';
import { MifielSigningDialog } from '@/components/admin/MifielSigningDialog';
import { SignaturePadDialog } from '@/components/admin/SignaturePadDialog';
import type { ExpDocEstado } from '@/hooks/useExpedienteDocs';

/**
 * Firma digital (Mifiel) de una carta de acuerdos, reutilizable por cualquier
 * portal: el agente firma su Carta de comercialización y el embajador su Convenio.
 * Cambia únicamente la plantilla (`cartas_acuerdo`).
 *
 * Estado real en `firmas_digitales` (tipo_documento 'carta_acuerdos', referencia_id
 * = id_persona, carta_acuerdo_id = plantilla). El PDF firmado lo deja el webhook de
 * Mifiel en el bucket privado `firmas-digitales`.
 */

export type FirmaEstado = 'sin_firmar' | 'enviado' | 'firmado_parcial' | 'pendiente_contraparte' | 'completado' | 'cancelado';

/** Traduce el estado de firma al vocabulario del expediente. */
export function firmaToExpEstado(estado: FirmaEstado): ExpDocEstado {
  if (estado === 'completado') return 'validado';
  if (estado === 'enviado' || estado === 'firmado_parcial' || estado === 'pendiente_contraparte') return 'revision';
  return 'pendiente';
}

export const FIRMA_ESTADO_LABEL: Record<FirmaEstado, string> = {
  sin_firmar: 'Sin firmar',
  enviado: 'Enviado a firma',
  firmado_parcial: 'Firma parcial',
  pendiente_contraparte: 'Pendiente contraparte',
  completado: 'Firmado',
  cancelado: 'Cancelado',
};

/** El motivo real de un error de Edge Function viaja en el body (err.context). */
async function readEdgeFunctionError(err: any): Promise<string> {
  const ctx = err?.context;
  if (!ctx || typeof ctx !== 'object') return '';
  try {
    const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    if (typeof res.json === 'function') {
      const body = await res.json();
      const msg = body?.error || body?.message;
      if (msg) return String(msg);
    }
  } catch {
    // Body no-JSON o ya consumido.
  }
  try {
    if (typeof ctx.text === 'function') {
      const txt = await ctx.text();
      if (txt) return txt.slice(0, 500);
    }
  } catch {
    // Sin body legible.
  }
  return '';
}

interface Params {
  personaId?: number | null;
  /** Plantilla concreta; si no se pasa se resuelve por nombre. */
  cartaAcuerdoId?: string | null;
  /** Patrón ILIKE para resolver la plantilla (p. ej. '%convenio%embajador%'). */
  cartaAcuerdoNombreLike?: string;
  enabled?: boolean;
}

export function useFirmaCartaAcuerdo({ personaId, cartaAcuerdoId, cartaAcuerdoNombreLike, enabled = true }: Params) {
  const on = enabled && !!personaId;

  // ── Plantilla de la carta ──
  const { data: carta } = useQuery({
    queryKey: ['carta-acuerdo', cartaAcuerdoId ?? null, cartaAcuerdoNombreLike ?? null],
    enabled: on && (!!cartaAcuerdoId || !!cartaAcuerdoNombreLike),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = (supabase as any).from('cartas_acuerdo').select('id, nombre, requiere_firma_autografa').eq('activo', true);
      q = cartaAcuerdoId ? q.eq('id', cartaAcuerdoId) : q.ilike('nombre', cartaAcuerdoNombreLike!);
      const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
    },
  });
  const cartaId: string | null = carta?.id ?? null;
  const requiereFirmaAutografa = carta?.requiere_firma_autografa !== false;

  // ── Persona firmante ──
  const { data: persona, refetch: refetchPersona } = useQuery({
    queryKey: ['firma-persona', personaId ?? null],
    enabled: on,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('nombre_legal, email').eq('id', personaId!).maybeSingle();
      return data ?? null;
    },
  });

  // ── Firma existente + sincronización contra Mifiel ──
  const { data: firma, refetch: refetchFirma } = useQuery({
    queryKey: ['firma-carta-acuerdo', personaId ?? null, cartaId],
    enabled: on && !!cartaId,
    staleTime: 15_000,
    queryFn: async (): Promise<any | null> => {
      const { data } = await (supabase as any)
        .from('firmas_digitales')
        .select('*')
        .eq('tipo_documento', 'carta_acuerdos')
        .eq('referencia_id', personaId)
        .eq('carta_acuerdo_id', cartaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;

      const enProgreso = data.estado === 'enviado' || data.estado === 'firmado_parcial';
      if (!enProgreso || !data.mifiel_document_id) return data;

      const { data: mifielData, error: mifielError } = await supabase.functions.invoke('mifiel-consultar-documento', {
        body: { document_id: data.mifiel_document_id, environment: ENVIRONMENT },
      });
      const upstreamStatus = Number(mifielData?.upstream_status || 0);
      const errorMessage = [
        mifielError ? await readEdgeFunctionError(mifielError) : '',
        mifielError?.message,
        mifielData?.error,
      ].filter(Boolean).join(' | ');
      const notFound = upstreamStatus === 404 || /404|not found|no existe|deleted/i.test(errorMessage);

      if (mifielError || !mifielData?.success) {
        if (notFound) {
          await (supabase as any).from('firmas_digitales').update({ estado: 'cancelado' }).eq('id', data.id);
          return { ...data, estado: 'cancelado' };
        }
        return data;
      }

      const remoteState = String(mifielData?.document?.state || '').toLowerCase().trim();
      if (['completed', 'signed'].includes(remoteState)) {
        await (supabase as any).from('firmas_digitales').update({ estado: 'completado' }).eq('id', data.id);
        return { ...data, estado: 'completado' };
      }
      if (['deleted', 'canceled', 'cancelled', 'void', 'voided', 'expired', 'rejected', 'archived'].includes(remoteState)) {
        await (supabase as any).from('firmas_digitales').update({ estado: 'cancelado' }).eq('id', data.id);
        return { ...data, estado: 'cancelado' };
      }

      // ¿La persona ya firmó y solo falta la contraparte?
      const signers = mifielData.document?.signers || mifielData.document?.signatories || [];
      const propio = signers.find((s: any) => s.email === persona?.email);
      return { ...data, alreadySigned: !!propio?.signed };
    },
  });

  // ── Estado derivado ──
  const raw = firma?.estado as string | undefined;
  const estado: FirmaEstado =
    raw === 'completado' ? 'completado'
    : (raw === 'enviado' || raw === 'firmado_parcial') && firma?.alreadySigned ? 'pendiente_contraparte'
    : raw === 'enviado' ? 'enviado'
    : raw === 'firmado_parcial' ? 'firmado_parcial'
    : raw === 'cancelado' ? 'cancelado'
    : 'sin_firmar';
  const pdfUrl: string | null = estado === 'completado' ? firma?.pdf_firmado_url ?? null : null;

  // ── Acciones ──
  const [busy, setBusy] = useState(false);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [signingOpen, setSigningOpen] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const pendingAction = useRef<'firmar' | 'continuar' | null>(null);

  const crearDocumento = async (firmaAutografa: string | null) => {
    if (!cartaId) { toast.error('El documento no está configurado. Contacta a tu administrador.'); return; }
    const p = (await refetchPersona()).data ?? persona;
    if (!p?.email || !p?.nombre_legal) { toast.error('Faltan tus datos (nombre o correo) para enviar a firma.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('mifiel-crear-documento', {
        body: {
          agente_email: p.email,
          agente_nombre: p.nombre_legal,
          agente_persona_id: personaId,
          carta_acuerdo_id: cartaId,
          firma_autografa_agente: firmaAutografa,
          environment: ENVIRONMENT,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error desconocido');
      if (data.widget_id) { setWidgetId(data.widget_id); setSigningOpen(true); }
      else toast.success('Documento enviado a firma. Revisa tu correo.');
      refetchFirma();
    } catch (err: any) {
      const detalle = (await readEdgeFunctionError(err)) || err?.message || 'Error';
      console.error('[mifiel-crear-documento]', detalle);
      toast.error('No se pudo enviar el documento a firma. Inténtalo más tarde o contacta a tu administrador.');
    } finally {
      setBusy(false);
    }
  };

  const continuarFirma = async () => {
    if (!firma?.mifiel_document_id) { toast.error('No hay un documento activo para continuar la firma.'); return; }
    const docEnv = (firma as any).metadata?.environment;
    if (docEnv && docEnv !== ENVIRONMENT) {
      await (supabase as any).from('firmas_digitales').update({ estado: 'cancelado' }).eq('id', firma.id);
      await refetchFirma();
      toast.error('Este documento se creó en otro entorno. Se canceló para generar uno nuevo.');
      return;
    }
    setBusy(true);
    try {
      const { data: mifielData, error: mifielError } = await supabase.functions.invoke('mifiel-consultar-documento', {
        body: { document_id: firma.mifiel_document_id, environment: ENVIRONMENT },
      });
      if (mifielError || !mifielData?.success) throw new Error('No se pudo sincronizar el estado de firma');
      const signers = mifielData.document?.signers || mifielData.document?.signatories || [];
      const propio = signers.find((s: any) => s.email === persona?.email);
      const wid = propio?.widget_id || null;
      if (wid) { setWidgetId(wid); setSigningOpen(true); }
      else toast.error('No se pudo abrir la firma. Contacta a tu administrador.');
    } catch (err: any) {
      console.error('[mifiel-continuar-firma]', err?.message || err);
      toast.error('No se pudo continuar con la firma en este momento.');
    } finally {
      setBusy(false);
    }
  };

  /** Acción del documento: firmar por primera vez o retomar la firma en curso. */
  const firmar = async () => {
    if (estado === 'completado') return;
    const action = estado === 'enviado' || estado === 'firmado_parcial' ? 'continuar' : 'firmar';
    if (action === 'continuar' && !requiereFirmaAutografa) { await continuarFirma(); return; }
    if (action === 'firmar' && !requiereFirmaAutografa) { await crearDocumento(null); return; }
    pendingAction.current = action;
    setPadOpen(true);
  };

  const onSignatureSaved = async (dataUrl: string) => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setPadOpen(false);
    if (action === 'continuar') await continuarFirma();
    else await crearDocumento(dataUrl);
  };

  return {
    cartaId,
    configurada: !!cartaId,
    estado,
    estadoLabel: FIRMA_ESTADO_LABEL[estado],
    expEstado: firmaToExpEstado(estado),
    pdfUrl,
    busy,
    firmar,
    refetchFirma,
    // Estado interno de los diálogos (lo consume <FirmaCartaAcuerdoDialogs/>).
    dialogs: { widgetId, signingOpen, setSigningOpen, padOpen, setPadOpen, onSignatureSaved },
  };
}

export type FirmaCartaAcuerdo = ReturnType<typeof useFirmaCartaAcuerdo>;

/** Diálogos de firma (pad autógrafo + widget Mifiel). */
export function FirmaCartaAcuerdoDialogs({ firma, onCompleted }: { firma: FirmaCartaAcuerdo; onCompleted?: () => void }) {
  const { widgetId, signingOpen, setSigningOpen, padOpen, setPadOpen, onSignatureSaved } = firma.dialogs;
  return (
    <>
      <SignaturePadDialog open={padOpen} onOpenChange={setPadOpen} onSave={onSignatureSaved} />
      {widgetId && (
        <MifielSigningDialog
          open={signingOpen}
          onOpenChange={setSigningOpen}
          widgetId={widgetId}
          onSuccess={() => {
            setSigningOpen(false);
            toast.success('¡Firma completada exitosamente!');
            firma.refetchFirma();
            onCompleted?.();
          }}
        />
      )}
    </>
  );
}
