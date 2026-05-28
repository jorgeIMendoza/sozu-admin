import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Ambassador, AmbassadorAuditEvent, AmbassadorNotification, AdvisorNotification,
  Advisor, AmbassadorsSettings, AssignmentStatus, CommissionStatus,
  DEFAULT_PAYMENT_DOCS, DEFAULT_SETTINGS, DocumentStatus, Referral,
  ReferralStatus, ProtectionStatus, InterestType,
  AmbassadorType, AmbassadorStatus, CommissionTrigger, nextStepFor,
} from '@/types/ambassadors';
import { toast } from 'sonner';

const LS_SETTINGS_KEY = 'sozu.ambassadors.settings.v1';
const LS_NOTIFS_KEY = 'sozu.ambassadors.notifs.v1';
const LS_ADVISOR_NOTIFS_KEY = 'sozu.ambassadors.advisorNotifs.v1';

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapAmbassador(row: any): Ambassador {
  const cfg = Array.isArray(row.embajadores_config)
    ? row.embajadores_config[0]
    : row.embajadores_config;
  return {
    id: String(row.id),
    idPersona: row.id_persona ?? undefined,
    fullName: row.personas?.nombre_legal ?? '',
    phone: row.personas?.telefono ?? '',
    clavePaisTelefono: row.personas?.clave_pais_telefono ?? 'MX',
    email: row.personas?.email ?? '',
    company: cfg?.empresa ?? undefined,
    type: (cfg?.tipo ?? 'otro') as AmbassadorType,
    status: (cfg?.estatus ?? 'pendiente') as AmbassadorStatus,
    createdAt: row.fecha_creacion ?? new Date().toISOString(),
    code: cfg?.codigo ?? `EMB-${String(row.id).padStart(4, '0')}`,
    referralLink: `https://sozu.app/ref/${cfg?.codigo ?? row.id}`,
    commissionPct: Number(cfg?.pct_comision) || 0,
    fixedAmount: cfg?.monto_fijo != null ? Number(cfg.monto_fijo) : undefined,
    commissionTrigger: (cfg?.trigger_comision ?? 'escrituracion') as CommissionTrigger,
    notes: cfg?.notas ?? undefined,
    paymentDocs: Array.isArray(cfg?.documentos_pago) && cfg.documentos_pago.length
      ? cfg.documentos_pago
      : DEFAULT_PAYMENT_DOCS.map(d => ({ ...d })),
    protectionDays: cfg?.dias_proteccion ?? 90,
  };
}

function mapReferral(row: any): Referral {
  // Client info comes through entidades_relacionadas → personas
  const er = row.entidades_relacionadas;
  const clientPersona = er?.personas;
  return {
    id: String(row.id),
    ambassadorId: String(row.id_entidad_relacionada_emb),
    clientName: clientPersona?.nombre_legal ?? '',
    phone: clientPersona?.telefono ?? '',
    email: clientPersona?.email ?? '',
    relationship: row.relacion_embajador ?? undefined,
    comments: row.comentarios ?? undefined,
    interestType: (row.tipo_interes ?? 'indefinido') as InterestType,
    productInterest: row.producto_interes ?? undefined,
    consent: row.consentimiento ?? false,
    registeredAt: row.fecha_creacion ?? new Date().toISOString(),
    status: (row.estatus ?? 'registrado') as ReferralStatus,
    assignedAdvisorId: row.id_asesor_asignado ?? undefined,
    assignedAdvisorName: row.nombre_asesor ?? undefined,
    assignedAdvisorRole: row.rol_asesor ?? undefined,
    assignedAdvisorPhone: row.telefono_asesor ?? undefined,
    assignedAdvisorEmail: row.email_asesor ?? undefined,
    assignedAt: row.fecha_asignacion ?? undefined,
    assignmentStatus: (row.estatus_asignacion ?? 'sin_asignar') as AssignmentStatus,
    lastAdvisorUpdate: row.ultima_actualizacion_asesor ?? undefined,
    internalNotes: Array.isArray(row.notas_internas) ? row.notas_internas : [],
    publicComments: row.comentarios_publicos ?? undefined,
    nextStepOverride: row.proximo_paso ?? undefined,
    protectionStatus: (row.estatus_proteccion ?? 'pendiente') as ProtectionStatus,
    saleAmount: row.monto_venta != null ? Number(row.monto_venta) : undefined,
    commissionAmount: Number(row.monto_comision) || 0,
    commissionStatus: (row.estatus_comision ?? 'potencial') as CommissionStatus,
    estimatedPaymentDate: row.fecha_pago_estimada ?? undefined,
    paymentDate: row.fecha_pago ?? undefined,
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : [],
  };
}

function mapAdvisor(row: any): Advisor {
  return {
    id: row.email,
    idPersona: row.id_persona ?? undefined,
    name: row.personas?.nombre_legal ?? row.nombre ?? '',
    role: (row.roles as any)?.nombre ?? '',
    phone: row.telefono ?? row.personas?.telefono ?? undefined,
    email: row.email ?? undefined,
    active: row.activo ?? true,
  };
}

// ─── Ctx interface ───────────────────────────────────────────────────────────

interface Ctx {
  ambassadors: Ambassador[];
  referrals: Referral[];
  notifications: AmbassadorNotification[];
  advisors: Advisor[];
  advisorNotifications: AdvisorNotification[];
  settings: AmbassadorsSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<AmbassadorsSettings>) => void;
  updateAdvisor: (id: string, patch: Partial<Advisor>) => void;
  updateAmbassador: (id: string, patch: Partial<Ambassador>) => void;
  deleteAmbassador: (id: string) => void;
  setDocumentStatus: (ambassadorId: string, key: string, status: DocumentStatus, fileName?: string) => void;
  updateReferralStatus: (id: string, status: ReferralStatus, actor?: 'admin' | 'embajador') => void;
  validateReferral: (id: string) => void;
  markDuplicate: (id: string) => void;
  assignAdvisor: (referralId: string, advisorId: string | null) => void;
  setAssignmentStatus: (referralId: string, status: AssignmentStatus) => void;
  addInternalNote: (id: string, note: string) => void;
  setPublicComments: (id: string, text: string) => void;
  setNextStep: (id: string, text: string) => void;
  setProtectionStatus: (id: string, status: ProtectionStatus) => void;
  setSaleAmount: (id: string, amount: number) => void;
  setCommissionStatus: (id: string, status: CommissionStatus) => void;
  setEstimatedPaymentDate: (id: string, dateISO: string) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: (ambassadorId: string) => void;
  markAdvisorNotifRead: (id: string) => void;
}

const AmbassadorsContext = createContext<Ctx | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AmbassadorsProvider({ children }: { children: React.ReactNode }) {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<AmbassadorNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_NOTIFS_KEY) ?? '[]'); } catch { return []; }
  });
  const [advisorNotifications, setAdvisorNotifications] = useState<AdvisorNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_ADVISOR_NOTIFS_KEY) ?? '[]'); } catch { return []; }
  });
  const [settings, setSettings] = useState<AmbassadorsSettings>(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
  });

  useEffect(() => { localStorage.setItem(LS_NOTIFS_KEY, JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem(LS_ADVISOR_NOTIFS_KEY, JSON.stringify(advisorNotifications)); }, [advisorNotifications]);
  useEffect(() => { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  const referralsRef = useRef(referrals);
  const ambassadorsRef = useRef(ambassadors);
  const advisorsRef = useRef(advisors);
  useEffect(() => { referralsRef.current = referrals; }, [referrals]);
  useEffect(() => { ambassadorsRef.current = ambassadors; }, [ambassadors]);
  useEffect(() => { advisorsRef.current = advisors; }, [advisors]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadAmbassadors = useCallback(async () => {
    // Resolve tipo_entidad id for "Embajador"
    const { data: tipoData } = await supabase
      .from('tipos_entidad')
      .select('id')
      .eq('nombre', 'Embajador')
      .maybeSingle();

    if (!tipoData) return;

    const { data, error } = await supabase
      .from('entidades_relacionadas')
      .select(`
        id, id_persona, activo, fecha_creacion,
        personas!entidades_relacionadas_id_persona_fkey(nombre_legal, email, telefono, clave_pais_telefono),
        embajadores_config(
          codigo, empresa, tipo, pct_comision, monto_fijo, trigger_comision,
          dias_proteccion, notas, estatus, documentos_pago
        )
      `)
      .eq('id_tipo_entidad', tipoData.id)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false });

    if (!error && data) setAmbassadors(data.map(mapAmbassador));
  }, []);

  const loadReferrals = useCallback(async () => {
    const { data, error } = await supabase
      .from('embajadores_referidos')
      .select(`
        id, id_persona_embajador, id_entidad_relacionada, id_entidad_relacionada_emb,
        tipo_interes, producto_interes, relacion_embajador, comentarios, consentimiento,
        estatus, id_asesor_asignado, nombre_asesor, rol_asesor, telefono_asesor, email_asesor,
        estatus_asignacion, fecha_asignacion, ultima_actualizacion_asesor,
        notas_internas, comentarios_publicos, proximo_paso, estatus_proteccion,
        monto_venta, monto_comision, estatus_comision, fecha_pago_estimada, fecha_pago,
        audit_trail, fecha_creacion, activo,
        entidades_relacionadas(
          id_persona,
          personas(nombre_legal, email, telefono)
        )
      `)
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false });

    if (!error && data) setReferrals(data.map(mapReferral));
  }, []);

  const loadAdvisors = useCallback(async () => {
    // rol_id 9 = "Agente Interno"
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        nombre, email, telefono, activo, id_persona,
        roles!rol_id(nombre),
        personas!id_persona(nombre_legal, telefono)
      `)
      .eq('activo', true)
      .eq('rol_id', 9)
      .order('nombre');
    if (error) {
      console.error('loadAdvisors error:', error);
      return;
    }
    if (data) {
      setAdvisors(data.map(mapAdvisor));
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadAmbassadors(), loadReferrals(), loadAdvisors()]);
  }, [loadAmbassadors, loadReferrals, loadAdvisors]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushNotification = (ambassadorId: string, type: string, message: string, referralId?: string) => {
    setNotifications(p => [
      { id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ambassadorId, referralId, type, message, createdAt: new Date().toISOString(), read: false },
      ...p,
    ]);
  };

  const pushAdvisorNotif = (n: Omit<AdvisorNotification, 'id' | 'createdAt' | 'read'>) => {
    setAdvisorNotifications(p => [
      { id: `advn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(), read: false, ...n },
      ...p,
    ]);
  };

  const dbUpdateReferral = (id: string, patch: Record<string, any>) => {
    supabase.from('embajadores_referidos').update(patch).eq('id', Number(id))
      .then(({ error }) => { if (error) { console.error(error); toast.error('Error al guardar cambio'); } });
  };

  // Updates fields in embajadores_config (keyed by id_entidad_relacionada = Ambassador.id)
  const dbUpdateAmbassadorConfig = (id: string, patch: Record<string, any>) => {
    supabase.from('embajadores_config').update(patch).eq('id_entidad_relacionada', Number(id))
      .then(({ error }) => { if (error) { console.error(error); toast.error('Error al guardar cambio'); } });
  };

  const STATUS_NOTIF: Partial<Record<ReferralStatus, string>> = {
    validado: 'Tu referido fue validado correctamente.',
    contactado: 'Nuestro equipo ya contactó a tu referido.',
    cita_agendada: 'Tu referido tiene cita agendada.',
    apartado: 'Tu referido apartó. El proceso avanza.',
    promesa_firmada: 'Tu referido firmó promesa.',
    venta_cerrada: 'Tu referido cerró venta.',
    comision_generada: 'Se generó tu comisión.',
    comision_pagada: 'Tu comisión fue pagada.',
    duplicado: 'Tu referido fue marcado como duplicado en revisión.',
    descartado: 'Tu referido fue descartado.',
  };

  // ── Ctx value ─────────────────────────────────────────────────────────────

  const ctx: Ctx = {
    ambassadors, referrals, notifications, advisors, advisorNotifications, settings, loading, refresh,

    updateSettings: (patch) => setSettings(s => ({ ...s, ...patch })),

    updateAdvisor: (id, patch) => {
      setAdvisors(p => p.map(a => a.id === id ? { ...a, ...patch } : a));
      if (patch.active !== undefined) {
        supabase.from('usuarios').update({ activo: patch.active }).eq('email', id)
          .then(({ error }) => { if (error) console.error(error); });
      }
    },

    updateAmbassador: (id, patch) => {
      setAmbassadors(p => p.map(a => a.id === id ? { ...a, ...patch } : a));
      const dbPatch: Record<string, any> = {};
      if (patch.company !== undefined) dbPatch.empresa = patch.company;
      if (patch.type !== undefined) dbPatch.tipo = patch.type;
      if (patch.status !== undefined) dbPatch.estatus = patch.status;
      if (patch.commissionPct !== undefined) dbPatch.pct_comision = patch.commissionPct;
      if (patch.fixedAmount !== undefined) dbPatch.monto_fijo = patch.fixedAmount;
      if (patch.commissionTrigger !== undefined) dbPatch.trigger_comision = patch.commissionTrigger;
      if (patch.protectionDays !== undefined) dbPatch.dias_proteccion = patch.protectionDays;
      if (patch.notes !== undefined) dbPatch.notas = patch.notes;
      if (patch.paymentDocs !== undefined) dbPatch.documentos_pago = patch.paymentDocs;
      if (Object.keys(dbPatch).length) dbUpdateAmbassadorConfig(id, dbPatch);
    },

    deleteAmbassador: (id) => {
      setAmbassadors(p => p.filter(a => a.id !== id));
      supabase.from('entidades_relacionadas').update({ activo: false }).eq('id', Number(id))
        .then(({ error }) => { if (error) { console.error(error); toast.error('Error al guardar cambio'); } });
    },

    setDocumentStatus: (ambassadorId, key, status, fileName) => {
      setAmbassadors(p => p.map(a => {
        if (a.id !== ambassadorId) return a;
        const docs = (a.paymentDocs ?? DEFAULT_PAYMENT_DOCS.map(d => ({ ...d }))).map(d =>
          d.key === key
            ? { ...d, status, fileName: fileName ?? d.fileName, uploadedAt: fileName ? new Date().toISOString() : d.uploadedAt }
            : d,
        );
        dbUpdateAmbassadorConfig(ambassadorId, { documentos_pago: docs });
        return { ...a, paymentDocs: docs };
      }));
    },

    updateReferralStatus: (id, status, actor = 'admin') => {
      const now = new Date().toISOString();
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail: AmbassadorAuditEvent[] = [
          ...r.auditTrail,
          { timestamp: now, actor, type: `status:${status}` },
        ];
        let updated: Referral = { ...r, status, auditTrail: newTrail };
        const dbPatch: Record<string, any> = { estatus: status, audit_trail: newTrail };
        if (status === 'venta_cerrada' && updated.commissionStatus === 'potencial') {
          updated = { ...updated, commissionStatus: 'generada' };
          dbPatch.estatus_comision = 'generada';
        }
        if (status === 'comision_pagada') {
          updated = { ...updated, commissionStatus: 'pagada', paymentDate: now };
          dbPatch.estatus_comision = 'pagada';
          dbPatch.fecha_pago = now;
        }
        dbUpdateReferral(id, dbPatch);
        const msg = STATUS_NOTIF[status];
        if (msg) pushNotification(updated.ambassadorId, `status:${status}`, msg, updated.id);
        return updated;
      }));
    },

    validateReferral: (id) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const now = new Date().toISOString();
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: 'validado' }];
        const updated = { ...r, status: 'validado' as ReferralStatus, protectionStatus: 'protegido' as ProtectionStatus, auditTrail: newTrail };
        dbUpdateReferral(id, { estatus: 'validado', estatus_proteccion: 'protegido', audit_trail: newTrail });
        pushNotification(updated.ambassadorId, 'validado', 'Tu referido fue validado correctamente.', updated.id);
        return updated;
      }));
    },

    markDuplicate: (id) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const now = new Date().toISOString();
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: 'duplicado' }];
        const updated = { ...r, status: 'duplicado' as ReferralStatus, commissionStatus: 'cancelada' as CommissionStatus, protectionStatus: 'duplicado_revision' as ProtectionStatus, auditTrail: newTrail };
        dbUpdateReferral(id, { estatus: 'duplicado', estatus_comision: 'cancelada', estatus_proteccion: 'duplicado_revision', audit_trail: newTrail });
        pushNotification(updated.ambassadorId, 'duplicado', 'Tu referido fue marcado como duplicado en revisión.', updated.id);
        return updated;
      }));
    },

    assignAdvisor: (referralId, advisorId) => {
      const now = new Date().toISOString();
      setReferrals(prev => prev.map(r => {
        if (r.id !== referralId) return r;
        const wasAssigned = !!r.assignedAdvisorId;

        if (!advisorId) {
          const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: 'asesor_removido', details: r.assignedAdvisorName }];
          const updated = { ...r, assignedAdvisorId: undefined, assignedAdvisorName: undefined, assignedAdvisorRole: undefined, assignedAdvisorPhone: undefined, assignedAdvisorEmail: undefined, assignedAt: undefined, assignmentStatus: 'sin_asignar' as AssignmentStatus, auditTrail: newTrail };
          dbUpdateReferral(referralId, { id_asesor_asignado: null, nombre_asesor: null, rol_asesor: null, telefono_asesor: null, email_asesor: null, id_persona_asesor: null, fecha_asignacion: null, estatus_asignacion: 'sin_asignar', audit_trail: newTrail });
          pushNotification(updated.ambassadorId, 'asesor_removido', 'La asignación de asesor fue actualizada.', updated.id);
          return updated;
        }

        const adv = advisorsRef.current.find(a => a.id === advisorId);
        if (!adv) return r;

        const newStatus: AssignmentStatus = wasAssigned && r.assignedAdvisorId !== advisorId ? 'reasignado' : 'asignado';
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: wasAssigned ? 'asesor_reasignado' : 'asesor_asignado', details: `${adv.name} (${adv.role})` }];
        const updated = { ...r, assignedAdvisorId: adv.id, assignedAdvisorName: adv.name, assignedAdvisorRole: adv.role, assignedAdvisorPhone: adv.phone, assignedAdvisorEmail: adv.email, assignedAt: now, assignmentStatus: newStatus, auditTrail: newTrail };

        dbUpdateReferral(referralId, {
          id_asesor_asignado: adv.id,       // email
          id_persona_asesor: adv.idPersona ?? null,
          nombre_asesor: adv.name,
          rol_asesor: adv.role,
          telefono_asesor: adv.phone ?? null,
          email_asesor: adv.email ?? null,
          fecha_asignacion: now,
          estatus_asignacion: newStatus,
          ultima_actualizacion_asesor: now,
          audit_trail: newTrail,
        });

        const amb = ambassadorsRef.current.find(x => x.id === updated.ambassadorId);
        pushAdvisorNotif({
          advisorId: adv.id, referralId: updated.id, type: 'lead_asignado',
          title: 'Nuevo referido asignado',
          message: `Se te asignó un referido de ${amb?.fullName ?? 'Embajador'}: ${updated.clientName} · ${updated.phone} · ${updated.email}. Próximo paso: ${nextStepFor(updated.status)}.`,
        });
        pushNotification(updated.ambassadorId, 'asesor_asignado', 'Tu referido ya fue asignado a un asesor de ventas.', updated.id);
        return updated;
      }));
    },

    setAssignmentStatus: (referralId, status) => {
      const now = new Date().toISOString();
      setReferrals(prev => prev.map(r => {
        if (r.id !== referralId) return r;
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: `assignment:${status}` }];
        dbUpdateReferral(referralId, { estatus_asignacion: status, ultima_actualizacion_asesor: now, audit_trail: newTrail });
        return { ...r, assignmentStatus: status, lastAdvisorUpdate: now, auditTrail: newTrail };
      }));
    },

    addInternalNote: (id, note) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const now = new Date().toISOString();
        const newNotes = [...r.internalNotes, note];
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: 'nota_interna' }];
        dbUpdateReferral(id, { notas_internas: newNotes, ultima_actualizacion_asesor: now, audit_trail: newTrail });
        return { ...r, internalNotes: newNotes, lastAdvisorUpdate: now, auditTrail: newTrail };
      }));
    },

    setPublicComments: (id, text) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: new Date().toISOString(), actor: 'admin' as const, type: 'comentario_publico' }];
        dbUpdateReferral(id, { comentarios_publicos: text, audit_trail: newTrail });
        return { ...r, publicComments: text, auditTrail: newTrail };
      }));
    },

    setNextStep: (id, text) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: new Date().toISOString(), actor: 'admin' as const, type: 'proximo_paso', details: text }];
        dbUpdateReferral(id, { proximo_paso: text, audit_trail: newTrail });
        return { ...r, nextStepOverride: text, auditTrail: newTrail };
      }));
    },

    setProtectionStatus: (id, status) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: new Date().toISOString(), actor: 'admin' as const, type: `proteccion:${status}` }];
        dbUpdateReferral(id, { estatus_proteccion: status, audit_trail: newTrail });
        return { ...r, protectionStatus: status, auditTrail: newTrail };
      }));
    },

    setSaleAmount: (id, amount) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: new Date().toISOString(), actor: 'admin' as const, type: 'venta_actualizada', details: `$${amount}` }];
        const amb = ambassadorsRef.current.find(a => a.id === r.ambassadorId);
        const commission = Math.round((amount * ((amb?.commissionPct ?? 0) / 100)) + (amb?.fixedAmount ?? 0));
        dbUpdateReferral(id, { monto_venta: amount, monto_comision: commission, audit_trail: newTrail });
        return { ...r, saleAmount: amount, commissionAmount: commission, auditTrail: newTrail };
      }));
    },

    setCommissionStatus: (id, status) => {
      const now = new Date().toISOString();
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: now, actor: 'admin' as const, type: `comision:${status}` }];
        const paymentDate = status === 'pagada' ? now : r.paymentDate;
        const dbPatch: Record<string, any> = { estatus_comision: status, audit_trail: newTrail };
        if (paymentDate) dbPatch.fecha_pago = paymentDate;
        dbUpdateReferral(id, dbPatch);
        const msgs: Partial<Record<CommissionStatus, string>> = {
          generada: 'Se generó tu comisión.',
          autorizada: 'Tu comisión fue autorizada para pago.',
          pagada: 'Tu comisión fue pagada.',
          cancelada: 'Tu comisión fue cancelada.',
        };
        const msg = msgs[status];
        if (msg) pushNotification(r.ambassadorId, `comision:${status}`, msg, r.id);
        return { ...r, commissionStatus: status, paymentDate, auditTrail: newTrail };
      }));
    },

    setEstimatedPaymentDate: (id, dateISO) => {
      setReferrals(prev => prev.map(r => {
        if (r.id !== id) return r;
        const newTrail = [...r.auditTrail, { timestamp: new Date().toISOString(), actor: 'admin' as const, type: 'fecha_estimada_pago', details: dateISO }];
        dbUpdateReferral(id, { fecha_pago_estimada: dateISO, audit_trail: newTrail });
        return { ...r, estimatedPaymentDate: dateISO, auditTrail: newTrail };
      }));
    },

    markNotificationRead: (id) =>
      setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)),

    markAllRead: (ambassadorId) =>
      setNotifications(p => p.map(n => n.ambassadorId === ambassadorId ? { ...n, read: true } : n)),

    markAdvisorNotifRead: (id) =>
      setAdvisorNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)),
  };

  return <AmbassadorsContext.Provider value={ctx}>{children}</AmbassadorsContext.Provider>;
}

export function useAmbassadors() {
  const c = useContext(AmbassadorsContext);
  if (!c) throw new Error('useAmbassadors must be used within AmbassadorsProvider');
  return c;
}
