import { useState } from 'react';
import { EditCuentaCobranzaDialog } from '@/components/admin/EditCuentaCobranzaDialog';
import { TransferPaymentDialog } from '@/components/admin/TransferPaymentDialog';
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
import { useEliminarPago, fetchPagoImpacto, impactoClause, impactoWarning, type PagoImpacto } from '@/hooks/useEliminarPago';
import { DeleteConfirmationDialog } from '@/components/admin/DeleteConfirmationDialog';
import { PaymentDetailDialog } from '@/components/admin/portal-cobranza/PaymentDetailDialog';
import type { PagoRecord } from '@/hooks/useRelacionPagos';
import { CuentaDetalleMantenimiento } from './CuentaDetalleMantenimiento';
import { CuentaDetallePropiedad } from './CuentaDetallePropiedad';
import { CuentaDetalleProducto } from './CuentaDetalleProducto';

// ── fetch ───────────────────────────────────────────────────────────────────────

async function fetchCuentaDetalle(cuentaId: number) {
  // 1. cuentas_cobranza — include id_cuenta_cobranza_padre for maintenance detection
  const { data: cuenta, error: cuentaErr } = await (supabase as any)
    .from('cuentas_cobranza')
    .select('id, clabe_stp, precio_final, fecha_compra, valor_uma, id_oferta, id_propiedad, activo, id_cuenta_cobranza_padre')
    .eq('id', cuentaId)
    .maybeSingle();
  if (cuentaErr) throw cuentaErr;
  if (!cuenta) throw new Error('Cuenta no encontrada');

  const esMantenimiento = !!cuenta.id_cuenta_cobranza_padre && !cuenta.id_oferta;

  // For maintenance: inherit oferta from parent account
  let efectivoIdOferta: number | null = cuenta.id_oferta ?? null;
  if (esMantenimiento && cuenta.id_cuenta_cobranza_padre) {
    const { data: padre } = await (supabase as any)
      .from('cuentas_cobranza')
      .select('id_oferta')
      .eq('id', cuenta.id_cuenta_cobranza_padre)
      .maybeSingle();
    if (padre?.id_oferta) efectivoIdOferta = padre.id_oferta;
  }

  // 2. oferta — separate fetch (never triple-join from cuentas_cobranza)
  let oferta: any = null;
  if (efectivoIdOferta) {
    const { data: ofData } = await (supabase as any)
      .from('ofertas')
      .select(`
        id, id_producto, email_creador,
        id_esquema_pago_seleccionado,
        esquemas_pago!ofertas_id_esquema_pago_seleccionado_fkey(nombre, porcentaje_enganche, porcentaje_mensualidades, porcentaje_entrega, numero_mensualidades),
        propiedades!ofertas_id_propiedad_fkey(id, numero_propiedad, m2_interiores, m2_exteriores, id_edificio_modelo, id_estatus_disponibilidad),
        productos_servicios!ofertas_id_producto_fkey(nombre, categorias_producto!productos_servicios_id_categoria_fkey(nombre))
      `)
      .eq('id', efectivoIdOferta)
      .maybeSingle();
    oferta = ofData;
  }

  const ofertaId: number | null = oferta?.id ?? null;
  const ofertaProductoId: number | null = oferta?.id_producto ?? null;
  const propiedad = oferta?.propiedades ?? null;
  const propiedadId: number | null = propiedad?.id ?? cuenta.id_propiedad ?? null;
  const esquema = oferta?.esquemas_pago ?? null;
  const esquemaNombre: string = esquema?.nombre ?? '';
  const esquemaPct = esquema ? {
    enganche: Number(esquema.porcentaje_enganche ?? 0),
    mensualidades: Number(esquema.porcentaje_mensualidades ?? 0),
    entrega: Number(esquema.porcentaje_entrega ?? 0),
    numMensualidades: Number(esquema.numero_mensualidades ?? 0),
  } : null;
  const productoNombre: string | null = oferta?.productos_servicios?.nombre ?? null;
  const categoriaNombre: string | null = oferta?.productos_servicios?.categorias_producto?.nombre ?? null;
  const tipo = esMantenimiento ? 'Mantenimiento' : productoNombre ? (categoriaNombre ?? 'Producto') : 'Propiedad';

  // 3. Compradores — maintenance inherits from parent account
  const cuentaIdParaCompradores = esMantenimiento && cuenta.id_cuenta_cobranza_padre
    ? cuenta.id_cuenta_cobranza_padre
    : cuentaId;
  const { data: compRows } = await (supabase as any)
    .from('compradores')
    .select('id_persona, porcentaje_copropiedad, personas!compradores_id_persona_fkey(nombre_legal)')
    .eq('id_cuenta_cobranza', cuentaIdParaCompradores)
    .eq('activo', true);
  const compradores = (compRows ?? []).map((c: any) => ({
    id_persona: c.id_persona as number | null,
    nombre: c.personas?.nombre_legal ?? '',
    porcentaje: c.porcentaje_copropiedad,
  }));
  const compradorPersonaIds = compradores.map((c: any) => c.id_persona).filter(Boolean) as number[];
  const clienteNombre = compradores.map((c: any) => c.nombre).filter(Boolean).join(', ') || 'Sin nombre';

  // 4. Propiedad details — waterfall to avoid triple-join
  const precioFinal = Number(cuenta.precio_final ?? 0);
  let proyectoNombre = '';
  let edificioNombre = '';
  let modeloNombre = '';
  let numero_propiedad: string | null = null;
  let m2Interiores = 0;
  let m2Exteriores = 0;
  let precioM2: number | null = null;
  let estatusPropiedad = '';

  if (propiedad) {
    numero_propiedad = propiedad.numero_propiedad ?? null;
    m2Interiores = Number(propiedad.m2_interiores ?? 0);
    m2Exteriores = Number(propiedad.m2_exteriores ?? 0);
    precioM2 = m2Interiores > 0 ? precioFinal / m2Interiores : null;

    if (propiedad.id_edificio_modelo) {
      const { data: em } = await (supabase as any)
        .from('edificios_modelos')
        .select('edificios!edificios_modelos_id_edificio_fkey(id, nombre, id_proyecto), modelos!edificios_modelos_id_modelo_fkey(nombre)')
        .eq('id', propiedad.id_edificio_modelo)
        .maybeSingle();
      edificioNombre = em?.edificios?.nombre ?? '';
      modeloNombre = em?.modelos?.nombre ?? '';
      if (em?.edificios?.id_proyecto) {
        const { data: proy } = await (supabase as any)
          .from('proyectos').select('nombre').eq('id', em.edificios.id_proyecto).maybeSingle();
        proyectoNombre = proy?.nombre ?? '';
      }
    }

    if (propiedad.id_estatus_disponibilidad) {
      const { data: est } = await (supabase as any)
        .from('estatus_disponibilidad').select('nombre').eq('id', propiedad.id_estatus_disponibilidad).maybeSingle();
      estatusPropiedad = est?.nombre ?? '';
    }
  } else if (productoNombre && ofertaProductoId) {
    const { data: prod } = await (supabase as any)
      .from('productos_servicios').select('proyectos(nombre)').eq('id', ofertaProductoId).maybeSingle();
    proyectoNombre = prod?.proyectos?.nombre ?? '';
  }

  // 5. Agente — via oferta.email_creador → usuarios
  let agente: any | null = null;
  if (oferta?.email_creador) {
    const { data: usu } = await (supabase as any)
      .from('usuarios')
      .select('nombre, email, telefono, roles!usuarios_rol_id_fkey(nombre)')
      .eq('email', oferta.email_creador)
      .maybeSingle();
    const rolNombre: string = usu?.roles?.nombre ?? '';
    agente = {
      nombre: usu?.nombre ?? oferta.email_creador,
      email: usu?.email ?? oferta.email_creador,
      telefono: usu?.telefono ?? null,
      rolNombre,
      tipoAgente: rolNombre.toLowerCase().includes('agente') ? 'Agente' : (rolNombre || 'Otro'),
      organizacion: (usu?.email ?? oferta.email_creador).includes('@sozu.com') ? 'Sozu' : null,
    };
  }

  // 6. Acuerdos — flat query + separate waterfall (4-level nesting silently fails in PostgREST)
  const { data: acuerdosRaw } = await (supabase as any)
    .from('acuerdos_pago')
    .select('id, orden, monto, fecha_pago, pago_completado, id_concepto')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order(esMantenimiento ? 'fecha_pago' : 'orden', { ascending: !esMantenimiento });

  const acuerdoList: any[] = acuerdosRaw ?? [];
  const acuerdoIds = acuerdoList.map((a: any) => a.id);

  // conceptos by ids
  let conceptoMap: Record<number, string> = {};
  if (acuerdoList.length > 0) {
    const cids = [...new Set(acuerdoList.map((a: any) => a.id_concepto).filter(Boolean))];
    if (cids.length > 0) {
      const { data: cs } = await (supabase as any).from('conceptos_pago').select('id, nombre').in('id', cids);
      for (const c of (cs ?? [])) conceptoMap[c.id] = c.nombre;
    }
  }

  // aplicaciones_pago flat
  const { data: aplicacionesRaw } = await (supabase as any)
    .from('aplicaciones_pago')
    .select('id, monto, es_multa, id_acuerdo_pago, id_pago')
    .in('id_acuerdo_pago', acuerdoIds.length > 0 ? acuerdoIds : [-1])
    .eq('activo', true);

  // pagos linked to those aplicaciones
  const pagoIdsFromAplic = [...new Set(
    (aplicacionesRaw ?? []).map((a: any) => a.id_pago).filter(Boolean) as number[]
  )];

  let pagosMap: Record<number, any> = {};
  let metodoNombreMap: Record<number, string> = {};
  if (pagoIdsFromAplic.length > 0) {
    const { data: pagosLinked } = await (supabase as any)
      .from('pagos')
      .select('id, fecha_pago, clave_rastreo, id_metodos_pago, url_cep, url_recibo')
      .in('id', pagoIdsFromAplic);
    for (const p of (pagosLinked ?? [])) pagosMap[p.id] = p;

    const metodosIds = [...new Set((pagosLinked ?? []).map((p: any) => p.id_metodos_pago).filter(Boolean))];
    if (metodosIds.length > 0) {
      const { data: ms } = await (supabase as any).from('metodos_pago').select('id, nombre').in('id', metodosIds);
      for (const m of (ms ?? [])) metodoNombreMap[m.id] = m.nombre;
    }
  }

  // multas
  const { data: multasData } = await (supabase as any)
    .from('multas')
    .select('id, id_acuerdo_pago, monto, descripcion, id_tipo_multa, activo, tipos_multa(nombre)')
    .in('id_acuerdo_pago', acuerdoIds.length > 0 ? acuerdoIds : [-1])
    .eq('activo', true);

  // validaciones for linked pagos
  let validacionByPago: Record<number, any> = {};
  if (pagoIdsFromAplic.length > 0) {
    const { data: validaciones } = await (supabase as any)
      .from('pago_validaciones')
      .select('id_pago, estado, motivo, monto_esperado, monto_real, fecha_creacion')
      .in('id_pago', pagoIdsFromAplic)
      .order('fecha_creacion', { ascending: false });
    for (const v of (validaciones ?? [])) {
      if (!validacionByPago[v.id_pago]) {
        validacionByPago[v.id_pago] = {
          estado: v.estado, motivo: v.motivo,
          monto_esperado: Number(v.monto_esperado), monto_real: Number(v.monto_real),
        };
      }
    }
  }

  // Build acuerdos from lookups
  const acuerdos = acuerdoList.map((a: any) => {
    const aplics = (aplicacionesRaw ?? []).filter((ap: any) => ap.id_acuerdo_pago === a.id);
    const aplicsNormales = aplics.filter((ap: any) => !ap.es_multa);
    const montoAplicado = aplicsNormales.reduce((s: number, ap: any) => s + Number(ap.monto), 0);

    const pagoIds = [...new Set(aplicsNormales.map((ap: any) => ap.id_pago).filter(Boolean) as number[])];
    const pagosLinked = pagoIds.map((pid: number) => pagosMap[pid]).filter(Boolean);
    pagosLinked.sort((a: any, b: any) => (b.fecha_pago ?? '').localeCompare(a.fecha_pago ?? ''));
    const ultimoPago = pagosLinked[0] ?? null;

    const aplicacionesDetalle = aplicsNormales.map((ap: any) => {
      const pago = ap.id_pago ? pagosMap[ap.id_pago] : null;
      return {
        id: ap.id as number,
        monto: Number(ap.monto),
        id_pago: ap.id_pago as number | null,
        fecha_pago: pago?.fecha_pago ?? null,
        metodo: pago ? (metodoNombreMap[pago.id_metodos_pago] ?? 'Sin método') : null,
        clave_rastreo: pago?.clave_rastreo ?? null,
        url_cep: pago?.url_cep ?? null,
        url_recibo: pago?.url_recibo ?? null,
        validacion: ap.id_pago ? (validacionByPago[ap.id_pago] ?? null) : null,
      };
    });

    const multasActivas = (multasData ?? []).filter((m: any) => m.id_acuerdo_pago === a.id);
    const estado = a.pago_completado ? 'pagado'
      : !a.fecha_pago ? 'pendiente'
      : (() => {
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
          const f = new Date(a.fecha_pago + 'T00:00:00');
          if (f < hoy) return 'vencido';
          const pronto = new Date(hoy); pronto.setDate(pronto.getDate() + 30);
          return f <= pronto ? 'proximo' : 'pendiente';
        })();

    return {
      id: a.id as number,
      orden: a.orden as number,
      monto: Number(a.monto),
      montoAplicado,
      fecha_pago: a.fecha_pago as string | null,
      pago_completado: a.pago_completado as boolean,
      concepto: conceptoMap[a.id_concepto] ?? 'Sin concepto',
      estado,
      numAplicaciones: aplicsNormales.length,
      aplicacionesDetalle,
      ultimoPago: ultimoPago ? {
        id: ultimoPago.id as number,
        id_metodos_pago: ultimoPago.id_metodos_pago as number | null,
        metodo: metodoNombreMap[ultimoPago.id_metodos_pago] ?? 'Sin método',
        clave_rastreo: ultimoPago.clave_rastreo ?? null,
        fecha_pago: ultimoPago.fecha_pago ?? null,
        url_cep: ultimoPago.url_cep ?? null,
        url_recibo: ultimoPago.url_recibo ?? null,
      } : null,
      pagoIds,
      validacion: ultimoPago ? (validacionByPago[ultimoPago.id] ?? null) : null,
      multas: multasActivas.length > 0
        ? { count: multasActivas.length, total: multasActivas.reduce((s: number, m: any) => s + Number(m.monto), 0), items: multasActivas }
        : null,
    };
  });

  // 7. Pagos directos de la cuenta (tab Pagos)
  const { data: pagosRaw } = await (supabase as any)
    .from('pagos')
    .select('id, fecha_pago, monto, clave_rastreo, id_metodos_pago, url_cep, url_recibo, descripcion, metodos_pago!pagos_id_metodos_pago_fkey(nombre)')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order('fecha_pago', { ascending: false });

  // validaciones for direct pagos not already in map
  const directPagoIds = (pagosRaw ?? []).map((p: any) => p.id as number);
  const missingValidIds = directPagoIds.filter((id: number) => !(id in validacionByPago));
  if (missingValidIds.length > 0) {
    const { data: extraVal } = await (supabase as any)
      .from('pago_validaciones')
      .select('id_pago, estado, motivo, monto_esperado, monto_real, fecha_creacion')
      .in('id_pago', missingValidIds)
      .order('fecha_creacion', { ascending: false });
    for (const v of (extraVal ?? [])) {
      if (!validacionByPago[v.id_pago]) {
        validacionByPago[v.id_pago] = {
          estado: v.estado, motivo: v.motivo,
          monto_esperado: Number(v.monto_esperado), monto_real: Number(v.monto_real),
        };
      }
    }
  }

  const pagadoEfectivo = (pagosRaw ?? [])
    .filter((p: any) => p.id_metodos_pago === 1)
    .reduce((s: number, p: any) => s + Number(p.monto), 0);

  const pagos = (pagosRaw ?? []).map((p: any) => ({
    id: p.id as number,
    fecha_pago: p.fecha_pago as string,
    monto: Number(p.monto),
    clave_rastreo: p.clave_rastreo as string | null,
    metodo: p.metodos_pago?.nombre ?? 'Sin método',
    id_metodos_pago: p.id_metodos_pago as number | null,
    url_cep: p.url_cep as string | null,
    url_recibo: p.url_recibo as string | null,
    descripcion: p.descripcion as string | null,
    validacion: validacionByPago[p.id] ?? null,
  }));

  // 8. aplicacionesList — built from already-fetched data (no extra query)
  const aplicacionesList = acuerdoList.flatMap((a: any) => {
    const aplics = (aplicacionesRaw ?? []).filter((ap: any) => ap.id_acuerdo_pago === a.id && !ap.es_multa);
    return aplics.map((ap: any) => {
      const pago = ap.id_pago ? pagosMap[ap.id_pago] : null;
      return {
        id: ap.id as number,
        monto: Number(ap.monto),
        id_pago: ap.id_pago as number | null,
        concepto: conceptoMap[a.id_concepto] ?? 'Sin concepto',
        acuerdoOrden: a.orden as number,
        fechaLimite: a.fecha_pago as string | null,
        fecha_pago: pago?.fecha_pago ?? null,
        id_metodos_pago: pago ? (pago.id_metodos_pago as number | null) : null,
        metodo: pago ? (metodoNombreMap[pago.id_metodos_pago] ?? 'Sin método') : null,
        clave_rastreo: pago?.clave_rastreo ?? null,
        url_cep: pago?.url_cep ?? null,
        url_recibo: pago?.url_recibo ?? null,
        validacion: ap.id_pago ? (validacionByPago[ap.id_pago] ?? null) : null,
      };
    });
  }).sort((a: any, b: any) => {
    if (!a.fecha_pago && !b.fecha_pago) return (a.acuerdoOrden ?? 0) - (b.acuerdoOrden ?? 0);
    if (!a.fecha_pago) return 1;
    if (!b.fecha_pago) return -1;
    return a.fecha_pago.localeCompare(b.fecha_pago);
  });

  // 9. Totals
  const totalPagado = acuerdos.reduce((s: number, a: any) => s + a.montoAplicado, 0);
  // Suma de TODAS las aplicaciones (incluye multas) → para detectar dinero recibido
  // que aún no se dispersa. Comparar contra totalPagado (sin multas) daría falsos
  // positivos en cuentas con multas pagadas.
  const totalAplicacionesAll = (aplicacionesRaw ?? []).reduce((s: number, ap: any) => s + Number(ap.monto), 0);
  const saldoPendiente = precioFinal - totalPagado;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const vencidos = acuerdos.filter((a: any) => !a.pago_completado && a.fecha_pago && new Date(a.fecha_pago + 'T00:00:00') < today);
  const montoVencido = vencidos.reduce((s: number, a: any) => s + Math.max(0, a.monto - a.montoAplicado), 0);
  const parcialidadesVencidas = vencidos.length;

  return {
    clabe_stp: cuenta.clabe_stp ?? null,
    precio_final: precioFinal,
    fecha_compra: cuenta.fecha_compra ?? null,
    valor_uma: cuenta.valor_uma ? Number(cuenta.valor_uma) : null,
    activo: cuenta.activo ?? true,
    clienteNombre,
    compradores,
    compradorPersonaIds,
    agente,
    ofertaId,
    ofertaProductoId,
    propiedadId,
    esquemaNombre,
    esquemaPct,
    proyectoNombre,
    edificioNombre,
    modeloNombre,
    numero_propiedad,
    productoNombre,
    tipo,
    m2Interiores,
    m2Exteriores,
    precioM2,
    estatusPropiedad,
    totalPagado,
    totalAplicacionesAll,
    saldoPendiente,
    montoVencido,
    parcialidadesVencidas,
    pagadoEfectivo,
    acuerdos,
    pagos,
    aplicacionesList,
    esMantenimiento,
  };
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
  const [cpFile, setCpFile] = useState<File | null>(null);
  const [cpDragging, setCpDragging] = useState(false);
  const [cpEsValido, setCpEsValido] = useState(false);
  const [cpEsCep, setCpEsCep] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);

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

  const handleConfirmEliminarPago = async () => {
    if (eliminarPagoId == null) return;
    try {
      await eliminarPago(eliminarPagoId);
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
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setUploadSaving(false);
    }
  }

  // Bucket por check "Es CEP"; columna por check "Validado".
  const cpBucket = cpEsCep ? 'ceps' : 'evidencias_efectivo';
  const cpColumna = cpEsValido ? 'url_cep' : 'url_recibo';

  function cpResetForm() {
    setCpTarget(null); setCpFile(null); setCpEsValido(false); setCpEsCep(false);
  }

  function openCargarEvidencia(pago: any) {
    setCpTarget(pago);
    setCpFile(null);
    setCpEsValido(false);
    setCpEsCep(false);
    setCargarPagoDialog(true);
  }

  async function handleCargarPagoSubmit() {
    if (!cpFile) { toast.error('Arrastra o selecciona un archivo'); return; }
    if (!cpTarget?.id) { toast.error('No hay pago destino'); return; }
    setCpSaving(true);
    try {
      const ext = cpFile.name.split('.').pop() ?? 'bin';
      const path = `${cuentaId}/${cpTarget.id}/${Date.now()}.${ext}`;
      const { error: se } = await supabase.storage.from(cpBucket).upload(path, cpFile, { upsert: true });
      if (se) throw se;
      const { data: pub } = supabase.storage.from(cpBucket).getPublicUrl(path);
      // Columna: validado → url_cep ; no validado → url_recibo (evidencia)
      const { error: ue } = await (supabase as any).from('pagos')
        .update({ [cpColumna]: pub.publicUrl }).eq('id', cpTarget.id);
      if (ue) throw ue;
      toast.success('Evidencia cargada');
      setCargarPagoDialog(false);
      cpResetForm();
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al subir evidencia');
    } finally {
      setCpSaving(false);
    }
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

      {/* Dialog: Cargar pago (evidencia → bucket) */}
      <Dialog open={cargarPagoDialog} onOpenChange={(o) => { setCargarPagoDialog(o); if (!o) cpResetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Cargar evidencia de pago</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setCpDragging(true); }}
              onDragLeave={() => setCpDragging(false)}
              onDrop={(e) => { e.preventDefault(); setCpDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setCpFile(f); }}
              className={`relative rounded-lg border-2 border-dashed transition-colors ${cpDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
            >
              <input
                id="cp-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xml"
                onChange={(e) => setCpFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-1.5 py-7 px-4 text-center pointer-events-none">
                {cpFile ? (
                  <>
                    <FileCheck className="size-7 text-primary" />
                    <p className="text-[13px] font-medium text-foreground break-all">{cpFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">{(cpFile.size / 1024).toFixed(0)} KB · clic para cambiar</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-7 text-muted-foreground" />
                    <p className="text-[13px] font-medium text-foreground">Arrastra el archivo aquí</p>
                    <p className="text-[11px] text-muted-foreground">o haz clic para seleccionar · PDF, imagen o XML</p>
                  </>
                )}
              </div>
            </div>

            {/* Pago destino (registro) */}
            {cpTarget && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Método</span>
                  <span className="font-medium text-foreground">{cpTarget.metodo ?? '—'}</span>
                </div>
                {cpTarget.monto != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Monto</span>
                    <span className="font-medium tabular-nums text-foreground">{fmtCurrency(Number(cpTarget.monto))}</span>
                  </div>
                )}
                {cpTarget.fecha_pago && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fecha de pago</span>
                    <span className="font-medium text-foreground">{fmtDate(cpTarget.fecha_pago)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checks */}
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <input type="checkbox" checked={cpEsValido} onChange={(e) => setCpEsValido(e.target.checked)}
                  className="size-4 accent-primary" />
                <span className="text-[13px] font-medium text-foreground">Pago validado</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <input type="checkbox" checked={cpEsCep} onChange={(e) => setCpEsCep(e.target.checked)}
                  className="size-4 accent-primary" />
                <span className="text-[13px] font-medium text-foreground">Es CEP</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => { setCargarPagoDialog(false); cpResetForm(); }}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCargarPagoSubmit} disabled={cpSaving || !cpFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {cpSaving && <Loader2 className="size-3.5 animate-spin" />}
              Cargar
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

      {/* Eliminar pago (cascada vía RPC eliminar_pago) */}
      <DeleteConfirmationDialog
        open={eliminarPagoId != null}
        onOpenChange={(open) => { if (!open && !isDeleting) { setEliminarPagoId(null); setEliminarImpacto(null); } }}
        onConfirm={handleConfirmEliminarPago}
        isLoading={isDeleting}
        title="Eliminar pago"
        description={'Se eliminará este pago de la cuenta.' + impactoClause(eliminarImpacto)}
        warningMessage={impactoWarning(eliminarImpacto)}
      />

    </div>
  );
}
