// SOZU · Onboarding "Registrar mi propiedad" — Estado global (mock)
// Portado del prototipo Lovable "Property Passport". Fase 1 = solo UI / mock.
// Asume RLS server-side en producción: el nuevo dueño solo ve su unidad,
// el anterior pierde acceso al transferirse.
// Todas las integraciones reales van marcadas con `// SWAP POINT:` en los sitios de uso.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  margotFachada,
  margotWordmark,
  margotWordmarkLight,
  margotIsotipo,
  margotKindPlanta,
} from "@/lib/portal-cliente/onboarding-assets";

export type ProjectKey = "daiku" | "margot" | "monocolo" | "bottura";

export interface ProjectBrand {
  wordmark?: string;
  wordmarkLight?: string;
  isotipo?: string;
  accent: string; // color acento del desarrollo (hex)
  ink: string; // color principal oscuro
}

export interface Project {
  key: ProjectKey;
  name: string;
  city: string;
  cover: string;
  tagline: string;
  brand?: ProjectBrand;
}

export interface Property {
  id: string;
  project: ProjectKey;
  unit: string;
  address: string;
  folioReal: string;
  originalOwnerId: string;
  currentOwnerId: string;
  transferredAt?: string;
  maintenanceMonthly: number; // MXN
  // Ficha extendida (opcional; usada por Margot en onboarding)
  model?: string;
  floor?: number;
  floorTotal?: number;
  mInt?: number;
  mExt?: number;
  bedrooms?: number;
  baths?: number;
  halfBaths?: number;
  parking?: number;
  features?: string[];
  description?: string;
  image?: string;
  floorPlan?: string;
}

export type PersonType = "fisica" | "moral";

export type DocStatus = "en_revision" | "validado" | "rechazado" | "por_confirmar";

export interface DocField {
  key: string;
  label: string;
  value: string;
  status: DocStatus;
  sourceDocId: string;
}

export type DocType =
  | "id_oficial"
  | "escritura"
  | "certificado_rpp"
  | "predial"
  | "curp"
  | "csf"
  | "acta_constitutiva"
  | "poder_rl"
  | "id_rl";


export interface UploadedDoc {
  id: string;
  type: DocType;
  filename: string;
  status: DocStatus;
  confidence: number;
  fields: DocField[];
  confirmed: boolean;
  createdAt: string;
  rejectedReason?: string;
  managedBySozu?: boolean; // para certificado RPP gestionado por SOZU
}

export type CheckStatus = "ok" | "warn" | "fail" | "idle";

export interface VerificationCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export type OnboardingLevel = 0 | 1 | 2;

export type PurchaseType = "contado" | "credito";
export type PurchaseRecency = "reciente" | "antiguo";

export interface OnboardingState {
  step: number;
  personType: PersonType;
  unitId: string | null;
  unitConfirmed: boolean;
  accountEmail: string | null;
  accountPhone: string | null;
  accountReady: boolean;
  emailVerificationSent: boolean;
  emailVerified: boolean;
  privacyAccepted: boolean;
  purchaseType: PurchaseType;
  purchaseRecency: PurchaseRecency;
  rppInTramite: boolean;
  docs: UploadedDoc[];
  level: OnboardingLevel;
  caseId: string | null;
  routedDepartments: string[];
  completedAt?: string;
}


export interface Lead {
  id: string;
  project: ProjectKey;
  createdAt: string;
  note?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  kind: "info" | "warn" | "ok";
}

export interface DemoOverrides {
  forceNameMismatch: boolean;
  forceFolioMismatch: boolean;
  forceChainMismatch: boolean;
  rppState: "vigente" | "vencido" | "gravamen";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isNewOwner: boolean; // registrado por el flujo de reventa
}

export interface PortalState {
  auth: {
    user: AuthUser | null;
    sensitiveSessionUntil: number | null;
  };
  projects: Project[];
  properties: Property[];
  leads: Lead[];
  notifications: Notification[];
  onboarding: OnboardingState;
  demo: DemoOverrides;

  // Acciones
  login: (email: string, name?: string) => void;
  logout: () => void;
  openSensitiveSession: () => void;
  setOnboarding: (partial: Partial<OnboardingState>) => void;
  resetOnboarding: () => void;
  addDoc: (doc: UploadedDoc) => void;
  updateDoc: (id: string, partial: Partial<UploadedDoc>) => void;
  removeDoc: (id: string) => void;
  addLead: (lead: Lead) => void;
  markNotification: (id: string, read: boolean) => void;
  pushNotification: (n: Omit<Notification, "id" | "createdAt" | "read">) => void;
  setDemo: (partial: Partial<DemoOverrides>) => void;
  approveLevel: (level: 1 | 2) => void;
  transferOwnership: (propertyId: string, newOwnerId: string) => void;
  seedOriginalOwner: (propertyId: string, ownerId: string) => void;
  reset: () => void;
}

const MARGOT_COVER_GRADIENT = "linear-gradient(135deg, #2b2b2b, #a48b6a)";

const PROJECTS: Project[] = [
  {
    key: "daiku",
    name: "Daiku",
    city: "Guadalajara, Providencia",
    cover: "linear-gradient(135deg, #1a1a1a, #57ae75)",
    tagline: "Arquitectura japonesa contemporánea en el corazón de Providencia.",
  },
  {
    key: "margot",
    name: "Margot",
    city: "Guadalajara, Chapultepec",
    cover: margotFachada
      ? `url('${margotFachada}') center/cover no-repeat, ${MARGOT_COVER_GRADIENT}`
      : MARGOT_COVER_GRADIENT,
    tagline: "Residencial boutique con jardines interiores.",
    brand: {
      wordmark: margotWordmark,
      wordmarkLight: margotWordmarkLight,
      isotipo: margotIsotipo,
      accent: "#ea4a3f",
      ink: "#4a5754",
    },
  },
  {
    key: "monocolo",
    name: "Monócolo",
    city: "Zapopan, Andares",
    cover: "linear-gradient(135deg, #000000, #575757)",
    tagline: "Torre de usos mixtos frente al corredor Andares.",
  },
  {
    key: "bottura",
    name: "Bottura",
    city: "Guadalajara, Lafayette",
    cover: "linear-gradient(135deg, #1a2b1a, #57ae75)",
    tagline: "Lofts de autor en Colonia Americana.",
  },
];

const MARGOT_MODELS = ["Breath", "Heart", "Joy", "Kind", "Soft"] as const;
const MARGOT_MODEL_SPECS: Record<
  (typeof MARGOT_MODELS)[number],
  { mInt: number; mExt: number; bedrooms: number; baths: number; halfBaths: number; features: string[] }
> = {
  Breath: { mInt: 68.4, mExt: 6.2, bedrooms: 2, baths: 1, halfBaths: 1, features: ["Balcón", "Cuarto de Lavado", "Clóset"] },
  Heart: { mInt: 74.9, mExt: 8.4, bedrooms: 2, baths: 2, halfBaths: 0, features: ["Terraza", "Cuarto de Lavado", "Vestidor"] },
  Joy: { mInt: 61.1, mExt: 0, bedrooms: 1, baths: 1, halfBaths: 1, features: ["Flex", "Cuarto de Lavado", "Clóset"] },
  Kind: { mInt: 53.72, mExt: 0, bedrooms: 1, baths: 1, halfBaths: 0, features: ["Cuarto de Lavado", "Flex", "Clóset"] },
  Soft: { mInt: 45.2, mExt: 0, bedrooms: 1, baths: 1, halfBaths: 0, features: ["Cuarto de Lavado", "Clóset"] },
};

function buildMargotUnits(): Property[] {
  const out: Property[] = [];
  for (let floor = 2; floor <= 17; floor++) {
    for (let i = 1; i <= 5; i++) {
      const model = MARGOT_MODELS[(i - 1) % MARGOT_MODELS.length];
      const spec = MARGOT_MODEL_SPECS[model];
      const unit = `${floor}${String(i).padStart(2, "0")}`;
      const isSeed = unit === "308";
      out.push({
        id: `prop-margot-${unit}`,
        project: "margot",
        unit,
        address: `Av. Chapultepec 480, int. ${unit}, Guadalajara, Jal.`,
        folioReal: isSeed ? "GDL-2019-011230" : `GDL-2019-0${11000 + floor * 20 + i}`,
        originalOwnerId: isSeed ? "user-original-002" : `user-original-mgt-${unit}`,
        currentOwnerId: isSeed ? "user-original-002" : `user-original-mgt-${unit}`,
        maintenanceMonthly: 3980,
        model,
        floor,
        floorTotal: 17,
        mInt: spec.mInt,
        mExt: spec.mExt,
        bedrooms: spec.bedrooms,
        baths: spec.baths,
        halfBaths: spec.halfBaths,
        parking: 1,
        features: spec.features,
        image: margotFachada,
        floorPlan: margotKindPlanta,
        description:
          "Departamento a 3 minutos de Av. López Mateos y Lázaro Cárdenas, a una cuadra de la Expo Guadalajara, rodeado de cafés, restaurantes, supermercados, parques, escuelas y bancos. Al ingreso, área de lavado y cuarto flexible; cocina integrada a sala-comedor; recámara con clóset y baño completo; incluye un cajón de estacionamiento. Margot ofrece opción de amueblado y servicios (gas, internet, telefonía y HDTV), reserva de amenidades, control de acceso a visitantes y app de comunicación entre residentes.",
      });
    }
  }
  return out;
}

const PROPERTIES: Property[] = [
  {
    id: "prop-daiku-402",
    project: "daiku",
    unit: "402",
    address: "Av. Providencia 2450, int. 402, Guadalajara, Jal.",
    folioReal: "GDL-2018-004521",
    originalOwnerId: "user-original-001",
    currentOwnerId: "user-original-001",
    maintenanceMonthly: 4850,
  },
  ...buildMargotUnits(),
  {
    id: "prop-monocolo-1508",
    project: "monocolo",
    unit: "1508",
    address: "Av. Patria 890, int. 1508, Zapopan, Jal.",
    folioReal: "ZAP-2021-007744",
    originalOwnerId: "user-original-003",
    currentOwnerId: "user-original-003",
    maintenanceMonthly: 6120,
  },
  {
    id: "prop-bottura-a3",
    project: "bottura",
    unit: "A-3",
    address: "Argentina 45, int. A-3, Guadalajara, Jal.",
    folioReal: "GDL-2022-002988",
    originalOwnerId: "user-original-004",
    currentOwnerId: "user-original-004",
    maintenanceMonthly: 3420,
  },
];

const initialOnboarding: OnboardingState = {
  step: 1,
  personType: "fisica",
  unitId: null,
  unitConfirmed: false,
  accountEmail: null,
  accountPhone: null,
  accountReady: false,
  emailVerificationSent: false,
  emailVerified: false,
  privacyAccepted: false,
  purchaseType: "contado",
  purchaseRecency: "antiguo",
  rppInTramite: false,
  docs: [],
  level: 0,
  caseId: null,
  routedDepartments: [],
};

const initialDemo: DemoOverrides = {
  forceNameMismatch: false,
  forceFolioMismatch: false,
  forceChainMismatch: false,
  rppState: "vigente",
};

const initial = {
  auth: { user: null as AuthUser | null, sensitiveSessionUntil: null as number | null },
  projects: PROJECTS,
  properties: PROPERTIES,
  leads: [] as Lead[],
  notifications: [] as Notification[],
  onboarding: structuredClone(initialOnboarding),
  demo: structuredClone(initialDemo),
};

export const usePortal = create<PortalState>()(
  persist(
    (set, get) => ({
      ...structuredClone(initial),

      login: (email, name) =>
        set((s) => ({
          auth: {
            ...s.auth,
            user: {
              id: "user-" + email.split("@")[0],
              email,
              name: name ?? email.split("@")[0],
              isNewOwner: s.onboarding.level > 0,
            },
          },
        })),

      logout: () =>
        set(() => ({ auth: { user: null, sensitiveSessionUntil: null } })),

      openSensitiveSession: () =>
        set((s) => ({
          auth: { ...s.auth, sensitiveSessionUntil: Date.now() + 5 * 60 * 1000 },
        })),

      setOnboarding: (partial) =>
        set((s) => ({ onboarding: { ...s.onboarding, ...partial } })),

      resetOnboarding: () =>
        set(() => ({ onboarding: structuredClone(initialOnboarding) })),

      addDoc: (doc) =>
        set((s) => ({
          onboarding: { ...s.onboarding, docs: [...s.onboarding.docs, doc] },
        })),

      updateDoc: (id, partial) =>
        set((s) => ({
          onboarding: {
            ...s.onboarding,
            docs: s.onboarding.docs.map((d) => (d.id === id ? { ...d, ...partial } : d)),
          },
        })),

      removeDoc: (id) =>
        set((s) => ({
          onboarding: { ...s.onboarding, docs: s.onboarding.docs.filter((d) => d.id !== id) },
        })),

      addLead: (lead) => set((s) => ({ leads: [...s.leads, lead] })),

      markNotification: (id, read) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read } : n)),
        })),

      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: "n-" + Math.random().toString(36).slice(2, 9),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
        })),

      setDemo: (partial) => set((s) => ({ demo: { ...s.demo, ...partial } })),

      approveLevel: (level) => {
        const s = get();
        set({
          onboarding: {
            ...s.onboarding,
            level,
            completedAt: new Date().toISOString(),
          },
        });
        if (level === 1) {
          get().pushNotification({
            kind: "ok",
            title: "Registro Nivel 1 aprobado",
            body: "Ya puedes gestionar mantenimiento de tu unidad.",
          });
        }
        if (level === 2) {
          get().pushNotification({
            kind: "ok",
            title: "Titularidad reconocida (Nivel 2)",
            body: "Se desbloqueó tu Patrimonio completo.",
          });
        }
      },

      transferOwnership: (propertyId, newOwnerId) =>
        set((s) => ({
          properties: s.properties.map((p) =>
            p.id === propertyId
              ? { ...p, currentOwnerId: newOwnerId, transferredAt: new Date().toISOString() }
              : p,
          ),
        })),

      seedOriginalOwner: (propertyId, ownerId) =>
        set((s) => ({
          properties: s.properties.map((p) =>
            p.id === propertyId ? { ...p, originalOwnerId: ownerId } : p,
          ),
        })),

      reset: () => set(() => structuredClone(initial)),
    }),
    {
      name: "sozu-onboarding",
      version: 2,
      // No persistimos catálogos estáticos (proyectos/propiedades) — se toman siempre del código.
      partialize: (s) => {
        const { projects: _p, properties: _pr, ...rest } = s as PortalState & {
          projects: unknown;
          properties: unknown;
        };
        return rest;
      },
    },
  ),
);

// ---------- Helpers puros ----------

export function findField(doc: UploadedDoc | undefined, key: string): string | undefined {
  return doc?.fields.find((f) => f.key === key)?.value;
}

export function getPropertyById(state: PortalState, id: string | null): Property | undefined {
  if (!id) return undefined;
  return state.properties.find((p) => p.id === id);
}

export function computeVerification(state: PortalState): VerificationCheck[] {
  const { onboarding, demo } = state;
  const property = getPropertyById(state, onboarding.unitId);
  const idDoc = onboarding.docs.find((d) => d.type === "id_oficial" && d.confirmed);
  const escritura = onboarding.docs.find((d) => d.type === "escritura" && d.confirmed);
  const rpp = onboarding.docs.find((d) => d.type === "certificado_rpp");
  const predial = onboarding.docs.find((d) => d.type === "predial" && d.confirmed);

  const nameId = findField(idDoc, "nombre");
  const nameEsc = findField(escritura, "adquirente");
  const nameRpp = findField(rpp, "titular_registral");
  const folioEsc = findField(escritura, "folio_real");
  const folioRpp = findField(rpp, "folio_real");
  const folioPred = findField(predial, "folio_real");
  const vendedor = findField(escritura, "vendedor");

  const nameMatch =
    !!nameId && !!nameEsc && (demo.forceNameMismatch ? false : nameId === nameEsc);
  const folioConsistent = (() => {
    if (demo.forceFolioMismatch) return false;
    const vals = [folioEsc, folioRpp, folioPred].filter(Boolean);
    if (vals.length < 2) return false;
    return vals.every((v) => v === vals[0]);
  })();
  const unitMatch = !!property && folioEsc === property.folioReal && !demo.forceFolioMismatch;
  const chainOk =
    !!property && !!vendedor && (demo.forceChainMismatch ? false : vendedor === property.originalOwnerId);
  const rppOk =
    !!rpp &&
    (rpp.managedBySozu ? true : demo.rppState === "vigente");

  return [
    {
      key: "name",
      label: "Nombre en ID = titular en escritura = titular en RPP",
      status: idDoc && escritura ? (nameMatch && (!nameRpp || nameRpp === nameId) ? "ok" : "fail") : "idle",
      detail:
        idDoc && escritura
          ? nameMatch
            ? `Coincide: ${nameId}`
            : `No coincide (ID: ${nameId ?? "—"}, escritura: ${nameEsc ?? "—"})`
          : "Sube ID y escritura para validar",
    },
    {
      key: "folio",
      label: "Folio real consistente entre escritura, RPP y predial",
      status: escritura && (rpp || predial) ? (folioConsistent ? "ok" : "fail") : "idle",
      detail: folioConsistent
        ? `Folio: ${folioEsc}`
        : "Los documentos deben referir el mismo folio real",
    },
    {
      key: "unit",
      label: "Inmueble = unidad SOZU seleccionada",
      status: property && escritura ? (unitMatch ? "ok" : "fail") : "idle",
      detail: property
        ? unitMatch
          ? `Coincide con folio ${property.folioReal}`
          : `Unidad SOZU: ${property.folioReal}`
        : "Selecciona unidad en el paso 1",
    },
    {
      key: "chain",
      label: "Cadena de dominio: vendedor en escritura = dueño original SOZU",
      status: escritura && property ? (chainOk ? "ok" : "fail") : "idle",
      detail: chainOk
        ? "El vendedor coincide con el registro SOZU."
        : "Requiere revisión del área legal (posible venta intermedia).",
    },
    {
      key: "rpp",
      label: "Certificado RPP vigente (≤90 días) sin gravámenes bloqueantes",
      status: rpp ? (rppOk ? "ok" : demo.rppState === "gravamen" ? "warn" : "fail") : "idle",
      detail: !rpp
        ? "Sube el certificado o solicita que SOZU lo gestione."
        : rpp.managedBySozu
          ? "SOZU lo gestionará ante el RPP de Jalisco."
          : demo.rppState === "vigente"
            ? "Vigente."
            : demo.rppState === "vencido"
              ? "Vencido (>90 días)."
              : "Con gravamen que impide reconocimiento.",
    },
  ];
}

export function requiredDocsFor(personType: PersonType): DocType[] {
  if (personType === "moral") {
    return [
      "acta_constitutiva",
      "poder_rl",
      "id_rl",
      "escritura",
      "certificado_rpp",
      "predial",
      "csf",
    ];
  }
  return ["id_oficial", "escritura", "certificado_rpp", "predial", "curp", "csf"];
}

export const DOC_LABELS: Record<DocType, string> = {
  id_oficial: "Identificación oficial (INE / Pasaporte)",
  escritura: "Escritura pública de compraventa",
  certificado_rpp: "Certificado del RPP (inscripción / titularidad)",
  predial: "Predial reciente",
  curp: "CURP",
  csf: "Constancia de situación fiscal",
  acta_constitutiva: "Acta constitutiva",
  poder_rl: "Poder del representante legal",
  id_rl: "Identificación oficial del representante legal (INE / Pasaporte)",
};

export const DOC_HELP: Partial<Record<DocType, string>> = {
  predial:
    "Corroboración fiscal — no acredita propiedad por sí solo. Si tu compra es reciente, es normal que aún no esté a tu nombre: súbelo si lo tienes (aunque aparezca el propietario anterior nos sirve para confirmar el inmueble) o continúa sin él.",
  curp: "Clave Única de Registro de Población. Nos permite identificarte ante autoridades.",
  csf: "Emitida por el SAT. Necesaria para facturar tu mantenimiento con tus datos fiscales.",
  certificado_rpp:
    "Confirma que estás inscrito como propietario. Si compraste con crédito, es normal que aparezca tu hipoteca como gravamen — no es problema. Vigencia recomendada ≤ 90 días.",
  acta_constitutiva:
    "Documento notariado que da vida a la empresa. Extraemos razón social, RFC, fecha de constitución y objeto social.",
  poder_rl:
    "Notarial. Extraemos el nombre del representante y el tipo de facultades. Para revender más adelante se requiere poder para actos de dominio — su ausencia no bloquea este paso.",
  id_rl:
    "INE o pasaporte vigente del apoderado que firma por la persona moral.",
};
