import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CheckCircle2, AlertTriangle, Clock, X, Calendar, Home,
  Camera, FileText, Download, Plus, RotateCcw, ChevronRight,
  User, Building2, CalendarDays, MapPin, Wrench, Star,
  ListChecks, ClipboardCheck, Package, Edit2, ChevronDown,
  ChevronUp, ZoomIn, Loader2, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstatusItem = 'COMPLETADO' | 'PENDIENTE' | 'CON_OBSERVACION' | 'NO_APLICA';
type PrioridadObs = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

interface ChecklistItem { id: string; nombre: string; estatus: EstatusItem; observacion?: string; }

interface ChecklistCategoria {
  id: string; nombre: string; orden: number;
  responsable: string; cargo: string; fechaVoBo: string;
  total: number; completos: number;
  estatus: 'COMPLETADO' | 'PENDIENTE' | 'CON_OBSERVACION';
  observacionGeneral?: string;
  evidencias: number;
  items: ChecklistItem[];
}

interface Observacion {
  id: string; titulo: string; categoria: string;
  prioridad: PrioridadObs; estatus: 'ABIERTA' | 'EN_ATENCION' | 'RESUELTA';
  descripcion: string; evidencias: number;
  registradoPor: string; fecha: string;
}

interface EntregaDetalle {
  id: string; unidad: string; torre: string; proyecto: string;
  cliente: string; modelo: string; area: string;
  estatus: string; fechaProgramada: string; fechaEntrega: string | null;
  entregadoPor: string; cargo: string;
  checklistPct: number; daikuEstatus: string; actaEstatus: string;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_UNIDADES: Record<string, EntregaDetalle> = {
  '1': { id: '1', unidad: '305B', torre: 'Torre B', proyecto: 'Bottura', cliente: 'Jorge Acosta',
         modelo: 'GALA', area: '90.50', estatus: 'ENTREGADA',
         fechaProgramada: '21/05/2024 · 10:00 AM', fechaEntrega: '21/05/2024',
         entregadoPor: 'Luis García', cargo: 'Coordinador de Entregas',
         checklistPct: 100, daikuEstatus: 'COMPLETADO', actaEstatus: 'FIRMADA' },
  '2': { id: '2', unidad: 'A-404', torre: 'Torre A', proyecto: 'Bottura', cliente: 'Marta Ramírez',
         modelo: 'GALA', area: '87.20', estatus: 'PROGRAMADA',
         fechaProgramada: '22/05/2024 · 10:00 AM', fechaEntrega: null,
         entregadoPor: 'Luis García', cargo: 'Coordinador de Entregas',
         checklistPct: 100, daikuEstatus: 'PENDIENTE', actaEstatus: 'PENDIENTE' },
  '3': { id: '3', unidad: 'B-1104', torre: 'Torre B', proyecto: 'Bottura', cliente: 'Ernesto Gómez',
         modelo: 'MARGOT', area: '95.00', estatus: 'EN_PROCESO',
         fechaProgramada: '22/05/2024 · 12:00 PM', fechaEntrega: null,
         entregadoPor: 'Luis García', cargo: 'Coordinador de Entregas',
         checklistPct: 80, daikuEstatus: 'EN_INSTALACION', actaEstatus: 'PENDIENTE' },
};

const DEMO_CHECKLIST: ChecklistCategoria[] = [
  { id: 'c1', nombre: 'Acabados', orden: 1, responsable: 'Luis García', cargo: 'Supervisor Acabados',
    fechaVoBo: '18/05/2024 · 05:42 PM', total: 12, completos: 12, estatus: 'COMPLETADO', evidencias: 12,
    observacionGeneral: 'Todos los acabados en correcto estado.',
    items: [
      { id: 'i1', nombre: 'Pintura interior', estatus: 'COMPLETADO' },
      { id: 'i2', nombre: 'Carpintería', estatus: 'COMPLETADO' },
      { id: 'i3', nombre: 'Cancelería (ventanas)', estatus: 'COMPLETADO' },
      { id: 'i4', nombre: 'Pisos y recubrimientos', estatus: 'COMPLETADO' },
      { id: 'i5', nombre: 'Plafones', estatus: 'COMPLETADO' },
      { id: 'i6', nombre: 'Sellos y juntas', estatus: 'COMPLETADO' },
    ] },
  { id: 'c2', nombre: 'Instalación Eléctrica', orden: 2, responsable: 'Carlos Méndez', cargo: 'Ing. Eléctrico',
    fechaVoBo: '18/05/2024 · 04:15 PM', total: 8, completos: 8, estatus: 'COMPLETADO', evidencias: 8,
    observacionGeneral: 'Todo en correcto funcionamiento.',
    items: [
      { id: 'i7', nombre: 'Tablero eléctrico', estatus: 'COMPLETADO' },
      { id: 'i8', nombre: 'Contactos', estatus: 'COMPLETADO' },
      { id: 'i9', nombre: 'Apagadores', estatus: 'COMPLETADO' },
      { id: 'i10', nombre: 'Luminarias', estatus: 'COMPLETADO' },
      { id: 'i11', nombre: 'Pruebas de voltaje', estatus: 'COMPLETADO' },
      { id: 'i12', nombre: 'Tierra física', estatus: 'COMPLETADO' },
      { id: 'i13', nombre: 'Interruptores diferencial', estatus: 'COMPLETADO' },
      { id: 'i14', nombre: 'Funcionamiento general', estatus: 'COMPLETADO' },
    ] },
  { id: 'c3', nombre: 'Instalación Hidráulica', orden: 3, responsable: 'Javier Ruiz', cargo: 'Ing. Hidráulico',
    fechaVoBo: '18/05/2024 · 03:50 PM', total: 6, completos: 6, estatus: 'COMPLETADO', evidencias: 6,
    observacionGeneral: 'Presión correcta, sin fugas.',
    items: [
      { id: 'i15', nombre: 'Presión de agua', estatus: 'COMPLETADO' },
      { id: 'i16', nombre: 'Llaves y mezcladores', estatus: 'COMPLETADO' },
      { id: 'i17', nombre: 'Lavabos', estatus: 'COMPLETADO' },
      { id: 'i18', nombre: 'Tarja de cocina', estatus: 'COMPLETADO' },
      { id: 'i19', nombre: 'Ausencia de fugas', estatus: 'COMPLETADO' },
      { id: 'i20', nombre: 'Regaderas', estatus: 'COMPLETADO' },
    ] },
  { id: 'c4', nombre: 'Instalación Sanitaria', orden: 4, responsable: 'Javier Ruiz', cargo: 'Ing. Sanitario',
    fechaVoBo: '18/05/2024 · 03:55 PM', total: 6, completos: 6, estatus: 'COMPLETADO', evidencias: 4,
    items: [
      { id: 'i21', nombre: 'WC / inodoros', estatus: 'COMPLETADO' },
      { id: 'i22', nombre: 'Drenajes', estatus: 'COMPLETADO' },
      { id: 'i23', nombre: 'Coladeras', estatus: 'COMPLETADO' },
      { id: 'i24', nombre: 'Prueba de descarga', estatus: 'COMPLETADO' },
      { id: 'i25', nombre: 'Regaderas (drenaje)', estatus: 'COMPLETADO' },
      { id: 'i26', nombre: 'Lavabos (drenaje)', estatus: 'COMPLETADO' },
    ] },
  { id: 'c5', nombre: 'HVAC / Aire Acondicionado', orden: 5, responsable: 'Miguel Torres', cargo: 'Técnico HVAC',
    fechaVoBo: '18/05/2024 · 04:30 PM', total: 6, completos: 6, estatus: 'COMPLETADO', evidencias: 5,
    items: [
      { id: 'i27', nombre: 'Equipo instalado', estatus: 'COMPLETADO' },
      { id: 'i28', nombre: 'Encendido', estatus: 'COMPLETADO' },
      { id: 'i29', nombre: 'Enfriamiento correcto', estatus: 'COMPLETADO' },
      { id: 'i30', nombre: 'Control remoto', estatus: 'COMPLETADO' },
      { id: 'i31', nombre: 'Drenaje de condensado', estatus: 'COMPLETADO' },
      { id: 'i32', nombre: 'Funcionamiento general', estatus: 'COMPLETADO' },
    ] },
  { id: 'c6', nombre: 'Calentador / Boiler', orden: 6, responsable: 'Miguel Torres', cargo: 'Técnico HVAC',
    fechaVoBo: '18/05/2024 · 04:35 PM', total: 4, completos: 4, estatus: 'COMPLETADO', evidencias: 3,
    items: [
      { id: 'i33', nombre: 'Equipo instalado', estatus: 'COMPLETADO' },
      { id: 'i34', nombre: 'Encendido y agua caliente', estatus: 'COMPLETADO' },
      { id: 'i35', nombre: 'Ausencia de fugas / válvulas', estatus: 'COMPLETADO' },
      { id: 'i36', nombre: 'Seguridad y presión', estatus: 'COMPLETADO' },
    ] },
  { id: 'c7', nombre: 'Equipamiento', orden: 7, responsable: 'Luis García', cargo: 'Coordinador de Entregas',
    fechaVoBo: '18/05/2024 · 04:50 PM', total: 4, completos: 4, estatus: 'COMPLETADO', evidencias: 4,
    items: [
      { id: 'i37', nombre: 'Electrodomésticos', estatus: 'COMPLETADO' },
      { id: 'i38', nombre: 'Iluminación decorativa', estatus: 'COMPLETADO' },
      { id: 'i39', nombre: 'Chapa digital', estatus: 'COMPLETADO' },
      { id: 'i40', nombre: 'Funcionamiento de chapa', estatus: 'COMPLETADO' },
    ] },
  { id: 'c8', nombre: 'Limpieza', orden: 8, responsable: 'Ana Martínez', cargo: 'Supervisora Limpieza',
    fechaVoBo: '18/05/2024 · 05:00 PM', total: 2, completos: 2, estatus: 'COMPLETADO', evidencias: 2,
    items: [
      { id: 'i41', nombre: 'Limpieza fina y cristales', estatus: 'COMPLETADO' },
      { id: 'i42', nombre: 'Retiro de residuos', estatus: 'COMPLETADO' },
    ] },
];

const DEMO_OBSERVACIONES: Observacion[] = [
  { id: 'o1', titulo: 'Puerta de clóset no cierra correctamente', categoria: 'Carpintería',
    prioridad: 'MEDIA', estatus: 'ABIERTA',
    descripcion: 'La puerta del clóset de la recámara principal se atora al cerrar.',
    evidencias: 2, registradoPor: 'Jorge Acosta', fecha: '21/05/2024 · 10:35 AM' },
  { id: 'o2', titulo: 'Detalle en pintura en muro de sala', categoria: 'Acabados',
    prioridad: 'BAJA', estatus: 'ABIERTA',
    descripcion: 'Pequeña imperfección en pintura en muro lateral izquierdo de la sala.',
    evidencias: 1, registradoPor: 'Jorge Acosta', fecha: '21/05/2024 · 10:42 AM' },
];

const DOCUMENTOS_ENTREGA = [
  { id: 'd1', nombre: 'Acta de entrega',          icono: '📄', generado: true },
  { id: 'd2', nombre: 'Checklist técnico PDF',    icono: '✅', generado: true },
  { id: 'd3', nombre: 'Reporte fotográfico',      icono: '📷', generado: true },
  { id: 'd4', nombre: 'Manual del propietario',   icono: '📘', generado: true },
  { id: 'd5', nombre: 'Garantías',                icono: '🛡️', generado: true },
  { id: 'd6', nombre: 'Instructivo chapa digital',icono: '🔑', generado: true },
  { id: 'd7', nombre: 'Manual de boiler',         icono: '🔥', generado: true },
  { id: 'd8', nombre: 'Manual de A/C',            icono: '❄️', generado: true },
  { id: 'd9', nombre: 'Documentos CFE',           icono: '⚡', generado: false },
  { id: 'd10', nombre: 'Documentos SIAPA',        icono: '💧', generado: false },
  { id: 'd11', nombre: 'Reglamento',              icono: '📋', generado: true },
  { id: 'd12', nombre: 'Evidencias ZIP',          icono: '🗜️', generado: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORIDAD_META: Record<PrioridadObs, { label: string; cls: string }> = {
  CRITICA: { label: 'Crítica', cls: 'bg-red-50 text-red-700 border border-red-200' },
  ALTA:    { label: 'Alta',    cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  MEDIA:   { label: 'Media',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  BAJA:    { label: 'Baja',    cls: 'bg-slate-100 text-slate-600' },
};

const ITEM_ESTATUS_CLS: Record<EstatusItem, string> = {
  COMPLETADO:     'text-emerald-600',
  PENDIENTE:      'text-amber-600',
  CON_OBSERVACION:'text-orange-600',
  NO_APLICA:      'text-slate-400',
};

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const end = () => {
    drawing.current = false;
    const c = canvasRef.current;
    if (c && hasSignature) onChange(c.toDataURL());
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={440} height={140}
        className="w-full border-2 border-dashed border-slate-200 rounded-2xl bg-white cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Dibuja tu firma en el área de arriba</p>
        <button onClick={clear} className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Limpiar
        </button>
      </div>
    </div>
  );
}

// ─── Paquete Muebles Checklist ────────────────────────────────────────────────

const MUEBLES_CHECKLIST = [
  { zona: 'Sala', color: 'bg-blue-50 text-blue-700', items: [
    { nombre: 'Sofá principal (3 plazas)',    incluido: true },
    { nombre: 'Sillones laterales (2 pzas)', incluido: true },
    { nombre: 'Mesa de centro',               incluido: true },
    { nombre: 'Mesa auxiliar / consola',      incluido: false },
    { nombre: 'Lámpara de piso',              incluido: false },
  ]},
  { zona: 'Comedor', color: 'bg-violet-50 text-violet-700', items: [
    { nombre: 'Mesa de comedor',              incluido: true },
    { nombre: 'Sillas (6 pzas)',              incluido: true },
    { nombre: 'Mueble auxiliar / trinchador', incluido: false },
  ]},
  { zona: 'Recámara Principal', color: 'bg-emerald-50 text-emerald-700', items: [
    { nombre: 'Base de cama king / queen',    incluido: true },
    { nombre: 'Colchón',                      incluido: true },
    { nombre: 'Buró (2 pzas)',                incluido: true },
    { nombre: 'Cómoda / tocador',             incluido: true },
    { nombre: 'Espejo de cuerpo completo',    incluido: false },
  ]},
  { zona: 'Recámara 2', color: 'bg-teal-50 text-teal-700', items: [
    { nombre: 'Base de cama individual / matrimonial', incluido: true },
    { nombre: 'Colchón',                               incluido: true },
    { nombre: 'Buró (1 pza)',                          incluido: true },
  ]},
  { zona: 'Cocina / Electrodomésticos', color: 'bg-amber-50 text-amber-700', items: [
    { nombre: 'Refrigerador',           incluido: true },
    { nombre: 'Estufa / Horno',         incluido: true },
    { nombre: 'Campana de extracción',  incluido: true },
    { nombre: 'Lavavajillas',           incluido: false },
    { nombre: 'Horno de microondas',    incluido: true },
  ]},
  { zona: 'General', color: 'bg-slate-100 text-slate-700', items: [
    { nombre: 'Lavadora',                             incluido: true },
    { nombre: 'Secadora',                             incluido: false },
    { nombre: 'Cortinas / persianas',                 incluido: true },
    { nombre: 'Escritorio / silla (si aplica)',       incluido: false },
  ]},
] as const;

const MUEBLES_TOTAL    = MUEBLES_CHECKLIST.flatMap(z => z.items as readonly { nombre: string; incluido: boolean }[]).length;
const MUEBLES_INCLUIDOS = MUEBLES_CHECKLIST.flatMap(z => z.items as readonly { nombre: string; incluido: boolean }[]).filter(i => i.incluido).length;

// ─── Main Component ───────────────────────────────────────────────────────────

export function EntregaDetalle() {
  const { id = '1' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'resumen' | 'checklist' | 'muebles' | 'programacion' | 'acta' | 'observaciones' | 'documentos' | 'historial'>('resumen');
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<ChecklistCategoria | null>(DEMO_CHECKLIST[1]);
  const [actaStep, setActaStep] = useState(1);
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaData, setFirmaData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newObsOpen, setNewObsOpen] = useState(false);

  const unidad = DEMO_UNIDADES[id] ?? DEMO_UNIDADES['1'];

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
  };

  const TABS = [
    { id: 'resumen',       label: 'Resumen' },
    { id: 'checklist',     label: 'Checklist' },
    { id: 'muebles',       label: 'Paquete Muebles' },
    { id: 'programacion',  label: 'Programación' },
    { id: 'acta',          label: 'Acta de entrega' },
    { id: 'observaciones', label: `Observaciones${DEMO_OBSERVACIONES.length > 0 ? ` (${DEMO_OBSERVACIONES.length})` : ''}` },
    { id: 'documentos',    label: 'Documentos' },
    { id: 'historial',     label: 'Historial' },
  ] as const;

  const totalItems = DEMO_CHECKLIST.reduce((s, c) => s + c.total, 0);
  const completosItems = DEMO_CHECKLIST.reduce((s, c) => s + c.completos, 0);
  const checklistGlobal = totalItems > 0 ? Math.round((completosItems / totalItems) * 100) : 0;

  const handleFinalizarEntrega = async () => {
    if (!firmaData) { toast.error('La firma del cliente es requerida'); return; }
    if (!firmaNombre.trim()) { toast.error('Ingresa el nombre completo del cliente'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1500));
    setSaving(false);
    toast.success('¡Entrega finalizada correctamente! Se han generado los documentos.');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/40">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <button onClick={() => navigate('/admin/portal-escrituracion/entregas')}
            className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Entregas
          </button>
          <span>/</span>
          <span className="text-slate-600 font-medium">{unidad.unidad} · {unidad.torre}</span>
        </div>

        {/* Unit info */}
        <div className="flex items-start justify-between gap-6 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
              <Building2 className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{unidad.unidad} · {unidad.torre}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  unidad.estatus === 'ENTREGADA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  unidad.estatus === 'PROGRAMADA' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
                  unidad.estatus === 'EN_PROCESO' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  {unidad.estatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span><span className="font-medium text-slate-700">Cliente:</span> {unidad.cliente}</span>
                <span><span className="font-medium text-slate-700">Modelo:</span> {unidad.modelo}</span>
                <span><span className="font-medium text-slate-700">Área:</span> {unidad.area} m²</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-6 shrink-0 text-xs text-slate-500">
            <div>
              <div className="flex items-center gap-1 text-slate-400 mb-0.5"><CalendarDays className="w-3.5 h-3.5" /> Fecha de entrega</div>
              <p className="font-medium text-slate-800">{unidad.fechaProgramada}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-slate-400 mb-0.5"><User className="w-3.5 h-3.5" /> Entregado por</div>
              <p className="font-medium text-slate-800">{unidad.entregadoPor}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveTab('acta')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Ver acta digital
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-0 -mb-px">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── RESUMEN ── */}
        {activeTab === 'resumen' && (
          <div className="space-y-5 max-w-4xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Checklist técnico', value: `${checklistGlobal}%`, sub: `${completosItems}/${totalItems} ítems`, ok: checklistGlobal === 100, icon: ListChecks },
                { label: 'Paquete Muebles', value: unidad.daikuEstatus === 'COMPLETADO' ? 'Completado' : unidad.daikuEstatus === 'NO_APLICA' ? 'No aplica' : 'Pendiente', sub: '', ok: unidad.daikuEstatus !== 'PENDIENTE', icon: Package, tab: 'muebles' as const },
                { label: 'Observaciones', value: `${DEMO_OBSERVACIONES.length} abiertas`, sub: 'Sin obs. críticas', ok: !DEMO_OBSERVACIONES.some(o => o.prioridad === 'CRITICA'), icon: AlertTriangle },
                { label: 'Firmas', value: unidad.actaEstatus === 'FIRMADA' ? 'Firmado' : 'Pendiente', sub: '', ok: unidad.actaEstatus === 'FIRMADA', icon: ClipboardCheck },
              ].map(s => {
                const Icon = s.icon;
                const hasTab = 'tab' in s && s.tab;
                return (
                  <div
                    key={s.label}
                    onClick={hasTab ? () => setActiveTab((s as any).tab) : undefined}
                    className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ${hasTab ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <Icon className={`w-4 h-4 ${s.ok ? 'text-emerald-600' : 'text-amber-600'}`} />
                      </div>
                      {s.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-amber-400" />}
                    </div>
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    {s.sub && <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>}
                    {hasTab && <p className="text-[11px] text-blue-500 mt-1.5 flex items-center gap-0.5">Ver checklist <ChevronRight className="w-3 h-3" /></p>}
                  </div>
                );
              })}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-900 mb-3">Datos de la entrega</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                {[
                  ['Unidad', unidad.unidad], ['Torre', unidad.torre], ['Proyecto', unidad.proyecto],
                  ['Modelo', unidad.modelo], ['Área', `${unidad.area} m²`], ['Cliente', unidad.cliente],
                  ['Fecha programada', unidad.fechaProgramada], ['Entregado por', unidad.entregadoPor], ['Cargo', unidad.cargo],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400 mb-0.5">{l}</p>
                    <p className="text-sm font-medium text-slate-800">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKLIST ── */}
        {activeTab === 'checklist' && (
          <div className="flex gap-5 max-w-[1200px]">
            {/* Table */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-slate-900">Progreso del checklist</p>
                  <button onClick={() => setExpandedCats(expandedCats.length > 0 ? [] : DEMO_CHECKLIST.map(c => c.id))}
                    className="text-xs text-blue-600 hover:underline">{expandedCats.length > 0 ? 'Colapsar todo' : 'Expandir todo'}</button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Completos',       value: completosItems, cls: 'text-emerald-600' },
                    { label: 'Pendientes',       value: totalItems - completosItems, cls: 'text-amber-600' },
                    { label: 'Con observación',  value: 0, cls: 'text-orange-600' },
                    { label: 'No aplica',        value: 0, cls: 'text-slate-400' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-slate-50 rounded-2xl p-3">
                      <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría / Concepto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estatus</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">VoBo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {DEMO_CHECKLIST.map(cat => (
                      <>
                        <tr key={cat.id}
                          onClick={() => { toggleCat(cat.id); setSelectedCat(cat); }}
                          className={`cursor-pointer transition-colors ${selectedCat?.id === cat.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {expandedCats.includes(cat.id)
                                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                              <div>
                                <p className="font-semibold text-slate-900 text-xs">{cat.nombre}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((cat.completos / cat.total) * 100)}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-500">{cat.completos}/{cat.total}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              cat.estatus === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700' :
                              cat.estatus === 'CON_OBSERVACION' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {cat.estatus === 'COMPLETADO' && <CheckCircle2 className="w-3 h-3" />}
                              {cat.estatus === 'COMPLETADO' ? 'Completado' : cat.estatus === 'CON_OBSERVACION' ? 'Con observación' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {cat.estatus === 'COMPLETADO'
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              : <Clock className="w-4 h-4 text-amber-400" />}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-700">{cat.responsable}</p>
                            <p className="text-[10px] text-slate-400">{cat.cargo}</p>
                          </td>
                          <td className="px-4 py-3">
                            <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600">
                              <Camera className="w-3.5 h-3.5" />
                              <span className="font-medium">{cat.evidencias}</span>
                            </button>
                          </td>
                        </tr>
                        {expandedCats.includes(cat.id) && cat.items.map(item => (
                          <tr key={item.id} className="bg-slate-50/60">
                            <td className="pl-12 pr-4 py-2.5" colSpan={5}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${ITEM_ESTATUS_CLS[item.estatus]}`} />
                                  <span className="text-xs text-slate-700">{item.nombre}</span>
                                </div>
                                <span className={`text-[11px] font-medium ${ITEM_ESTATUS_CLS[item.estatus]}`}>
                                  {item.estatus === 'COMPLETADO' ? 'Completado' : item.estatus === 'NO_APLICA' ? 'N/A' : item.estatus === 'CON_OBSERVACION' ? 'Con observación' : 'Pendiente'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VoBo Panel */}
            {selectedCat && (
              <div className="w-[300px] min-w-[300px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden self-start sticky top-0">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Detalle del VoBo</p>
                    <button onClick={() => setSelectedCat(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedCat.nombre}</p>
                    <div className="flex items-center justify-between mt-2 mb-1">
                      <span className="text-xs text-slate-500">Conceptos</span>
                      <span className="text-xs font-semibold text-emerald-600">{selectedCat.completos}/{selectedCat.total} completos</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.round((selectedCat.completos / selectedCat.total) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{selectedCat.responsable}</p>
                        <p className="text-[11px] text-slate-500">{selectedCat.cargo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                      <Clock className="w-3 h-3" /> {selectedCat.fechaVoBo}
                    </div>
                  </div>
                  {selectedCat.observacionGeneral && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Observaciones</p>
                      <p className="text-xs text-slate-700">{selectedCat.observacionGeneral}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Evidencia general</p>
                    <div className="grid grid-cols-4 gap-1">
                      {Array.from({ length: Math.min(selectedCat.evidencias, 4) }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg bg-slate-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                          {i === 3 && selectedCat.evidencias > 4
                            ? <span className="text-xs font-bold text-slate-600">+{selectedCat.evidencias - 3}</span>
                            : <Camera className="w-4 h-4 text-slate-400" />}
                        </div>
                      ))}
                    </div>
                    <button className="mt-2 text-xs text-blue-600 hover:underline">Ver todas las evidencias</button>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Historial de VoBos</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-slate-700">VoBo realizado</p>
                          <p className="text-[10px] text-slate-400">{selectedCat.responsable} · {selectedCat.fechaVoBo}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-600">VoBo solicitado</p>
                          <p className="text-[10px] text-slate-400">Luis García · {selectedCat.fechaVoBo.split('·')[0].trim()} · 03:40 PM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PAQUETE MUEBLES ── */}
        {activeTab === 'muebles' && (
          <div className="max-w-3xl space-y-4">

            {/* Estado general */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
              unidad.daikuEstatus === 'COMPLETADO' ? 'bg-emerald-50 border-emerald-200' :
              unidad.daikuEstatus === 'NO_APLICA'  ? 'bg-slate-50 border-slate-200' :
              'bg-amber-50 border-amber-200'
            }`}>
              <Package className={`w-6 h-6 shrink-0 ${
                unidad.daikuEstatus === 'COMPLETADO' ? 'text-emerald-600' :
                unidad.daikuEstatus === 'NO_APLICA'  ? 'text-slate-400' : 'text-amber-600'
              }`} />
              <div>
                <p className="text-sm font-bold text-slate-900">Paquete Muebles</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {unidad.daikuEstatus === 'COMPLETADO'     && 'Entregado e instalado correctamente.'}
                  {unidad.daikuEstatus === 'NO_APLICA'      && 'Esta unidad no incluye paquete de muebles.'}
                  {unidad.daikuEstatus === 'PENDIENTE'      && 'Pendiente de entrega.'}
                  {unidad.daikuEstatus === 'EN_INSTALACION' && 'En proceso de instalación.'}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-900">Progreso del paquete</p>
                <span className="text-sm font-bold text-emerald-600">
                  {Math.round((MUEBLES_INCLUIDOS / MUEBLES_TOTAL) * 100)}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round((MUEBLES_INCLUIDOS / MUEBLES_TOTAL) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{MUEBLES_INCLUIDOS} de {MUEBLES_TOTAL} ítems incluidos</p>
            </div>

            {/* Checklist por zona */}
            <div className="space-y-3">
              {MUEBLES_CHECKLIST.map(zona => {
                const incluidos = zona.items.filter(i => i.incluido).length;
                return (
                  <div key={zona.zona} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${zona.color}`}>
                      <p className="text-sm font-bold">{zona.zona}</p>
                      <span className="text-xs font-medium">{incluidos}/{zona.items.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {zona.items.map(item => (
                        <div key={item.nombre} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {item.incluido
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                            }
                            <span className={`text-sm ${item.incluido ? 'text-slate-800' : 'text-slate-400'}`}>
                              {item.nombre}
                            </span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            item.incluido ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {item.incluido ? 'Incluido' : 'No incluido'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Observaciones */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Observaciones del paquete</p>
              <textarea
                rows={3}
                placeholder="Agregar observaciones sobre el paquete de muebles entregado…"
                className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={() => toast.info('Observaciones guardadas')}
                className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                Guardar observación
              </button>
            </div>

          </div>
        )}

        {/* ── PROGRAMACIÓN ── */}
        {activeTab === 'programacion' && (
          <div className="max-w-xl bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-slate-900">Programar entrega</p>
            {[['Fecha', 'date'], ['Hora', 'time'], ['Punto de reunión', 'text'], ['Responsable', 'text'], ['Teléfono', 'tel']].map(([l, t]) => (
              <div key={l}>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                <input type={t} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Observaciones internas</label>
              <textarea rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <button className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              Guardar programación
            </button>
          </div>
        )}

        {/* ── ACTA DE ENTREGA ── */}
        {activeTab === 'acta' && (
          <div className="flex gap-6 max-w-[1100px]">
            {/* Left: Acta */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Steps */}
              <div className="flex items-center gap-0">
                {['Información', 'Checklist', 'Observaciones', 'Firmas', 'Finalizar'].map((s, i) => {
                  const num = i + 1;
                  const done = num < actaStep;
                  const active = num === actaStep;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <button onClick={() => setActaStep(num)} className="flex flex-col items-center gap-1 w-full group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {done ? <CheckCheck className="w-4 h-4" /> : num}
                        </div>
                        <span className={`text-[10px] text-center ${active ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>{s}</span>
                      </button>
                      {i < 4 && <div className={`h-0.5 flex-1 -mt-5 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                    </div>
                  );
                })}
              </div>

              {/* Alert */}
              {checklistGlobal === 100 && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800">
                    <span className="font-semibold">Checklist completado al 100%.</span> La unidad está lista para la entrega.
                  </p>
                </div>
              )}

              {/* Step content */}
              {actaStep === 1 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <p className="text-sm font-bold text-slate-900">Acta de entrega digital</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[['Unidad', unidad.unidad], ['Proyecto', unidad.proyecto], ['Modelo', unidad.modelo], ['Área', `${unidad.area} m²`],
                      ['Cliente', unidad.cliente], ['Fecha y hora', unidad.fechaProgramada],
                      ['Entregado por', unidad.entregadoPor], ['Cargo', unidad.cargo]].map(([l, v]) => (
                      <div key={l} className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{l}</p>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Declaración de conformidad</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Por medio de la presente, el cliente recibe de conformidad la unidad descrita anteriormente, con todas sus instalaciones, equipamiento y accesorios en condiciones funcionales, de acuerdo con el checklist verificado y la información proporcionada por el desarrollador.
                      El cliente acepta la entrega y se compromete a dar el uso adecuado a las instalaciones y equipamiento de la unidad.
                    </p>
                  </div>
                </div>
              )}

              {actaStep === 4 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                  <p className="text-sm font-bold text-slate-900">Firma del cliente</p>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nombre completo del cliente<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="text" value={firmaNombre} onChange={e => setFirmaNombre(e.target.value)}
                      placeholder="Nombre tal como aparece en la identificación"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Firma digital<span className="text-red-500 ml-0.5">*</span></label>
                    <SignatureCanvas onChange={setFirmaData} />
                    {firmaData && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Firma capturada correctamente
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs text-slate-500">
                    <div className="flex justify-between"><span>Fecha y hora de firma</span><span className="font-medium text-slate-700">{new Date().toLocaleString('es-MX')}</span></div>
                    <div className="flex justify-between"><span>IP / Dispositivo</span><span className="font-medium text-slate-700">192.168.1.xxx · Web App</span></div>
                  </div>
                </div>
              )}

              {actaStep === 5 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <p className="text-sm font-bold text-slate-900">Resumen y finalización</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Checklist técnico', ok: checklistGlobal === 100, value: `${checklistGlobal}%` },
                      { label: 'Paquete Muebles', ok: unidad.daikuEstatus !== 'PENDIENTE', value: unidad.daikuEstatus === 'NO_APLICA' ? 'No aplica' : 'Completado' },
                      { label: 'Observaciones', ok: true, value: `${DEMO_OBSERVACIONES.length} abiertas (no críticas)` },
                      { label: 'Firma del cliente', ok: !!firmaData && !!firmaNombre, value: firmaData && firmaNombre ? firmaNombre : 'Pendiente' },
                    ].map(s => (
                      <div key={s.label} className={`flex items-center justify-between p-3 rounded-xl border ${s.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2">
                          {s.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span className="text-sm font-medium text-slate-800">{s.label}</span>
                        </div>
                        <span className={`text-xs font-medium ${s.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Al finalizar: se cambiará el estatus de la unidad a <strong>Entregada</strong>, se generarán los documentos PDF y se activará el módulo de Postventa.</p>
                  <button onClick={handleFinalizarEntrega} disabled={saving || !firmaData || !firmaNombre}
                    className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando…</> : <><CheckCheck className="w-4 h-4" /> Finalizar entrega</>}
                  </button>
                </div>
              )}

              {/* Nav buttons */}
              <div className="flex items-center justify-between">
                <button onClick={() => setActaStep(s => Math.max(1, s - 1))} disabled={actaStep === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Regresar
                </button>
                {actaStep < 5 && (
                  <button onClick={() => setActaStep(s => Math.min(5, s + 1))}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Observations panel */}
            <div className="w-[280px] min-w-[280px] space-y-4 self-start sticky top-0">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Observaciones</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200 mt-1">
                      {DEMO_OBSERVACIONES.length} registradas
                    </span>
                  </div>
                  <button onClick={() => setNewObsOpen(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                    <Plus className="w-3 h-3" /> Nueva
                  </button>
                </div>
                <div className="space-y-3">
                  {DEMO_OBSERVACIONES.map(obs => (
                    <div key={obs.id} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 leading-tight">{obs.titulo}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PRIORIDAD_META[obs.prioridad].cls}`}>{PRIORIDAD_META[obs.prioridad].label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{obs.categoria} · {obs.registradoPor}</p>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{obs.descripcion}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Camera className="w-3 h-3" /> {obs.evidencias} fotos
                        <span>·</span> {obs.fecha}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OBSERVACIONES ── */}
        {activeTab === 'observaciones' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{DEMO_OBSERVACIONES.length} observaciones registradas</p>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nueva observación
              </button>
            </div>
            {DEMO_OBSERVACIONES.map(obs => (
              <div key={obs.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-slate-900">{obs.titulo}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORIDAD_META[obs.prioridad].cls}`}>{PRIORIDAD_META[obs.prioridad].label}</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">{obs.estatus}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div><span className="text-slate-400">Categoría</span><p className="font-medium text-slate-700 mt-0.5">{obs.categoria}</p></div>
                  <div><span className="text-slate-400">Registrado por</span><p className="font-medium text-slate-700 mt-0.5">{obs.registradoPor}</p></div>
                </div>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{obs.descripcion}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> {obs.evidencias} evidencias</div>
                  <span>{obs.fecha}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DOCUMENTOS ── */}
        {activeTab === 'documentos' && (
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-bold text-slate-900">Documentos liberados al cliente</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOCUMENTOS_ENTREGA.map(doc => (
                <div key={doc.id} className={`flex items-center justify-between bg-white border rounded-2xl p-4 shadow-sm ${doc.generado ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{doc.icono}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.generado ? 'Disponible' : 'Pendiente de generación'}</p>
                    </div>
                  </div>
                  {doc.generado && (
                    <button onClick={() => toast.info(`Descargando ${doc.nombre}…`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {activeTab === 'historial' && (
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-bold text-slate-900">Bitácora de eventos</p>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {[
                { icon: CheckCheck, color: 'text-emerald-600 bg-emerald-50', label: 'Entrega finalizada', desc: 'Acta firmada por Jorge Acosta', fecha: '21/05/2024 · 11:15 AM', user: 'Luis García' },
                { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'Acta generada', desc: 'Acta de entrega digital generada', fecha: '21/05/2024 · 11:00 AM', user: 'Sistema' },
                { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', label: 'Checklist completado', desc: 'Todos los conceptos verificados — 100%', fecha: '18/05/2024 · 05:42 PM', user: 'Luis García' },
                { icon: Package, color: 'text-teal-600 bg-teal-50', label: 'Paquete Muebles verificado', desc: 'Entrega e instalación de muebles completada y verificada', fecha: '17/05/2024 · 03:30 PM', user: 'Coordinador de Entregas' },
                { icon: Calendar, color: 'text-violet-600 bg-violet-50', label: 'Entrega programada', desc: `Cita agendada para ${unidad.fechaProgramada}`, fecha: '15/05/2024 · 09:00 AM', user: 'Luis García' },
                { icon: Home, color: 'text-slate-600 bg-slate-100', label: 'Unidad lista para entrega', desc: 'Estatus actualizado a Listo para entrega', fecha: '14/05/2024 · 04:00 PM', user: 'Sistema' },
              ].map((e, i) => {
                const Icon = e.icon;
                return (
                  <div key={i} className="flex items-start gap-4 p-4 border-b border-slate-50 last:border-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${e.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{e.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{e.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">{e.fecha}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{e.user}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
