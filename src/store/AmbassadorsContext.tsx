import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Ambassador,
  AmbassadorAuditEvent,
  AmbassadorNotification,
  AdvisorNotification,
  Advisor,
  AmbassadorsSettings,
  AssignmentStatus,
  CommissionStatus,
  DEFAULT_PAYMENT_DOCS,
  DEFAULT_SETTINGS,
  DocumentStatus,
  Referral,
  ReferralStatus,
  ProtectionStatus,
  detectDuplicate,
  nextStepFor,
} from '@/types/ambassadors';

const LS_KEY = 'sozu.ambassadors.v3';

interface PersistShape {
  ambassadors: Ambassador[];
  referrals: Referral[];
  notifications: AmbassadorNotification[];
  advisors: Advisor[];
  advisorNotifications: AdvisorNotification[];
  settings: AmbassadorsSettings;
}

const seedAmbassadors: Ambassador[] = [
  {
    id: 'amb-1', fullName: 'María Fernanda López', phone: '5512345678',
    email: 'mafer@example.com', company: 'Cliente premium', type: 'cliente',
    status: 'activo', createdAt: new Date().toISOString(), code: 'EMB-0001',
    referralLink: 'https://sozu.app/ref/EMB-0001', commissionPct: 0.5,
    commissionTrigger: 'enganche',
    paymentDocs: DEFAULT_PAYMENT_DOCS.map((d) => ({ ...d })),
    protectionDays: 90,
  },
  {
    id: 'amb-2', fullName: 'Carlos Reyes', phone: '5598765432',
    email: 'carlos@aliados.mx', company: 'Despacho aliado', type: 'aliado',
    status: 'activo', createdAt: new Date().toISOString(), code: 'EMB-0002',
    referralLink: 'https://sozu.app/ref/EMB-0002', commissionPct: 1.0,
    commissionTrigger: 'apartado',
    paymentDocs: DEFAULT_PAYMENT_DOCS.map((d) => ({ ...d })),
    protectionDays: 90,
  },
];

const seedAdvisors: Advisor[] = [
  { id: 'adv-1', name: 'Laura Méndez', role: 'Asesor Senior', phone: '5511223344', email: 'laura.mendez@sozu.com', active: true },
  { id: 'adv-2', name: 'Roberto Salazar', role: 'Asesor Comercial', phone: '5599887766', email: 'roberto.salazar@sozu.com', active: true },
  { id: 'adv-3', name: 'Diana Vargas', role: 'Gerente Comercial', phone: '5544332211', email: 'diana.vargas@sozu.com', active: true },
];

const seedReferrals: Referral[] = [
  {
    id: 'ref-1', ambassadorId: 'amb-1', clientName: 'Andrés Pérez',
    phone: '5544556677', email: 'andres@correo.com', interestType: 'inversion',
    productInterest: '2 recámaras', consent: true,
    registeredAt: new Date().toISOString(), status: 'en_seguimiento',
    internalNotes: ['Cliente interesado en piso medio.'],
    publicComments: 'Tu cliente ya fue contactado por nuestro equipo. Esperamos su decisión.',
    saleAmount: 4500000, commissionAmount: 22500, commissionStatus: 'potencial',
    assignedAdvisorId: 'adv-1', assignedAdvisorName: 'Laura Méndez',
    assignedAdvisorRole: 'Asesor Senior', assignedAdvisorPhone: '5511223344',
    assignedAdvisorEmail: 'laura.mendez@sozu.com',
    assignedAt: new Date().toISOString(), assignmentStatus: 'en_seguimiento',
    lastAdvisorUpdate: new Date().toISOString(),
    auditTrail: [{ timestamp: new Date().toISOString(), actor: 'embajador', type: 'creado' }],
  },
];

interface Ctx {
  ambassadors: Ambassador[];
  referrals: Referral[];
  notifications: AmbassadorNotification[];
  advisors: Advisor[];
  advisorNotifications: AdvisorNotification[];
  settings: AmbassadorsSettings;
  updateSettings: (patch: Partial<AmbassadorsSettings>) => void;
  createAdvisor: (a: Omit<Advisor, 'id'>) => Advisor;
  updateAdvisor: (id: string, patch: Partial<Advisor>) => void;
  createAmbassador: (a: Omit<Ambassador, 'id' | 'code' | 'referralLink' | 'createdAt'>) => Ambassador;
  updateAmbassador: (id: string, patch: Partial<Ambassador>) => void;
  deleteAmbassador: (id: string) => void;
  setDocumentStatus: (ambassadorId: string, key: string, status: DocumentStatus, fileName?: string) => void;
  createReferral: (
    r: Omit<Referral, 'id' | 'registeredAt' | 'status' | 'commissionAmount' | 'commissionStatus' | 'auditTrail' | 'internalNotes'>,
    opts?: { force?: boolean },
  ) => { referral: Referral | null; duplicate: Referral | null };
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

export function AmbassadorsProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo<PersistShape>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          ambassadors: p.ambassadors ?? seedAmbassadors,
          referrals: p.referrals ?? seedReferrals,
          notifications: p.notifications ?? [],
          advisors: p.advisors ?? seedAdvisors,
          advisorNotifications: p.advisorNotifications ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      }
    } catch {}
    return {
      ambassadors: seedAmbassadors, referrals: seedReferrals,
      notifications: [], advisors: seedAdvisors,
      advisorNotifications: [], settings: DEFAULT_SETTINGS,
    };
  }, []);

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>(initial.ambassadors);
  const [referrals, setReferrals] = useState<Referral[]>(initial.referrals);
  const [notifications, setNotifications] = useState<AmbassadorNotification[]>(initial.notifications);
  const [advisors, setAdvisors] = useState<Advisor[]>(initial.advisors);
  const [advisorNotifications, setAdvisorNotifications] = useState<AdvisorNotification[]>(initial.advisorNotifications);
  const [settings, setSettings] = useState<AmbassadorsSettings>(initial.settings);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      ambassadors, referrals, notifications, advisors, advisorNotifications, settings,
    }));
  }, [ambassadors, referrals, notifications, advisors, advisorNotifications, settings]);

  const nextCode = () => {
    const max = ambassadors.reduce((m, a) => {
      const n = parseInt(a.code.replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `EMB-${String(max + 1).padStart(4, '0')}`;
  };

  const pushNotification = (ambassadorId: string, type: string, message: string, referralId?: string) => {
    setNotifications((p) => [
      { id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ambassadorId, referralId, type, message,
        createdAt: new Date().toISOString(), read: false },
      ...p,
    ]);
  };

  const pushAdvisorNotif = (n: Omit<AdvisorNotification, 'id' | 'createdAt' | 'read'>) => {
    setAdvisorNotifications((p) => [
      { id: `advn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(), read: false, ...n },
      ...p,
    ]);
  };

  const audit = (referral: Referral, type: string, actor: AmbassadorAuditEvent['actor'] = 'admin', details?: string): Referral => ({
    ...referral,
    auditTrail: [...referral.auditTrail, { timestamp: new Date().toISOString(), actor, type, details }],
  });

  const computeCommission = (r: Referral, amb?: Ambassador): number => {
    const a = amb ?? ambassadors.find((x) => x.id === r.ambassadorId);
    if (!a) return r.commissionAmount;
    const pctPart = (r.saleAmount ?? 0) * (a.commissionPct / 100);
    return Math.round(pctPart + (a.fixedAmount ?? 0));
  };

  const STATUS_NOTIF: Partial<Record<ReferralStatus, string>> = {
    validado: 'Tu referido fue validado correctamente.',
    contactado: 'Nuestro equipo ya contactó a tu referido.',
    cita_agendada: 'Tu referido tiene cita agendada.',
    apartado: 'Tu referido apartó. El proceso avanza a la siguiente etapa.',
    promesa_firmada: 'Tu referido firmó promesa.',
    venta_cerrada: 'Tu referido cerró venta.',
    comision_generada: 'Se generó tu comisión.',
    comision_pagada: 'Tu comisión fue pagada.',
    duplicado: 'Tu referido fue marcado como duplicado en revisión.',
    descartado: 'Tu referido fue descartado.',
  };

  const ctx: Ctx = {
    ambassadors, referrals, notifications, advisors, advisorNotifications, settings,

    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),

    createAdvisor: (a) => {
      const adv: Advisor = { ...a, id: `adv-${Date.now()}` };
      setAdvisors((p) => [...p, adv]);
      return adv;
    },
    updateAdvisor: (id, patch) =>
      setAdvisors((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a))),

    createAmbassador: (a) => {
      const code = nextCode();
      const newAmb: Ambassador = {
        ...a, id: `amb-${Date.now()}`, code,
        referralLink: `https://sozu.app/ref/${code}`,
        createdAt: new Date().toISOString(),
        paymentDocs: a.paymentDocs ?? DEFAULT_PAYMENT_DOCS.map((d) => ({ ...d })),
        protectionDays: a.protectionDays ?? 90,
      };
      setAmbassadors((p) => [...p, newAmb]);
      return newAmb;
    },
    updateAmbassador: (id, patch) =>
      setAmbassadors((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    deleteAmbassador: (id) => setAmbassadors((p) => p.filter((a) => a.id !== id)),

    setDocumentStatus: (ambassadorId, key, status, fileName) =>
      setAmbassadors((p) =>
        p.map((a) => {
          if (a.id !== ambassadorId) return a;
          const docs = (a.paymentDocs ?? DEFAULT_PAYMENT_DOCS.map((d) => ({ ...d }))).map((d) =>
            d.key === key
              ? { ...d, status, fileName: fileName ?? d.fileName, uploadedAt: fileName ? new Date().toISOString() : d.uploadedAt }
              : d,
          );
          return { ...a, paymentDocs: docs };
        }),
      ),

    createReferral: (r, opts) => {
      const dup = detectDuplicate(referrals, r);
      if (dup && !opts?.force) return { referral: null, duplicate: dup };
      const amb = ambassadors.find((a) => a.id === r.ambassadorId);
      const newRef: Referral = {
        ...r, id: `ref-${Date.now()}`,
        registeredAt: new Date().toISOString(), status: 'registrado',
        commissionAmount: 0, commissionStatus: 'potencial',
        internalNotes: [], assignmentStatus: 'sin_asignar',
        auditTrail: [{ timestamp: new Date().toISOString(), actor: 'embajador', type: 'creado' }],
      };
      newRef.commissionAmount = computeCommission(newRef, amb);
      setReferrals((p) => [...p, newRef]);
      pushNotification(newRef.ambassadorId, 'referido_registrado', `Registraste a ${newRef.clientName}.`, newRef.id);
      return { referral: newRef, duplicate: dup };
    },

    updateReferralStatus: (id, status, actor = 'admin') =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== id) return r;
          let next = audit({ ...r, status, lastAdvisorUpdate: actor === 'admin' ? new Date().toISOString() : r.lastAdvisorUpdate }, `status:${status}`, actor);
          if (status === 'venta_cerrada' && next.commissionStatus === 'potencial') {
            next = { ...next, commissionStatus: 'generada' };
          }
          if (status === 'comision_pagada') {
            next = { ...next, commissionStatus: 'pagada', paymentDate: new Date().toISOString() };
          }
          const msg = STATUS_NOTIF[status];
          if (msg) pushNotification(next.ambassadorId, `status:${status}`, msg, next.id);
          return next;
        }),
      ),

    validateReferral: (id) =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== id) return r;
          const next = audit({ ...r, status: 'validado', protectionStatus: 'protegido' }, 'validado');
          pushNotification(next.ambassadorId, 'validado', 'Tu referido fue validado correctamente.', next.id);
          return next;
        }),
      ),

    markDuplicate: (id) =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== id) return r;
          const next = audit({ ...r, status: 'duplicado', commissionStatus: 'cancelada', protectionStatus: 'duplicado_revision' }, 'duplicado');
          pushNotification(next.ambassadorId, 'duplicado', 'Tu referido fue marcado como duplicado en revisión.', next.id);
          return next;
        }),
      ),

    assignAdvisor: (referralId, advisorId) =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== referralId) return r;
          const wasAssigned = !!r.assignedAdvisorId;
          if (!advisorId) {
            const next = audit(
              { ...r, assignedAdvisorId: undefined, assignedAdvisorName: undefined,
                assignedAdvisorRole: undefined, assignedAdvisorPhone: undefined,
                assignedAdvisorEmail: undefined, assignedAt: undefined,
                assignmentStatus: 'sin_asignar' },
              'asesor_removido', 'admin', r.assignedAdvisorName,
            );
            pushNotification(next.ambassadorId, 'asesor_removido',
              'La asignación de asesor a tu referido fue actualizada.', next.id);
            return next;
          }
          const adv = advisors.find((a) => a.id === advisorId);
          if (!adv) return r;
          const newStatus: AssignmentStatus = wasAssigned && r.assignedAdvisorId !== advisorId ? 'reasignado' : 'asignado';
          const next = audit(
            { ...r, assignedAdvisorId: adv.id, assignedAdvisorName: adv.name,
              assignedAdvisorRole: adv.role, assignedAdvisorPhone: adv.phone,
              assignedAdvisorEmail: adv.email, assignedAt: new Date().toISOString(),
              assignmentStatus: newStatus },
            wasAssigned ? 'asesor_reasignado' : 'asesor_asignado', 'admin',
            `${adv.name} (${adv.role})`,
          );
          const amb = ambassadors.find((x) => x.id === next.ambassadorId);
          pushAdvisorNotif({
            advisorId: adv.id, referralId: next.id, type: 'lead_asignado',
            title: 'Nuevo referido asignado',
            message: `Se te asignó un referido de ${amb?.fullName ?? 'Embajador'}: ${next.clientName} · Tel ${next.phone} · ${next.email}. Próximo paso: ${nextStepFor(next.status)}.`,
          });
          pushNotification(next.ambassadorId, 'asesor_asignado',
            'Tu referido ya fue asignado a un asesor de ventas. Puedes consultar sus datos de contacto en el detalle del referido.',
            next.id);
          return next;
        }),
      ),

    setAssignmentStatus: (referralId, status) =>
      setReferrals((p) =>
        p.map((r) =>
          r.id === referralId
            ? audit({ ...r, assignmentStatus: status, lastAdvisorUpdate: new Date().toISOString() },
                `assignment:${status}`, 'admin')
            : r,
        ),
      ),

    addInternalNote: (id, note) =>
      setReferrals((p) =>
        p.map((r) =>
          r.id === id
            ? audit({ ...r, internalNotes: [...r.internalNotes, note], lastAdvisorUpdate: new Date().toISOString() }, 'nota_interna')
            : r,
        ),
      ),

    setPublicComments: (id, text) =>
      setReferrals((p) => p.map((r) => (r.id === id ? audit({ ...r, publicComments: text }, 'comentario_publico') : r))),

    setNextStep: (id, text) =>
      setReferrals((p) => p.map((r) => (r.id === id ? audit({ ...r, nextStepOverride: text }, 'proximo_paso', 'admin', text) : r))),

    setProtectionStatus: (id, status) =>
      setReferrals((p) => p.map((r) => (r.id === id ? audit({ ...r, protectionStatus: status }, `proteccion:${status}`) : r))),

    setSaleAmount: (id, amount) =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, saleAmount: amount };
          updated.commissionAmount = computeCommission(updated);
          return audit(updated, 'venta_actualizada', 'admin', `$${amount}`);
        }),
      ),

    setCommissionStatus: (id, status) =>
      setReferrals((p) =>
        p.map((r) => {
          if (r.id !== id) return r;
          const next: Referral = {
            ...r, commissionStatus: status,
            paymentDate: status === 'pagada' ? new Date().toISOString() : r.paymentDate,
          };
          const msg =
            status === 'generada' ? 'Se generó tu comisión.' :
            status === 'autorizada' ? 'Tu comisión fue autorizada para pago.' :
            status === 'pagada' ? 'Tu comisión fue pagada.' :
            status === 'cancelada' ? 'Tu comisión fue cancelada.' : '';
          if (msg) pushNotification(next.ambassadorId, `comision:${status}`, msg, next.id);
          return audit(next, `comision:${status}`, 'admin');
        }),
      ),

    setEstimatedPaymentDate: (id, dateISO) =>
      setReferrals((p) =>
        p.map((r) => (r.id === id ? audit({ ...r, estimatedPaymentDate: dateISO }, 'fecha_estimada_pago', 'admin', dateISO) : r)),
      ),

    markNotificationRead: (id) =>
      setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))),

    markAllRead: (ambassadorId) =>
      setNotifications((p) => p.map((n) => (n.ambassadorId === ambassadorId ? { ...n, read: true } : n))),

    markAdvisorNotifRead: (id) =>
      setAdvisorNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))),
  };

  return <AmbassadorsContext.Provider value={ctx}>{children}</AmbassadorsContext.Provider>;
}

export function useAmbassadors() {
  const c = useContext(AmbassadorsContext);
  if (!c) throw new Error('useAmbassadors must be used within AmbassadorsProvider');
  return c;
}