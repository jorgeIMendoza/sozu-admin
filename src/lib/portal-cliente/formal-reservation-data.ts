import { create } from "zustand";

// ── Tipos ──

export type BuyerType =
  | "individual_mexican"          // Persona física mexicana
  | "individual_foreign"          // Persona física extranjera
  | "legal_entity";               // Persona moral (empresa)

export type DocumentType =
  // PF nacional
  | "ine_front"                   // INE/IFE frente
  | "ine_back"                    // INE/IFE reverso
  | "curp"                        // CURP
  | "rfc_constancia"              // Constancia de situación fiscal SAT
  | "address_proof"               // Comprobante de domicilio (≤3 meses)
  // PF extranjera
  | "passport"                    // Pasaporte vigente
  | "fm_visa"                     // FM2/FM3 o tarjeta residencia
  // PM
  | "incorporation_deed"          // Acta constitutiva
  | "legal_rep_power"             // Poder del rep legal
  | "rfc_pm"                      // RFC de la persona moral
  | "address_proof_pm";           // Comprobante de domicilio fiscal PM

export type DocumentStatus =
  | "pending"                     // No subido todavía
  | "uploading"                   // Subiendo (loading state)
  | "under_review"                // Subido, en revisión
  | "approved"                    // Aprobado
  | "rejected";                   // Rechazado (con motivo)

export type FormalReservationStatus =
  | "in_progress"                 // Wizard incompleto
  | "documents_uploaded"          // Docs subidos, esperando revisión
  | "documents_approved"          // Docs aprobados, listo para firmar
  | "contract_signed"             // Contrato firmado
  | "completed"                   // Apartado formal completado, enganche aplicado
  | "cancelled";                  // Apartado formal cancelado

export type ContractSignatureStatus =
  | "not_started"
  | "pending_mifiel"              // Esperando firma en MIFIEL
  | "signed"                      // Firmado exitosamente
  | "expired"                     // Link MIFIEL expiró sin firma
  | "rejected";                   // El comprador rechazó firmar

export interface UploadedDocument {
  documentType: DocumentType;
  status: DocumentStatus;
  fileName?: string;
  fileSize?: number;              // bytes
  uploadedAt?: string;            // ISO
  reviewedAt?: string;            // ISO
  rejectionReason?: string;       // si status === "rejected"
  fileUrl?: string;               // mock — en producción sería URL S3/Cloudinary
}

export interface PersonalData {
  // Comunes
  fullName: string;
  email: string;
  phone: string;
  birthDate?: string;             // YYYY-MM-DD
  nationality?: string;

  // PF mexicana
  rfc?: string;                   // 13 caracteres con homoclave
  curp?: string;                  // 18 caracteres

  // PF extranjera
  passportNumber?: string;
  passportCountry?: string;
  visaType?: "FM2" | "FM3" | "Residencia_Temporal" | "Residencia_Permanente";

  // PM
  companyName?: string;
  companyRFC?: string;            // 12 caracteres
  legalRepName?: string;          // Nombre del representante legal

  // Domicilio fiscal
  address: {
    street: string;
    exteriorNumber: string;
    interiorNumber?: string;
    neighborhood: string;         // Colonia
    zipCode: string;              // CP (5 dígitos MX)
    municipality: string;
    state: string;
    country: string;
  };
}

export interface FormalReservation {
  id: string;                     // FR-XXXXX
  preReservationId: string | null; // null si el flujo es directo (sin pre-apartado previo)
  prospectId: string;
  offerId: string;
  agentId: string;

  status: FormalReservationStatus;
  buyerType: BuyerType;

  personalData?: Partial<PersonalData>;
  selectedPlanId?: string;        // plan final elegido

  documents: UploadedDocument[];

  contractSignature: {
    status: ContractSignatureStatus;
    mifielDocumentId?: string;    // ID en MIFIEL (swap point)
    mifielSigningUrl?: string;    // URL para firmar (swap point)
    signedAt?: string;            // ISO
    signedFileUrl?: string;       // URL del PDF firmado
    signatureHash?: string;       // SHA-256 mock (64 hex)
  };


  appliedAmountMXN: number;       // $5,000 que se aplican al enganche
  remainingDownPaymentMXN?: number;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;  // paso actual del wizard
}

// ── Storage helpers ──

const STORAGE_KEY = "sozu_formal_reservation_progress";

function loadFromStorage(): FormalReservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveToStorage(reservations: FormalReservation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  } catch {
    // no-op
  }
}

// ── Store ──

interface FormalReservationState {
  reservations: FormalReservation[];

  initiateFormalReservation: (input: {
    preReservationId?: string | null;
    prospectId: string;
    offerId: string;
    agentId: string;
    appliedAmountMXN?: number;
  }) => FormalReservation;

  setBuyerType: (id: string, buyerType: BuyerType) => void;

  updatePersonalData: (id: string, data: Partial<PersonalData>) => void;

  setSelectedPlan: (id: string, planId: string, remainingDownPaymentMXN: number) => void;

  uploadDocument: (
    id: string,
    documentType: DocumentType,
    file: { fileName: string; fileSize: number }
  ) => void;

  simulateDocumentReview: (id: string, documentType: DocumentType) => void;

  initiateContractSignature: (id: string) => void;

  completeContractSignature: (
    id: string,
    meta?: { signatureHash?: string; signedAt?: string; mifielFolio?: string }
  ) => void;


  setCurrentStep: (id: string, step: 1 | 2 | 3 | 4 | 5 | 6) => void;

  completeFormalReservation: (id: string) => FormalReservation | undefined;

  cancelFormalReservation: (id: string) => void;

  reset: () => void;
}

export const useFormalReservationStore = create<FormalReservationState>((set, get) => ({
  reservations: loadFromStorage(),

  initiateFormalReservation: (input) => {
    const now = new Date().toISOString();
    const reservation: FormalReservation = {
      id: `FR-${Date.now().toString(36).toUpperCase()}`,
      preReservationId: input.preReservationId ?? null,
      prospectId: input.prospectId,
      offerId: input.offerId,
      agentId: input.agentId,
      status: "in_progress",
      buyerType: "individual_mexican",
      documents: [],
      contractSignature: { status: "not_started" },
      appliedAmountMXN: input.appliedAmountMXN ?? 0,
      createdAt: now,
      updatedAt: now,
      currentStep: 1,
    };

    const updated = [...get().reservations, reservation];
    saveToStorage(updated);
    set({ reservations: updated });
    return reservation;
  },

  setBuyerType: (id, buyerType) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            buyerType,
            // Resetear docs si cambió de tipo (cada tipo tiene set distinto)
            documents: getRequiredDocumentTypes(buyerType).map((dt) => ({
              documentType: dt,
              status: "pending" as DocumentStatus,
            })),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  updatePersonalData: (id, data) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            personalData: { ...r.personalData, ...data },
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  setSelectedPlan: (id, planId, remainingDownPaymentMXN) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            selectedPlanId: planId,
            remainingDownPaymentMXN,
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  uploadDocument: (id, documentType, file) => {
    // Paso 1: marcar como uploading
    set((s) => ({
      reservations: s.reservations.map((r) =>
        r.id === id
          ? {
              ...r,
              documents: r.documents.map((d) =>
                d.documentType === documentType
                  ? {
                      ...d,
                      status: "uploading" as DocumentStatus,
                      fileName: file.fileName,
                      fileSize: file.fileSize,
                    }
                  : d
              ),
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
    }));

    // SWAP POINT: en producción aquí dispararía POST a backend con el archivo real
    // (multipart/form-data o presigned URL a S3/Cloudinary)

    // Mock: después de 1.2s pasar a under_review
    setTimeout(() => {
      const current = get().reservations.find((r) => r.id === id);
      if (!current) return;

      const updated = get().reservations.map((r) =>
        r.id === id
          ? {
              ...r,
              documents: r.documents.map((d) =>
                d.documentType === documentType
                  ? {
                      ...d,
                      status: "under_review" as DocumentStatus,
                      uploadedAt: new Date().toISOString(),
                      fileUrl: `mock://documents/${id}/${documentType}`,
                    }
                  : d
              ),
              updatedAt: new Date().toISOString(),
            }
          : r
      );
      saveToStorage(updated);
      set({ reservations: updated });

      // Mock: después de otros 2s pasar a approved automáticamente
      setTimeout(() => {
        get().simulateDocumentReview(id, documentType);
      }, 2000);
    }, 1200);
  },

  simulateDocumentReview: (id, documentType) => {
    // SWAP POINT: en producción esto vendría de backend tras revisión humana o OCR
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            documents: r.documents.map((d) =>
              d.documentType === documentType
                ? {
                    ...d,
                    status: "approved" as DocumentStatus,
                    reviewedAt: new Date().toISOString(),
                  }
                : d
            ),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  initiateContractSignature: (id) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            contractSignature: {
              status: "pending_mifiel" as ContractSignatureStatus,
              // SWAP POINT MIFIEL: estos campos vienen de la API real
              mifielDocumentId: `MIFIEL-${Date.now().toString(36).toUpperCase()}`,
              mifielSigningUrl: `mock://mifiel/sign/${id}`,
            },
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  completeContractSignature: (id, meta) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "contract_signed" as FormalReservationStatus,
            contractSignature: {
              ...r.contractSignature,
              status: "signed" as ContractSignatureStatus,
              signedAt: meta?.signedAt ?? new Date().toISOString(),
              signedFileUrl: `mock://contracts/${id}/signed.pdf`,
              ...(meta?.mifielFolio ? { mifielDocumentId: meta.mifielFolio } : {}),
              ...(meta?.signatureHash ? { signatureHash: meta.signatureHash } : {}),
            } as FormalReservation["contractSignature"] & { signatureHash?: string },
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },


  setCurrentStep: (id, step) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? { ...r, currentStep: step, updatedAt: new Date().toISOString() }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  completeFormalReservation: (id) => {
    const reservation = get().reservations.find((r) => r.id === id);
    if (!reservation) return undefined;

    const now = new Date().toISOString();
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "completed" as FormalReservationStatus,
            completedAt: now,
            updatedAt: now,
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });

    return updated.find((r) => r.id === id);
  },

  cancelFormalReservation: (id) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "cancelled" as FormalReservationStatus,
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  reset: () => {
    saveToStorage([]);
    set({ reservations: [] });
  },
}));

// ── Selectors ──

export function useFormalReservationById(id: string): FormalReservation | undefined {
  return useFormalReservationStore((s) => s.reservations.find((r) => r.id === id));
}

export function useActiveFormalReservation(prospectId: string): FormalReservation | undefined {
  return useFormalReservationStore((s) =>
    s.reservations.find(
      (r) =>
        r.prospectId === prospectId &&
        r.status !== "completed" &&
        r.status !== "cancelled"
    )
  );
}

// ── Helpers ──

/**
 * Lista de documentos requeridos según tipo de comprador.
 */
export function getRequiredDocumentTypes(buyerType: BuyerType): DocumentType[] {
  switch (buyerType) {
    case "individual_mexican":
      return ["ine_front", "ine_back", "curp", "rfc_constancia", "address_proof"];
    case "individual_foreign":
      return ["passport", "fm_visa", "rfc_constancia", "address_proof"];
    case "legal_entity":
      return [
        "incorporation_deed",
        "legal_rep_power",
        "rfc_pm",
        "ine_front",         // INE del rep legal
        "address_proof_pm",
      ];
  }
}

/**
 * Validación local de RFC.
 * SAT pattern: 4 letras (PF) o 3 letras (PM) + 6 dígitos fecha + 3 caracteres homoclave.
 */
export function validateRFC(rfc: string, buyerType: BuyerType): { valid: boolean; error?: string } {
  if (!rfc) return { valid: false, error: "RFC requerido" };

  const cleaned = rfc.toUpperCase().trim();

  if (buyerType === "legal_entity") {
    // PM: 3 letras + 6 dígitos + 3 caracteres
    const pmPattern = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
    if (!pmPattern.test(cleaned)) {
      return { valid: false, error: "RFC de empresa debe ser 12 caracteres (ej: ABC123456XYZ)" };
    }
  } else {
    // PF: 4 letras + 6 dígitos + 3 caracteres
    const pfPattern = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
    if (!pfPattern.test(cleaned)) {
      return {
        valid: false,
        error: "RFC debe ser 13 caracteres (4 letras + 6 dígitos + 3 caracteres)",
      };
    }
  }

  // Validar que la parte de fecha sea válida
  const datePart = buyerType === "legal_entity" ? cleaned.slice(3, 9) : cleaned.slice(4, 10);
  const month = parseInt(datePart.slice(2, 4));
  const day = parseInt(datePart.slice(4, 6));

  if (month < 1 || month > 12) return { valid: false, error: "Mes inválido en RFC" };
  if (day < 1 || day > 31) return { valid: false, error: "Día inválido en RFC" };

  // SWAP POINT: en producción verificar contra padrón SAT vía API
  return { valid: true };
}

/**
 * Validación local de CURP.
 * RENAPO pattern: 18 caracteres con estructura específica.
 */
export function validateCURP(curp: string): { valid: boolean; error?: string } {
  if (!curp) return { valid: false, error: "CURP requerido" };

  const cleaned = curp.toUpperCase().trim();

  // 4 letras + 6 dígitos fecha + 1 letra sexo + 5 letras estado/consonantes + 2 caracteres validación
  const curpPattern = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

  if (cleaned.length !== 18) {
    return { valid: false, error: "CURP debe tener 18 caracteres" };
  }

  if (!curpPattern.test(cleaned)) {
    return {
      valid: false,
      error: "Formato de CURP inválido. Verifica que sea correcto.",
    };
  }

  // Validar sexo
  const sexo = cleaned[10];
  if (sexo !== "H" && sexo !== "M") {
    return { valid: false, error: "El carácter de sexo en CURP debe ser H o M" };
  }

  // Validar fecha
  const datePart = cleaned.slice(4, 10);
  const month = parseInt(datePart.slice(2, 4));
  const day = parseInt(datePart.slice(4, 6));

  if (month < 1 || month > 12) return { valid: false, error: "Mes inválido en CURP" };
  if (day < 1 || day > 31) return { valid: false, error: "Día inválido en CURP" };

  // SWAP POINT: en producción verificar contra padrón RENAPO vía API
  return { valid: true };
}

// ── Document labels (para UI) ──

export const DOCUMENT_LABELS: Record<DocumentType, { label: string; description: string; example?: string }> = {
  ine_front: {
    label: "INE / IFE — Frente",
    description: "Foto clara del frente de tu identificación oficial",
    example: "Asegúrate de que se vea bien la foto, nombre y CURP",
  },
  ine_back: {
    label: "INE / IFE — Reverso",
    description: "Foto clara del reverso con el código QR/MRZ",
  },
  curp: {
    label: "CURP",
    description: "Constancia de tu CURP impresa desde gob.mx",
    example: "Puedes descargarla en gob.mx/curp",
  },
  rfc_constancia: {
    label: "Constancia de Situación Fiscal",
    description: "Constancia actualizada del SAT (≤ 3 meses)",
    example: "Descárgala en sat.gob.mx con tu RFC y contraseña",
  },
  address_proof: {
    label: "Comprobante de domicilio",
    description: "Recibo de luz, agua, predial o teléfono fijo (≤ 3 meses)",
    example: "El domicilio debe coincidir con el de tu CSF del SAT",
  },
  passport: {
    label: "Pasaporte",
    description: "Pasaporte vigente del país de origen",
    example: "Página con foto y datos personales",
  },
  fm_visa: {
    label: "Visa / Forma migratoria",
    description: "FM2, FM3, Residencia Temporal o Permanente",
  },
  incorporation_deed: {
    label: "Acta constitutiva",
    description: "Escritura pública de constitución de la empresa",
  },
  legal_rep_power: {
    label: "Poder del representante legal",
    description: "Poder notarial vigente para actos de dominio",
  },
  rfc_pm: {
    label: "RFC y CSF de la empresa",
    description: "Constancia de situación fiscal de la persona moral",
  },
  address_proof_pm: {
    label: "Comprobante de domicilio fiscal",
    description: "Comprobante del domicilio fiscal de la empresa (≤ 3 meses)",
  },
};

// ── Buyer type labels ──

export const BUYER_TYPE_LABELS: Record<BuyerType, { title: string; description: string }> = {
  individual_mexican: {
    title: "Persona física — Mexicana",
    description: "Soy ciudadano mexicano comprando a título personal",
  },
  individual_foreign: {
    title: "Persona física — Extranjera",
    description: "Soy extranjero residente o no residente en México",
  },
  legal_entity: {
    title: "Persona moral",
    description: "Compra a nombre de una empresa o sociedad",
  },
};

// SWAP POINTS marcados a través del archivo:
// 1. localStorage → backend POST con autenticación
// 2. Validación RFC/CURP local → API SAT/RENAPO oficial
// 3. uploadDocument mock → AWS S3 / Cloudinary con presigned URL
// 4. simulateDocumentReview automática → revisión humana en backoffice + OCR
// 5. MIFIEL mock URLs → API real de MIFIEL con webhook callbacks
// 6. completeFormalReservation → trigger cascada: aplicación contable de los $5K,
//    generación de Cuenta de Cobranza, notificación a tesorería SOZU (Prompt 18.6)
