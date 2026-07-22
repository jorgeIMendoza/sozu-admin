import { useState } from 'react';
import { EditCuentaCobranzaDialog } from '@/components/admin/EditCuentaCobranzaDialog';
import { TransferPaymentDialog } from '@/components/admin/TransferPaymentDialog';
import { CargarEvidenciaDialog } from '@/components/admin/CargarEvidenciaDialog';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PROD_FUNCTIONS_BASE_URL, PROD_SUPABASE_ANON_KEY } from '@/lib/config';
import { formatCuentaCobranzaId, formatOfertaId } from '@/utils/cuentaCobranzaUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Loader2, AlertTriangle, Scale, Upload, Plus, X, Pencil,
  UploadCloud, FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  todayIso, isImage, fmtCurrency, fmtDate, SelectSearch,
  type CuentaDetalleCtx,
} from './cuentaDetalleShared';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import { useEliminarPago, fetchPagoImpacto, type PagoImpacto } from '@/hooks/useEliminarPago';
import { EliminarPagoDialog } from '@/components/admin/portal-cobranza/EliminarPagoDialog';
import { PaymentDetailDialog } from '@/components/admin/portal-cobranza/PaymentDetailDialog';
import type { PagoRecord } from '@/hooks/useRelacionPagos';
import { CuentaDetalleMantenimiento } from './CuentaDetalleMantenimiento';
import { CuentaDetallePropiedad } from './CuentaDetallePropiedad';
import { CuentaDetalleProducto } from './CuentaDetalleProducto';

// ── fetch ───────────────────────────────────────────────────────────────────────

// Detalle completo de la cuenta en UNA sola RPC (homogéneo con el resto del
// portal: get_pcobranza_*). Antes eran ~33 .from() en waterfall. El jsonb que
// devuelve la RPC ya trae el shape exacto que consumen las sub-vistas (mismas
// llaves camelCase), por eso se retorna tal cual. Ver Ejecuciones_manuales/P30.
async function fetchCuentaDetalle(cuentaId: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_pcobranza_cuenta_detalle', { p_cuenta_id: cuentaId });
  if (error) throw error;
  if (!data) throw new Error('Cuenta no encontrada');
  return data;
}

async function fetchDocumentos(cuentaId: number, propiedadId: number | null, _compradorPersonaIds: number[]) {
  const { data: docs } = await (supabase as any)
    .from('documentos')
    .select('id, url, fecha_creacion, id_tipo_documento, id_estatus_verificacion, tipos_documento ( nombre ), id_cuenta_cobranza, id_propiedad, id_persona')
    .or(`id_cuenta_cobranza.eq.${cuentaId}${propiedadId ? `,id_propiedad.eq.${propiedadId}` : ''}`)
    .eq('activo', true)
    .order('fecha_creacion', { ascending: false });
  return (docs ?? []).map((d: any) => ({
    id: d.id,
    url: d.url,
    fecha: d.fecha_creacion,
    tipoNombre: d.tipos_documento?.nombre ?? 'Documento',
    estatusId: d.id_estatus_verificacion,
    source: d.id_cuenta_cobranza === cuentaId ? 'Cuenta' : d.id_propiedad ? 'Propiedad' : 'Persona',
    missing: false,
  }));
}

async function fetchMetodosPago() {
  const { data } = await (supabase as any).from('metodos_pago').select('id, nombre').eq('activo', true).order('id');
  return (data ?? []) as Array<{ id: number; nombre: string }>;
}

async function fetchTiposDocumento() {
  const { data } = await (supabase as any).from('tipos_documento').select('id, nombre').eq('activo', true).order('nombre');
  return (data ?? []) as Array<{ id: number; nombre: string }>;
}

// ── Shell ───────────────────────────────────────────────────────────────────────

export default function CobranzaCuentaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cuentaId = parseInt(id ?? '0');

  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);

  // dialogs
  const [editCuentaDialog, setEditCuentaDialog] = useState(false);
  const [pagoDialog, setPagoDialog] = useState(false);
  const [pagoForm, setPagoForm] = useState({ fecha: todayIso(), monto: '', id_metodo: '', clave: '' });
  const [pagoSaving, setPagoSaving] = useState(false);
  // Evidencia opcional al registrar el pago (mismo destino que el modal de carga:
  // validado → bucket ceps / col url_cep ; no validado → evidencias_efectivo / url_recibo).
  const [apFile, setApFile] = useState<File | null>(null);
  const [apDragging, setApDragging] = useState(false);
  const [apEsValido, setApEsValido] = useState(false);
  const [apEsCep, setApEsCep] = useState(false);
  const [recalculandoAplic, setRecalculandoAplic] = useState(false);

  const [multaDialog, setMultaDialog] = useState(false);
  const [multaAcuerdoId, setMultaAcuerdoId] = useState<number | null>(null);
  const [multaForm, setMultaForm] = useState({ monto: '', descripcion: '', id_tipo_multa: '' });
  const [multaSaving, setMultaSaving] = useState(false);

  const [multaGestionDialog, setMultaGestionDialog] = useState(false);
  const [multaGestionAcuerdoId, setMultaGestionAcuerdoId] = useState<number | null>(null);
  const [multaGestionDeleting, setMultaGestionDeleting] = useState<number | null>(null);
  const [multaGestionEditId, setMultaGestionEditId] = useState<number | null>(null);
  const [multaGestionEditForm, setMultaGestionEditForm] = useState({ monto: '', descripcion: '', id_tipo_multa: '' });
  const [multaGestionAddOpen, setMultaGestionAddOpen] = useState(false);
  const [multaGestionAddForm, setMultaGestionAddForm] = useState({ monto: '', descripcion: '', id_tipo_multa: '' });
  const [multaGestionSaving, setMultaGestionSaving] = useState(false);

  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadIdTipo, setUploadIdTipo] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);

  // ── Cargar evidencia de pago (por registro → bucket ceps / evidencias_efectivo) ──
  const [cargarPagoDialog, setCargarPagoDialog] = useState(false);
  const [cpTarget, setCpTarget] = useState<any | null>(null); // pago destino

  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{ url: string; title: string } | null>(null);
  const [demandaDialog, setDemandaDialog] = useState(false);
  const [demandaSaving, setDemandaSaving] = useState(false);
  const [quitarDemandaDialog, setQuitarDemandaDialog] = useState(false);
  const [quitarDemandaSaving, setQuitarDemandaSaving] = useState(false);
  const [expandedAcuerdos, setExpandedAcuerdos] = useState<Set<number>>(new Set());
  const [acuerdosPage, setAcuerdosPage] = useState(0);
  const [pagoEvidenciaModal, setPagoEvidenciaModal] = useState<any | null>(null);
  const [downloadingOferta, setDownloadingOferta] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);

  // Eliminar pago (cascada vía RPC eliminar_pago). Permiso heredado del submenú Cuentas de Cobranza.
  const { canDelete } = usePagePermissions('/admin/portal-cobranza/cuentas-cobranza');
  const { eliminarPago, isDeleting } = useEliminarPago();
  const [eliminarPagoId, setEliminarPagoId] = useState<number | null>(null);
  const [eliminarImpacto, setEliminarImpacto] = useState<PagoImpacto | null>(null);

  const openEliminarPago = (idPago: number) => {
    setEliminarPagoId(idPago);
    setEliminarImpacto(null);
    fetchPagoImpacto(idPago).then(setEliminarImpacto).catch(() => setEliminarImpacto(null));
  };

  const handleConfirmEliminarPago = async (motivo: string) => {
    if (eliminarPagoId == null) return;
    try {
      await eliminarPago(eliminarPagoId, motivo);
      toast.success('Pago eliminado');
      setEliminarPagoId(null);
      setEliminarImpacto(null);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo eliminar el pago');
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['cobranza-cuenta-detalle', cuentaId],
    queryFn: () => fetchCuentaDetalle(cuentaId),
    enabled: !!cuentaId,
    staleTime: 30_000,
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['cobranza-cuenta-docs', cuentaId, data?.propiedadId, data?.compradorPersonaIds],
    queryFn: () => fetchDocumentos(cuentaId, data?.propiedadId ?? null, data?.compradorPersonaIds ?? []),
    enabled: !!cuentaId && !!data,
    staleTime: 15_000,
  });

  // tipo_financiamiento no viene en la RPC: se lee directo (fuente de verdad del
  // método de pago del cliente). Query aparte, front-only.
  const { data: tipoFinanciamiento = null } = useQuery({
    queryKey: ['cobranza-cuenta-tipo-fin', cuentaId],
    enabled: !!cuentaId,
    staleTime: 15_000,
    queryFn: async (): Promise<string | null> => {
      const { data: row } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('tipo_financiamiento')
        .eq('id', cuentaId)
        .maybeSingle();
      return row?.tipo_financiamiento ?? null;
    },
  });

  // Empresa vendedora / dueña del proyecto (ej. Bottura → Tallwood). Es el dueño
  // de la propiedad: propiedades.id_entidad_relacionada_dueno → entidad → persona.
  const { data: empresaVendedora = null } = useQuery({
    queryKey: ['cobranza-cuenta-empresa-vendedora', data?.propiedadId],
    enabled: !!data?.propiedadId,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const propId = data?.propiedadId;
      if (!propId) return null;
      // Waterfall plano (sin embed PostgREST, que fallaba en silencio):
      // propiedad → entidad dueña → persona.
      const { data: prop } = await (supabase as any)
        .from('propiedades').select('id_entidad_relacionada_dueno').eq('id', propId).maybeSingle();
      const entId = prop?.id_entidad_relacionada_dueno;
      if (!entId) return null;
      const { data: ent } = await (supabase as any)
        .from('entidades_relacionadas').select('id_persona').eq('id', entId).maybeSingle();
      const personaId = ent?.id_persona;
      if (!personaId) return null;
      const { data: per } = await (supabase as any)
        .from('personas').select('nombre_legal').eq('id', personaId).maybeSingle();
      return per?.nombre_legal ?? null;
    },
  });

  const [reiniciarFinDialog, setReiniciarFinDialog] = useState(false);
  const [reiniciarFinSaving, setReiniciarFinSaving] = useState(false);

  const { data: metodosPago = [] } = useQuery({
    queryKey: ['metodos-pago'],
    queryFn: fetchMetodosPago,
    staleTime: 300_000,
  });
  const { data: tiposDocumento = [] } = useQuery({
    queryKey: ['tipos-documento'],
    queryFn: fetchTiposDocumento,
    staleTime: 300_000,
  });
  const { data: tiposMulta = [] } = useQuery({
    queryKey: ['tipos-multa'],
    queryFn: async () => {
      const { data: d, error: e } = await (supabase as any).from('tipos_multa').select('id, nombre').eq('activo', true).order('id');
      if (e) throw e;
      return d as Array<{ id: number; nombre: string }>;
    },
    staleTime: 300_000,
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  function apResetForm() {
    setPagoForm({ fecha: todayIso(), monto: '', id_metodo: '', clave: '' });
    setApFile(null); setApEsValido(false); setApEsCep(false);
  }

  async function handlePagoSubmit() {
    if (!pagoForm.fecha || !pagoForm.monto || !pagoForm.id_metodo) {
      toast.error('Completa fecha, monto y metodo');
      return;
    }
    setPagoSaving(true);
    try {
      // 1) Registrar el pago (RETURNING id para poder adjuntar la evidencia).
      const { data: nuevoPago, error: e } = await (supabase as any).from('pagos').insert({
        id_cuenta_cobranza: cuentaId,
        fecha_pago: pagoForm.fecha,
        monto: parseFloat(pagoForm.monto),
        id_metodos_pago: parseInt(pagoForm.id_metodo),
        clave_rastreo: pagoForm.clave || null,
        activo: true,
      }).select('id').single();
      if (e) throw e;

      // 2) Evidencia opcional → bucket + columna según validado/CEP.
      if (apFile && nuevoPago?.id) {
        const bucket = apEsCep ? 'ceps' : 'evidencias_efectivo';
        const columna = apEsValido ? 'url_cep' : 'url_recibo';
        const ext = apFile.name.split('.').pop() ?? 'bin';
        const path = `${cuentaId}/${nuevoPago.id}/${Date.now()}.${ext}`;
        const { error: se } = await supabase.storage.from(bucket).upload(path, apFile, { upsert: true });
        if (se) throw se;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        const { error: ue } = await (supabase as any).from('pagos')
          .update({ [columna]: pub.publicUrl }).eq('id', nuevoPago.id);
        if (ue) throw ue;
      }

      toast.success(apFile ? 'Pago y evidencia registrados' : 'Pago registrado');
      setPagoDialog(false);
      apResetForm();
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al registrar');
    } finally {
      setPagoSaving(false);
    }
  }

  async function handleMultaSubmit() {
    if (!multaAcuerdoId || !multaForm.monto || !multaForm.id_tipo_multa) {
      toast.error('Ingresa monto y tipo de multa');
      return;
    }
    setMultaSaving(true);
    try {
      const { error: e } = await (supabase as any).from('multas').insert({
        id_acuerdo_pago: multaAcuerdoId,
        monto: parseFloat(multaForm.monto),
        descripcion: multaForm.descripcion || '',
        id_tipo_multa: parseInt(multaForm.id_tipo_multa),
        activo: true,
      });
      if (e) throw e;
      toast.success('Multa agregada');
      setMultaDialog(false);
      setMultaAcuerdoId(null);
      setMultaForm({ monto: '', descripcion: '', id_tipo_multa: '' });
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setMultaSaving(false);
    }
  }

  async function handleMultaGestionDelete(multaId: number) {
    setMultaGestionDeleting(multaId);
    try {
      const { error } = await (supabase as any).from('multas').update({ activo: false }).eq('id', multaId);
      if (error) throw error;
      toast.success('Multa eliminada');
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar');
    } finally {
      setMultaGestionDeleting(null);
    }
  }

  async function handleMultaGestionUpdate(multaId: number) {
    if (!multaGestionEditForm.monto || !multaGestionEditForm.id_tipo_multa) {
      toast.error('Monto y tipo requeridos');
      return;
    }
    setMultaGestionSaving(true);
    try {
      const { error } = await (supabase as any).from('multas').update({
        monto: parseFloat(multaGestionEditForm.monto),
        descripcion: multaGestionEditForm.descripcion,
        id_tipo_multa: parseInt(multaGestionEditForm.id_tipo_multa),
      }).eq('id', multaId);
      if (error) throw error;
      toast.success('Multa actualizada');
      setMultaGestionEditId(null);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar');
    } finally {
      setMultaGestionSaving(false);
    }
  }

  async function handleMultaGestionAdd() {
    if (!multaGestionAcuerdoId || !multaGestionAddForm.monto || !multaGestionAddForm.id_tipo_multa) {
      toast.error('Monto y tipo requeridos');
      return;
    }
    setMultaGestionSaving(true);
    try {
      const { error } = await (supabase as any).from('multas').insert({
        id_acuerdo_pago: multaGestionAcuerdoId,
        monto: parseFloat(multaGestionAddForm.monto),
        descripcion: multaGestionAddForm.descripcion || '',
        id_tipo_multa: parseInt(multaGestionAddForm.id_tipo_multa),
        activo: true,
      });
      if (error) throw error;
      toast.success('Multa agregada');
      setMultaGestionAddOpen(false);
      setMultaGestionAddForm({ monto: '', descripcion: '', id_tipo_multa: '' });
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al agregar');
    } finally {
      setMultaGestionSaving(false);
    }
  }

  async function handleUploadSubmit() {
    if (!uploadFile || !uploadIdTipo) {
      toast.error('Selecciona tipo y archivo');
      return;
    }
    setUploadSaving(true);
    try {
      const ext = uploadFile.name.split('.').pop() ?? 'bin';
      const path = `${cuentaId}/${Date.now()}.${ext}`;
      const { error: se } = await supabase.storage.from('documentos').upload(path, uploadFile, { upsert: true });
      if (se) throw se;
      const { data: pub } = supabase.storage.from('documentos').getPublicUrl(path);
      const { error: de } = await (supabase as any).from('documentos').insert({
        url: pub.publicUrl,
        id_cuenta_cobranza: cuentaId,
        id_tipo_documento: parseInt(uploadIdTipo),
        id_estatus_verificacion: 1,
        activo: true,
      });
      if (de) throw de;
      toast.success('Documento subido');
      setUploadDialog(false);
      setUploadIdTipo('');
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-docs', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-expediente-docs', cuentaId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setUploadSaving(false);
    }
  }

  function cpResetForm() {
    setCpTarget(null);
  }

  function openCargarEvidencia(pago: any) {
    setCpTarget(pago);
    setCargarPagoDialog(true);
  }

  // Recalcular dispersión de pagos: reparte los pagos crudos en aplicaciones_pago.
  // Misma edge function que usa el detalle de cuenta del admin panel — un solo
  // algoritmo canónico para pagos manuales y automáticos (STP).
  async function handleRecalcularAplicaciones() {
    setRecalculandoAplic(true);
    try {
      const { error } = await supabase.functions.invoke('recalcular-aplicaciones', {
        body: { id_cuenta_cobranza: cuentaId },
      });
      if (error) throw error;
      toast.success('Dispersión recalculada; los pagos se redistribuyeron.');
      // La función corre async del lado servidor: refrescar tras un breve delay.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
        queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
        setRecalculandoAplic(false);
      }, 2000);
    } catch (err: any) {
      toast.error(err.message ?? 'Error al recalcular la dispersión');
      setRecalculandoAplic(false);
    }
  }

  async function handleEstadoCuenta() {
    setGeneratingPDF(true);
    try {
      const res = await fetch(`${PROD_FUNCTIONS_BASE_URL}/generar-estado-cuenta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PROD_SUPABASE_ANON_KEY}`,
          'apikey': PROD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ id_cuenta: cuentaId }),
      });
      const resp = await res.json();
      const url = resp?.url_estado_cuenta ?? resp?.url;
      if (!url) throw new Error(resp?.error ?? 'Error al generar');
      setPdfPreviewModal({ url, title: 'Estado de Cuenta' });
      // El PDF se genera desde la BD en vivo; refrescar el detalle para que la
      // página en pantalla quede consistente con lo que muestra el estado de cuenta.
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar estado de cuenta');
    } finally {
      setGeneratingPDF(false);
    }
  }

  async function handleDemanda() {
    if (!data?.propiedadId) {
      toast.error('No se encontro propiedad asociada');
      return;
    }
    setDemandaSaving(true);
    try {
      const { error: e } = await (supabase as any)
        .from('propiedades')
        .update({ id_estatus_disponibilidad: 11 })
        .eq('id', data.propiedadId);
      if (e) throw e;
      toast.success('Cuenta puesta en demanda');
      setDemandaDialog(false);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setDemandaSaving(false);
    }
  }

  async function handleQuitarDemanda() {
    if (!data?.propiedadId) {
      toast.error('No se encontró propiedad asociada');
      return;
    }
    setQuitarDemandaSaving(true);
    try {
      const { error: e } = await (supabase as any)
        .from('propiedades')
        .update({ id_estatus_disponibilidad: 5 })
        .eq('id', data.propiedadId);
      if (e) throw e;
      toast.success('Demanda removida - propiedad vuelve a Vendida');
      setQuitarDemandaDialog(false);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setQuitarDemandaSaving(false);
    }
  }

  // Reinicia/cancela el financiamiento (acción INTERNA de emergencia). Limpia el
  // campo maestro tipo_financiamiento en la propiedad y sus productos, y da de
  // baja el crédito y la solicitud vigentes. No borra pagos. Tras esto el cliente
  // vuelve a elegir su método de pago en el portal.
  async function handleReiniciarFinanciamiento() {
    setReiniciarFinSaving(true);
    try {
      const propId = data?.propiedadId ?? null;
      let cuentaIds: number[] = [cuentaId];
      if (propId != null) {
        const { data: hermanas } = await (supabase as any)
          .from('cuentas_cobranza').select('id').eq('id_propiedad', propId);
        if (hermanas?.length) cuentaIds = hermanas.map((c: any) => Number(c.id));
      }
      const now = new Date().toISOString();
      await (supabase as any).from('cuentas_cobranza')
        .update({ tipo_financiamiento: null }).in('id', cuentaIds);
      await (supabase as any).from('creditos_hipotecarios')
        .update({ activo: false, fecha_actualizacion: now }).in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      await (supabase as any).from('bancos_solicitudes')
        .update({ activo: false, fecha_actualizacion: now }).in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      toast.success('Financiamiento reiniciado. El cliente puede elegir de nuevo su método de pago.');
      setReiniciarFinDialog(false);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-tipo-fin', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-cliente'] });
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo reiniciar el financiamiento');
    } finally {
      setReiniciarFinSaving(false);
    }
  }

  // La edición de validación/método vive ahora en PaymentDetailDialog (modal
  // compartido con Relación de Pagos); ya no se maneja aquí.

  // ── Loading / error guards ──────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle className="size-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">No se pudo cargar la cuenta.</p>
      <button onClick={() => navigate(-1)} className="text-[13px] text-primary hover:underline">Volver</button>
    </div>
  );

  // ── Computed values ─────────────────────────────────────────────────────────

  const {
    clabe_stp, precio_final, fecha_compra, valor_uma, activo,
    clienteNombre, compradores, agente, ofertaId, ofertaProductoId, propiedadId,
    esquemaNombre, esquemaPct,
    proyectoNombre, edificioNombre, modeloNombre, numero_propiedad, productoNombre, tipo,
    m2Interiores, m2Exteriores, precioM2, estatusPropiedad,
    totalPagado, totalAplicacionesAll, saldoPendiente, montoVencido, parcialidadesVencidas, pagadoEfectivo,
    acuerdos, pagos, aplicacionesList, esMantenimiento,
  } = data;

  const limiteEfectivo = (valor_uma ?? 0) * 8025;
  const aunPermitido = limiteEfectivo - pagadoEfectivo;
  const acuerdosPendientes = acuerdos.filter((a: any) => !a.pago_completado).length;

  const _planParcAcuerdos = acuerdos.filter((a: any) => a.concepto.toLowerCase().includes('parcialidad'));
  const _planEngTotal = [
    ...acuerdos.filter((a: any) => a.concepto.toLowerCase().includes('apartado')),
    ...acuerdos.filter((a: any) => a.concepto.toLowerCase().includes('enganche')),
  ].reduce((s: number, a: any) => s + a.monto, 0);
  const _planParcTotal = _planParcAcuerdos.reduce((s: number, a: any) => s + a.monto, 0);
  const _planEntTotal = acuerdos.filter((a: any) => a.concepto.toLowerCase().includes('contra entrega')).reduce((s: number, a: any) => s + a.monto, 0);
  const _planPctE = precio_final > 0 ? Number((_planEngTotal / precio_final * 100).toFixed(1)) : 0;
  const _planPctP = precio_final > 0 ? Number((_planParcTotal / precio_final * 100).toFixed(1)) : 0;
  const _planPctEnt = precio_final > 0 ? Number((_planEntTotal / precio_final * 100).toFixed(1)) : 0;
  const _hasEsquema = (esquemaPct?.enganche ?? 0) > 0 || (esquemaPct?.mensualidades ?? 0) > 0 || (esquemaPct?.entrega ?? 0) > 0;
  const planIsModified = _hasEsquema && !!esquemaPct && (
    Math.abs(esquemaPct.enganche - _planPctE) > 0.5 ||
    Math.abs(esquemaPct.mensualidades - _planPctP) > 0.5 ||
    Math.abs(esquemaPct.entrega - _planPctEnt) > 0.5 ||
    esquemaPct.numMensualidades !== _planParcAcuerdos.length
  );
  const esquemaNombreDisplay = esquemaNombre ? (planIsModified ? `${esquemaNombre} modificado` : esquemaNombre) : null;

  const isEnDemanda = estatusPropiedad?.toLowerCase().includes('demanda');
  const porcentajePagado = precio_final > 0 ? Math.min(100, (totalPagado / precio_final) * 100) : 0;

  const sumaAcuerdos = acuerdos.reduce((s: number, a: any) => s + a.monto, 0);
  const hayDiscrepancia = Math.abs(precio_final - sumaAcuerdos) > 0.01;
  // Discrepancia dinero-recibido vs dinero-dispersado: si hay pagos crudos cuyo
  // monto no está aplicado en aplicaciones_pago (ej. pago manual sin dispersar),
  // se ofrece "Recalcular dispersión" (edge function recalcular-aplicaciones).
  const sumaPagosReales = pagos.reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
  const hayDiscrepanciaAplicaciones = pagos.length > 0 && Math.abs(sumaPagosReales - totalAplicacionesAll) > 0.01;
  const ultimoPagoSTP = pagos.find((p: any) => p.clave_rastreo) ?? null;
  const selectedPago = pagos.find((p: any) => p.id === selectedPagoId) ?? null;

  const conceptoGroups: Record<string, { total: number; pagado: number; count: number; fechas: (string | null)[] }> = {};
  for (const a of acuerdos) {
    const key = a.concepto;
    if (!conceptoGroups[key]) conceptoGroups[key] = { total: 0, pagado: 0, count: 0, fechas: [] };
    conceptoGroups[key].total += a.monto;
    conceptoGroups[key].pagado += a.montoAplicado;
    conceptoGroups[key].count++;
    conceptoGroups[key].fechas.push(a.fecha_pago);
  }

  const montoValidado = aplicacionesList.reduce((acc: number, ap: any) =>
    ap.validacion?.estado === 'coincide' ? acc + Number(ap.monto) : acc, 0);
  const montoSinValidar = Math.max(0, totalPagado - montoValidado);

  const pagoIdToFechaDebida: Record<number, string | null> = {};
  for (const a of acuerdos) {
    for (const pid of (a.pagoIds as number[])) {
      if (!(pid in pagoIdToFechaDebida)) pagoIdToFechaDebida[pid] = a.fecha_pago;
    }
  }

  const pagoIdToMontoAplicado: Record<number, number> = {};
  for (const ap of aplicacionesList) {
    if (ap.id_pago) pagoIdToMontoAplicado[ap.id_pago] = (pagoIdToMontoAplicado[ap.id_pago] ?? 0) + ap.monto;
  }

  async function handleDownloadOferta() {
    if (!ofertaId) return;
    setDownloadingOferta(true);
    try {
      const { offerPdfStorageService } = await import('@/services/offerPdfStorageService');
      const existingUrl = await offerPdfStorageService.getExistingUrl(ofertaId);
      if (existingUrl) {
        const validation = await offerPdfStorageService.validateOfferDataAndInvalidateIfNeeded(ofertaId);
        if (!validation.wasInvalidated) {
          setPdfPreviewModal({ url: existingUrl, title: `Oferta ${formatOfertaId(ofertaId)}` });
          return;
        }
        toast.info('Regenerando PDF - los datos han cambiado...');
      } else {
        toast.info('Generando PDF de oferta...');
      }
      const { generateOfferPDF } = await import('@/services/htmlToPdfService');
      const isProduct = tipo !== 'Propiedad';
      if (isProduct && ofertaProductoId) {
        await generateOfferPDF({
          propertyId: propiedadId ?? 0,
          offerId: ofertaId,
          propertyNumber: productoNombre ?? '',
          leadName: clienteNombre,
          leadEmail: '', leadPhone: '',
          creatorEmail: 'admin@system.com',
          isProductOffer: true,
          productId: ofertaProductoId,
        });
      } else if (propiedadId) {
        await generateOfferPDF({
          propertyId: propiedadId,
          offerId: ofertaId,
          propertyNumber: numero_propiedad ?? '',
          leadName: clienteNombre,
          leadEmail: '', leadPhone: '',
          creatorEmail: 'admin@system.com',
        });
      } else {
        toast.error('La oferta no tiene propiedad ni producto asociado');
        return;
      }
      const freshUrl = await offerPdfStorageService.getExistingUrl(ofertaId);
      if (freshUrl) {
        setPdfPreviewModal({ url: freshUrl, title: `Oferta ${formatOfertaId(ofertaId)}` });
      } else {
        toast.success('PDF generado');
      }
    } catch (error: any) {
      toast.error(`Error al generar oferta: ${error?.message ?? 'Error desconocido'}`);
    } finally {
      setDownloadingOferta(false);
    }
  }

  // ── ctx assembly ────────────────────────────────────────────────────────────

  const ctx: CuentaDetalleCtx = {
    cuentaId, clabe_stp, precio_final, fecha_compra, valor_uma, activo,
    esMantenimiento, clienteNombre, compradores, agente,
    ofertaId, ofertaProductoId, propiedadId,
    esquemaNombre, esquemaPct,
    proyectoNombre, edificioNombre, modeloNombre, numero_propiedad, productoNombre, tipo,
    m2Interiores, m2Exteriores, precioM2, estatusPropiedad,
    totalPagado, saldoPendiente, montoVencido, parcialidadesVencidas, pagadoEfectivo,
    acuerdos, pagos, aplicacionesList,
    docs, docsLoading,
    limiteEfectivo, aunPermitido, acuerdosPendientes,
    planIsModified, esquemaNombreDisplay,
    isEnDemanda, porcentajePagado, montoValidado, montoSinValidar,
    pagoIdToFechaDebida, pagoIdToMontoAplicado, conceptoGroups,
    _planParcAcuerdos, _planEngTotal, _planParcTotal, _planEntTotal,
    _planPctE, _planPctP, _planPctEnt,
    acuerdosPage, setAcuerdosPage,
    expandedAcuerdos, setExpandedAcuerdos,
    selectedPagoId, setSelectedPagoId, selectedPago,
    setPagoDialog: (v) => setPagoDialog(v),
    setUploadDialog: (v) => setUploadDialog(v),
    openCargarEvidencia,
    setEditCuentaDialog: (v) => setEditCuentaDialog(v),
    setDemandaDialog: (v) => setDemandaDialog(v),
    setQuitarDemandaDialog: (v) => setQuitarDemandaDialog(v),
    setMultaAcuerdoId: (v) => setMultaAcuerdoId(v),
    setMultaDialog: (v) => setMultaDialog(v),
    setMultaGestionAcuerdoId: (v) => setMultaGestionAcuerdoId(v),
    setMultaGestionDialog: (v) => setMultaGestionDialog(v),
    setPagoEvidenciaModal,
    setPdfPreviewModal,
    hayDiscrepancia, sumaAcuerdos,
    hayDiscrepanciaAplicaciones, recalculandoAplic, handleRecalcularAplicaciones,
    generatingPDF, handleEstadoCuenta,
    downloadingOferta, handleDownloadOferta,
    setTransferDialog: (v) => setTransferDialog(v),
    canDeletePago: canDelete,
    openEliminarPago,
    tipoFinanciamiento,
    empresaVendedora,
    compradorPersonaIds: data?.compradorPersonaIds ?? [],
    setReiniciarFinDialog: (v) => setReiniciarFinDialog(v),
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)}
          className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight leading-tight mb-1">{clienteNombre}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[13px] font-mono text-muted-foreground">{formatCuentaCobranzaId(cuentaId)}</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-[11px] font-medium text-muted-foreground">{tipo}</span>
            {!activo && (
              <span className="text-[10px] font-semibold text-red-600 border border-red-200 bg-red-50 rounded-full px-2 py-0.5">Inactiva</span>
            )}
            {parcialidadesVencidas > 0 && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  {parcialidadesVencidas} vencida{parcialidadesVencidas !== 1 ? 's' : ''}
                </span>
              </>
            )}
            {parcialidadesVencidas === 0 && totalPagado > 0 && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Al corriente</span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-component render */}
      {esMantenimiento
        ? <CuentaDetalleMantenimiento ctx={ctx} />
        : tipo !== 'Propiedad'
          ? <CuentaDetalleProducto ctx={ctx} />
          : <CuentaDetallePropiedad ctx={ctx} />
      }

      {/* ── Dialogs (shell-only) ─────────────────────────────────────────────── */}

      {/* Dialog: Agregar Pago (con evidencia opcional) */}
      <Dialog open={pagoDialog} onOpenChange={(o) => { setPagoDialog(o); if (!o) apResetForm(); }}>
        <DialogContent className="p-0 gap-0 flex flex-col overflow-hidden max-sm:left-0 max-sm:right-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:max-h-[92vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom sm:max-w-md sm:max-h-[88vh]">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle className="text-[15px]">Registrar pago</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3">
            {/* Método */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Método de pago *</label>
              <SelectSearch
                value={pagoForm.id_metodo}
                onValueChange={v => setPagoForm(f => ({ ...f, id_metodo: v }))}
                options={metodosPago.map(m => ({ value: String(m.id), label: m.nombre }))}
              />
            </div>

            {/* Fecha + Monto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground px-0.5">Fecha de pago *</label>
                <Input type="date" value={pagoForm.fecha}
                  onChange={e => setPagoForm(p => ({ ...p, fecha: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground px-0.5">Monto (MXN) *</label>
                <Input type="number" inputMode="decimal" placeholder="ej. 15000" value={pagoForm.monto}
                  onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>

            {/* Clave */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Clave de rastreo</label>
              <Input type="text" placeholder="ej. 2024060912345678" value={pagoForm.clave}
                onChange={e => setPagoForm(p => ({ ...p, clave: e.target.value }))} className="h-9 text-sm" />
            </div>

            {/* Evidencia opcional */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Evidencia del pago (opcional)</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setApDragging(true); }}
                onDragLeave={() => setApDragging(false)}
                onDrop={(e) => { e.preventDefault(); setApDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setApFile(f); }}
                className={`relative rounded-lg border-2 border-dashed transition-colors ${apDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
              >
                <input id="ap-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xml"
                  onChange={(e) => setApFile(e.target.files?.[0] ?? null)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center justify-center gap-1.5 py-5 px-4 text-center pointer-events-none">
                  {apFile ? (
                    <>
                      <FileCheck className="size-6 text-primary" />
                      <p className="text-[13px] font-medium text-foreground break-all">{apFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(apFile.size / 1024).toFixed(0)} KB · clic para cambiar</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-6 text-muted-foreground" />
                      <p className="text-[13px] font-medium text-foreground">Arrastra el archivo aquí</p>
                      <p className="text-[11px] text-muted-foreground">o haz clic · PDF, imagen o XML</p>
                    </>
                  )}
                </div>
              </div>
              {apFile && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <input type="checkbox" checked={apEsValido} onChange={(e) => setApEsValido(e.target.checked)} className="size-4 accent-primary" />
                    <span className="text-[13px] font-medium text-foreground">Pago validado</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <input type="checkbox" checked={apEsCep} onChange={(e) => setApEsCep(e.target.checked)} className="size-4 accent-primary" />
                    <span className="text-[13px] font-medium text-foreground">Es CEP</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-5 py-4 border-t border-border shrink-0">
            <button onClick={() => { setPagoDialog(false); apResetForm(); }}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handlePagoSubmit} disabled={pagoSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pagoSaving && <Loader2 className="size-3.5 animate-spin" />}Registrar pago
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar Multa */}
      <Dialog open={multaDialog} onOpenChange={open => {
        setMultaDialog(open);
        if (!open) { setMultaAcuerdoId(null); setMultaForm({ monto: '', descripcion: '', id_tipo_multa: '' }); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Agregar Multa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Tipo de multa *</label>
              <SelectSearch
                value={multaForm.id_tipo_multa}
                onValueChange={v => setMultaForm(f => ({ ...f, id_tipo_multa: v }))}
                options={tiposMulta.map(t => ({ value: String(t.id), label: t.nombre }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Monto (MXN) *</label>
              <Input type="number" placeholder="ej. 2000" value={multaForm.monto}
                onChange={e => setMultaForm(f => ({ ...f, monto: e.target.value }))}
                className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Descripcion adicional</label>
              <textarea rows={2} placeholder="Notas adicionales..." value={multaForm.descripcion}
                onChange={e => setMultaForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setMultaDialog(false)}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleMultaSubmit} disabled={multaSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              {multaSaving && <Loader2 className="size-3.5 animate-spin" />}Agregar multa
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gestionar Multas */}
      <Dialog open={multaGestionDialog} onOpenChange={open => {
        if (!multaGestionSaving) {
          setMultaGestionDialog(open);
          if (!open) { setMultaGestionEditId(null); setMultaGestionAddOpen(false); setMultaGestionAddForm({ monto: '', descripcion: '', id_tipo_multa: '' }); }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const gestionAcuerdo = data?.acuerdos.find((a: any) => a.id === multaGestionAcuerdoId);
            const gestionMultas: any[] = gestionAcuerdo?.multas?.items ?? [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-[15px]">
                    Multas - {gestionAcuerdo?.concepto?.toLowerCase().includes('contra entrega') ? 'Entrega' : gestionAcuerdo?.concepto}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-1 max-h-[55vh] overflow-y-auto pr-0.5">
                  {gestionMultas.map((m: any) => (
                    <div key={m.id} className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                      {multaGestionEditId === m.id ? (
                        <div className="space-y-2">
                          <SelectSearch
                            value={multaGestionEditForm.id_tipo_multa}
                            onValueChange={v => setMultaGestionEditForm(f => ({ ...f, id_tipo_multa: v }))}
                            options={tiposMulta.map(t => ({ value: String(t.id), label: t.nombre }))}
                            placeholder="Tipo de multa..."
                          />
                          <Input type="number" value={multaGestionEditForm.monto}
                            onChange={e => setMultaGestionEditForm(f => ({ ...f, monto: e.target.value }))}
                            placeholder="Monto" className="h-9 text-sm" />
                          <textarea rows={2} value={multaGestionEditForm.descripcion}
                            onChange={e => setMultaGestionEditForm(f => ({ ...f, descripcion: e.target.value }))}
                            placeholder="Descripción..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setMultaGestionEditId(null)}
                              className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">Cancelar</button>
                            <button onClick={() => handleMultaGestionUpdate(m.id)} disabled={multaGestionSaving}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-50">
                              {multaGestionSaving && <Loader2 className="size-3 animate-spin" />}Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-foreground">{m.tipos_multa?.nombre ?? 'Sin tipo'}</p>
                            <p className="text-[13px] font-bold tabular-nums text-amber-600">{fmtCurrency(Number(m.monto))}</p>
                            {m.descripcion && <p className="text-[11px] text-muted-foreground mt-0.5">{m.descripcion}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setMultaGestionEditId(m.id); setMultaGestionEditForm({ monto: String(m.monto), descripcion: m.descripcion ?? '', id_tipo_multa: String(m.id_tipo_multa) }); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => handleMultaGestionDelete(m.id)} disabled={multaGestionDeleting === m.id}
                              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50">
                              {multaGestionDeleting === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  {multaGestionAddOpen ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nueva multa</p>
                      <SelectSearch
                        value={multaGestionAddForm.id_tipo_multa}
                        onValueChange={v => setMultaGestionAddForm(f => ({ ...f, id_tipo_multa: v }))}
                        options={tiposMulta.map(t => ({ value: String(t.id), label: t.nombre }))}
                        placeholder="Tipo de multa..."
                      />
                      <Input type="number" value={multaGestionAddForm.monto}
                        onChange={e => setMultaGestionAddForm(f => ({ ...f, monto: e.target.value }))}
                        placeholder="Monto" className="h-9 text-sm" />
                      <textarea rows={2} value={multaGestionAddForm.descripcion}
                        onChange={e => setMultaGestionAddForm(f => ({ ...f, descripcion: e.target.value }))}
                        placeholder="Descripción adicional..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setMultaGestionAddOpen(false)}
                          className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">Cancelar</button>
                        <button onClick={handleMultaGestionAdd} disabled={multaGestionSaving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50">
                          {multaGestionSaving && <Loader2 className="size-3 animate-spin" />}Agregar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setMultaGestionAddOpen(true)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors">
                      <Plus className="size-3.5" />Agregar otra multa
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: Subir Documento */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Subir Documento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground px-0.5">Tipo de documento *</span>
              <SelectSearch
                value={uploadIdTipo}
                onValueChange={setUploadIdTipo}
                options={tiposDocumento.map((t: any) => ({ value: String(t.id), label: t.nombre }))}
                placeholder="Seleccionar tipo..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">Archivo *</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xml"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-foreground hover:file:bg-muted/80" />
              <p className="text-[11px] text-muted-foreground">PDF, imagen o XML - max 10 MB</p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setUploadDialog(false)}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleUploadSubmit} disabled={uploadSaving || !uploadFile || !uploadIdTipo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {uploadSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Subir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cargar evidencia de pago (modal canónico compartido con RP) */}
      <CargarEvidenciaDialog
        open={cargarPagoDialog}
        onClose={() => { setCargarPagoDialog(false); cpResetForm(); }}
        cuentaId={Number(cuentaId)}
        target={cpTarget ? {
          id: cpTarget.id,
          metodo: cpTarget.metodo,
          monto: cpTarget.monto,
          fecha_pago: cpTarget.fecha_pago,
          clave_rastreo: cpTarget.clave_rastreo,
        } : null}
        onDone={() => queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] })}
        captureClaveRastreo
        logActivity
      />

      {/* Dialog: Reiniciar financiamiento (interno / emergencia) */}
      <Dialog open={reiniciarFinDialog} onOpenChange={open => { if (!reiniciarFinSaving) setReiniciarFinDialog(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Reiniciar financiamiento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">Método actual</span>
              <span className="text-[12px] font-semibold text-foreground">
                {tipoFinanciamiento === 'CREDITO_HIPOTECARIO' ? 'Crédito hipotecario'
                  : tipoFinanciamiento === 'RECURSOS_PROPIOS' ? 'Recursos propios' : '—'}
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Se limpiará el método de financiamiento de la propiedad y sus productos, y se darán de baja
                el crédito y la solicitud vigentes. <span className="font-semibold">No borra pagos.</span> El
                cliente volverá a elegir su método de pago.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setReiniciarFinDialog(false)} disabled={reiniciarFinSaving}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50">Cancelar</button>
            <button onClick={handleReiniciarFinanciamiento} disabled={reiniciarFinSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white text-[13px] font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {reiniciarFinSaving && <Loader2 className="size-3.5 animate-spin" />}Reiniciar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Poner en Demanda */}
      <Dialog open={demandaDialog} onOpenChange={open => { if (!demandaSaving) setDemandaDialog(open); }}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-full bg-white/20 shrink-0">
              <Scale className="size-4.5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white leading-tight">Poner en demanda</p>
              {clienteNombre && <p className="text-[12px] text-red-100 mt-0.5 truncate max-w-[220px]">{clienteNombre}</p>}
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="rounded-lg border border-red-200 bg-red-50 divide-y divide-red-200/60">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-red-700">Saldo pendiente</span>
                <span className="text-[13px] font-bold tabular-nums text-red-900">{fmtCurrency(saldoPendiente)}</span>
              </div>
              {montoVencido > 0 && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[11px] text-red-700">Monto vencido</span>
                  <span className="text-[12px] font-semibold tabular-nums text-red-800">{fmtCurrency(montoVencido)}</span>
                </div>
              )}
              {parcialidadesVencidas > 0 && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[11px] text-red-700">Acuerdos vencidos</span>
                  <span className="text-[12px] font-semibold text-red-800">{parcialidadesVencidas} acuerdo{parcialidadesVencidas !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-red-700">Nuevo estatus</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-900">
                  <Scale className="size-3" />En demanda
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Esta acción cambia el estatus de la propiedad. Asegúrate de haber agotado otras opciones. Puede revertirse desde esta misma pantalla.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDemandaDialog(false)} disabled={demandaSaving}
                className="px-4 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDemanda} disabled={demandaSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {demandaSaving && <Loader2 className="size-3.5 animate-spin" />}
                Confirmar demanda
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Quitar Demanda */}
      <Dialog open={quitarDemandaDialog} onOpenChange={open => { if (!quitarDemandaSaving) setQuitarDemandaDialog(open); }}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="bg-amber-500 px-5 py-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-full bg-white/20 shrink-0">
              <Scale className="size-4 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white leading-tight">Quitar demanda</p>
              {clienteNombre && <p className="text-[12px] text-amber-100 mt-0.5 truncate max-w-[220px]">{clienteNombre}</p>}
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 divide-y divide-amber-200/60">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-amber-700">Estatus actual</span>
                <span className="text-[11px] font-semibold text-amber-900">En demanda</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-amber-700">Nuevo estatus</span>
                <span className="text-[11px] font-semibold text-amber-900">Vendido</span>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              La propiedad regresará al estatus Vendida. Úsalo si pusiste en demanda por error o si el caso fue resuelto.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setQuitarDemandaDialog(false)} disabled={quitarDemandaSaving}
                className="px-4 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleQuitarDemanda} disabled={quitarDemandaSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-white text-[13px] font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {quitarDemandaSaving && <Loader2 className="size-3.5 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Vista previa PDF */}
      <Dialog open={!!pdfPreviewModal} onOpenChange={open => !open && setPdfPreviewModal(null)}>
        <DialogContent className="sm:max-w-4xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {pdfPreviewModal && (
            <div className="flex-1 min-h-0 bg-muted/10">
              {isImage(pdfPreviewModal.url) ? (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                  <img src={pdfPreviewModal.url} alt={pdfPreviewModal.title} className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <iframe src={pdfPreviewModal.url} title={pdfPreviewModal.title} className="w-full h-full" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalle del pago — modal compartido con Relación de Pagos */}
      <PaymentDetailDialog
        payment={pagoEvidenciaModal && pagoEvidenciaModal.id_pago ? ({
          pago_id: pagoEvidenciaModal.id_pago,
          fecha_pago: pagoEvidenciaModal.fecha_pago,
          clave_rastreo: pagoEvidenciaModal.clave_rastreo ?? null,
          url_cep: pagoEvidenciaModal.url_cep ?? null,
          url_recibo: pagoEvidenciaModal.url_recibo ?? null,
        } as PagoRecord) : null}
        onClose={() => setPagoEvidenciaModal(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] })}
      />

      {editCuentaDialog && (
        <EditCuentaCobranzaDialog
          cuenta={{ id: cuentaId, precio_final }}
          onClose={() => setEditCuentaDialog(false)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-operativa'] });
          }}
        />
      )}

      <TransferPaymentDialog
        isOpen={transferDialog}
        onClose={() => setTransferDialog(false)}
        cuentaOrigenId={cuentaId}
        ultimoPagoSTP={ultimoPagoSTP && ultimoPagoSTP.clave_rastreo
          ? { id: ultimoPagoSTP.id, clave_rastreo: ultimoPagoSTP.clave_rastreo, monto: ultimoPagoSTP.monto }
          : null
        }
      />

      {/* Eliminar pago (soft delete vía RPC eliminar_pago) */}
      <EliminarPagoDialog
        open={eliminarPagoId != null}
        onOpenChange={(open) => { if (!open) { setEliminarPagoId(null); setEliminarImpacto(null); } }}
        onConfirm={handleConfirmEliminarPago}
        isLoading={isDeleting}
        impacto={eliminarImpacto}
        encabezado="pago de la cuenta"
      />

    </div>
  );
}
