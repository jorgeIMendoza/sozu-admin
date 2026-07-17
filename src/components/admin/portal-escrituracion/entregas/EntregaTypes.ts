// Tipos y constantes compartidos del módulo de Entregas.
// Importar desde aquí en todos los componentes del módulo.

export const ESTATUS_CHECKLIST = {
  PENDIENTE:               1,
  CUMPLE:                  2,
  NO_CUMPLE:               3,
  NO_APLICA:               4,
  EN_REPARACION:           5,
  REPARADO_PENDIENTE_VOBO: 6,
  VOBO_APROBADO:           7,
  VOBO_RECHAZADO:          8,
} as const;

export type EstatusEntrega =
  | 'PENDIENTE_PRE_ENTREGA' | 'PRE_ENTREGA_EN_PROCESO' | 'LISTO'
  | 'PROGRAMADA' | 'EN_PROCESO' | 'ENTREGADA' | 'CON_OBSERVACIONES' | 'REPROGRAMADA';

export type PrioridadObs = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

export interface EstatusChecklistRow {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface EntidadER {
  id: number;
  nombre: string;
}

export interface ChecklistItem {
  id: number;
  id_categoria: number;
  nombre: string;
  id_estatus_checklist: number;
  observacion: string | null;
  responsable: string | null;
  id_responsable_er: number | null;
  id_supervisor_er: number | null;
  id_tecnico_er: number | null;
  fecha_revision: string | null;
  fecha_compromiso: string | null;
}

export interface ResponsableEntregas {
  id: number;
  id_entidad_er: number;
  nombre: string;
  es_supervisor: boolean;
  es_tecnico: boolean;
  especialidades: string[];
  activo: boolean;
}

export interface ChecklistCategoria {
  id: number;
  nombre: string;
  tipo_checklist?: string;
  responsable: string | null;
  cargo: string | null;
  fecha_vobo: string | null;
  estatus: string;
  total_items: number;
  items_completos: number;
  items: ChecklistItem[];
}

export interface ObservacionRow {
  id: number;
  descripcion: string;
  estatus: string;
  prioridad: PrioridadObs;
  fecha_creacion: string;
  id_checklist_item: number | null;
}

export interface PageData {
  entrega: {
    id: number;
    id_propiedad: number;
    id_proyecto: number;
    id_cuenta_cobranza: number;
    estatus: string;
    fecha_programada: string | null;
    fecha_entrega: string | null;
    muebles_daiku_estatus: string;
    entregado_por: string | null;
    punto_reunion: string | null;
    telefono_contacto: string | null;
  } | null;
  propiedad: { id: number; numero_propiedad: string | null; id_edificio_modelo: number; id_estatus_disponibilidad: number };
  edificio: { id: number; nombre: string; id_proyecto: number } | null;
  modelo: { id: number; nombre: string } | null;
  proyecto: { id: number; nombre: string } | null;
  cuenta: { id: number; id_propiedad: number } | null;
  clienteNombre: string;
}

export const ESTATUS_META: Record<string, { label: string; cls: string }> = {
  PENDIENTE_PRE_ENTREGA:  { label: 'Pendiente de pre-entrega', cls: 'bg-slate-50 text-slate-600 border border-slate-200' },
  PRE_ENTREGA_EN_PROCESO: { label: 'Pre-entrega en proceso',   cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  LISTO:                  { label: 'Lista p/entrega',           cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  PROGRAMADA:             { label: 'Programada',                cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  EN_PROCESO:             { label: 'En proceso',                cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ENTREGADA:              { label: 'Entregada',                 cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  CON_OBSERVACIONES:      { label: 'Con observaciones',         cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  REPROGRAMADA:           { label: 'Reprogramada',              cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export const ITEM_CLS: Record<number, string> = {
  [ESTATUS_CHECKLIST.CUMPLE]:                  'text-emerald-600',
  [ESTATUS_CHECKLIST.PENDIENTE]:               'text-amber-600',
  [ESTATUS_CHECKLIST.NO_CUMPLE]:               'text-red-500',
  [ESTATUS_CHECKLIST.NO_APLICA]:               'text-slate-400',
  [ESTATUS_CHECKLIST.EN_REPARACION]:           'text-orange-500',
  [ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO]: 'text-blue-500',
  [ESTATUS_CHECKLIST.VOBO_APROBADO]:           'text-emerald-700',
  [ESTATUS_CHECKLIST.VOBO_RECHAZADO]:          'text-red-700',
};

export const PRIORIDAD_META: Record<PrioridadObs, { label: string; cls: string }> = {
  CRITICA: { label: 'Crítica', cls: 'bg-red-50 text-red-700 border border-red-200' },
  ALTA:    { label: 'Alta',    cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  MEDIA:   { label: 'Media',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  BAJA:    { label: 'Baja',    cls: 'bg-slate-100 text-slate-600' },
};

export const fmt   = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('es-MX') : '—';
export const fmtDt = (d: string | null | undefined) => d ? new Date(d).toLocaleString('es-MX')   : '—';
