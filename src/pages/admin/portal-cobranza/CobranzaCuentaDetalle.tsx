import { useState, Fragment, useRef } from 'react';
import { EditCuentaCobranzaDialog } from '@/components/admin/EditCuentaCobranzaDialog';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PROD_FUNCTIONS_BASE_URL, PROD_SUPABASE_ANON_KEY } from '@/lib/config';
import { formatCuentaCobranzaId, formatOfertaId } from '@/utils/cuentaCobranzaUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft, Loader2, AlertTriangle, Calendar, CreditCard, Building2, Hash, Home,
  Landmark, User, Phone, Mail, FileText, Upload, Plus, ExternalLink,
  LayoutDashboard, Users, CheckCircle2, XCircle, AlertCircle, HelpCircle, Briefcase,
  Eye, X, Download, FileDown, Scale, Pencil, ArrowRightLeft, ChevronRight,
  ChevronDown, ChevronsUpDown, Layers, Copy, Search, Check, Undo2,
  FileCheck, FileWarning, FileClock, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '-';
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function acuerdoEstado(pago_completado: boolean, fecha_pago: string | null) {
  if (pago_completado) return 'pagado';
  if (!fecha_pago) return 'pendiente';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fecha_pago + 'T00:00:00');
  if (fecha < hoy) return 'vencido';
  const pronto = new Date(hoy); pronto.setDate(pronto.getDate() + 30);
  if (fecha <= pronto) return 'proximo';
  return 'pendiente';
}

function isEmbeddable(url: string) {
  return url.includes('supabase') || /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(url);
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

function ClaveCopyable({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground/40 text-[11px]">Sin registro</span>;
  return (
    <span className="inline-flex items-center gap-1 group max-w-full">
      <span className="font-mono text-[12px] text-muted-foreground truncate max-w-[120px]" title={value}>{value}</span>
      <button
        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value); toast.success('Copiado'); }}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title="Copiar clave"
      >
        <Copy className="size-3 text-muted-foreground" />
      </button>
    </span>
  );
}

// ── fetch ───────────────────────────────────────────────────────────────────────

async function fetchCuentaDetalle(cuentaId: number) {
  const { data: cuenta, error: cuentaErr } = await (supabase as any)
    .from('cuentas_cobranza')
    .select('id, clabe_stp, precio_final, fecha_compra, valor_uma, id_oferta, id_propiedad, activo')
    .eq('id', cuentaId)
    .maybeSingle();
  if (cuentaErr) throw cuentaErr;
  if (!cuenta) throw new Error('Cuenta no encontrada');

  const { data: oferta } = await (supabase as any)
    .from('ofertas')
    .select(`
      id, id_producto, email_creador,
      id_esquema_pago_seleccionado,
      esquemas_pago!ofertas_id_esquema_pago_seleccionado_fkey(nombre, porcentaje_enganche, porcentaje_mensualidades, porcentaje_entrega, numero_mensualidades),
      propiedades!ofertas_id_propiedad_fkey(
        id, numero_propiedad, m2_interiores, m2_exteriores,
        id_edificio_modelo, id_entidad_relacionada_dueno,
        id_estatus_disponibilidad
      ),
      productos_servicios!ofertas_id_producto_fkey(
        nombre,
        categorias_producto!productos_servicios_id_categoria_fkey(nombre)
      )
    `)
    .eq('id', cuenta.id_oferta)
    .maybeSingle();

  const propiedad = oferta?.propiedades ?? null;
  const esquemaNombre: string = oferta?.esquemas_pago?.nombre ?? null;
  const esquemaPct = {
    enganche: Number(oferta?.esquemas_pago?.porcentaje_enganche ?? 0),
    mensualidades: Number(oferta?.esquemas_pago?.porcentaje_mensualidades ?? 0),
    entrega: Number(oferta?.esquemas_pago?.porcentaje_entrega ?? 0),
    numMensualidades: Number(oferta?.esquemas_pago?.numero_mensualidades ?? 0),
  };
  const productoNombre: string | null = oferta?.productos_servicios?.nombre ?? null;
  const categoriaNombre: string | null = oferta?.productos_servicios?.categorias_producto?.nombre ?? null;
  const tipo = productoNombre ? (categoriaNombre ?? 'Producto') : 'Propiedad';

  // compradores via id_cuenta_cobranza
  const { data: compradoresRaw } = await (supabase as any)
    .from('compradores')
    .select('id_persona, porcentaje_copropiedad, personas!compradores_id_persona_fkey(nombre_legal)')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true);
  const compradores = (compradoresRaw ?? []).map((c: any) => ({
    id_persona: c.id_persona as number | null,
    nombre: c.personas?.nombre_legal ?? '',
    porcentaje: c.porcentaje_copropiedad,
  }));
  const compradorPersonaIds = compradores.map((c: any) => c.id_persona).filter(Boolean) as number[];
  const clienteNombre = compradores.map((c: any) => c.nombre).filter(Boolean).join(', ') || 'Sin nombre';

  // edificio / modelo
  let edificioNombre = '';
  let modeloNombre = '';
  if (propiedad?.id_edificio_modelo) {
    const { data: em } = await (supabase as any)
      .from('edificios_modelos')
      .select(`
        edificios!edificios_modelos_id_edificio_fkey(nombre),
        modelos!edificios_modelos_id_modelo_fkey(nombre)
      `)
      .eq('id', propiedad.id_edificio_modelo)
      .maybeSingle();
    edificioNombre = em?.edificios?.nombre ?? '';
    modeloNombre = em?.modelos?.nombre ?? '';
  }

  // proyecto desde entidad dueno
  let proyectoNombre = '';
  const duenoEntidadId = propiedad?.id_entidad_relacionada_dueno ?? null;
  if (duenoEntidadId) {
    const { data: ent } = await (supabase as any)
      .from('entidades_relacionadas')
      .select('proyectos!entidades_relacionadas_id_proyecto_fkey(nombre)')
      .eq('id', duenoEntidadId)
      .maybeSingle();
    proyectoNombre = ent?.proyectos?.nombre ?? '';
  }

  // estatus propiedad
  let estatusPropiedad = '';
  if (propiedad?.id_estatus_disponibilidad) {
    const { data: est } = await (supabase as any)
      .from('estatus_disponibilidad')
      .select('nombre')
      .eq('id', propiedad.id_estatus_disponibilidad)
      .maybeSingle();
    estatusPropiedad = est?.nombre ?? '';
  }

  const m2Interiores = Number(propiedad?.m2_interiores ?? 0);
  const m2Exteriores = Number(propiedad?.m2_exteriores ?? 0);
  const precioFinal = Number(cuenta.precio_final ?? 0);
  const precioM2 = m2Interiores > 0 ? precioFinal / m2Interiores : null;

  // agente vendedor
  let agente: {
    nombre: string; email: string; telefono: string | null;
    tipoAgente: string; organizacion: string | null; rolNombre: string;
  } | null = null;
  if (oferta?.email_creador) {
    const { data: usu } = await (supabase as any)
      .from('usuarios')
      .select('nombre, email, telefono, rol_id, id_persona, roles!usuarios_rol_id_fkey(nombre)')
      .eq('email', oferta.email_creador)
      .maybeSingle();
    if (usu) {
      const rolNombre: string = (usu as any).roles?.nombre ?? '';
      let tipoAgente = 'Otro';
      let organizacion: string | null = null;
      if (rolNombre.toLowerCase().includes('agente') && rolNombre.toLowerCase().includes('interno')) {
        tipoAgente = 'Agente Interno';
        organizacion = 'Sozu';
      } else if (rolNombre.toLowerCase().includes('inmobiliario') || rolNombre.toLowerCase().includes('agente')) {
        tipoAgente = 'Agente Inmobiliario';
        if (usu.id_persona) {
          const { data: ae } = await (supabase as any)
            .from('entidades_relacionadas')
            .select('id_persona_duena_lead')
            .eq('id_persona', usu.id_persona)
            .eq('id_tipo_entidad', 19)
            .eq('activo', true)
            .maybeSingle();
          if (ae?.id_persona_duena_lead) {
            const { data: inm } = await (supabase as any)
              .from('personas')
              .select('nombre_legal')
              .eq('id', ae.id_persona_duena_lead)
              .maybeSingle();
            organizacion = inm?.nombre_legal ?? null;
          }
        }
        if (!organizacion) {
          organizacion = usu.email?.includes('@sozu.com') ? 'Sozu' : 'Grupo Investimento';
        }
      } else {
        tipoAgente = rolNombre || (usu.email?.includes('@sozu.com') ? 'Agente Interno' : 'Agente');
        organizacion = usu.email?.includes('@sozu.com') ? 'Sozu' : null;
      }
      agente = {
        nombre: usu.nombre ?? oferta.email_creador,
        email: usu.email,
        telefono: usu.telefono ?? null,
        tipoAgente,
        organizacion,
        rolNombre,
      };
    } else {
      agente = {
        nombre: oferta.email_creador,
        email: oferta.email_creador,
        telefono: null,
        tipoAgente: oferta.email_creador.includes('@sozu.com') ? 'Agente Interno' : 'Agente',
        organizacion: oferta.email_creador.includes('@sozu.com') ? 'Sozu' : null,
        rolNombre: '',
      };
    }
  }

  // acuerdos
  const { data: acuerdosRaw } = await (supabase as any)
    .from('acuerdos_pago')
    .select('id, orden, monto, fecha_pago, pago_completado, id_concepto')
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order('orden');
  const acuerdoList: any[] = acuerdosRaw ?? [];

  let conceptoMap: Record<number, string> = {};
  if (acuerdoList.length > 0) {
    const cids = [...new Set(acuerdoList.map((a: any) => a.id_concepto).filter(Boolean))];
    if (cids.length > 0) {
      const { data: cs } = await (supabase as any).from('conceptos_pago').select('id, nombre').in('id', cids);
      for (const c of (cs ?? [])) conceptoMap[c.id] = c.nombre;
    }
  }

  const acuerdoIds = acuerdoList.map((a: any) => a.id);

  // aplicaciones con id_pago
  const { data: aplicaciones } = await (supabase as any)
    .from('aplicaciones_pago')
    .select('id, monto, id_acuerdo_pago, id_pago, es_multa')
    .in('id_acuerdo_pago', acuerdoIds.length > 0 ? acuerdoIds : [-1])
    .eq('activo', true);

  // pagos vinculados a las aplicaciones
  const pagoIdsFromAplic = [...new Set(
    (aplicaciones ?? []).map((a: any) => a.id_pago).filter(Boolean) as number[]
  )];

  let pagosMap: Record<number, any> = {};
  let metodoNombreMap: Record<number, string> = {};
  if (pagoIdsFromAplic.length > 0) {
    const { data: pagosLinked } = await (supabase as any)
      .from('pagos')
      .select('id, fecha_pago, monto, clave_rastreo, id_metodos_pago, url_cep, url_recibo, descripcion')
      .in('id', pagoIdsFromAplic);
    for (const p of (pagosLinked ?? [])) pagosMap[p.id] = p;

    const metodosIds = [...new Set((pagosLinked ?? []).map((p: any) => p.id_metodos_pago).filter(Boolean))];
    if (metodosIds.length > 0) {
      const { data: ms } = await (supabase as any).from('metodos_pago').select('id, nombre').in('id', metodosIds);
      for (const m of (ms ?? [])) metodoNombreMap[m.id] = m.nombre;
    }
  }

  // multas por acuerdo
  const { data: multasData } = await (supabase as any)
    .from('multas')
    .select('id, id_acuerdo_pago, monto, descripcion, id_tipo_multa, tipos_multa(nombre)')
    .in('id_acuerdo_pago', acuerdoIds.length > 0 ? acuerdoIds : [-1])
    .eq('activo', true);

  // pagos directos de la cuenta (pestaña Pagos)
  const { data: pagosData } = await (supabase as any)
    .from('pagos')
    .select(`
      id, fecha_pago, monto, clave_rastreo, url_cep, url_recibo, descripcion, id_metodos_pago,
      metodos_pago!pagos_id_metodos_pago_fkey(nombre)
    `)
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('activo', true)
    .order('fecha_pago', { ascending: false });

  const pagadoEfectivo = (pagosData ?? [])
    .filter((p: any) => p.id_metodos_pago === 1)
    .reduce((s: number, p: any) => s + Number(p.monto), 0);

  const allPagoIds = (pagosData ?? []).map((p: any) => p.id);
  const allValidacionIds = [...new Set([...allPagoIds, ...pagoIdsFromAplic])];
  let validacionByPago: Record<number, { estado: string; motivo: string; monto_esperado: number; monto_real: number }> = {};
  if (allValidacionIds.length > 0) {
    const { data: validaciones } = await (supabase as any)
      .from('pago_validaciones')
      .select('id_pago, estado, motivo, monto_esperado, monto_real, fecha_creacion')
      .in('id_pago', allValidacionIds)
      .order('fecha_creacion', { ascending: false });
    for (const v of (validaciones ?? [])) {
      if (!validacionByPago[v.id_pago]) {
        validacionByPago[v.id_pago] = {
          estado: v.estado,
          motivo: v.motivo,
          monto_esperado: Number(v.monto_esperado),
          monto_real: Number(v.monto_real),
        };
      }
    }
  }

  let totalPagado = 0;
  const acuerdos = acuerdoList.map((a: any) => {
    const aplics = (aplicaciones ?? []).filter((ap: any) => ap.id_acuerdo_pago === a.id);
    const aplicsNormales = aplics.filter((ap: any) => !ap.es_multa);
    const montoAplicado = aplicsNormales.reduce((s: number, ap: any) => s + Number(ap.monto), 0);
    totalPagado += montoAplicado;

    const pagoIds = [...new Set(aplicsNormales.map((ap: any) => ap.id_pago).filter(Boolean) as number[])];
    const pagosLinked = pagoIds.map((pid: number) => pagosMap[pid]).filter(Boolean);
    pagosLinked.sort((a: any, b: any) => (b.fecha_pago ?? '').localeCompare(a.fecha_pago ?? ''));
    const ultimoPago = pagosLinked[0] ?? null;

    const multasAcuerdo = (multasData ?? []).filter((m: any) => m.id_acuerdo_pago === a.id);

    // all aplicaciones with pago detail (for expandable view)
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

    return {
      id: a.id as number,
      orden: a.orden as number,
      monto: Number(a.monto),
      montoAplicado,
      fecha_pago: a.fecha_pago as string | null,
      pago_completado: a.pago_completado as boolean,
      concepto: conceptoMap[a.id_concepto] ?? 'Sin concepto',
      estado: acuerdoEstado(a.pago_completado, a.fecha_pago),
      numAplicaciones: aplicsNormales.length,
      aplicacionesDetalle,
      ultimoPago: ultimoPago
        ? {
            id: ultimoPago.id as number,
            id_metodos_pago: ultimoPago.id_metodos_pago as number | null,
            metodo: metodoNombreMap[ultimoPago.id_metodos_pago] ?? 'Sin método',
            clave_rastreo: ultimoPago.clave_rastreo ?? null,
            fecha_pago: ultimoPago.fecha_pago ?? null,
            url_cep: ultimoPago.url_cep ?? null,
            url_recibo: ultimoPago.url_recibo ?? null,
          }
        : null,
      pagoIds,
      validacion: ultimoPago ? (validacionByPago[ultimoPago.id] ?? null) : null,
      multas: multasAcuerdo.length > 0
        ? { count: multasAcuerdo.length, total: multasAcuerdo.reduce((s: number, m: any) => s + Number(m.monto), 0), items: multasAcuerdo }
        : null,
    };
  });

  // flat list of all aplicaciones for "Pagos y Validaciones" tab
  const aplicacionesList = acuerdoList.flatMap((a: any) => {
    const aplics = (aplicaciones ?? []).filter((ap: any) => ap.id_acuerdo_pago === a.id && !ap.es_multa);
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
        estado: a.estado as string,
        montoAplicado: a.montoAplicado as number,
      };
    });
  }).sort((a: any, b: any) => {
    if (!a.fecha_pago && !b.fecha_pago) return (a.acuerdoOrden ?? 0) - (b.acuerdoOrden ?? 0);
    if (!a.fecha_pago) return 1;
    if (!b.fecha_pago) return -1;
    return a.fecha_pago.localeCompare(b.fecha_pago);
  });

  const pagos = (pagosData ?? []).map((p: any) => ({
    id: p.id as number,
    fecha_pago: p.fecha_pago as string,
    monto: Number(p.monto),
    clave_rastreo: p.clave_rastreo as string | null,
    metodo: p.metodos_pago?.nombre ?? 'Sin método',
    url_cep: p.url_cep as string | null,
    url_recibo: p.url_recibo as string | null,
    descripcion: p.descripcion as string | null,
    validacion: validacionByPago[p.id] ?? null,
  }));

  // saldo / vencidos
  const saldoPendiente = precioFinal - totalPagado;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let montoVencido = 0;
  let parcialidadesVencidas = 0;
  for (const a of acuerdos) {
    if (!a.pago_completado && a.fecha_pago) {
      const f = new Date(a.fecha_pago + 'T00:00:00');
      if (f < hoy) {
        montoVencido += Math.max(0, a.monto - a.montoAplicado);
        parcialidadesVencidas++;
      }
    }
  }

  return {
    id: cuenta.id as number,
    clabe_stp: cuenta.clabe_stp as string | null,
    precio_final: precioFinal,
    fecha_compra: cuenta.fecha_compra as string | null,
    valor_uma: cuenta.valor_uma as number | null,
    activo: cuenta.activo as boolean,
    clienteNombre,
    compradores,
    compradorPersonaIds,
    agente,
    ofertaId: oferta?.id as number | null,
    ofertaProductoId: oferta?.id_producto as number | null ?? null,
    propiedadId: (propiedad?.id ?? cuenta.id_propiedad ?? null) as number | null,
    esquemaNombre,
    esquemaPct,
    proyectoNombre,
    edificioNombre,
    modeloNombre,
    numero_propiedad: propiedad?.numero_propiedad as string | null ?? null,
    productoNombre,
    tipo,
    m2Interiores,
    m2Exteriores,
    precioM2,
    estatusPropiedad,
    totalPagado,
    saldoPendiente,
    montoVencido,
    parcialidadesVencidas,
    pagadoEfectivo,
    acuerdos,
    pagos,
    aplicacionesList,
  };
}

async function fetchDocumentos(cuentaId: number, propiedadId?: number | null, personaIds?: number[]) {
  const resolveUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('https://')) return url;
    const { data: pub } = (supabase as any).storage.from('documentos').getPublicUrl(url);
    return pub?.publicUrl ?? url;
  };

  const mapDoc = (d: any, source: string) => ({
    id: d.id as number,
    idTipo: d.id_tipo_documento as number,
    tipoNombre: d.tipos_documento?.nombre ?? 'Documento',
    fecha: d.fecha_creacion as string,
    url: resolveUrl(d.url ?? ''),
    estatusId: d.id_estatus_verificacion as number | null,
    source,
    missing: false,
  });

  const queries: Promise<any[]>[] = [];

  // cuenta docs
  queries.push(
    (supabase as any)
      .from('documentos')
      .select('id, url, fecha_creacion, id_estatus_verificacion, tipos_documento:id_tipo_documento(nombre)')
      .eq('id_cuenta_cobranza', cuentaId)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false })
      .then(({ data }: any) => (data ?? []).map((d: any) => mapDoc(d, 'Cuenta')))
  );

  // propiedad docs
  if (propiedadId) {
    queries.push(
      (supabase as any)
        .from('documentos')
        .select('id, url, fecha_creacion, id_estatus_verificacion, tipos_documento:id_tipo_documento(nombre)')
        .eq('id_propiedad', propiedadId)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false })
        .then(({ data }: any) => (data ?? []).map((d: any) => mapDoc(d, 'Propiedad')))
    );
  }

  // persona docs (compradores)
  if (personaIds && personaIds.length > 0) {
    queries.push(
      (supabase as any)
        .from('documentos')
        .select('id, url, fecha_creacion, id_estatus_verificacion, tipos_documento:id_tipo_documento(nombre)')
        .in('id_persona', personaIds)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false })
        .then(({ data }: any) => (data ?? []).map((d: any) => mapDoc(d, 'Cliente')))
    );
  }

  const results = await Promise.all(queries);
  const all = results.flat();
  // sort by fecha desc so most recent wins in dedup
  all.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  // deduplicate by idTipo — keep most recent per type; null-tipo docs always included
  const seenTipo = new Set<number>();
  const deduped: typeof all = [];
  for (const d of all) {
    if (d.idTipo == null) { deduped.push(d); continue; }
    if (seenTipo.has(d.idTipo)) continue;
    seenTipo.add(d.idTipo);
    deduped.push(d);
  }

  deduped.sort((a, b) => (a.tipoNombre ?? '').localeCompare(b.tipoNombre ?? '', 'es'));
  return deduped;
}

async function fetchMetodosPago() {
  const { data } = await (supabase as any).from('metodos_pago').select('id, nombre').eq('activo', true).order('nombre');
  return (data ?? []) as Array<{ id: number; nombre: string }>;
}

async function fetchTiposDocumento() {
  const { data } = await (supabase as any).from('tipos_documento').select('id, nombre').eq('activo', true).order('nombre');
  return (data ?? []) as Array<{ id: number; nombre: string }>;
}

// ── sub-components ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = {
    pagado:    { label: 'Pagado',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    vencido:   { label: 'Vencido',   cls: 'bg-red-50 text-red-700 border-red-200' },
    proximo:   { label: 'Próximo',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pendiente: { label: 'Pendiente', cls: 'bg-muted/50 text-muted-foreground border-border' },
  }[estado] ?? { label: estado, cls: 'bg-muted/50 text-muted-foreground border-border' };
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>;
}

function ValidacionBadge({ estado }: { estado: string | null | undefined }) {
  if (!estado || estado === 'sin_validar') return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
      Sin validar
    </span>
  );
  const cfg: Record<string, { label: string; cls: string }> = {
    coincide:    { label: 'Valido',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    error:       { label: 'Error',       cls: 'bg-red-50 text-red-700 border-red-200' },
    no_coincide: { label: 'No coincide', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const c = cfg[estado] ?? { label: estado, cls: 'bg-muted/40 text-muted-foreground border-border' };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', c.cls)}>
      {c.label}
    </span>
  );
}

function SelectSearch({
  value, onValueChange, options, placeholder = 'Seleccionar...', disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) setTimeout(() => inputRef.current?.focus(), 0); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm',
            'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0
            ? <p className="py-3 text-center text-sm text-muted-foreground">Sin resultados</p>
            : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onValueChange(o.value); setOpen(false); setSearch(''); }}
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                  value === o.value && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                <Check className={cn('mr-2 size-4 shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')} />
                {o.label}
              </button>
            ))
          }
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DocEstatusBadge({ id }: { id: number | null }) {
  const cfg = id === 2
    ? { label: 'Verificado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : id === 3
    ? { label: 'Rechazado',  cls: 'bg-red-50 text-red-700 border-red-200' }
    : id === 4
    ? { label: 'Expirado',   cls: 'bg-orange-50 text-orange-700 border-orange-200' }
    : { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>;
}

function MiniKpiCard({ label, value, accent }: {
  label: string; value: string; accent?: 'success' | 'warning' | 'danger' | 'info';
}) {
  const valueClass = {
    success: 'text-emerald-600', warning: 'text-amber-600',
    danger: 'text-red-600', info: 'text-blue-600',
  }[accent ?? ''] ?? 'text-foreground';
  return (
    <div className="flex-1 rounded-md border border-border/60 bg-card px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</p>
      <p className={cn('text-[14px] font-bold tabular-nums leading-none', valueClass)}>{value}</p>
    </div>
  );
}

function KpiCard({ label, value, sub, accent, children }: {
  label: string; value: string; sub?: string; accent?: 'success' | 'warning' | 'danger';
  children?: React.ReactNode;
}) {
  const valueClass = { success: 'text-emerald-600', warning: 'text-amber-600', danger: 'text-red-600' }[accent ?? ''] ?? 'text-foreground';
  return (
    <div className="sozu-kpi-card overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">{label}</span>
      <p className={cn('text-[18px] font-bold tabular-nums leading-none mb-1.5', valueClass)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-[12px] text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-foreground break-all">{value || '-'}</span>
    </div>
  );
}

function EvidencePanel({ url, label, onClose, fill }: { url: string; label: string; onClose?: () => void; fill?: boolean }) {
  return (
    <div className={cn(fill ? 'flex flex-col flex-1 min-h-0 p-2 gap-2' : 'space-y-2')}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <a href={url} download target="_blank" rel="noopener noreferrer"
            title="Descargar"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Download className="size-3" />
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
            <ExternalLink className="size-3" />Abrir
          </a>
          {onClose && (
            <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>
      {isEmbeddable(url)
        ? isImage(url)
          ? <img src={url} alt={label} className={cn('w-full rounded-md border border-border object-contain', fill ? 'flex-1 min-h-0' : 'max-h-[60vh]')} />
          : <iframe src={url} title={label} className={cn('w-full rounded-md border border-border bg-muted/20', fill ? 'flex-1 min-h-0' : 'h-[60vh]')} />
        : (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
            <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px] text-foreground truncate">{url}</span>
          </a>
        )
      }
    </div>
  );
}

// ── tab config ──────────────────────────────────────────────────────────────────

type InfoTab = 'resumen' | 'personas';
type ActivityTab = 'acuerdos' | 'documentos';

const INFO_TABS: { id: InfoTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',  label: 'Resumen',  icon: LayoutDashboard },
  { id: 'personas', label: 'Personas', icon: Users },
];
const ACTIVITY_TABS: { id: ActivityTab; label: string; icon: React.ElementType }[] = [
  { id: 'acuerdos',   label: 'Acuerdos de Pago', icon: Calendar },
  { id: 'documentos', label: 'Documentos',        icon: FileText },
];

function TabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string; icon: React.ElementType }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-100 whitespace-nowrap',
            active === tab.id
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}>
          <tab.icon className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────────

export default function CobranzaCuentaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cuentaId = parseInt(id ?? '0');

  const [infoTab, setInfoTab] = useState<InfoTab>('resumen');
  const [activityTab, setActivityTab] = useState<ActivityTab>('acuerdos');
  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);
  // dialogs
  const [editCuentaDialog, setEditCuentaDialog] = useState(false);
  const [pagoDialog, setPagoDialog] = useState(false);
  const [pagoForm, setPagoForm] = useState({ fecha: todayIso(), monto: '', id_metodo: '', clave: '' });
  const [pagoSaving, setPagoSaving] = useState(false);

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

  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{ url: string; title: string } | null>(null);
  const [demandaDialog, setDemandaDialog] = useState(false);
  const [demandaSaving, setDemandaSaving] = useState(false);
  const [quitarDemandaDialog, setQuitarDemandaDialog] = useState(false);
  const [quitarDemandaSaving, setQuitarDemandaSaving] = useState(false);
  const [expandedAcuerdos, setExpandedAcuerdos] = useState<Set<number>>(new Set());
  const [docViewer, setDocViewer] = useState<{ url: string; nombre: string } | null>(null);
  const [pagoEvidenciaModal, setPagoEvidenciaModal] = useState<any | null>(null);
  const [pagoValidacionSaving, setPagoValidacionSaving] = useState(false);
  const [pagoMetodoSaving, setPagoMetodoSaving] = useState(false);
  const [downloadingOferta, setDownloadingOferta] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cobranza-cuenta-detalle', cuentaId],
    queryFn: () => fetchCuentaDetalle(cuentaId),
    enabled: !!cuentaId,
    staleTime: 30_000,
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['cobranza-cuenta-docs', cuentaId, data?.propiedadId, data?.compradorPersonaIds],
    queryFn: () => fetchDocumentos(cuentaId, data?.propiedadId, data?.compradorPersonaIds),
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
      const { data, error } = await (supabase as any).from('tipos_multa').select('id, nombre').eq('activo', true).order('id');
      if (error) throw error;
      return data as Array<{ id: number; nombre: string }>;
    },
    staleTime: 300_000,
  });

  async function handlePagoSubmit() {
    if (!pagoForm.fecha || !pagoForm.monto || !pagoForm.id_metodo) {
      toast.error('Completa fecha, monto y metodo');
      return;
    }
    setPagoSaving(true);
    try {
      const { error: e } = await (supabase as any).from('pagos').insert({
        id_cuenta_cobranza: cuentaId,
        fecha_pago: pagoForm.fecha,
        monto: parseFloat(pagoForm.monto),
        id_metodos_pago: parseInt(pagoForm.id_metodo),
        clave_rastreo: pagoForm.clave || null,
        activo: true,
      });
      if (e) throw e;
      toast.success('Pago registrado');
      setPagoDialog(false);
      setPagoForm({ fecha: todayIso(), monto: '', id_metodo: '', clave: '' });
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
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

  async function handleEstadoCuenta() {
    setGeneratingPDF(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? PROD_SUPABASE_ANON_KEY;
      const res = await fetch(`${PROD_FUNCTIONS_BASE_URL}/generar-estado-cuenta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': PROD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ id_cuenta: cuentaId }),
      });
      const resp = await res.json();
      const url = resp?.url_estado_cuenta ?? resp?.url;
      if (!url) throw new Error(resp?.error ?? 'Error al generar');
      setPdfPreviewModal({ url, title: 'Estado de Cuenta' });
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
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    } finally {
      setQuitarDemandaSaving(false);
    }
  }

  async function handleUpdatePagoValidacion(pagoId: number, nuevoEstado: string) {
    setPagoValidacionSaving(true);
    try {
      const { data: updated } = await (supabase as any)
        .from('pago_validaciones').update({ estado: nuevoEstado }).eq('id_pago', pagoId).select('id');
      if (!updated || updated.length === 0) {
        const { error: ie } = await (supabase as any)
          .from('pago_validaciones').insert({ id_pago: pagoId, estado: nuevoEstado });
        if (ie) throw ie;
      }
      toast.success('Estado de validación actualizado');
      setPagoEvidenciaModal((prev: any) => prev ? { ...prev, validacion: { ...(prev.validacion ?? {}), estado: nuevoEstado } } : null);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar');
    } finally {
      setPagoValidacionSaving(false);
    }
  }

  async function handleUpdatePagoMetodo(pagoId: number, newMetodoId: number) {
    setPagoMetodoSaving(true);
    try {
      const { error: e } = await (supabase as any)
        .from('pagos')
        .update({ id_metodos_pago: newMetodoId })
        .eq('id', pagoId);
      if (e) throw e;
      const metodoNombre = metodosPago.find(m => m.id === newMetodoId)?.nombre ?? 'Sin método';
      toast.success('Método de pago actualizado');
      setPagoEvidenciaModal((prev: any) => prev ? {
        ...prev,
        metodo: metodoNombre,
        id_metodos_pago: newMetodoId,
      } : null);
      queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar');
    } finally {
      setPagoMetodoSaving(false);
    }
  }

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

  const {
    clabe_stp, precio_final, fecha_compra, valor_uma, activo,
    clienteNombre, compradores, agente, ofertaId, ofertaProductoId, propiedadId, esquemaNombre, esquemaPct,
    proyectoNombre, edificioNombre, modeloNombre, numero_propiedad, productoNombre, tipo,
    m2Interiores, m2Exteriores, precioM2, estatusPropiedad,
    totalPagado, saldoPendiente, montoVencido, parcialidadesVencidas, pagadoEfectivo,
    acuerdos, pagos, aplicacionesList,
  } = data;

  const limiteEfectivo = (valor_uma ?? 0) * 8025;
  const aunPermitido = limiteEfectivo - pagadoEfectivo;
  const acuerdosPendientes = (acuerdos as any[]).filter(a => !a.pago_completado).length;

  // plan modification check — computed once for badge, InfoRow, and plan rows
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
  const planIsModified = _hasEsquema && !!(esquemaPct) && (
    Math.abs(esquemaPct.enganche - _planPctE) > 0.5 ||
    Math.abs(esquemaPct.mensualidades - _planPctP) > 0.5 ||
    Math.abs(esquemaPct.entrega - _planPctEnt) > 0.5 ||
    esquemaPct.numMensualidades !== _planParcAcuerdos.length
  );
  const esquemaNombreDisplay = esquemaNombre ? (planIsModified ? `${esquemaNombre} modificado` : esquemaNombre) : null;

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
      // after generation, show in modal
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

  const isEnDemanda = estatusPropiedad?.toLowerCase().includes('demanda');

  const porcentajePagado = precio_final > 0 ? Math.min(100, (totalPagado / precio_final) * 100) : 0;
  const selectedPago = pagos.find(p => p.id === selectedPagoId) ?? null;

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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Precio Final" value={fmtCurrency(precio_final)} />
        <KpiCard
          label="Total Pagado"
          value={fmtCurrency(totalPagado)}
          sub={`${porcentajePagado.toFixed(0)}% del total`}
          accent={porcentajePagado >= 100 ? 'success' : undefined}
        />
        <KpiCard
          label="Saldo Pendiente"
          value={fmtCurrency(saldoPendiente)}
          sub={acuerdosPendientes > 0 ? `${acuerdosPendientes} acuerdo${acuerdosPendientes !== 1 ? 's' : ''} pendiente${acuerdosPendientes !== 1 ? 's' : ''}` : undefined}
          accent={saldoPendiente <= 0 ? 'success' : 'danger'}
        />
        <KpiCard label="Pago en efectivo" value="">
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Límite</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{fmtCurrency(limiteEfectivo)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Pagado</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{fmtCurrency(pagadoEfectivo)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground">Restante</span>
              <span className={cn('text-[10px] font-bold tabular-nums', aunPermitido < 0 ? 'text-red-600' : 'text-foreground')}>{fmtCurrency(aunPermitido)}</span>
            </div>
          </div>
        </KpiCard>
        <KpiCard
          label="Avance Cobranza"
          value={`${porcentajePagado.toFixed(1)}%`}
          accent={porcentajePagado >= 85 ? 'success' : porcentajePagado < 25 ? 'danger' : 'warning'}
        >
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                porcentajePagado >= 85 ? 'bg-emerald-500' : porcentajePagado < 25 ? 'bg-red-500' : 'bg-amber-400'
              )}
              style={{ width: `${porcentajePagado}%` }}
            />
          </div>
        </KpiCard>
      </div>

      {/* Botones de accion — alineados con las cards */}
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <button
          onClick={() => navigate(`/admin/portal-cobranza/expediente/${cuentaId}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRightLeft className="size-3.5" />Transferir
        </button>
        <button
          onClick={() => setPagoDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
        >
          <CreditCard className="size-3.5" />Agregar Pago
        </button>
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <button
          onClick={handleEstadoCuenta}
          disabled={generatingPDF}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          {generatingPDF ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
          Estado de Cuenta
        </button>
        <button
          onClick={() => setEditCuentaDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="size-3.5" />Editar Cuenta
        </button>
        {!isEnDemanda && saldoPendiente > 0 && (
          <button
            onClick={() => setDemandaDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-background text-[12px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Scale className="size-3.5" />Poner en demanda
          </button>
        )}
        {isEnDemanda && (
          <button
            onClick={() => setQuitarDemandaDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors"
            title="Quitar demanda"
          >
            <Scale className="size-3.5" />En demanda
          </button>
        )}
      </div>

      {/* Seccion info (Resumen + Personas) */}
      <div className="sozu-kpi-card p-0 overflow-hidden">
        <TabBar tabs={INFO_TABS} active={infoTab} onChange={(t) => setInfoTab(t)} />

        {infoTab === 'resumen' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                {tipo === 'Propiedad' ? 'Unidad' : 'Producto'}
              </h3>
              <InfoRow icon={Building2} label="Proyecto"   value={proyectoNombre} />
              {edificioNombre && <InfoRow icon={Building2} label="Edificio"   value={edificioNombre} />}
              {modeloNombre   && <InfoRow icon={Home}      label="Modelo"     value={modeloNombre} />}
              {numero_propiedad && <InfoRow icon={Hash}    label="Unidad"     value={numero_propiedad} />}
              {productoNombre && <InfoRow icon={Home}      label="Producto"   value={productoNombre} />}
              {estatusPropiedad && <InfoRow icon={ChevronRight} label="Estatus" value={estatusPropiedad} />}
              {(m2Interiores > 0 || m2Exteriores > 0) && (
                <InfoRow icon={Home} label="Metraje"
                  value={m2Exteriores > 0
                    ? `${m2Interiores} m2 int · ${m2Exteriores} m2 ext`
                    : `${m2Interiores} m2`}
                />
              )}
              {precioM2 != null && (
                <InfoRow icon={CreditCard} label="Precio / m2" value={fmtCurrency(precioM2)} />
              )}
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Datos de la cuenta</h3>
              <InfoRow icon={Landmark}   label="CLABE STP"    value={clabe_stp ?? ''} />
              <InfoRow icon={Calendar}   label="Fecha compra" value={fmtDate(fecha_compra)} />
              {ofertaId && (
                <>
                  <div className="flex items-start gap-3 py-2 border-b border-border/50">
                    <Hash className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-[12px] text-muted-foreground w-28 shrink-0">Oferta PDF</span>
                    <button
                      onClick={handleDownloadOferta}
                      disabled={downloadingOferta}
                      title="Descargar PDF de oferta"
                      className="text-[12px] font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                    >
                      {downloadingOferta
                        ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" />{formatOfertaId(ofertaId)}</span>
                        : formatOfertaId(ofertaId)
                      }
                    </button>
                  </div>
                  <div className="flex items-start gap-3 py-2 border-b border-border/50">
                    <Hash className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-[12px] text-muted-foreground w-28 shrink-0">Oferta digital</span>
                    <a
                      href={`${window.location.origin}/oferta/${ofertaId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-700 transition-colors"
                    >
                      {formatOfertaId(ofertaId)}
                    </a>
                  </div>
                </>
              )}
              {esquemaNombreDisplay && <InfoRow icon={Calendar} label="Plan de pagos" value={esquemaNombreDisplay} />}
            </div>
          </div>
        )}

        {infoTab === 'personas' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
                Compradores ({compradores.length})
              </h3>
              {compradores.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Sin compradores registrados.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {compradores.map((c: any, i: number) => (
                    <div key={i} className="py-3 flex items-center gap-3">
                      <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{c.nombre || 'Sin nombre'}</p>
                        {c.porcentaje != null && (
                          <p className="text-[11px] text-muted-foreground">{c.porcentaje}% copropiedad</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Vendedor</h3>
              {agente ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold leading-tight">{agente.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[agente.tipoAgente !== 'Otro' ? agente.tipoAgente : null, agente.organizacion].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    <div className="flex items-center gap-2 py-2">
                      <Mail className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-foreground break-all">{agente.email}</span>
                    </div>
                    {agente.telefono && (
                      <div className="flex items-center gap-2 py-2">
                        <Phone className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-foreground">{agente.telefono}</span>
                      </div>
                    )}
                    {agente.rolNombre && (
                      <div className="flex items-center gap-2 py-2">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground">{agente.rolNombre}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">Sin información de vendedor.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Seccion actividad (Acuerdos + Pagos + Documentos) */}
      <div className="sozu-kpi-card p-0 overflow-hidden">
        <TabBar tabs={ACTIVITY_TABS} active={activityTab} onChange={(t) => setActivityTab(t)} />

        {/* Acuerdos de Pago */}
        {activityTab === 'acuerdos' && (
          <>
            <div className="px-5 py-3 border-b border-border/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {esquemaNombreDisplay && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary">
                      <Layers className="size-2.5" />{esquemaNombreDisplay}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {acuerdos.filter(a => a.pago_completado).length} de {acuerdos.length} pagados
                  </span>
                </div>
                <button
                  onClick={() => setPagoDialog(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="size-3.5" />Registrar pago
                </button>
              </div>
              {/* Plan de pagos — siempre mostrar el plan seleccionado */}
              {(() => {
                const PlanRow = ({ label, pE, nP, pP, pEnt, amtE, amtP, amtEnt, active }: any) => {
                  const perPago = nP > 0 ? amtP / nP : 0;
                  return (
                    <div className={cn('rounded-md border px-3 py-2.5', active ? 'border-emerald-500/60 bg-emerald-50/30' : 'border-border bg-muted/20 opacity-60')}>
                      <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-2', active ? 'text-emerald-600' : 'text-muted-foreground')}>{label}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pE > 0 ? `${pE}%` : '-'}</p>
                          <p className="text-[11px] font-medium text-muted-foreground">Enganche</p>
                          <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{pE > 0 ? fmtCurrency(amtE) : '-'}</p>
                        </div>
                        <div>
                          <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pP > 0 ? `${pP}%` : '-'}</p>
                          <p className="text-[11px] font-medium text-muted-foreground">Parcialidades</p>
                          <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{nP > 0 && pP > 0 ? `${nP} pagos de ${fmtCurrency(perPago)}` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pEnt > 0 ? `${pEnt}%` : '-'}</p>
                          <p className="text-[11px] font-medium text-muted-foreground">Pago final</p>
                          <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{pEnt > 0 ? fmtCurrency(amtEnt) : '-'}</p>
                        </div>
                      </div>
                    </div>
                  );
                };
                const orig = esquemaPct;
                return (
                  <div className="space-y-2 mb-3">
                    {planIsModified && orig && (
                      <PlanRow
                        label="Plan Original"
                        pE={orig.enganche} nP={orig.numMensualidades} pP={orig.mensualidades} pEnt={orig.entrega}
                        amtE={orig.enganche / 100 * precio_final}
                        amtP={orig.mensualidades / 100 * precio_final}
                        amtEnt={orig.entrega / 100 * precio_final}
                        active={false}
                      />
                    )}
                    <PlanRow
                      label={planIsModified ? 'Plan Actual' : 'Plan de Pagos'}
                      pE={_planPctE} nP={_planParcAcuerdos.length} pP={_planPctP} pEnt={_planPctEnt}
                      amtE={_planEngTotal} amtP={_planParcTotal} amtEnt={_planEntTotal}
                      active={true}
                    />
                  </div>
                );
              })()}
              <div className="grid grid-cols-4 gap-x-2 py-6">
                <div className="text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Por recibir</p>
                  <p className="text-[17px] font-bold tabular-nums text-foreground leading-none">{fmtCurrency(precio_final)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ya recibido</p>
                  <p className="text-[17px] font-bold tabular-nums text-emerald-600 leading-none">{fmtCurrency(montoValidado)}</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-[9px] font-semibold uppercase tracking-wider mb-1', saldoPendiente > 0 ? 'text-red-500' : 'text-muted-foreground')}>Pendiente</p>
                  <p className={cn('text-[17px] font-bold tabular-nums leading-none', saldoPendiente > 0 ? 'text-red-600' : 'text-muted-foreground')}>{fmtCurrency(saldoPendiente)}</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-[9px] font-semibold uppercase tracking-wider mb-1', montoSinValidar > 0 ? 'text-amber-500' : 'text-muted-foreground')}>Sin validar</p>
                  <p className={cn('text-[17px] font-bold tabular-nums leading-none', montoSinValidar > 0 ? 'text-amber-600' : 'text-muted-foreground/40')}>{fmtCurrency(montoSinValidar)}</p>
                </div>
              </div>
            </div>

            {acuerdos.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted-foreground">Sin acuerdos de pago.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sozu-thead">
                      {['Concepto', 'Aplic.', 'F. límite', 'F. pagado', 'Metodo', 'Clave rastreo', 'Monto', 'Aplicado', '%', 'Estado', 'Valido', ''].map((h, i) => (
                        <th key={i} className={cn(
                          'px-3 py-2.5 text-[10px] whitespace-nowrap',
                          i === 1 && 'w-10',
                          i === 10 && 'w-20'
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {acuerdos.map(a => {
                      const isExpanded = expandedAcuerdos.has(a.id);
                      return (
                      <Fragment key={a.id}>
                      <tr
                        onClick={() => a.numAplicaciones > 1 && setExpandedAcuerdos(prev => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(a.id) : next.add(a.id);
                          return next;
                        })}
                        className={cn(
                          'border-b border-border/50 transition-colors duration-100',
                          a.numAplicaciones > 1 ? 'cursor-pointer hover:bg-muted/30' : 'hover:bg-muted/20'
                        )}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2 min-w-0">
                            <span className="inline-flex items-center justify-center size-[18px] rounded-full bg-muted text-[9px] font-bold text-muted-foreground shrink-0">{a.orden}</span>
                            <span className="text-[12px] text-foreground leading-tight">
                              {a.concepto.toLowerCase().includes('contra entrega') ? 'Entrega' : a.concepto}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {a.numAplicaciones > 0 ? (
                            <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{a.numAplicaciones}</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="text-[12px] tabular-nums text-muted-foreground">{a.fecha_pago ? fmtDate(a.fecha_pago) : 'Sin registro'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={cn('text-[12px] tabular-nums', a.ultimoPago?.fecha_pago ? 'text-emerald-600' : 'text-muted-foreground/40')}>
                            {a.ultimoPago?.fecha_pago ? fmtDate(a.ultimoPago.fecha_pago) : 'Sin registro'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="text-[12px] text-foreground">{a.ultimoPago?.metodo ?? 'Sin registro'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {a.numAplicaciones >= 2
                            ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground/70">
                                <Undo2 className="size-2.5 shrink-0" style={{ transform: 'rotate(180deg)' }} />{a.numAplicaciones}
                              </span>
                            : <ClaveCopyable value={a.ultimoPago?.clave_rastreo} />
                          }
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="text-[12px] font-medium tabular-nums">{fmtCurrency(a.monto)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={cn('text-[12px] tabular-nums',
                            a.montoAplicado >= a.monto ? 'text-emerald-600 font-medium'
                            : a.montoAplicado > 0 ? 'text-amber-600'
                            : 'text-muted-foreground/40'
                          )}>
                            {a.montoAplicado > 0 ? fmtCurrency(a.montoAplicado) : 'Sin aplicar'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {a.montoAplicado > 0 && precio_final > 0 ? (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {(Math.floor(a.montoAplicado / precio_final * 10000) / 100).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <EstadoBadge estado={
                            a.numAplicaciones >= 2
                              ? (a.aplicacionesDetalle.every((ap: any) => ap.id_pago != null)
                                  ? 'pagado'
                                  : acuerdoEstado(false, a.fecha_pago))
                              : a.estado
                          } />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <ValidacionBadge estado={a.validacion?.estado} />
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {a.ultimoPago?.url_cep && (
                              <FileCheck
                                title={a.numAplicaciones >= 2 ? 'Ver en parcialidades' : 'CEP / SPEI'}
                                className={cn('size-3.5 shrink-0', a.numAplicaciones >= 2 ? 'text-muted-foreground/25' : 'text-emerald-500')}
                              />
                            )}
                            {!a.ultimoPago?.url_cep && a.ultimoPago?.url_recibo && (
                              <FileWarning
                                title={a.numAplicaciones >= 2 ? 'Ver en parcialidades' : 'Comprobante manual'}
                                className={cn('size-3.5 shrink-0', a.numAplicaciones >= 2 ? 'text-muted-foreground/25' : 'text-amber-500')}
                              />
                            )}
                            <button
                              onClick={() => {
                                if (a.multas) {
                                  setMultaGestionAcuerdoId(a.id);
                                  setMultaGestionDialog(true);
                                } else {
                                  setMultaAcuerdoId(a.id);
                                  setMultaDialog(true);
                                }
                              }}
                              title={a.multas ? `${a.multas.count} multa${a.multas.count !== 1 ? 's' : ''} - ver detalle` : 'Agregar multa'}
                              className={cn('p-1 rounded transition-colors', a.multas ? 'text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600' : 'text-foreground/70 hover:bg-muted hover:text-foreground')}
                            >
                              <FileClock className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (a.numAplicaciones >= 2) return;
                                const listItem = aplicacionesList.find((x: any) => x.id_pago === a.ultimoPago?.id);
                                if (listItem) setPagoEvidenciaModal(listItem);
                              }}
                              disabled={a.numAplicaciones >= 2 || !a.ultimoPago?.id}
                              title={a.numAplicaciones >= 2 ? 'Ver en parcialidades expandidas' : 'Ver evidencia y validación'}
                              className={cn(
                                'p-1 rounded transition-colors',
                                a.numAplicaciones >= 2 || !a.ultimoPago?.id
                                  ? 'text-muted-foreground/20 cursor-not-allowed'
                                  : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
                              )}
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && a.aplicacionesDetalle.map((ap: any, idx: number) => (
                        <tr key={`aplic-${ap.id}`} className="border-b border-primary/10 bg-primary/5">
                          {/* col 0: indent indicator */}
                          <td className="px-3 py-1.5">
                            <span className="flex items-center pl-4">
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-[9px] font-semibold text-primary/60">
                                <Undo2 className="size-2.5 shrink-0" style={{ transform: 'rotate(180deg)' }} />{idx + 1}
                              </span>
                            </span>
                          </td>
                          {/* col 1: aplic count — empty */}
                          <td />
                          {/* col 2: F. límite — empty (inherited) */}
                          <td />
                          {/* col 3: F. pagado */}
                          <td className="px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
                            {ap.fecha_pago ? fmtDate(ap.fecha_pago) : '-'}
                          </td>
                          {/* col 4: metodo */}
                          <td className="px-3 py-1.5 text-[11px] text-foreground whitespace-nowrap">
                            {ap.metodo ?? '-'}
                          </td>
                          {/* col 5: clave rastreo */}
                          <td className="px-3 py-1.5 text-center">
                            <ClaveCopyable value={ap.clave_rastreo} />
                          </td>
                          {/* col 6: monto — empty (shown on parent) */}
                          <td />
                          {/* col 7: aplicado */}
                          <td className="px-3 py-1.5 text-right text-[11px] font-semibold tabular-nums text-emerald-600">
                            {fmtCurrency(ap.monto)}
                          </td>
                          {/* col 8: % */}
                          <td />
                          {/* col 9: estado */}
                          <td className="px-3 py-1.5 text-center">
                            <EstadoBadge estado={ap.id_pago ? 'pagado' : acuerdoEstado(false, a.fecha_pago)} />
                          </td>
                          {/* col 10: valido */}
                          <td className="px-3 py-1.5 text-center">
                            <ValidacionBadge estado={ap.validacion?.estado} />
                          </td>
                          {/* col 11: actions */}
                          <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {ap.url_cep && (
                                <FileCheck title="CEP / SPEI" className="size-3.5 shrink-0 text-emerald-500" />
                              )}
                              {!ap.url_cep && ap.url_recibo && (
                                <FileWarning title="Comprobante manual" className="size-3.5 shrink-0 text-amber-500" />
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const listItem = aplicacionesList.find((x: any) => x.id === ap.id);
                                  if (listItem) setPagoEvidenciaModal(listItem);
                                }}
                                title="Ver evidencia y validación"
                                className="p-1 rounded transition-colors hover:bg-primary/10 text-muted-foreground/60 hover:text-primary"
                              >
                                <Eye className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      </Fragment>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Documentos */}
        {activityTab === 'documentos' && (
          <>
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {docsLoading ? 'Cargando...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''}`}
              </p>
              <button
                onClick={() => setUploadDialog(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Upload className="size-3.5" />Subir
              </button>
            </div>
            {docsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="px-5 py-12 text-center space-y-2">
                <FileText className="size-7 text-muted-foreground/20 mx-auto" />
                <p className="text-[13px] text-muted-foreground">Sin documentos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sozu-thead">
                      {['Archivo', 'Origen', 'Fecha', 'Estatus', 'Acciones'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d: any) => (
                      <tr key={d.id} className={cn('border-b border-border/50 transition-colors duration-100', d.missing ? 'bg-muted/20' : 'hover:bg-muted/40')}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('text-[12px]', d.missing && 'text-muted-foreground/60 italic')}>{d.tipoNombre}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing ? (
                            <span className="text-[10px] text-muted-foreground/40">-</span>
                          ) : (
                            <span className={cn(
                              'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded',
                              d.source === 'Cuenta' ? 'bg-primary/10 text-primary' :
                              d.source === 'Propiedad' ? 'bg-blue-500/10 text-blue-600' :
                              'bg-emerald-500/10 text-emerald-700'
                            )}>
                              {d.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing
                            ? <span className="text-[11px] text-muted-foreground/50 italic">Sin registro</span>
                            : <span className="text-[12px] tabular-nums text-muted-foreground">{fmtDate(d.fecha)}</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing
                            ? <span className="text-[10px] text-muted-foreground/40">-</span>
                            : <DocEstatusBadge id={d.estatusId} />
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            {d.url && (
                              <button
                                onClick={() => setDocViewer({ url: d.url, nombre: d.tipoNombre })}
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Ver documento"
                              >
                                <Eye className="size-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setUploadIdTipo(String(d.idTipo)); setUploadDialog(true); }}
                              className="inline-flex items-center justify-center p-1 rounded hover:bg-emerald-50 text-muted-foreground/50 hover:text-emerald-600 transition-colors"
                              title={d.missing ? 'Subir documento' : 'Reemplazar documento'}
                            >
                              <Upload className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog: Agregar Pago */}
      <Dialog open={pagoDialog} onOpenChange={setPagoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Registrar Pago</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {([
              { label: 'Fecha de pago *', type: 'date', value: pagoForm.fecha, key: 'fecha' },
              { label: 'Monto (MXN) *', type: 'number', placeholder: 'ej. 15000', value: pagoForm.monto, key: 'monto' },
              { label: 'Clave de rastreo', type: 'text', placeholder: 'ej. 2024060912345678', value: pagoForm.clave, key: 'clave' },
            ] as const).map(f => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground px-0.5">{f.label}</label>
                <Input
                  type={f.type}
                  placeholder={'placeholder' in f ? f.placeholder : undefined}
                  value={f.value}
                  onChange={e => setPagoForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground px-0.5">Metodo de pago *</label>
              <SelectSearch
                value={pagoForm.id_metodo}
                onValueChange={v => setPagoForm(f => ({ ...f, id_metodo: v }))}
                options={metodosPago.map(m => ({ value: String(m.id), label: m.nombre }))}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setPagoDialog(false)}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handlePagoSubmit} disabled={pagoSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pagoSaving && <Loader2 className="size-3.5 animate-spin" />}Registrar
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
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card">
                <div className="flex items-center gap-2">
                  <FileDown className="size-4 text-muted-foreground" />
                  <p className="text-[13px] font-semibold">{pdfPreviewModal.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfPreviewModal.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Download className="size-3.5" />Descargar
                  </a>
                  <a
                    href={pdfPreviewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="size-3.5" />Abrir en pestaña
                  </a>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-muted/20">
                <iframe
                  src={pdfPreviewModal.url}
                  title={pdfPreviewModal.title}
                  className="w-full h-full"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Visor de documentos */}
      <Dialog open={!!docViewer} onOpenChange={open => !open && setDocViewer(null)}>
        <DialogContent className="sm:max-w-5xl h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
          {docViewer && (
            <div className="flex h-full min-h-0">
              <div className="flex-1 min-w-0 min-h-0 bg-muted/10">
                {isImage(docViewer.url) ? (
                  <div className="flex items-center justify-center h-full overflow-auto p-4">
                    <img src={docViewer.url} alt={docViewer.nombre} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <iframe src={docViewer.url} title={docViewer.nombre} className="w-full h-full" />
                )}
              </div>
              <div className="w-60 shrink-0 border-l border-border flex flex-col bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                  <p className="text-[13px] font-semibold truncate pr-2 leading-tight">{docViewer.nombre}</p>
                  <button
                    onClick={() => setDocViewer(null)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Acciones</p>
                  <a
                    href={docViewer.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium transition-colors"
                  >
                    <Download className="size-3.5 text-muted-foreground shrink-0" />Descargar
                  </a>
                  <a
                    href={docViewer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium transition-colors"
                  >
                    <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />Abrir en otra pestaña
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Evidencia Pago */}
      <Dialog open={!!pagoEvidenciaModal} onOpenChange={open => !open && setPagoEvidenciaModal(null)}>
        <DialogContent className="sm:max-w-5xl h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
          {pagoEvidenciaModal && (() => {
            const p = pagoEvidenciaModal;
            const conceptoLabel = p.concepto?.toLowerCase().includes('contra entrega') ? 'Pago Final' : (p.concepto ?? 'Pago');
            const evidUrl = p.url_cep ?? p.url_recibo ?? null;
            return (
              <div className="flex h-full min-h-0">
                {/* Evidence — 65% — raw file only, no header bar */}
                <div className="flex-[65] min-w-0 min-h-0 bg-muted/10">
                  {evidUrl ? (
                    isImage(evidUrl)
                      ? <div className="flex items-center justify-center h-full overflow-auto p-4">
                          <img src={evidUrl} alt="Evidencia" className="max-w-full max-h-full object-contain" />
                        </div>
                      : <iframe src={evidUrl} title="Evidencia" className="w-full h-full border-0" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <FileText className="size-10 text-muted-foreground/20 mb-3" />
                      <p className="text-[13px] text-muted-foreground">Sin evidencia adjunta</p>
                    </div>
                  )}
                </div>
                {/* Metadata — 35% */}
                <div className="flex-[35] shrink-0 border-l border-border flex flex-col bg-card min-w-[240px]">
                  <div className="px-4 py-3 border-b border-border shrink-0">
                    <p className="text-[13px] font-semibold leading-tight">{conceptoLabel} · {fmtDate(p.fecha_pago)}</p>
                    <ValidacionBadge estado={p.validacion?.estado} />
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {/* Acciones con badge de tipo */}
                    {evidUrl && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acciones</p>
                          {p.url_cep
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                <FileCheck className="size-3.5" />CEP / SPEI
                              </span>
                            : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                                <FileWarning className="size-3.5" />Comprobante
                              </span>
                          }
                        </div>
                        <a href={evidUrl} download target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium transition-colors">
                          <Download className="size-3.5 text-muted-foreground shrink-0" />Descargar
                        </a>
                        <a href={evidUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium transition-colors">
                          <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />Abrir en otra pestaña
                        </a>
                      </div>
                    )}
                    {/* Método de pago editable */}
                    {p.id_pago && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Método de pago</p>
                        <SelectSearch
                          value={String(p.id_metodos_pago ?? '')}
                          onValueChange={v => {
                            const n = parseInt(v);
                            if (n && n !== p.id_metodos_pago) handleUpdatePagoMetodo(p.id_pago!, n);
                          }}
                          options={metodosPago.map(m => ({ value: String(m.id), label: m.nombre }))}
                          disabled={pagoMetodoSaving}
                        />
                      </div>
                    )}
                    {/* Validación editable */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Validación</p>
                      {p.id_pago ? (
                        <SelectSearch
                          value={p.validacion?.estado ?? ''}
                          onValueChange={v => v && handleUpdatePagoValidacion(p.id_pago!, v)}
                          options={[
                            { value: 'coincide', label: 'Válido' },
                            { value: 'no_coincide', label: 'No coincide' },
                            { value: 'error', label: 'Error' },
                          ]}
                          placeholder="Sin validar"
                          disabled={pagoValidacionSaving}
                        />
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 italic">Sin pago vinculado - no editable</p>
                      )}
                      {/* Detalle solo cuando no es válido — debajo del select */}
                      {(p.validacion?.estado ?? 'sin_validar') !== 'coincide' && (
                        <div className="mt-2 space-y-1">
                          {p.validacion?.motivo && (
                            <p className="text-[11px] text-muted-foreground">{p.validacion.motivo}</p>
                          )}
                          {p.validacion && (p.validacion.monto_esperado > 0 || p.validacion.monto_real > 0) && (
                            <div className="flex gap-3 text-[11px]">
                              <span className="text-muted-foreground">Esperado: <span className="font-medium text-foreground">{fmtCurrency(p.validacion.monto_esperado)}</span></span>
                              <span className="text-muted-foreground">Real: <span className="font-medium text-foreground">{fmtCurrency(p.validacion.monto_real)}</span></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Plan context */}
                    {(() => {
                      const c = p.concepto?.toLowerCase() ?? '';
                      const isEng = c.includes('enganche') || c.includes('apartado');
                      const isParcialidad = c.includes('parcialidad');
                      const isEntrega = c.includes('contra entrega');
                      if (!isEng && !isParcialidad && !isEntrega) return null;
                      return (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Plan de pagos</p>
                          <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 space-y-2.5">
                            {(isEng || isEntrega) && (
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">{isEntrega ? 'Pago final' : (c.includes('apartado') ? 'Apartado' : 'Enganche')}</span>
                                <div className="text-right">
                                  <span className="text-[14px] font-bold tabular-nums text-foreground">{isEntrega ? _planPctEnt : _planPctE}%</span>
                                  <span className="text-[10px] text-muted-foreground ml-1.5">{fmtCurrency(isEntrega ? _planEntTotal : _planEngTotal)}</span>
                                </div>
                              </div>
                            )}
                            {isParcialidad && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-muted-foreground">Parcialidades</span>
                                  <div className="text-right">
                                    <span className="text-[14px] font-bold tabular-nums text-foreground">{_planPctP}%</span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5">{_planParcAcuerdos.length} pagos</span>
                                  </div>
                                </div>
                                {_planParcAcuerdos.length > 0 && (
                                  <div className="border-t border-border/40 pt-2 space-y-0.5 max-h-32 overflow-y-auto">
                                    {(_planParcAcuerdos as any[]).map((pa: any, i: number) => {
                                      const isCurrent = pa.orden === p.acuerdoOrden;
                                      return (
                                        <div key={pa.id} className={cn('flex items-center justify-between text-[10px] py-0.5 px-1 rounded', isCurrent ? 'bg-primary/8 font-semibold text-primary' : 'text-muted-foreground')}>
                                          <span>Parcialidad {i + 1}{isCurrent ? ' ←' : ''}</span>
                                          <span className="tabular-nums">{pa.fecha_pago ? fmtDate(pa.fecha_pago) : 'Sin fecha'}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Detalle del pago — al final */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detalle del pago</p>
                      <div className="space-y-1.5 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Concepto</span>
                          <span className="font-medium">{conceptoLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">F. límite</span>
                          <span className="tabular-nums">{p.fechaLimite ? fmtDate(p.fechaLimite) : 'Sin registro'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">F. pagado</span>
                          <span className="font-medium tabular-nums text-emerald-600">{fmtDate(p.fecha_pago)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monto aplicado</span>
                          <span className="font-bold tabular-nums text-emerald-600">{fmtCurrency(p.monto)}</span>
                        </div>
                        {p.clave_rastreo && (
                          <div className="flex flex-col gap-0.5 pt-0.5">
                            <span className="text-muted-foreground">Clave rastreo</span>
                            <span className="font-mono text-[11px] break-all text-foreground">{p.clave_rastreo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {editCuentaDialog && (
        <EditCuentaCobranzaDialog
          cuenta={{ id: cuentaId, precio_final }}
          onClose={() => setEditCuentaDialog(false)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['cobranza-cuenta-detalle', cuentaId] });
          }}
        />
      )}

    </div>
  );
}
