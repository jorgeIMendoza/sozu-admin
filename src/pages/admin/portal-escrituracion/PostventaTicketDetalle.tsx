import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft,
  Phone,
  UserPlus,
  Upload,
  ArrowUp,
  Send,
  Clock,
  User,
  Wrench,
  Camera,
  Video,
  Plus,
  Search,
  Calendar,
  Check,
  AlertTriangle,
  FileImage,
  MessageSquare,
  Activity,
  Layers,
  History,
  Info,
  X,
  Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type EstatusTicket =
  | 'NUEVO'
  | 'ASIGNADO'
  | 'EN_DIAGNOSTICO'
  | 'EN_REPARACION'
  | 'PENDIENTE_CLIENTE'
  | 'PENDIENTE_PROVEEDOR'
  | 'RESUELTO'
  | 'CERRADO'
  | 'REABIERTO';

type PrioridadTicket = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
type GarantiaEstatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'FUERA_GARANTIA';

interface EvidenciaItem {
  nombre: string;
  tipo: 'FOTO' | 'VIDEO';
  fecha: string;
  subidoPor: string;
}

interface ActividadItem {
  tipo: string;
  descripcion: string;
  fecha: string;
  por: string;
  icono: string;
}

interface ComentarioItem {
  texto: string;
  tipo: 'INTERNO' | 'CLIENTE' | 'PROVEEDOR';
  fecha: string;
  por: string;
}

interface TicketDetalle {
  id: string;
  unidad: string;
  torre: string;
  proyecto: string;
  cliente: string;
  telefono: string;
  fechaEntrega: string;
  fechaCreacion: string;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  estatus: EstatusTicket;
  garantiaEstatus: GarantiaEstatus;
  fechaVencimientoGarantia: string;
  slaLabel: string;
  slaVencido: boolean;
  responsable: string;
  proveedor: string;
  diagnostico: string;
  causaProbable: string;
  solucionPropuesta: string;
  descripcionReparacion: string;
  piezasReemplazadas: string;
  fechaReparacion: string | null;
  evidenciaInicial: EvidenciaItem[];
  evidenciaReparacion: EvidenciaItem[];
  actividad: ActividadItem[];
  comentarios: ComentarioItem[];
}

// ─── Helper: map tipo_evento to icono key ─────────────────────────────────────

function tipoEventoToIcono(tipo: string): string {
  const map: Record<string, string> = {
    CREACION: 'plus',
    ASIGNACION: 'user',
    CAMBIO_ESTATUS: 'activity',
    EVIDENCIA_INICIAL: 'camera',
    EVIDENCIA_REPARACION: 'camera',
    DIAGNOSTICO: 'search',
    VISITA: 'calendar',
    REPARACION: 'wrench',
    CONFIRMACION_CLIENTE: 'send',
    RECHAZO_CLIENTE: 'alert',
    CIERRE: 'check',
    REAPERTURA: 'activity',
    ESCALAMIENTO: 'alert',
    NOTA: 'activity',
    SLA_VENCIDO: 'alert',
  };
  return map[tipo] ?? 'activity';
}

// ─── Badge / Color Meta (previously preceded by demo data, now removed) ──────
// Real data loaded from DB in PostventaDetalle component

const _placeholderForTypeCheck: Record<string, TicketDetalle> = {
  'PLACEHOLDER': {
    id: 'PV-2031',
    unidad: '305B',
    torre: 'Torre B',
    proyecto: 'Bottura',
    cliente: 'Jorge Acosta',
    telefono: '(55) 1234-5678',
    fechaEntrega: '21/05/2024',
    fechaCreacion: '25/05/2024 10:12 AM',
    categoria: 'Calentador/Boiler',
    subcategoria: 'No enciende',
    descripcion:
      'El calentador de agua no enciende. Lo intenté con el encendedor manual pero tampoco funciona. Ya revisé que tenga gas.',
    prioridad: 'MEDIA',
    estatus: 'EN_REPARACION',
    garantiaEstatus: 'VIGENTE',
    fechaVencimientoGarantia: '21/11/2024',
    slaLabel: '24h',
    slaVencido: false,
    responsable: 'Isabel Hernández',
    proveedor: 'Juan López (Plomería Express)',
    diagnostico: 'Termopila defectuosa. No genera suficiente voltaje para mantener la válvula de gas abierta.',
    causaProbable: 'Desgaste prematuro del componente. Posible defecto de fábrica.',
    solucionPropuesta: 'Reemplazo de termopila y válvula de gas.',
    descripcionReparacion: '',
    piezasReemplazadas: '',
    fechaReparacion: null,
    evidenciaInicial: [
      { nombre: 'calentador_frente.jpg', tipo: 'FOTO', fecha: '25/05/2024 10:15', subidoPor: 'Jorge Acosta' },
      { nombre: 'calentador_lateral.jpg', tipo: 'FOTO', fecha: '25/05/2024 10:15', subidoPor: 'Jorge Acosta' },
      { nombre: 'intento_encendido.mp4', tipo: 'VIDEO', fecha: '25/05/2024 10:16', subidoPor: 'Jorge Acosta' },
    ],
    evidenciaReparacion: [],
    actividad: [
      { tipo: 'CREACION', descripcion: 'Ticket creado por Jorge Acosta vía Portal Cliente', fecha: '25/05/2024 10:12 AM', por: 'Jorge Acosta', icono: 'plus' },
      { tipo: 'EVIDENCIA_INICIAL', descripcion: 'Evidencia inicial cargada: 2 fotos y 1 video', fecha: '25/05/2024 10:15 AM', por: 'Jorge Acosta', icono: 'camera' },
      { tipo: 'ASIGNACION', descripcion: 'Ticket asignado a Isabel Hernández', fecha: '25/05/2024 10:30 AM', por: 'Sistema', icono: 'user' },
      { tipo: 'ASIGNACION', descripcion: 'Proveedor asignado: Juan López (Plomería Express)', fecha: '25/05/2024 11:00 AM', por: 'Isabel Hernández', icono: 'wrench' },
      { tipo: 'DIAGNOSTICO', descripcion: 'Diagnóstico registrado: Termopila defectuosa', fecha: '25/05/2024 02:15 PM', por: 'Juan López', icono: 'search' },
      { tipo: 'VISITA', descripcion: 'Visita programada para el 27/05/2024 09:00 AM', fecha: '25/05/2024 02:30 PM', por: 'Isabel Hernández', icono: 'calendar' },
    ],
    comentarios: [
      { texto: 'Buen día Jorge, estamos revisando su caso. Un técnico lo contactará a la brevedad posible.', tipo: 'CLIENTE', fecha: '25/05/2024 10:35 AM', por: 'Isabel Hernández' },
      { texto: 'Juan López visitará mañana a las 9am para el diagnóstico. Por favor confirme su disponibilidad.', tipo: 'CLIENTE', fecha: '25/05/2024 02:35 PM', por: 'Isabel Hernández' },
    ],
  },
  'PV-2032': {
    id: 'PV-2032',
    unidad: 'A-404',
    torre: 'Torre A',
    proyecto: 'Bottura',
    cliente: 'Marta Ramírez',
    telefono: '(55) 2345-6789',
    fechaEntrega: '22/05/2024',
    fechaCreacion: '24/05/2024 04:33 PM',
    categoria: 'Acabados',
    subcategoria: 'Pintura',
    descripcion:
      'Hay una mancha en la pared de la sala, parece humedad o mala aplicación de pintura. Aparecieron después de 2 días de la entrega.',
    prioridad: 'BAJA',
    estatus: 'ASIGNADO',
    garantiaEstatus: 'VIGENTE',
    fechaVencimientoGarantia: '22/08/2024',
    slaLabel: '5 días',
    slaVencido: false,
    responsable: 'Isabel Hernández',
    proveedor: 'Acabados del Valle',
    diagnostico: '',
    causaProbable: '',
    solucionPropuesta: '',
    descripcionReparacion: '',
    piezasReemplazadas: '',
    fechaReparacion: null,
    evidenciaInicial: [
      { nombre: 'mancha_sala.jpg', tipo: 'FOTO', fecha: '24/05/2024 04:35 PM', subidoPor: 'Marta Ramírez' },
      { nombre: 'detalle_mancha.jpg', tipo: 'FOTO', fecha: '24/05/2024 04:36 PM', subidoPor: 'Marta Ramírez' },
    ],
    evidenciaReparacion: [],
    actividad: [
      { tipo: 'CREACION', descripcion: 'Ticket creado por Marta Ramírez', fecha: '24/05/2024 04:33 PM', por: 'Marta Ramírez', icono: 'plus' },
      { tipo: 'ASIGNACION', descripcion: 'Asignado a Acabados del Valle', fecha: '24/05/2024 05:00 PM', por: 'Isabel Hernández', icono: 'user' },
    ],
    comentarios: [],
  },
  'PV-2033': {
    id: 'PV-2033',
    unidad: 'B-1104',
    torre: 'Torre B',
    proyecto: 'Bottura',
    cliente: 'Ernesto Gómez',
    telefono: '(55) 3456-7890',
    fechaEntrega: '20/05/2024',
    fechaCreacion: '25/05/2024 09:25 AM',
    categoria: 'Hidráulica',
    subcategoria: 'Fuga en lavabo',
    descripcion:
      'Hay fuga de agua debajo del lavabo del baño principal. El agua está saliendo constantemente y ya humedeció el mueble de madera.',
    prioridad: 'CRITICA',
    estatus: 'NUEVO',
    garantiaEstatus: 'VIGENTE',
    fechaVencimientoGarantia: '20/05/2025',
    slaLabel: '4h',
    slaVencido: true,
    responsable: 'Sin asignar',
    proveedor: 'Sin proveedor',
    diagnostico: '',
    causaProbable: '',
    solucionPropuesta: '',
    descripcionReparacion: '',
    piezasReemplazadas: '',
    fechaReparacion: null,
    evidenciaInicial: [
      { nombre: 'fuga_lavabo.jpg', tipo: 'FOTO', fecha: '25/05/2024 09:27 AM', subidoPor: 'Ernesto Gómez' },
    ],
    evidenciaReparacion: [],
    actividad: [
      { tipo: 'CREACION', descripcion: 'Ticket creado - Crítico: Fuga activa', fecha: '25/05/2024 09:25 AM', por: 'Ernesto Gómez', icono: 'plus' },
      { tipo: 'SLA_VENCIDO', descripcion: 'SLA vencido. Ticket sin asignar después de 4 horas.', fecha: '25/05/2024 01:25 PM', por: 'Sistema', icono: 'alert' },
    ],
    comentarios: [],
  },
  'PV-2034': {
    id: 'PV-2034',
    unidad: 'C-903',
    torre: 'Torre C',
    proyecto: 'Bottura',
    cliente: 'Diana Muñoz',
    telefono: '(55) 4567-8901',
    fechaEntrega: '23/05/2024',
    fechaCreacion: '23/05/2024 02:15 PM',
    categoria: 'Carpintería',
    subcategoria: 'Puerta clóset no cierra',
    descripcion:
      'La puerta del clóset del cuarto principal no cierra correctamente, se traba y la bisagra hace ruido.',
    prioridad: 'MEDIA',
    estatus: 'EN_REPARACION',
    garantiaEstatus: 'VIGENTE',
    fechaVencimientoGarantia: '23/08/2024',
    slaLabel: '24h',
    slaVencido: false,
    responsable: 'Isabel Hernández',
    proveedor: 'Carpintería Integral',
    diagnostico: 'Bisagra desalineada y marco de la puerta con desajuste de 3mm.',
    causaProbable: 'Asentamiento natural del mueble en primeras semanas.',
    solucionPropuesta: 'Reajuste de bisagras y calibración del marco.',
    descripcionReparacion: 'Se reajustaron las 3 bisagras y se recalibró el marco. La puerta cierra correctamente.',
    piezasReemplazadas: '3 bisagras ajustables',
    fechaReparacion: '24/05/2024',
    evidenciaInicial: [
      { nombre: 'puerta_problema.jpg', tipo: 'FOTO', fecha: '23/05/2024 02:17 PM', subidoPor: 'Diana Muñoz' },
      { nombre: 'bisagra.jpg', tipo: 'FOTO', fecha: '23/05/2024 02:18 PM', subidoPor: 'Diana Muñoz' },
    ],
    evidenciaReparacion: [
      { nombre: 'puerta_reparada.jpg', tipo: 'FOTO', fecha: '24/05/2024 11:30 AM', subidoPor: 'Carpintería Integral' },
      { nombre: 'bisagra_nueva.jpg', tipo: 'FOTO', fecha: '24/05/2024 11:31 AM', subidoPor: 'Carpintería Integral' },
    ],
    actividad: [
      { tipo: 'CREACION', descripcion: 'Ticket creado', fecha: '23/05/2024 02:15 PM', por: 'Diana Muñoz', icono: 'plus' },
      { tipo: 'ASIGNACION', descripcion: 'Asignado a Carpintería Integral', fecha: '23/05/2024 03:00 PM', por: 'Isabel Hernández', icono: 'user' },
      { tipo: 'VISITA', descripcion: 'Técnico en sitio - Diagnóstico realizado', fecha: '23/05/2024 05:00 PM', por: 'Carpintería Integral', icono: 'wrench' },
      { tipo: 'REPARACION', descripcion: 'Reparación ejecutada - Bisagras reajustadas', fecha: '24/05/2024 11:30 AM', por: 'Carpintería Integral', icono: 'check' },
      { tipo: 'EVIDENCIA_REPARACION', descripcion: 'Evidencia de reparación cargada: 2 fotos', fecha: '24/05/2024 11:35 AM', por: 'Carpintería Integral', icono: 'camera' },
    ],
    comentarios: [
      { texto: 'Mañana a las 9am pasamos a revisar.', tipo: 'CLIENTE', fecha: '23/05/2024 03:05 PM', por: 'Isabel Hernández' },
      { texto: 'La reparación quedó lista. Por favor confirme si quedó a su satisfacción.', tipo: 'CLIENTE', fecha: '24/05/2024 11:40 AM', por: 'Isabel Hernández' },
    ],
  },
  'PV-2035': {
    id: 'PV-2035',
    unidad: 'A-1203',
    torre: 'Torre A',
    proyecto: 'Bottura',
    cliente: 'Carlos López',
    telefono: '(55) 5678-9012',
    fechaEntrega: '24/05/2024',
    fechaCreacion: '24/05/2024 11:48 AM',
    categoria: 'HVAC',
    subcategoria: 'No enfría',
    descripcion:
      'El aire acondicionado enciende pero no enfría. El compresor hace un ruido extraño y el aire sale caliente.',
    prioridad: 'MEDIA',
    estatus: 'PENDIENTE_CLIENTE',
    garantiaEstatus: 'VIGENTE',
    fechaVencimientoGarantia: '24/11/2024',
    slaLabel: '24h',
    slaVencido: false,
    responsable: 'Miguel Torres',
    proveedor: 'HVAC Solutions',
    diagnostico: 'Gas refrigerante agotado. El compresor tiene desgaste en la junta.',
    causaProbable: 'Posible fuga de gas durante el transporte o instalación.',
    solucionPropuesta: 'Recarga de gas refrigerante R-410A y revisión de juntas.',
    descripcionReparacion: 'Se recargó el gas refrigerante y se selló la fuga en la junta del compresor.',
    piezasReemplazadas: 'Junta de compresor, válvula Schrader',
    fechaReparacion: '25/05/2024',
    evidenciaInicial: [
      { nombre: 'minisplit.jpg', tipo: 'FOTO', fecha: '24/05/2024 11:50 AM', subidoPor: 'Carlos López' },
      { nombre: 'compresor.jpg', tipo: 'FOTO', fecha: '24/05/2024 11:51 AM', subidoPor: 'Carlos López' },
    ],
    evidenciaReparacion: [
      { nombre: 'recarga_gas.jpg', tipo: 'FOTO', fecha: '25/05/2024 03:00 PM', subidoPor: 'HVAC Solutions' },
      { nombre: 'medicion_presion.jpg', tipo: 'FOTO', fecha: '25/05/2024 03:15 PM', subidoPor: 'HVAC Solutions' },
      { nombre: 'equipo_funcionando.mp4', tipo: 'VIDEO', fecha: '25/05/2024 03:30 PM', subidoPor: 'HVAC Solutions' },
    ],
    actividad: [
      { tipo: 'CREACION', descripcion: 'Ticket creado', fecha: '24/05/2024 11:48 AM', por: 'Carlos López', icono: 'plus' },
      { tipo: 'ASIGNACION', descripcion: 'Asignado a HVAC Solutions', fecha: '24/05/2024 12:30 PM', por: 'Miguel Torres', icono: 'user' },
      { tipo: 'VISITA', descripcion: 'Diagnóstico en sitio completado', fecha: '24/05/2024 04:00 PM', por: 'HVAC Solutions', icono: 'search' },
      { tipo: 'REPARACION', descripcion: 'Reparación completada', fecha: '25/05/2024 03:30 PM', por: 'HVAC Solutions', icono: 'check' },
      { tipo: 'EVIDENCIA_REPARACION', descripcion: 'Evidencia de reparación cargada', fecha: '25/05/2024 03:35 PM', por: 'HVAC Solutions', icono: 'camera' },
      { tipo: 'CONFIRMACION', descripcion: 'Solicitud de confirmación enviada al cliente', fecha: '25/05/2024 03:40 PM', por: 'Isabel Hernández', icono: 'send' },
    ],
    comentarios: [
      { texto: 'Carlos, la reparación quedó lista. ¿Puede confirmar que el equipo enfría correctamente?', tipo: 'CLIENTE', fecha: '25/05/2024 03:40 PM', por: 'Isabel Hernández' },
    ],
  },
};

// ─── Badge / Color Meta ───────────────────────────────────────────────────────

const ESTATUS_META: Record<EstatusTicket, { label: string; className: string }> = {
  NUEVO: { label: 'Nuevo', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ASIGNADO: { label: 'Asignado', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  EN_DIAGNOSTICO: { label: 'En diagnóstico', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  EN_REPARACION: { label: 'En proceso', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDIENTE_CLIENTE: { label: 'Pendiente cliente', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDIENTE_PROVEEDOR: { label: 'Pendiente proveedor', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  RESUELTO: { label: 'Resuelto', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  CERRADO: { label: 'Cerrado', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  REABIERTO: { label: 'Reabierto', className: 'bg-red-50 text-red-700 border-red-200' },
};

const PRIORIDAD_META: Record<PrioridadTicket, { label: string; className: string }> = {
  CRITICA: { label: 'Crítica', className: 'bg-red-50 text-red-700 border-red-200' },
  ALTA: { label: 'Alta', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  MEDIA: { label: 'Media', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  BAJA: { label: 'Baja', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const GARANTIA_META: Record<GarantiaEstatus, { label: string; className: string }> = {
  VIGENTE: { label: 'Vigente', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  POR_VENCER: { label: 'Por vencer', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  VENCIDA: { label: 'Vencida', className: 'bg-red-50 text-red-700 border-red-200' },
  FUERA_GARANTIA: { label: 'Fuera garantía', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// ─── Tab Definitions ──────────────────────────────────────────────────────────

type TabId = 'detalle' | 'actividad' | 'evidencia-inicial' | 'evidencia-reparacion' | 'comentarios' | 'historial';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'detalle', label: 'Detalle', icon: <Info size={15} /> },
  { id: 'actividad', label: 'Actividad', icon: <Activity size={15} /> },
  { id: 'evidencia-inicial', label: 'Evidencia inicial', icon: <FileImage size={15} /> },
  { id: 'evidencia-reparacion', label: 'Evidencia reparación', icon: <Layers size={15} /> },
  { id: 'comentarios', label: 'Comentarios', icon: <MessageSquare size={15} /> },
  { id: 'historial', label: 'Historial', icon: <History size={15} /> },
];

// ─── Helper: Activity Icon ────────────────────────────────────────────────────

function ActivityIcon({ icono, tipo }: { icono: string; tipo: string }) {
  const colorMap: Record<string, string> = {
    CREACION: 'bg-blue-500',
    ASIGNACION: 'bg-indigo-500',
    EVIDENCIA_INICIAL: 'bg-purple-500',
    EVIDENCIA_REPARACION: 'bg-purple-500',
    REPARACION: 'bg-emerald-500',
    SLA_VENCIDO: 'bg-red-500',
    DIAGNOSTICO: 'bg-amber-500',
    VISITA: 'bg-orange-500',
    CONFIRMACION: 'bg-teal-500',
  };

  const bg = colorMap[tipo] ?? 'bg-slate-400';

  const iconNode = (() => {
    switch (icono) {
      case 'plus': return <Plus size={12} className="text-white" />;
      case 'camera': return <Camera size={12} className="text-white" />;
      case 'user': return <User size={12} className="text-white" />;
      case 'wrench': return <Wrench size={12} className="text-white" />;
      case 'search': return <Search size={12} className="text-white" />;
      case 'calendar': return <Calendar size={12} className="text-white" />;
      case 'check': return <Check size={12} className="text-white" />;
      case 'alert': return <AlertTriangle size={12} className="text-white" />;
      case 'send': return <Send size={12} className="text-white" />;
      default: return <Activity size={12} className="text-white" />;
    }
  })();

  return (
    <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
      {iconNode}
    </div>
  );
}

// ─── Helper: Badge ────────────────────────────────────────────────────────────

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

// ─── Helper: Section Label ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
      {children}
    </p>
  );
}

// ─── Helper: Evidence Card ────────────────────────────────────────────────────

function EvidenciaCard({ item }: { item: EvidenciaItem }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {item.tipo === 'FOTO' ? (
          <Camera size={18} className="text-slate-400 flex-shrink-0" />
        ) : (
          <Video size={18} className="text-slate-400 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-slate-700 truncate">{item.nombre}</span>
      </div>
      <p className="text-[11px] text-slate-500">{item.fecha}</p>
      <p className="text-[11px] text-slate-400">Por: {item.subidoPor}</p>
    </div>
  );
}

// ─── Guarantee Progress Bar ───────────────────────────────────────────────────

function GarantiaProgress({ ticket }: { ticket: TicketDetalle }) {
  // Parse dates in DD/MM/YYYY format
  const parseDate = (str: string): Date | null => {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  };

  const entrega = parseDate(ticket.fechaEntrega);
  const vencimiento = parseDate(ticket.fechaVencimientoGarantia);

  let percent = 0;
  if (entrega && vencimiento) {
    const total = vencimiento.getTime() - entrega.getTime();
    const now = new Date().getTime();
    const elapsed = now - entrega.getTime();
    percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  const barColor =
    percent >= 100
      ? 'bg-red-500'
      : percent >= 75
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>Inicio garantía</span>
        <span>{Math.round(percent)}% consumido</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PostventaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const numericId = parseInt((id ?? '').replace('PV-', '')) || 0;

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: ticketDB, isLoading: ticketLoading, refetch: refetchTicket } = useQuery({
    queryKey: ['pv-ticket-detalle', numericId],
    queryFn: async () => {
      if (!numericId) return null;
      const { data, error } = await (supabase as any)
        .from('postventa_tickets')
        .select(`
          id, id_propiedad, id_cuenta_cobranza, id_postventa_categoria_garantia,
          subcategoria, descripcion, canal_recepcion, prioridad, estatus,
          garantia_estatus, fecha_vencimiento_garantia, sla_horas,
          fecha_limite_sla, sla_cumplido, responsable,
          diagnostico, causa_probable, solucion_propuesta,
          descripcion_reparacion, piezas_reemplazadas,
          fecha_reparacion, fecha_creacion, fecha_actualizacion,
          postventa_categorias_garantia(id, nombre)
        `)
        .eq('id', numericId)
        .single();
      if (error) { console.error('Error fetching ticket:', error); return null; }
      return data as any;
    },
    enabled: !!numericId,
  });

  const { data: comentariosDB = [], refetch: refetchComentarios } = useQuery({
    queryKey: ['pv-comentarios', numericId],
    queryFn: async () => {
      if (!numericId) return [];
      const { data } = await (supabase as any)
        .from('postventa_comentarios')
        .select('id, comentario, tipo, creado_por, fecha_creacion')
        .eq('id_postventa_ticket', numericId)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!numericId,
  });

  const { data: actividadDB = [], refetch: refetchActividad } = useQuery({
    queryKey: ['pv-actividad', numericId],
    queryFn: async () => {
      if (!numericId) return [];
      const { data } = await (supabase as any)
        .from('postventa_log_actividades')
        .select('id, tipo_evento, descripcion, creado_por, fecha_creacion')
        .eq('id_postventa_ticket', numericId)
        .order('fecha_creacion', { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!numericId,
  });

  const { data: evidenciasDB = [], refetch: refetchEvidencias } = useQuery({
    queryKey: ['pv-evidencias', numericId],
    queryFn: async () => {
      if (!numericId) return [];
      const { data } = await (supabase as any)
        .from('postventa_evidencias')
        .select('id, tipo_evidencia, tipo_archivo, url, nombre, subido_por, fecha_creacion')
        .eq('id_postventa_ticket', numericId)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!numericId,
  });

  // ── Local state ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabId>('detalle');
  const [diagnostico, setDiagnostico] = useState('');
  const [causaProbable, setCausaProbable] = useState('');
  const [solucionPropuesta, setSolucionPropuesta] = useState('');
  const [descReparacion, setDescReparacion] = useState('');
  const [piezas, setPiezas] = useState('');
  const [fechaReparacion, setFechaReparacion] = useState('');
  const [evidReparacionFiles, setEvidreparacionFiles] = useState<File[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [tipoComentario, setTipoComentario] = useState<'INTERNO' | 'CLIENTE' | 'PROVEEDOR'>('CLIENTE');
  const fileInputInicialRef = useRef<HTMLInputElement>(null);
  const fileInputReparacionRef = useRef<HTMLInputElement>(null);

  // ── Sync editable fields from DB ─────────────────────────────────────────────

  useEffect(() => {
    if (ticketDB) {
      setDiagnostico(ticketDB.diagnostico ?? '');
      setCausaProbable(ticketDB.causa_probable ?? '');
      setSolucionPropuesta(ticketDB.solucion_propuesta ?? '');
      setDescReparacion(ticketDB.descripcion_reparacion ?? '');
      setPiezas(ticketDB.piezas_reemplazadas ?? '');
      setFechaReparacion(ticketDB.fecha_reparacion ?? '');
    }
  }, [ticketDB]);

  // ── Loading / Not Found ──────────────────────────────────────────────────────

  if (ticketLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Cargando ticket…</span>
        </div>
      </div>
    );
  }

  if (!ticketDB) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-slate-600 text-sm font-medium">Ticket {id} no encontrado</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">
          Volver al dashboard
        </button>
      </div>
    );
  }

  // ── Derived from DB ──────────────────────────────────────────────────────────

  const ahora = new Date();
  const limiteSla = ticketDB.fecha_limite_sla ? new Date(ticketDB.fecha_limite_sla) : null;
  const slaVencido = limiteSla ? limiteSla < ahora && ticketDB.sla_cumplido !== true : false;
  const slaLabel = limiteSla
    ? (slaVencido ? '⚠ Vencido' : `✓ ${limiteSla.toLocaleDateString('es-MX')}`)
    : '—';

  const evidInicial: EvidenciaItem[] = evidenciasDB
    .filter((e: any) => e.tipo_evidencia === 'INICIAL')
    .map((e: any) => ({
      nombre: e.nombre ?? 'archivo',
      tipo: e.tipo_archivo === 'VIDEO' ? 'VIDEO' : 'FOTO',
      fecha: e.fecha_creacion ? new Date(e.fecha_creacion).toLocaleString('es-MX') : '—',
      subidoPor: e.subido_por ?? '—',
    }));

  const evidReparacion: EvidenciaItem[] = evidenciasDB
    .filter((e: any) => e.tipo_evidencia === 'REPARACION')
    .map((e: any) => ({
      nombre: e.nombre ?? 'archivo',
      tipo: e.tipo_archivo === 'VIDEO' ? 'VIDEO' : 'FOTO',
      fecha: e.fecha_creacion ? new Date(e.fecha_creacion).toLocaleString('es-MX') : '—',
      subidoPor: e.subido_por ?? '—',
    }));

  const actividadMapped: ActividadItem[] = actividadDB.map((a: any) => ({
    tipo: a.tipo_evento ?? 'NOTA',
    descripcion: a.descripcion ?? '',
    fecha: a.fecha_creacion ? new Date(a.fecha_creacion).toLocaleString('es-MX') : '—',
    por: a.creado_por ?? 'Sistema',
    icono: tipoEventoToIcono(a.tipo_evento ?? ''),
  }));

  const comentariosMapped: ComentarioItem[] = comentariosDB.map((c: any) => ({
    texto: c.comentario ?? '',
    tipo: (c.tipo ?? 'INTERNO') as 'INTERNO' | 'CLIENTE' | 'PROVEEDOR',
    fecha: c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleString('es-MX') : '—',
    por: c.creado_por ?? '—',
  }));

  // Build TicketDetalle for render helpers
  const ticket: TicketDetalle = {
    id: `PV-${ticketDB.id}`,
    unidad: '—',
    torre: '—',
    proyecto: '—',
    cliente: '—',
    telefono: '—',
    fechaEntrega: '—',
    fechaCreacion: ticketDB.fecha_creacion
      ? new Date(ticketDB.fecha_creacion).toLocaleString('es-MX') : '—',
    categoria: ticketDB.postventa_categorias_garantia?.nombre ?? '—',
    subcategoria: ticketDB.subcategoria ?? '—',
    descripcion: ticketDB.descripcion ?? '',
    prioridad: ticketDB.prioridad as PrioridadTicket,
    estatus: ticketDB.estatus as EstatusTicket,
    garantiaEstatus: (ticketDB.garantia_estatus ?? 'VIGENTE') as GarantiaEstatus,
    fechaVencimientoGarantia: ticketDB.fecha_vencimiento_garantia
      ? new Date(ticketDB.fecha_vencimiento_garantia + 'T00:00:00').toLocaleDateString('es-MX')
      : '—',
    slaLabel,
    slaVencido,
    responsable: ticketDB.responsable ?? 'Sin asignar',
    proveedor: 'Sin proveedor',
    diagnostico,
    causaProbable,
    solucionPropuesta,
    descripcionReparacion: descReparacion,
    piezasReemplazadas: piezas,
    fechaReparacion: fechaReparacion || null,
    evidenciaInicial: evidInicial,
    evidenciaReparacion: evidReparacion,
    actividad: actividadMapped,
    comentarios: comentariosMapped,
  };

  const canCerrar = evidReparacion.length > 0 && descReparacion.trim().length > 0;
  const canSolicitarConfirmacion = evidReparacion.length > 0 && descReparacion.trim().length > 0;
  const sinProveedor = true; // no id_proveedor in wizard for now

  // ── DB helpers ───────────────────────────────────────────────────────────────

  async function insertLog(tipoEvento: string, descripcionEvento: string) {
    await (supabase as any).from('postventa_log_actividades').insert({
      id_postventa_ticket: numericId,
      tipo_evento: tipoEvento,
      descripcion: descripcionEvento,
      creado_por: profile?.email ?? 'admin',
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGuardarDetalle() {
    const { error } = await (supabase as any)
      .from('postventa_tickets')
      .update({
        diagnostico: diagnostico || null,
        causa_probable: causaProbable || null,
        solucion_propuesta: solucionPropuesta || null,
      })
      .eq('id', numericId);
    if (error) { toast.error(error.message); return; }
    await insertLog('DIAGNOSTICO', 'Diagnóstico / causa / solución propuesta actualizados');
    toast.success('Diagnóstico guardado correctamente');
    refetchTicket();
    refetchActividad();
  }

  async function handleGuardarReparacion() {
    if (!descReparacion.trim()) {
      toast.error('La descripción de reparación es requerida');
      return;
    }
    const { error } = await (supabase as any)
      .from('postventa_tickets')
      .update({
        descripcion_reparacion: descReparacion || null,
        piezas_reemplazadas: piezas || null,
        fecha_reparacion: fechaReparacion || null,
        estatus: 'EN_REPARACION',
      })
      .eq('id', numericId);
    if (error) { toast.error(error.message); return; }
    await insertLog('REPARACION', `Reparación registrada${fechaReparacion ? ` — fecha: ${fechaReparacion}` : ''}`);
    toast.success('Evidencia de reparación guardada correctamente');
    refetchTicket();
    refetchActividad();
  }

  async function handleEnviarComentario() {
    if (!nuevoComentario.trim()) {
      toast.error('Escribe un comentario antes de enviar');
      return;
    }
    const { error } = await (supabase as any).from('postventa_comentarios').insert({
      id_postventa_ticket: numericId,
      comentario: nuevoComentario.trim(),
      tipo: tipoComentario,
      creado_por: profile?.email ?? 'admin',
    });
    if (error) { toast.error(error.message); return; }
    await insertLog('NOTA', `Comentario ${tipoComentario.toLowerCase()} agregado`);
    setNuevoComentario('');
    toast.success('Comentario enviado');
    refetchComentarios();
    refetchActividad();
  }

  async function handleCerrarTicket() {
    if (!canCerrar) return;
    const { error } = await (supabase as any)
      .from('postventa_tickets')
      .update({ estatus: 'CERRADO', sla_cumplido: !slaVencido })
      .eq('id', numericId);
    if (error) { toast.error(error.message); return; }
    await insertLog('CIERRE', 'Ticket cerrado');
    toast.success('Ticket cerrado exitosamente');
    refetchTicket();
    refetchActividad();
  }

  async function handleSolicitarConfirmacion() {
    const { error } = await (supabase as any)
      .from('postventa_tickets')
      .update({ estatus: 'PENDIENTE_CLIENTE' })
      .eq('id', numericId);
    if (error) { toast.error(error.message); return; }
    await insertLog('CONFIRMACION_CLIENTE', 'Solicitud de confirmación enviada al cliente');
    toast.success('Solicitud de confirmación enviada al cliente');
    refetchTicket();
    refetchActividad();
  }

  function handleSubirEvidenciaInicial(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // TODO: upload to Supabase Storage + INSERT postventa_evidencias
    toast.info(`${files.length} archivo(s) seleccionados. Subida a Storage pendiente de implementar.`);
    if (fileInputInicialRef.current) fileInputInicialRef.current.value = '';
  }

  function handleSubirEvidenciaReparacion(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setEvidreparacionFiles((prev) => [...prev, ...files]);
    // TODO: upload to Supabase Storage + INSERT postventa_evidencias
    toast.info(`${files.length} archivo(s) seleccionados. Subida a Storage pendiente de implementar.`);
    if (fileInputReparacionRef.current) fileInputReparacionRef.current.value = '';
  }

  function handleEscalar() {
    toast.success('Ticket escalado al supervisor');
  }

  function handleContactarCliente() {
    toast.success('Abriendo comunicación con el cliente');
  }

  function handleAsignarProveedor() {
    toast.success('Abriendo selector de proveedor');
  }

  // ── Render helpers ──

  const estatusMeta = ESTATUS_META[ticket.estatus] ?? ESTATUS_META.NUEVO;
  const prioridadMeta = PRIORIDAD_META[ticket.prioridad] ?? PRIORIDAD_META.MEDIA;
  const garantiaMeta = GARANTIA_META[ticket.garantiaEstatus] ?? GARANTIA_META.VIGENTE;

  function renderCommentBadge(tipo: ComentarioItem['tipo']) {
    switch (tipo) {
      case 'CLIENTE':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Para cliente</Badge>;
      case 'INTERNO':
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Interno</Badge>;
      case 'PROVEEDOR':
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Proveedor</Badge>;
    }
  }

  // ── Tab content renderers ──

  function renderDetalle() {
    return (
      <div className="space-y-4">
        {/* Descripcion del problema */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Descripción del problema</h3>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ticket.descripcion}</p>
        </div>

        {/* Diagnostico */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Diagnóstico interno</h3>
          <textarea
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-slate-300"
            rows={3}
            placeholder="Ingresa el diagnóstico técnico..."
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
          />
        </div>

        {/* Causa probable */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Causa probable</h3>
          <textarea
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-slate-300"
            rows={3}
            placeholder="Describe la causa probable del problema..."
            value={causaProbable}
            onChange={(e) => setCausaProbable(e.target.value)}
          />
        </div>

        {/* Solucion propuesta */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Solución propuesta</h3>
          <textarea
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-slate-300"
            rows={3}
            placeholder="Describe la solución propuesta..."
            value={solucionPropuesta}
            onChange={(e) => setSolucionPropuesta(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGuardarDetalle}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    );
  }

  function renderTimelineItems(items: ActividadItem[]) {
    return (
      <div className="relative">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-3 pb-5 relative">
            {/* Vertical line */}
            {idx < items.length - 1 && (
              <div className="absolute left-3 top-6 bottom-0 w-px bg-slate-200" />
            )}
            <ActivityIcon icono={item.icono} tipo={item.tipo} />
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-medium text-slate-700 leading-snug">{item.descripcion}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.fecha} &middot; {item.por}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderActividad() {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Actividad reciente</h3>
        {ticket.actividad.length === 0 ? (
          <p className="text-sm text-slate-400">Sin actividad registrada.</p>
        ) : (
          renderTimelineItems(ticket.actividad)
        )}
      </div>
    );
  }

  function renderEvidenciaInicial() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {evidInicial.length} archivo(s) de evidencia inicial
          </span>
          <button
            onClick={() => fileInputInicialRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} />
            Agregar evidencia
          </button>
          <input
            ref={fileInputInicialRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleSubirEvidenciaInicial}
          />
        </div>

        {evidInicial.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
            <Camera size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Sin evidencia inicial cargada</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {evidInicial.map((ev, idx) => (
              <EvidenciaCard key={idx} item={ev} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderEvidenciaReparacion() {
    return (
      <div className="space-y-5">
        {/* Evidence grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">
              {evidReparacion.length} archivo(s) de evidencia de reparación
            </span>
          </div>

          {evidReparacion.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Este ticket no puede cerrarse sin evidencia de reparación
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {evidReparacion.map((ev, idx) => (
                <EvidenciaCard key={idx} item={ev} />
              ))}
            </div>
          )}
        </div>

        {/* Repair form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Registrar reparación</h3>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descripción de reparación <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-slate-300"
              rows={3}
              placeholder="Describe detalladamente la reparación realizada..."
              value={descReparacion}
              onChange={(e) => setDescReparacion(e.target.value)}
            />
          </div>

          {/* Piezas reemplazadas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Piezas reemplazadas
            </label>
            <input
              type="text"
              className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-slate-300"
              placeholder="Ej: Termopila, válvula de gas..."
              value={piezas}
              onChange={(e) => setPiezas(e.target.value)}
            />
          </div>

          {/* Proveedor (readonly) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Proveedor que realizó la reparación
            </label>
            <input
              type="text"
              readOnly
              className="w-full text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-not-allowed"
              value={ticket.proveedor}
            />
          </div>

          {/* Fecha reparacion */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fecha de reparación
            </label>
            <input
              type="date"
              className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              value={fechaReparacion}
              onChange={(e) => setFechaReparacion(e.target.value)}
            />
          </div>

          {/* Upload area */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Evidencia fotográfica / video
            </label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              onClick={() => fileInputReparacionRef.current?.click()}
            >
              <Upload size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">
                Haz clic para seleccionar archivos o arrastra aquí
              </p>
              <p className="text-xs text-slate-300 mt-1">Fotos y videos (JPG, PNG, MP4)</p>
            </div>
            <input
              ref={fileInputReparacionRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleSubirEvidenciaReparacion}
            />
            {evidReparacionFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {evidReparacionFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <FileImage size={12} />
                    <span>{f.name}</span>
                    <button
                      onClick={() => setEvidreparacionFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-auto text-slate-400 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGuardarReparacion}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Guardar evidencia de reparación
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderComentarios() {
    return (
      <div className="space-y-4">
        {/* Existing comments */}
        {comentariosMapped.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <MessageSquare size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Sin comentarios aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comentariosMapped.map((c, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  {renderCommentBadge(c.tipo)}
                  <span className="text-xs font-medium text-slate-600">{c.por}</span>
                  <span className="text-xs text-slate-400 ml-auto">{c.fecha}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{c.texto}</p>
              </div>
            ))}
          </div>
        )}

        {/* New comment form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Nuevo comentario</h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de comentario</label>
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={tipoComentario}
              onChange={(e) => setTipoComentario(e.target.value as 'INTERNO' | 'CLIENTE' | 'PROVEEDOR')}
            >
              <option value="INTERNO">Interno (solo equipo)</option>
              <option value="CLIENTE">Para el cliente</option>
              <option value="PROVEEDOR">Para el proveedor</option>
            </select>
          </div>

          <textarea
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-slate-300"
            rows={3}
            placeholder="Escribe tu comentario..."
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
          />

          <div className="flex justify-end">
            <button
              onClick={handleEnviarComentario}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send size={14} />
              Enviar comentario
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderHistorial() {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Historial completo</h3>
        {ticket.actividad.length === 0 ? (
          <p className="text-sm text-slate-400">Sin eventos registrados.</p>
        ) : (
          <div className="relative">
            {ticket.actividad.map((item, idx) => (
              <div key={idx} className="flex gap-3 pb-5 relative">
                {idx < ticket.actividad.length - 1 && (
                  <div className="absolute left-3 top-6 bottom-0 w-px bg-slate-200" />
                )}
                <ActivityIcon icono={item.icono} tipo={item.tipo} />
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 leading-snug">{item.descripcion}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                      {item.tipo.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.fecha} &middot; por <span className="font-medium">{item.por}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'detalle': return renderDetalle();
      case 'actividad': return renderActividad();
      case 'evidencia-inicial': return renderEvidenciaInicial();
      case 'evidencia-reparacion': return renderEvidenciaReparacion();
      case 'comentarios': return renderComentarios();
      case 'historial': return renderHistorial();
    }
  }

  // ── Main render ──

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-start gap-4 px-6 py-3">
          {/* Left: back + title + badges */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(-1)}
              className="mt-0.5 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors flex-shrink-0"
              aria-label="Volver"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800">{ticket.id}</h1>
                <Badge className={prioridadMeta.className}>{prioridadMeta.label}</Badge>
                <Badge className={estatusMeta.className}>{estatusMeta.label}</Badge>
                {ticket.slaVencido && (
                  <Badge className="bg-red-50 text-red-700 border-red-200">
                    <AlertTriangle size={10} className="mr-1" /> SLA vencido
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {ticket.categoria} &middot; {ticket.subcategoria} &middot; Unidad {ticket.unidad}{' '}
                {ticket.torre}
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0 pt-0.5">
            <button
              onClick={handleContactarCliente}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Phone size={14} />
              Contactar cliente
            </button>

            {sinProveedor && (
              <button
                onClick={handleAsignarProveedor}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <UserPlus size={14} />
                Asignar proveedor
              </button>
            )}

            <button
              onClick={() => fileInputInicialRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Upload size={14} />
              Subir evidencia
            </button>

            <button
              onClick={handleEscalar}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
            >
              <ArrowUp size={14} />
              Escalar
            </button>

            {canSolicitarConfirmacion && (
              <button
                onClick={handleSolicitarConfirmacion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send size={14} />
                Solicitar confirmación
              </button>
            )}

            <button
              onClick={handleCerrarTicket}
              disabled={!canCerrar}
              title={
                !canCerrar
                  ? 'Se requiere evidencia de reparación y descripción para cerrar'
                  : 'Cerrar ticket'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                canCerrar
                  ? 'bg-slate-800 text-white hover:bg-slate-900'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <X size={14} />
              Cerrar ticket
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-5">
          {/* 1. Unidad y cliente */}
          <div>
            <SectionLabel>Unidad y cliente</SectionLabel>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Unidad {ticket.unidad} &mdash; {ticket.torre}
              </p>
              <p className="text-xs text-slate-500">Proyecto: {ticket.proyecto}</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{ticket.cliente}</p>
              <a
                href={`tel:${ticket.telefono.replace(/\D/g, '')}`}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                <Phone size={13} />
                {ticket.telefono}
              </a>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 2. Fechas */}
          <div>
            <SectionLabel>Fechas</SectionLabel>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Entrega</span>
                <span className="text-slate-700 font-medium">{ticket.fechaEntrega}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket creado</span>
                <span className="text-slate-700 font-medium">{ticket.fechaCreacion}</span>
              </div>
              {ticket.fechaReparacion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reparación</span>
                  <span className="text-slate-700 font-medium">{ticket.fechaReparacion}</span>
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 3. Garantia */}
          <div>
            <SectionLabel>Garantía</SectionLabel>
            <Badge className={garantiaMeta.className}>{garantiaMeta.label}</Badge>
            <p className="text-xs text-slate-500 mt-1.5">
              Vence: <span className="font-medium text-slate-700">{ticket.fechaVencimientoGarantia}</span>
            </p>
            <GarantiaProgress ticket={ticket} />
          </div>

          <hr className="border-slate-100" />

          {/* 4. SLA */}
          <div>
            <SectionLabel>SLA</SectionLabel>
            <div className="flex items-center gap-2">
              <Clock size={14} className={ticket.slaVencido ? 'text-red-500' : 'text-slate-400'} />
              <span className="text-sm font-medium text-slate-700">{ticket.slaLabel}</span>
              {ticket.slaVencido ? (
                <Badge className="bg-red-50 text-red-700 border-red-200">Vencido</Badge>
              ) : (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">En tiempo</Badge>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 5. Asignacion */}
          <div>
            <SectionLabel>Asignación</SectionLabel>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <User size={13} className="text-slate-400 flex-shrink-0" />
                <span>{ticket.responsable}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Wrench size={13} className="text-slate-400 flex-shrink-0" />
                <span>{ticket.proveedor}</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 6. Ticket info */}
          <div>
            <SectionLabel>Información del ticket</SectionLabel>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Canal</span>
                <span className="text-slate-700 font-medium">
                  {ticketDB.canal_recepcion?.replace('_', ' ').replace('_', ' ') ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Prioridad</span>
                <Badge className={prioridadMeta.className}>{prioridadMeta.label}</Badge>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Right content ── */}
        <main className="flex-1 overflow-y-auto">
          {/* Tab bar */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6">{renderTabContent()}</div>
        </main>
      </div>
    </div>
  );
}
