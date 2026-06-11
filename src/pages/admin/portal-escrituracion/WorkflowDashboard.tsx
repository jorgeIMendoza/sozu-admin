import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  GitBranch, Search, RefreshCw, X, ChevronRight,
  CheckCircle2, Clock, AlertCircle, MinusCircle, Circle,
  Loader2, FileText, DollarSign, Shield, Stamp, Building2,
  CalendarDays, PackageCheck, HeartHandshake, Receipt, Scale,
  Landmark, User, Users, Info, ExternalLink, Bell, MessageSquare,
  BarChart2, ArrowRight, Home, ChevronDown, Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'RECURSOS_PROPIOS' | 'CREDITO_HIPOTECARIO' | null;
type StepStatus   = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETO' | 'BLOQUEADO' | 'NO_APLICA' | 'RECHAZADO';
type StepBranch   = 'GENERAL' | 'RECURSOS_PROPIOS' | 'CREDITO_HIPOTECARIO' | 'FINAL';
type SourceModule =
  | 'EXPEDIENTES' | 'RELACION_PAGOS' | 'PLD' | 'NOTARIAS'
  | 'CREDITOS_HIPOTECARIOS' | 'PROGRAMAR_CITAS' | 'ENTREGAS' | 'ESCRITURACION';

interface EvidenceItem {
  label: string;
  type: 'DOCUMENT' | 'PAYMENT' | 'RECEIPT' | 'STATUS' | 'APPOINTMENT';
  url?: string | null;
  status?: string;
}

interface WorkflowStep {
  id: string;
  order: number;
  branch: StepBranch;
  title: string;
  description: string;
  status: StepStatus;
  sourceModule: SourceModule;
  responsibleRole: 'COMPRADOR' | 'DESARROLLADOR' | 'NOTARIA' | 'BANCO' | 'POSTVENTA' | 'SISTEMA';
  requiredValidations: string[];
  completedValidations: string[];
  missingValidations: string[];
  blockingReasons: string[];
  evidence: EvidenceItem[];
  actionLabel?: string;
  actionUrl?: string;
  lastUpdatedAt?: string | null;
}

interface WorkflowEvaluation {
  accountId: string;
  projectId: number;
  unitCode: string;
  clientName: string;
  buyerType: string;
  paymentMethod: PaymentMethod;
  overallStatus: 'PENDIENTE' | 'EN_PROCESO' | 'BLOQUEADO' | 'COMPLETO';
  progressPercentage: number;
  currentStepId: string;
  blockingReasons: string[];
  notariaName: string | null;
  pldStatus: string;
  pagosStatus: string;
  steps: WorkflowStep[];
}

interface UnitSearchResult {
  cuentaId: number;
  cuentaLabel: string;
  propiedadId: number;
  unitCode: string;
  clientName: string;
  proyectoNombre: string;
  edificioNombre: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_PATHS: Record<SourceModule, string> = {
  EXPEDIENTES:           '/admin/portal-escrituracion/expedientes',
  RELACION_PAGOS:        '/admin/portal-escrituracion/relacion-pagos',
  PLD:                   '/admin/portal-escrituracion/pld',
  NOTARIAS:              '/admin/portal-escrituracion/notarias',
  CREDITOS_HIPOTECARIOS: '/admin/portal-escrituracion/credito',
  PROGRAMAR_CITAS:       '/admin/portal-escrituracion/citas',
  ENTREGAS:              '/admin/portal-escrituracion/entregas',
  ESCRITURACION:         '/admin/portal-escrituracion/dashboard',
};

const MODULE_LABELS: Record<SourceModule, string> = {
  EXPEDIENTES:           'Expedientes',
  RELACION_PAGOS:        'Relación de Pagos',
  PLD:                   'PLD',
  NOTARIAS:              'Notarías',
  CREDITOS_HIPOTECARIOS: 'Créditos Hipotecarios',
  PROGRAMAR_CITAS:       'Programar Citas',
  ENTREGAS:              'Entregas',
  ESCRITURACION:         'Escrituración',
};

const STEP_STATUS_META: Record<StepStatus, { label: string; cls: string; dotCls: string }> = {
  COMPLETO:    { label: 'Completo',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dotCls: 'bg-emerald-500' },
  EN_PROCESO:  { label: 'En proceso',    cls: 'bg-blue-50 text-blue-700 border-blue-200',           dotCls: 'bg-blue-500' },
  PENDIENTE:   { label: 'Pendiente',     cls: 'bg-slate-100 text-slate-600 border-slate-200',       dotCls: 'bg-slate-400' },
  BLOQUEADO:   { label: 'Bloqueado',     cls: 'bg-red-50 text-red-700 border-red-200',              dotCls: 'bg-red-500' },
  NO_APLICA:   { label: 'No aplica',     cls: 'bg-slate-50 text-slate-400 border-slate-100',        dotCls: 'bg-slate-200' },
  RECHAZADO:   { label: 'Rechazado',     cls: 'bg-orange-50 text-orange-700 border-orange-200',     dotCls: 'bg-orange-500' },
};

const RESPONSIBLE_LABELS: Record<string, string> = {
  COMPRADOR:    'Comprador',
  DESARROLLADOR:'Desarrollador',
  NOTARIA:      'Notaría',
  BANCO:        'Banco',
  POSTVENTA:    'Postventa',
  SISTEMA:      'Sistema',
};

// ─── Static step definitions ──────────────────────────────────────────────────

function buildSteps(paymentMethod: PaymentMethod, data: EvalData): WorkflowStep[] {
  const rp = paymentMethod === 'RECURSOS_PROPIOS';
  const ch = paymentMethod === 'CREDITO_HIPOTECARIO';
  const unknownMethod = paymentMethod === null;

  // Helper
  const noAplicaIf = (cond: boolean): StepStatus => cond ? 'NO_APLICA' : 'PENDIENTE';

  // Step 1: Expediente
  const exp = data.documentCount > 0;
  const step1: WorkflowStep = {
    id: '1', order: 1, branch: 'GENERAL',
    title: 'Completar expediente del comprador',
    description: 'Todos los documentos requeridos del comprador están completos.',
    status: exp ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'EXPEDIENTES',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Documentos de identidad', 'Documentos legales', 'Comprobante de domicilio'],
    completedValidations: exp ? ['Documentos de identidad', 'Documentos legales', 'Comprobante de domicilio'] : [],
    missingValidations: exp ? [] : ['Documentos de identidad', 'Documentos legales'],
    blockingReasons: [],
    evidence: data.documents.slice(0, 3).map(d => ({
      label: d.tipo ?? 'Documento',
      type: 'DOCUMENT' as const,
      url: d.url,
      status: 'Validado',
    })),
    actionLabel: 'Ir a Expedientes',
    actionUrl: MODULE_PATHS.EXPEDIENTES,
    lastUpdatedAt: data.documents[0]?.fecha ?? null,
  };

  // Step 2: Pagos + PLD
  const pagosOk = data.pagosStatus === 'CONCILIADA';
  const pldOk   = data.pldStatus === 'APROBADO';
  const step2: WorkflowStep = {
    id: '2', order: 2, branch: 'GENERAL',
    title: 'Validar relación de pagos y PLD',
    description: 'Relación de pagos conciliada y validada sin riesgos PLD.',
    status: !exp ? 'BLOQUEADO' : pagosOk && pldOk ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'RELACION_PAGOS',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Pagos conciliados', 'Comprobantes completos', 'PLD aprobado', 'Sin pagos de terceros'],
    completedValidations: pagosOk && pldOk ? ['Pagos conciliados', 'PLD aprobado'] : [],
    missingValidations: pagosOk && pldOk ? [] : ['Pagos conciliados', 'PLD aprobado'],
    blockingReasons: !exp ? ['El expediente del comprador no está completo'] : [],
    evidence: [],
    actionLabel: 'Ir a Relación de Pagos',
    actionUrl: MODULE_PATHS.RELACION_PAGOS,
    lastUpdatedAt: null,
  };

  // Step 3: Forma de pago
  const step3: WorkflowStep = {
    id: '3', order: 3, branch: 'GENERAL',
    title: 'Seleccionar forma de pago del finiquito',
    description: 'El comprador seleccionó la forma de pago para escriturar.',
    status: paymentMethod !== null ? 'COMPLETO' : (!exp || !pagosOk) ? 'BLOQUEADO' : 'PENDIENTE',
    sourceModule: 'ESCRITURACION',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Forma de pago seleccionada (Recursos propios o Crédito hipotecario)'],
    completedValidations: paymentMethod !== null ? ['Forma de pago seleccionada'] : [],
    missingValidations: paymentMethod !== null ? [] : ['Forma de pago seleccionada'],
    blockingReasons: (!exp || !pagosOk) ? ['Expediente o relación de pagos incompleta'] : [],
    evidence: paymentMethod !== null ? [{ label: paymentMethod === 'RECURSOS_PROPIOS' ? 'Recursos propios' : 'Crédito hipotecario', type: 'STATUS', status: 'Seleccionado' }] : [],
    actionLabel: 'Ir a Escrituración',
    actionUrl: MODULE_PATHS.ESCRITURACION,
    lastUpdatedAt: null,
  };

  // ── Recursos propios branch ──────────────────────────────────────────────

  const rpBase = rp && paymentMethod !== null;

  const step41: WorkflowStep = {
    id: '4.1', order: 10, branch: 'RECURSOS_PROPIOS',
    title: 'Asignar notaría',
    description: 'Notaría asignada correctamente.',
    status: !rpBase ? noAplicaIf(ch) : data.notariaName ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Notaría asignada al expediente'],
    completedValidations: data.notariaName ? ['Notaría asignada al expediente'] : [],
    missingValidations: data.notariaName ? [] : ['Notaría asignada al expediente'],
    blockingReasons: [],
    evidence: data.notariaName ? [{ label: data.notariaName, type: 'STATUS', status: 'Asignada' }] : [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step411: WorkflowStep = {
    id: '4.1.1', order: 11, branch: 'RECURSOS_PROPIOS',
    title: 'Elaborar proyecto de escritura',
    description: 'La notaría está elaborando el proyecto de escritura.',
    status: !rpBase ? noAplicaIf(ch) : !data.notariaName ? 'BLOQUEADO' : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Notaría asignada', 'Expediente completo', 'Relación de pagos conciliada', 'VoBo desarrollador previo'],
    completedValidations: data.notariaName && exp ? ['Notaría asignada', 'Expediente completo'] : [],
    missingValidations: data.notariaName && exp ? ['VoBo desarrollador previo'] : ['Notaría asignada'],
    blockingReasons: !data.notariaName ? ['No hay notaría asignada'] : [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step412: WorkflowStep = {
    id: '4.1.2', order: 12, branch: 'RECURSOS_PROPIOS',
    title: 'VoBo del desarrollador',
    description: 'Pendiente de VoBo del desarrollador.',
    status: !rpBase ? noAplicaIf(ch) : 'PENDIENTE',
    sourceModule: 'ESCRITURACION',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Proyecto de escritura elaborado', 'VoBo del desarrollador'],
    completedValidations: [],
    missingValidations: ['Proyecto de escritura elaborado', 'VoBo del desarrollador'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Escrituración',
    actionUrl: MODULE_PATHS.ESCRITURACION,
    lastUpdatedAt: null,
  };

  const step413: WorkflowStep = {
    id: '4.1.3', order: 13, branch: 'RECURSOS_PROPIOS',
    title: 'Pagar Predial y SIAPA',
    description: 'Pendiente de pago de Predial y SIAPA por el desarrollador.',
    status: !rpBase ? noAplicaIf(ch) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Pago de Predial', 'Pago de SIAPA'],
    completedValidations: [],
    missingValidations: ['Pago de Predial', 'Pago de SIAPA'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step414: WorkflowStep = {
    id: '4.1.4', order: 14, branch: 'RECURSOS_PROPIOS',
    title: 'CLG y cotización listos',
    description: 'Esperando CLG y cotización de la notaría para notificar al comprador.',
    status: !rpBase ? noAplicaIf(ch) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['CLG disponible', 'Cotización notarial lista'],
    completedValidations: [],
    missingValidations: ['CLG disponible', 'Cotización notarial lista'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step415: WorkflowStep = {
    id: '4.1.5', order: 15, branch: 'RECURSOS_PROPIOS',
    title: 'Pago del finiquito por el comprador',
    description: 'Pendiente del pago final para liquidar el departamento al 100%.',
    status: !rpBase ? noAplicaIf(ch) : 'PENDIENTE',
    sourceModule: 'RELACION_PAGOS',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Cuenta liquidada al 100%', 'Comprobante de finiquito subido'],
    completedValidations: [],
    missingValidations: ['Cuenta liquidada al 100%', 'Comprobante de finiquito subido'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Rel. de Pagos',
    actionUrl: MODULE_PATHS.RELACION_PAGOS,
    lastUpdatedAt: null,
  };

  const step416: WorkflowStep = {
    id: '4.1.6', order: 16, branch: 'RECURSOS_PROPIOS',
    title: 'Agendar cita de firma',
    description: 'Pendiente de que el comprador agende la cita de firma.',
    status: !rpBase ? noAplicaIf(ch) : data.citaFirmaDate ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'PROGRAMAR_CITAS',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Cita de firma agendada'],
    completedValidations: data.citaFirmaDate ? ['Cita de firma agendada'] : [],
    missingValidations: data.citaFirmaDate ? [] : ['Cita de firma agendada'],
    blockingReasons: [],
    evidence: data.citaFirmaDate ? [{ label: `Cita: ${data.citaFirmaDate}`, type: 'APPOINTMENT', status: 'Agendada' }] : [],
    actionLabel: 'Ir a Citas',
    actionUrl: MODULE_PATHS.PROGRAMAR_CITAS,
    lastUpdatedAt: null,
  };

  const step417: WorkflowStep = {
    id: '4.1.7', order: 17, branch: 'RECURSOS_PROPIOS',
    title: 'Firma de escritura realizada',
    description: 'Pendiente de confirmación de la firma de escritura.',
    status: !rpBase ? noAplicaIf(ch) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Escritura firmada por todas las partes'],
    completedValidations: [],
    missingValidations: ['Escritura firmada por todas las partes'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  // ── Crédito hipotecario branch ───────────────────────────────────────────

  const chBase = ch && paymentMethod !== null;

  const step42: WorkflowStep = {
    id: '4.2', order: 20, branch: 'CREDITO_HIPOTECARIO',
    title: 'Seleccionar banco hipotecario',
    description: 'Banco hipotecario seleccionado por el comprador.',
    status: !chBase ? noAplicaIf(rp) : data.bancoName ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'CREDITOS_HIPOTECARIOS',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Banco seleccionado'],
    completedValidations: data.bancoName ? ['Banco seleccionado'] : [],
    missingValidations: data.bancoName ? [] : ['Banco seleccionado'],
    blockingReasons: [],
    evidence: data.bancoName ? [{ label: data.bancoName, type: 'STATUS', status: 'Seleccionado' }] : [],
    actionLabel: 'Ir a Créditos Hipotecarios',
    actionUrl: MODULE_PATHS.CREDITOS_HIPOTECARIOS,
    lastUpdatedAt: null,
  };

  const step421: WorkflowStep = {
    id: '4.2.1', order: 21, branch: 'CREDITO_HIPOTECARIO',
    title: 'Aprobación de crédito hipotecario',
    description: 'El banco aprobó el crédito hipotecario del comprador.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'CREDITOS_HIPOTECARIOS',
    responsibleRole: 'BANCO',
    requiredValidations: ['Crédito aprobado por el banco'],
    completedValidations: [],
    missingValidations: ['Crédito aprobado por el banco'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Créditos Hipotecarios',
    actionUrl: MODULE_PATHS.CREDITOS_HIPOTECARIOS,
    lastUpdatedAt: null,
  };

  const step422: WorkflowStep = {
    id: '4.2.2', order: 22, branch: 'CREDITO_HIPOTECARIO',
    title: 'Asignar notaría y compartir expediente',
    description: 'Notaría asignada y expediente compartido con banco y notaría.',
    status: !chBase ? noAplicaIf(rp) : data.notariaName ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Notaría asignada', 'Acceso de banco al expediente', 'Acceso de notaría al expediente'],
    completedValidations: data.notariaName ? ['Notaría asignada'] : [],
    missingValidations: data.notariaName ? ['Acceso de banco', 'Acceso de notaría'] : ['Notaría asignada'],
    blockingReasons: [],
    evidence: data.notariaName ? [{ label: data.notariaName, type: 'STATUS', status: 'Asignada' }] : [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step423: WorkflowStep = {
    id: '4.2.3', order: 23, branch: 'CREDITO_HIPOTECARIO',
    title: 'Proyecto de escritura por notaría',
    description: 'La notaría elabora el proyecto de escritura.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Proyecto de escritura elaborado'],
    completedValidations: [],
    missingValidations: ['Proyecto de escritura elaborado'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step424: WorkflowStep = {
    id: '4.2.4', order: 24, branch: 'CREDITO_HIPOTECARIO',
    title: 'VoBo desarrollador',
    description: 'El desarrollador revisa y aprueba el proyecto de escritura.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'ESCRITURACION',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['VoBo del desarrollador'],
    completedValidations: [],
    missingValidations: ['VoBo del desarrollador'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Escrituración',
    actionUrl: MODULE_PATHS.ESCRITURACION,
    lastUpdatedAt: null,
  };

  const step425: WorkflowStep = {
    id: '4.2.5', order: 25, branch: 'CREDITO_HIPOTECARIO',
    title: 'VoBo banco',
    description: 'El banco revisa y aprueba el proyecto de escritura.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'CREDITOS_HIPOTECARIOS',
    responsibleRole: 'BANCO',
    requiredValidations: ['VoBo del banco'],
    completedValidations: [],
    missingValidations: ['VoBo del banco'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Créditos Hipotecarios',
    actionUrl: MODULE_PATHS.CREDITOS_HIPOTECARIOS,
    lastUpdatedAt: null,
  };

  const step426: WorkflowStep = {
    id: '4.2.6', order: 26, branch: 'CREDITO_HIPOTECARIO',
    title: 'Pagar Predial y SIAPA',
    description: 'Pago de Predial y SIAPA por el desarrollador.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'DESARROLLADOR',
    requiredValidations: ['Pago de Predial', 'Pago de SIAPA'],
    completedValidations: [],
    missingValidations: ['Pago de Predial', 'Pago de SIAPA'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step427: WorkflowStep = {
    id: '4.2.7', order: 27, branch: 'CREDITO_HIPOTECARIO',
    title: 'Confirmar CLG, cotización y proyecto listo',
    description: 'CLG, cotización notarial y proyecto de escritura disponibles.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['CLG disponible', 'Cotización notarial', 'Proyecto de escritura listo'],
    completedValidations: [],
    missingValidations: ['CLG disponible', 'Cotización notarial', 'Proyecto de escritura listo'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step428: WorkflowStep = {
    id: '4.2.8', order: 28, branch: 'CREDITO_HIPOTECARIO',
    title: 'Agendar cita de firma',
    description: 'Cita de firma agendada con banco y notaría.',
    status: !chBase ? noAplicaIf(rp) : data.citaFirmaDate ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'PROGRAMAR_CITAS',
    responsibleRole: 'COMPRADOR',
    requiredValidations: ['Cita de firma agendada con banco y notaría'],
    completedValidations: data.citaFirmaDate ? ['Cita agendada'] : [],
    missingValidations: data.citaFirmaDate ? [] : ['Cita de firma agendada con banco y notaría'],
    blockingReasons: [],
    evidence: data.citaFirmaDate ? [{ label: `Cita: ${data.citaFirmaDate}`, type: 'APPOINTMENT', status: 'Agendada' }] : [],
    actionLabel: 'Ir a Citas',
    actionUrl: MODULE_PATHS.PROGRAMAR_CITAS,
    lastUpdatedAt: null,
  };

  const step429: WorkflowStep = {
    id: '4.2.9', order: 29, branch: 'CREDITO_HIPOTECARIO',
    title: 'Firma de escritura',
    description: 'Escritura firmada por todas las partes.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Escritura firmada por cliente', 'Escritura firmada por desarrollador', 'Escritura firmada por banco'],
    completedValidations: [],
    missingValidations: ['Firma de escritura por todas las partes'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step4210: WorkflowStep = {
    id: '4.2.10', order: 30, branch: 'CREDITO_HIPOTECARIO',
    title: 'Confirmar pago del banco al desarrollador',
    description: 'El banco realizó el pago al desarrollador y se subió el comprobante.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'RELACION_PAGOS',
    responsibleRole: 'BANCO',
    requiredValidations: ['Pago del banco recibido', 'Comprobante de pago subido'],
    completedValidations: [],
    missingValidations: ['Pago del banco recibido', 'Comprobante de pago subido'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Rel. de Pagos',
    actionUrl: MODULE_PATHS.RELACION_PAGOS,
    lastUpdatedAt: null,
  };

  const step4211: WorkflowStep = {
    id: '4.2.11', order: 31, branch: 'CREDITO_HIPOTECARIO',
    title: 'Confirmar finiquito total',
    description: 'Cuenta liquidada al 100% incluyendo el pago del banco.',
    status: !chBase ? noAplicaIf(rp) : 'PENDIENTE',
    sourceModule: 'RELACION_PAGOS',
    responsibleRole: 'SISTEMA',
    requiredValidations: ['Cuenta liquidada al 100%'],
    completedValidations: [],
    missingValidations: ['Cuenta liquidada al 100%'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Rel. de Pagos',
    actionUrl: MODULE_PATHS.RELACION_PAGOS,
    lastUpdatedAt: null,
  };

  // ── Pasos finales ────────────────────────────────────────────────────────

  const step5: WorkflowStep = {
    id: '5', order: 50, branch: 'FINAL',
    title: 'Registro en RPP',
    description: 'Escritura inscrita en el Registro Público de la Propiedad.',
    status: 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Folio real del RPP'],
    completedValidations: [],
    missingValidations: ['Folio real del RPP'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const step6: WorkflowStep = {
    id: '6', order: 51, branch: 'FINAL',
    title: 'Entrega de escritura',
    description: 'Escritura física entregada al comprador.',
    status: 'PENDIENTE',
    sourceModule: 'NOTARIAS',
    responsibleRole: 'NOTARIA',
    requiredValidations: ['Escritura entregada al comprador'],
    completedValidations: [],
    missingValidations: ['Escritura entregada al comprador'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Notarías',
    actionUrl: MODULE_PATHS.NOTARIAS,
    lastUpdatedAt: null,
  };

  const entregaCompleta = data.entregaEstatus === 'ENTREGADA';
  const entregaProgramada = !!data.entregaFecha;

  const step7: WorkflowStep = {
    id: '7', order: 52, branch: 'FINAL',
    title: 'Programar entrega del departamento',
    description: 'Entrega del departamento programada con el comprador.',
    status: entregaProgramada ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'ENTREGAS',
    responsibleRole: 'POSTVENTA',
    requiredValidations: ['Fecha de entrega programada', 'Checklist de entrega listo'],
    completedValidations: entregaProgramada ? ['Fecha de entrega programada'] : [],
    missingValidations: entregaProgramada ? ['Checklist de entrega listo'] : ['Fecha de entrega programada'],
    blockingReasons: [],
    evidence: entregaProgramada ? [{ label: `Fecha: ${data.entregaFecha}`, type: 'APPOINTMENT', status: 'Programada' }] : [],
    actionLabel: 'Ir a Entregas',
    actionUrl: MODULE_PATHS.ENTREGAS,
    lastUpdatedAt: data.entregaFecha,
  };

  const step8: WorkflowStep = {
    id: '8', order: 53, branch: 'FINAL',
    title: 'Entrega del departamento realizada',
    description: 'El departamento fue entregado al comprador y se firmó el acta.',
    status: entregaCompleta ? 'COMPLETO' : 'PENDIENTE',
    sourceModule: 'ENTREGAS',
    responsibleRole: 'POSTVENTA',
    requiredValidations: ['Checklist de entrega completado', 'Acta de entrega firmada', 'Departamento entregado'],
    completedValidations: entregaCompleta ? ['Departamento entregado'] : [],
    missingValidations: entregaCompleta ? [] : ['Checklist de entrega completado', 'Acta de entrega firmada'],
    blockingReasons: [],
    evidence: [],
    actionLabel: 'Ir a Entregas',
    actionUrl: MODULE_PATHS.ENTREGAS,
    lastUpdatedAt: null,
  };

  const all: WorkflowStep[] = [
    step1, step2, step3,
    step41, step411, step412, step413, step414, step415, step416, step417,
    step42, step421, step422, step423, step424, step425, step426, step427, step428, step429, step4210, step4211,
    step5, step6, step7, step8,
  ];

  return all.sort((a, b) => a.order - b.order);
}

// ─── Evaluation data types ────────────────────────────────────────────────────

interface EvalData {
  documentCount: number;
  documents: { tipo: string | null; url: string | null; fecha: string | null }[];
  pagosStatus: string;
  pldStatus: string;
  notariaName: string | null;
  bancoName: string | null;
  citaFirmaDate: string | null;
  entregaEstatus: string | null;
  entregaFecha: string | null;
  tipoFinanciamiento?: PaymentMethod;
}

// ─── Main evaluation function ─────────────────────────────────────────────────

async function evaluateWorkflow(cuentaId: number, propiedadId: number): Promise<WorkflowEvaluation> {
  const baseData: EvalData = {
    documentCount: 0, documents: [],
    pagosStatus: 'PENDIENTE', pldStatus: 'PENDIENTE',
    notariaName: null, bancoName: null,
    citaFirmaDate: null,
    entregaEstatus: null, entregaFecha: null,
  };

  // Documents (real)
  const { data: docs } = await supabase
    .from('documentos')
    .select('id, url, fecha_creacion, id_tipo_documento')
    .eq('id_propiedad', propiedadId)
    .eq('activo', true)
    .eq('es_draft', false)
    .limit(20);
  baseData.documentCount = docs?.length ?? 0;
  baseData.documents = (docs ?? []).map((d: any) => ({
    tipo: `Documento ${d.id_tipo_documento ?? ''}`,
    url: d.url,
    fecha: d.fecha_creacion,
  }));

  // Entregas (real — may not exist if DDL not run)
  try {
    const { data: entrega } = await (supabase as any)
      .from('entregas')
      .select('estatus, fecha_programada, fecha_entrega')
      .eq('id_propiedad', propiedadId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    if (entrega) {
      baseData.entregaEstatus = entrega.estatus;
      baseData.entregaFecha = entrega.fecha_programada
        ? new Date(entrega.fecha_programada).toLocaleDateString('es-MX')
        : null;
    }
  } catch (_) {}

  // Try cuentas_cobranza optional fields (notaría, banco, tipo_financiamiento)
  try {
    const { data: cuentaExtra } = await (supabase as any)
      .from('cuentas_cobranza')
      .select('tipo_financiamiento, id_notaria, id_banco')
      .eq('id', cuentaId)
      .maybeSingle();
    if (cuentaExtra) {
      if (cuentaExtra.tipo_financiamiento) {
        baseData.tipoFinanciamiento = cuentaExtra.tipo_financiamiento as PaymentMethod;
      }
    }
  } catch (_) {}

  // Try notarías from cuentas_cobranza join — probe only
  try {
    const { data: notariaRow } = await (supabase as any)
      .from('cuentas_cobranza')
      .select('notarias(nombre_comercial, nombre_legal)')
      .eq('id', cuentaId)
      .maybeSingle();
    if (notariaRow?.notarias) {
      const n = notariaRow.notarias;
      baseData.notariaName = n.nombre_comercial ?? n.nombre_legal ?? null;
    }
  } catch (_) {}

  return {
    accountId: cuentaId.toString(),
    projectId: 0,
    unitCode: '',
    clientName: '',
    buyerType: '',
    paymentMethod: null,
    overallStatus: 'EN_PROCESO',
    progressPercentage: 0,
    currentStepId: '1',
    blockingReasons: [],
    notariaName: baseData.notariaName,
    pldStatus: baseData.pldStatus,
    pagosStatus: baseData.pagosStatus,
    steps: [],
    ...(await (async () => ({ evalData: baseData }))()).evalData,
  } as any;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StepIcon({ status, id }: { status: StepStatus; id: string }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold';
  if (status === 'COMPLETO')   return <div className={`${base} bg-emerald-500 text-white`}><CheckCircle2 className="w-4 h-4" /></div>;
  if (status === 'EN_PROCESO') return <div className={`${base} bg-blue-500 text-white`}><div className="w-2 h-2 rounded-full bg-white" /></div>;
  if (status === 'BLOQUEADO')  return <div className={`${base} bg-red-500 text-white`}><AlertCircle className="w-4 h-4" /></div>;
  if (status === 'NO_APLICA')  return <div className={`${base} bg-slate-200 text-slate-400`}><MinusCircle className="w-4 h-4" /></div>;
  if (status === 'RECHAZADO')  return <div className={`${base} bg-orange-400 text-white`}><X className="w-4 h-4" /></div>;
  // PENDIENTE
  return <div className={`${base} bg-slate-200 text-slate-500`}><Clock className="w-4 h-4" /></div>;
}

function StatusBadge({ status }: { status: StepStatus }) {
  const m = STEP_STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${m.dotCls}`} />
      {m.label}
    </span>
  );
}

function ProgressCircle({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={pct >= 80 ? '#10b981' : pct >= 40 ? '#3b82f6' : '#f59e0b'}
          strokeWidth="5" strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-bold text-slate-800">{pct}%</span>
    </div>
  );
}

function BranchLabel({ branch }: { branch: StepBranch }) {
  if (branch === 'GENERAL')             return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest writing-mode-vertical">PASOS GENERALES</span>;
  if (branch === 'RECURSOS_PROPIOS')    return <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">RAMA RECURSOS PROPIOS</span>;
  if (branch === 'CREDITO_HIPOTECARIO') return <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">RAMA CRÉDITO HIPOTECARIO</span>;
  return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PASOS FINALES</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkflowDashboard() {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  // Clave de sesión para persistir la unidad seleccionada al navegar y regresar
  const WF_SESSION_KEY = 'workflow-selected-unit';

  const [proyectoId, setProyectoId]         = useState<number | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(WF_SESSION_KEY) ?? 'null')?.proyectoId ?? null; } catch { return null; }
  });
  const [search, setSearch]                 = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(WF_SESSION_KEY) ?? 'null')?.search ?? ''; } catch { return ''; }
  });
  const [showDropdown, setShowDropdown]     = useState(false);
  const [selectedUnit, setSelectedUnit]     = useState<UnitSearchResult | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(WF_SESSION_KEY) ?? 'null')?.selectedUnit ?? null; } catch { return null; }
  });
  const [evaluation, setEvaluation]         = useState<WorkflowEvaluation | null>(null);
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>(null);
  const [evaluating, setEvaluating]         = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Guardar estado en sessionStorage cada vez que cambia la unidad seleccionada
  useEffect(() => {
    if (selectedUnit) {
      sessionStorage.setItem(WF_SESSION_KEY, JSON.stringify({ proyectoId, search, selectedUnit }));
    }
  }, [selectedUnit, proyectoId, search]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-workflow'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas').select('id_proyecto').eq('id_tipo_entidad', 5).eq('activo', true);
      const ids = (rels ?? []).map((r: any) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('proyectos').select('id, nombre').in('id', ids).eq('publicar', true).eq('activo', true).order('nombre');
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

  useEffect(() => {
    if (proyectos.length > 0 && proyectoId === null) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  // Re-evaluar workflow cuando se restaura la unidad desde sessionStorage
  useEffect(() => {
    if (selectedUnit && !evaluation && !evaluating) {
      evaluate(selectedUnit, paymentMethod);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit]);

  // ── Unit search ───────────────────────────────────────────────────────────
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['workflow-search', proyectoId, search],
    queryFn: async (): Promise<UnitSearchResult[]> => {
      if (!search || search.length < 2 || !proyectoId) return [];
      const { data: edificios } = await supabase.from('edificios').select('id, nombre').eq('id_proyecto', proyectoId).eq('activo', true);
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];
      const edificioMap: Record<number, string> = Object.fromEntries((edificios ?? []).map((e: any) => [e.id, e.nombre]));
      const { data: modelos } = await supabase.from('edificios_modelos').select('id, id_edificio').in('id_edificio', edificioIds);
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];
      const modeloEdificioMap: Record<number, number> = Object.fromEntries((modelos ?? []).map((m: any) => [m.id, m.id_edificio]));
      const { data: props } = await supabase.from('propiedades').select('id, numero_propiedad, id_edificio_modelo').in('id_edificio_modelo', modeloIds).eq('activo', true);
      if (!props?.length) return [];
      const propIds = props.map((p: any) => p.id);
      const propMap: Record<number, any> = Object.fromEntries(props.map((p: any) => [p.id, p]));
      // Cuentas de cobranza — incluye id_oferta para filtrar solo cuentas de PROPIEDAD
      const { data: todasCuentas } = await supabase
        .from('cuentas_cobranza').select('id, id_propiedad, id_oferta')
        .in('id_propiedad', propIds).eq('activo', true);
      if (!todasCuentas?.length) return [];

      // Filtrar solo la cuenta PRINCIPAL de cada propiedad:
      // La oferta de la propiedad tiene id_producto = null (sin producto)
      // Las bodegas/estacionamientos tienen id_producto != null → excluirlas
      const ofertaIds = [...new Set(todasCuentas.map((c: any) => c.id_oferta).filter(Boolean))];
      const cuentasPropiedad = await (async () => {
        if (!ofertaIds.length) return todasCuentas;
        const { data: ofertas } = await supabase
          .from('ofertas').select('id, id_producto').in('id', ofertaIds as any);
        const ofertaEsProp = new Set(
          (ofertas ?? []).filter((o: any) => !o.id_producto).map((o: any) => o.id)
        );
        // Solo la cuenta cuya oferta es de propiedad (sin producto)
        // Si no se puede determinar (sin oferta), quedarse con la cuenta de menor id por prop
        const byCuenta = todasCuentas.filter((c: any) => ofertaEsProp.has(c.id_oferta));
        if (byCuenta.length) return byCuenta;
        // Fallback: si no hay ofertas, tomar la cuenta de menor id por propiedad
        const min: Record<number, any> = {};
        for (const c of todasCuentas as any[]) {
          if (!min[c.id_propiedad] || c.id < min[c.id_propiedad].id) min[c.id_propiedad] = c;
        }
        return Object.values(min);
      })();

      if (!cuentasPropiedad.length) return [];
      const cuentas = cuentasPropiedad;
      const cuentaIds = cuentas.map((c: any) => c.id);
      const { data: compradores } = await supabase.from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];
      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase.from('personas').select('id, nombre_legal').in('id', personaIds as number[]);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '']));
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => { if (!cuentaToPersona[c.id_cuenta_cobranza]) cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? ''; });

      const q = search.toLowerCase();
      const results: UnitSearchResult[] = [];
      for (const cuenta of cuentas as any[]) {
        const prop = propMap[cuenta.id_propiedad];
        if (!prop) continue;
        const edificioId = modeloEdificioMap[prop.id_edificio_modelo];
        const edificioNombre = edificioMap[edificioId] ?? '';
        const clientName = cuentaToPersona[cuenta.id] ?? '';
        const cuentaLabel = `CC-${String(cuenta.id).padStart(6, '0')}`;
        const matchCuenta = cuentaLabel.toLowerCase().includes(q);
        const matchUnidad = (prop.numero_propiedad ?? '').toLowerCase().includes(q);
        const matchCliente = clientName.toLowerCase().includes(q);
        if (matchCuenta || matchUnidad || matchCliente) {
          results.push({ cuentaId: cuenta.id, cuentaLabel, propiedadId: prop.id, unitCode: prop.numero_propiedad ?? '—', clientName, proyectoNombre: proyectos.find(p => p.id === proyectoId)?.nombre ?? '', edificioNombre });
        }
      }
      return results.slice(0, 10);
    },
    enabled: search.length >= 2 && proyectoId !== null,
  });

  // ── Click outside dropdown ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Navegar con contexto de cuenta (deep-link) ────────────────────────────
  const navigateWithContext = (baseUrl: string) => {
    if (!selectedUnit) { navigate(baseUrl); return; }
    const params = new URLSearchParams({
      wf_num:    selectedUnit.unitCode,
      wf_cuenta: String(selectedUnit.cuentaId),
    });
    navigate(`${baseUrl}?${params.toString()}`);
  };

  // ── Evaluate workflow ─────────────────────────────────────────────────────
  const evaluate = useCallback(async (unit: UnitSearchResult, pm: PaymentMethod) => {
    setEvaluating(true);
    try {
      const evalData = await evaluateWorkflow(unit.cuentaId, unit.propiedadId);

      const dbPm = (evalData as any).tipoFinanciamiento as PaymentMethod | undefined;
      const effectivePm: PaymentMethod = dbPm ?? pm;
      if (dbPm && dbPm !== pm) {
        setPaymentMethod(dbPm);
      }

      const steps = buildSteps(effectivePm, {
        documentCount: (evalData as any).documentCount ?? 0,
        documents: (evalData as any).documents ?? [],
        pagosStatus: (evalData as any).pagosStatus ?? 'PENDIENTE',
        pldStatus: (evalData as any).pldStatus ?? 'PENDIENTE',
        notariaName: (evalData as any).notariaName ?? null,
        bancoName: null,
        citaFirmaDate: null,
        entregaEstatus: (evalData as any).entregaEstatus ?? null,
        entregaFecha: (evalData as any).entregaFecha ?? null,
      });

      const applicable = steps.filter(s => s.status !== 'NO_APLICA');
      const completed  = applicable.filter(s => s.status === 'COMPLETO');
      const blocked    = applicable.filter(s => s.status === 'BLOQUEADO');
      const pct = applicable.length > 0 ? Math.round((completed.length / applicable.length) * 100) : 0;
      const currentStep = applicable.find(s => s.status !== 'COMPLETO') ?? applicable[applicable.length - 1];

      const ev: WorkflowEvaluation = {
        accountId: unit.cuentaId.toString(),
        projectId: proyectoId ?? 0,
        unitCode: unit.unitCode,
        clientName: unit.clientName,
        buyerType: 'PERSONA_FISICA',
        paymentMethod: effectivePm,
        overallStatus: blocked.length > 0 ? 'BLOQUEADO' : completed.length === applicable.length ? 'COMPLETO' : 'EN_PROCESO',
        progressPercentage: pct,
        currentStepId: currentStep?.id ?? '1',
        blockingReasons: blocked.flatMap(s => s.blockingReasons),
        notariaName: (evalData as any).notariaName ?? null,
        pldStatus: (evalData as any).pldStatus ?? 'PENDIENTE',
        pagosStatus: (evalData as any).pagosStatus ?? 'PENDIENTE',
        steps,
      };

      setEvaluation(ev);
      if (!selectedStepId) setSelectedStepId(currentStep?.id ?? steps[0]?.id);
    } catch (err) {
      toast.error('Error al evaluar el workflow');
    } finally {
      setEvaluating(false);
    }
  }, [proyectoId, selectedStepId]);

  const handleSelectUnit = (unit: UnitSearchResult) => {
    setSelectedUnit(unit);
    setSearch(unit.cuentaLabel);
    setShowDropdown(false);
    setPaymentMethod(null);
    setEvaluation(null);
    setSelectedStepId(null);
    evaluate(unit, null);
  };

  const handleReEvaluate = () => {
    if (selectedUnit) evaluate(selectedUnit, paymentMethod);
  };

  const handlePaymentMethodChange = (pm: PaymentMethod) => {
    setPaymentMethod(pm);
    if (selectedUnit) evaluate(selectedUnit, pm);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const visibleSteps = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.steps.filter(s => s.status !== 'NO_APLICA');
  }, [evaluation]);

  const selectedStep = useMemo(
    () => evaluation?.steps.find(s => s.id === selectedStepId) ?? null,
    [evaluation, selectedStepId]
  );

  const currentStep = useMemo(
    () => evaluation?.steps.find(s => s.id === evaluation.currentStepId) ?? null,
    [evaluation]
  );

  // Group steps by branch for rendering
  const stepsByBranch = useMemo(() => {
    const groups: { branch: StepBranch; steps: WorkflowStep[] }[] = [];
    let current: { branch: StepBranch; steps: WorkflowStep[] } | null = null;
    for (const s of visibleSteps) {
      if (!current || current.branch !== s.branch) {
        current = { branch: s.branch, steps: [] };
        groups.push(current);
      }
      current.steps.push(s);
    }
    return groups;
  }, [visibleSteps]);

  const branchBorderCls: Record<StepBranch, string> = {
    GENERAL:             'border-l-slate-300',
    RECURSOS_PROPIOS:    'border-l-emerald-400',
    CREDITO_HIPOTECARIO: 'border-l-blue-400',
    FINAL:               'border-l-slate-300',
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-none">Workflow de Escrituración y Entrega</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Project selector */}
        <select
          value={proyectoId ?? ''}
          onChange={e => { setProyectoId(Number(e.target.value) || null); setSelectedUnit(null); setEvaluation(null); setSearch(''); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="">Proyecto</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        {/* Unit search */}
        <div className="relative w-72" ref={dropdownRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar unidad, ID cuenta o cliente..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
          {!searching && search && (
            <button onClick={() => { setSearch(''); setSelectedUnit(null); setEvaluation(null); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {searchResults.map(r => (
                <button key={r.cuentaId} onClick={() => handleSelectUnit(r)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors">
                  <Home className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{r.cuentaLabel} · {r.unitCode}</p>
                    <p className="text-xs text-slate-500 truncate">{r.clientName} · {r.edificioNombre}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && search.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-slate-500">
              Sin resultados para "{search}"
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={handleReEvaluate}
          disabled={!selectedUnit || evaluating}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reevaluar workflow
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <main className="p-6 flex flex-col gap-5">

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!selectedUnit && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <GitBranch className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-600">Selecciona una unidad</p>
              <p className="text-sm mt-1">Busca por ID cuenta, número de unidad o nombre del cliente para ver el workflow de escrituración.</p>
            </div>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {selectedUnit && evaluating && !evaluation && (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Evaluando workflow…</span>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        {selectedUnit && evaluation && (
          <>
            {/* Unit card */}
            <div className="bg-white rounded-xl border border-slate-200 px-6 py-4 flex items-center gap-6 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-mono">{`CC-${String(selectedUnit.cuentaId).padStart(6, '0')}`}</p>
                <p className="text-xl font-bold text-slate-900">Unidad {selectedUnit.unitCode}</p>
                <p className="text-sm text-slate-500">{selectedUnit.edificioNombre}</p>
              </div>
              <div className="h-10 w-px bg-slate-200 hidden md:block" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="text-sm font-semibold text-slate-800">{selectedUnit.clientName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Forma de pago</p>
                <select
                  value={paymentMethod ?? ''}
                  onChange={e => handlePaymentMethodChange(e.target.value as PaymentMethod || null)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">Sin definir</option>
                  <option value="RECURSOS_PROPIOS">Recursos propios</option>
                  <option value="CREDITO_HIPOTECARIO">Crédito hipotecario</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Notaría</p>
                <span className="text-xs font-medium text-slate-800">{evaluation.notariaName ?? 'Sin asignar'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${evaluation.pldStatus === 'APROBADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  PLD: {evaluation.pldStatus === 'APROBADO' ? 'Aprobado' : 'Pendiente'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${evaluation.pagosStatus === 'CONCILIADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  Rel. de pagos: {evaluation.pagosStatus === 'CONCILIADA' ? 'Conciliada' : 'Pendiente'}
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Progreso general</p>
                  <p className="text-sm font-medium text-slate-700">{evaluation.progressPercentage}% completado</p>
                </div>
                <ProgressCircle pct={evaluation.progressPercentage} />
              </div>
            </div>

            {/* Next step banner */}
            {currentStep && currentStep.status !== 'COMPLETO' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-blue-800">
                    <span className="font-semibold">Siguiente paso sugerido:</span>{' '}
                    {currentStep.id} {currentStep.title}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStepId(currentStep.id)}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 shrink-0"
                >
                  Ver acción <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Blocker alert */}
            {evaluation.overallStatus === 'BLOQUEADO' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Workflow bloqueado</p>
                  <p className="text-xs text-red-700 mt-0.5">{evaluation.blockingReasons.join(' · ')}</p>
                </div>
              </div>
            )}

            {/* Checklist + Detail panel */}
            <div className="flex gap-4 items-start">

              {/* ── Checklist ──────────────────────────────────────────────── */}
              <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">Checklist del workflow</span>
                  {evaluating && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
                </div>
                <div className="divide-y divide-slate-50">
                  {stepsByBranch.map(group => (
                    <div key={group.branch}>
                      {/* Branch label row */}
                      <div className={`px-5 py-1.5 flex items-center gap-2 border-l-4 ${branchBorderCls[group.branch]} bg-slate-50`}>
                        <BranchLabel branch={group.branch} />
                      </div>

                      {/* Steps */}
                      {group.steps.map(step => {
                        const isSelected = selectedStepId === step.id;
                        return (
                          <button
                            key={step.id}
                            onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                            className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50 border-l-4 ${branchBorderCls[step.branch]} ${isSelected ? 'bg-emerald-50/50 border-l-emerald-400' : 'border-l-transparent'}`}
                          >
                            <StepIcon status={step.status} id={step.id} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400">{step.id}</span>
                                <span className={`text-sm font-medium ${step.status === 'COMPLETO' ? 'text-slate-700' : step.status === 'BLOQUEADO' ? 'text-red-700' : 'text-slate-800'}`}>
                                  {step.title}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{step.description}</p>
                            </div>

                            <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 shrink-0">
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Responsable</p>
                                <p className="font-medium">{RESPONSIBLE_LABELS[step.responsibleRole]}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Actualizado</p>
                                <p className="font-medium">{step.lastUpdatedAt ? new Date(step.lastUpdatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Evidencia</p>
                                <p className="font-medium">{step.evidence.length > 0 ? <span className="flex items-center gap-1 text-blue-600"><Eye className="w-3 h-3" />Ver</span> : '—'}</p>
                              </div>
                            </div>

                            {step.actionUrl && (
                              <button
                                onClick={e => { e.stopPropagation(); navigateWithContext(step.actionUrl!); }}
                                className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
                              >
                                {step.actionLabel}
                              </button>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Detail panel ────────────────────────────────────────────── */}
              {selectedStep && (
                <div className="w-80 xl:w-96 shrink-0 bg-white rounded-xl border border-slate-200 sticky top-[73px] overflow-hidden">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-800">Detalle del paso</span>
                    <button onClick={() => setSelectedStepId(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-160px)]">
                    {/* Status */}
                    <StatusBadge status={selectedStep.status} />

                    {/* Step info */}
                    <div>
                      <p className="text-xs font-mono text-slate-400">Paso {selectedStep.id}</p>
                      <p className="text-base font-semibold text-slate-900 mt-0.5">{selectedStep.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{selectedStep.description}</p>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Responsable</p>
                        <p className="font-semibold text-slate-800">{RESPONSIBLE_LABELS[selectedStep.responsibleRole]}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Módulo origen</p>
                        <p className="font-semibold text-slate-800">{MODULE_LABELS[selectedStep.sourceModule]}</p>
                      </div>
                      {selectedStep.lastUpdatedAt && (
                        <div className="col-span-2">
                          <p className="text-slate-400 mb-0.5">Última actualización</p>
                          <p className="font-semibold text-slate-800">{new Date(selectedStep.lastUpdatedAt).toLocaleString('es-MX')}</p>
                        </div>
                      )}
                    </div>

                    {/* Blocking reasons */}
                    {selectedStep.blockingReasons.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-red-800 mb-1.5 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />Bloqueado por</p>
                        {selectedStep.blockingReasons.map(r => (
                          <p key={r} className="text-xs text-red-700">• {r}</p>
                        ))}
                      </div>
                    )}

                    {/* Requirements */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Requisitos del paso</p>
                      <div className="flex flex-col gap-1.5">
                        {selectedStep.requiredValidations.map(v => {
                          const done = selectedStep.completedValidations.includes(v);
                          return (
                            <div key={v} className="flex items-start gap-2 text-xs">
                              {done
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />}
                              <span className={done ? 'text-slate-700' : 'text-slate-500'}>{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Evidence */}
                    {selectedStep.evidence.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Evidencia / documentos</p>
                        <div className="flex flex-col gap-1.5">
                          {selectedStep.evidence.map((ev, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-700">{ev.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {ev.status && <span className="text-emerald-600 font-medium">{ev.status}</span>}
                                {ev.url && <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800"><ExternalLink className="w-3 h-3" /></a>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No evidence */}
                    {selectedStep.evidence.length === 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Evidencia / documentos</p>
                        <p className="text-xs text-slate-400 italic">Sin documentos aún</p>
                      </div>
                    )}

                    {/* Quick action */}
                    {selectedStep.actionUrl && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Acciones rápidas</p>
                        <button
                          onClick={() => navigateWithContext(selectedStep.actionUrl!)}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          {selectedStep.actionLabel}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Missing validations */}
                    {selectedStep.missingValidations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Pendiente de resolver</p>
                        <div className="flex flex-col gap-1">
                          {selectedStep.missingValidations.map(v => (
                            <p key={v} className="text-xs text-slate-500 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              {v}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Branch info */}
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[10px] text-slate-400">Rama del workflow</p>
                      <BranchLabel branch={selectedStep.branch} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
