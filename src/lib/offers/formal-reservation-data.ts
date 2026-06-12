import { create } from "zustand";
import { getVirtualCLABEForProperty } from "./virtual-clabe";
import { generateScheduledNotifications } from "./provisional-notifications-template";
import { getOfferById } from "./offer-data";

// ── Tipos ──

export type BuyerType =
  | "individual_mexican"          // Persona física mexicana
  | "individual_foreign"          // Persona física extranjera
  | "legal_entity"                // Persona moral (empresa)
  | "copropiedad";                // (18.10.B) Compra entre dos personas físicas

/**
 * (18.10.B) Información del segundo copropietario.
 * Solo poblado si buyerType === "copropiedad".
 * - pending_invitation: el cliente actual aún no ha mandado la invitación
 * - invited: ya se envió email con magic link, esperando aceptación
 * - accepted: el segundo aceptó pero aún no valida su CSF
 * - fiscal_validated: copropiedad lista para escrituración
 */
export interface CoOwnerInfo {
  status: "pending_invitation" | "invited" | "accepted" | "fiscal_validated";
  invitedEmail: string | null;
  invitedAt: string | null;
  // SWAP POINT: en producción se agregan más campos cuando el segundo acepta y valida
}

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
  | "in_progress"
  | "documents_uploaded"
  | "documents_approved"
  | "contract_signed"
  | "completed"
  | "cancelled"
  // ── Flujo refactorizado v2 (18.9.A+) ──
  | "tipo_seleccionado"
  | "rfc_validado"
  | "clabe_vinculada"
  | "pago_pendiente"
  | "apartado_provisional"        // (F.1) Hold tarjeta activo
  | "provisional_expirado"        // (F.1) Hold expirado sin pago
  | "provisional_cancelado"       // (F.3.B) Cancelación voluntaria
  | "completando_apartado"        // (18.10.B) Cliente entró al wizard /completar post-hold
  | "pago_recibido"
  | "expediente_en_curso"
  | "expediente_completo"
  | "firmado";

export type HoldReleaseReason = "payment" | "expired" | "voluntary" | "manual";

// ── Hold de tarjeta — apartado provisional (F.1) ──
export interface HoldData {
  /** Mock authorization ID. SWAP POINT: real Stripe/Conekta auth ID */
  holdAuthorizationId: string;
  cardLast4: string;
  cardBrand: "visa" | "mastercard" | "amex" | "unknown";
  amountMXN: number;
  activatedAt: string;
  expiresAt: string;
  status: "active" | "released_by_payment" | "released_manually" | "released_voluntarily" | "expired";
  releasedAt: string | null;
  releaseReason?: HoldReleaseReason;
}

// ── Notificaciones automáticas apartado provisional (F.3.B) ──
export type NotificationChannel = "email" | "whatsapp";
export type NotificationStatus = "pending" | "sent";

export interface ProvisionalNotification {
  id: string;
  formalReservationId: string;
  day: 0 | 2 | 3 | 4 | 5;
  channel: NotificationChannel;
  subject: string;
  body: string;
  scheduledAt: string;
  status: NotificationStatus;
  sentAt: string | null;
}

// ── Sub-tipos del flujo refactorizado v2 ──

export interface FiscalIdentity {
  rfc: string;
  legalName: string;
  regimenFiscal: string;
  csfDocumentName: string | null;
  csfValidatedAt: string;
}

/**
 * @deprecated (18.9.E) Ya no capturamos la CLABE del cliente. Reemplazado por
 * `FormalReservation.propertyVirtualCLABE` + `PaymentRecord.emisorRFC`.
 * Mantenido para compatibilidad con datos persistidos.
 */
export interface BankIdentity {
  clabe: string;
  bankName: string;
  accountHolderRFC: string;
  validatedAt: string;
  matchesProspectRFC: boolean;
}

export interface PaymentRecord {
  id: string;
  amountMXN: number;
  paymentMethod: "spei" | "transfer" | "card";
  /**
   * @deprecated (18.9.E) Ya no se captura la CLABE del cliente.
   * El RFC del banco emisor se captura automáticamente en `emisorRFC`.
   */
  sourceCLABE?: string;
  /** CLABE virtual del departamento (= FormalReservation.propertyVirtualCLABE). */
  destinationCLABE: string;
  /** RFC del titular del banco emisor, capturado automáticamente por STP. */
  emisorRFC: string;
  /** True si emisorRFC coincide con fiscalIdentity.rfc del paso 2. */
  rfcMatched: boolean;
  detectedAt: string;
  speiTrackingKey: string;
}

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

// ── Expediente (18.9.C.1+) ──

export interface DatosPersonalesCompletos {
  curp: string;
  curpValidatedAt: string | null;
  fechaNacimiento: string;
  estadoNacimiento: string;
  sexo: "H" | "M";
  estadoCivil: "soltero" | "casado" | "divorciado" | "viudo" | "concubinato" | null;
  regimenPatrimonial: "separacion_bienes" | "sociedad_conyugal" | null;
  nacionalidad: string;
  ocupacion: string;
  domicilioFiscal: {
    calle: string;
    numeroExterior: string;
    numeroInterior: string;
    colonia: string;
    codigoPostal: string;
    municipio: string;
    estado: string;
  };
}

export type SeccionExpedienteStatus = "locked" | "pending" | "in_progress" | "completed";

// ── Plan de pagos (18.9.C.2) ──

export type PaymentItemType = "apartado" | "enganche_saldo" | "mensualidad" | "saldo_entrega";

export interface PaymentItem {
  id: string;
  type: PaymentItemType;
  concepto: string;
  fechaProgramada: string; // YYYY-MM-DD
  montoMXN: number;
  status: "pagado" | "programado";
}

export interface PlanPagosData {
  selectedPlanId: "corto" | "medio" | "largo";
  totalPriceMXN: number;
  appliedFromApartado: number;
  engancheTotalMXN: number;
  engancheRestanteMXN: number;
  mensualidadesCount: number;
  mensualidadAmountMXN: number;
  saldoEntregaMXN: number;
  estimatedDeliveryDate: string;
  schedule: PaymentItem[];
  selectedAt: string;
}

// ── Documentos del expediente (18.9.C.2) ──

export type ExpedienteDocumentType = "ine_anverso" | "ine_reverso" | "comprobante_domicilio";

export interface ExpedienteDocument {
  id: string;
  type: ExpedienteDocumentType;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  uploadedAt: string;
  previewDataUrl?: string;
}

export interface DocumentosData {
  documents: ExpedienteDocument[];
}

// ── Contrato preliminar (18.9.C.3) ──

export interface ContratoPreliminarData {
  acceptedAt: string;
  contractVersion: string;
  contractHash: string;
}

// ── Firma e.firma (18.9.C.3) ──

export interface FirmaData {
  signedAt: string;
  mifielDocumentId: string;
  nom151Hash: string;
  certificadoSerie: string;
  ipAddress: string;
}

export interface Expediente {
  identidadFiscal: { status: SeccionExpedienteStatus };
  datosPersonales: { status: SeccionExpedienteStatus; data: DatosPersonalesCompletos | null };
  planPagos: { status: SeccionExpedienteStatus; data: PlanPagosData | null };
  documentos: { status: SeccionExpedienteStatus; data: DocumentosData | null };
  contratoPreliminar: { status: SeccionExpedienteStatus; data: ContratoPreliminarData | null };
  firma: { status: SeccionExpedienteStatus; data: FirmaData | null };
}

export const createInitialExpediente = (): Expediente => ({
  identidadFiscal: { status: "completed" },
  datosPersonales: { status: "pending", data: null },
  planPagos: { status: "pending", data: null },
  documentos: { status: "pending", data: null },
  contratoPreliminar: { status: "locked", data: null },
  firma: { status: "locked", data: null },
});

export interface FormalReservation {
  id: string;
  preReservationId: string | null;
  prospectId: string;
  offerId: string;
  agentId: string;

  status: FormalReservationStatus;
  buyerType: BuyerType;

  /**
   * @deprecated (18.9.D) Reemplazado por `expediente.datosPersonales.data`.
   * Mantener mientras el wizard legacy siga en disco. Eliminar en próxima
   * iteración mayor cuando no queden FRs antiguos en localStorage.
   */
  personalData?: Partial<PersonalData>;
  /**
   * @deprecated (18.9.D) Reemplazado por `expediente.planPagos.data.selectedPlanId`.
   */
  selectedPlanId?: string;

  /**
   * @deprecated (18.9.D) Reemplazado por `expediente.documentos.data`.
   */
  documents: UploadedDocument[];

  /**
   * @deprecated (18.9.D) Reemplazado por `expediente.contratoPreliminar` + `expediente.firma`.
   */
  contractSignature: {
    status: ContractSignatureStatus;
    mifielDocumentId?: string;
    mifielSigningUrl?: string;
    signedAt?: string;
    signedFileUrl?: string;
    signatureHash?: string;
  };

  appliedAmountMXN: number;
  remainingDownPaymentMXN?: number;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /**
   * @deprecated (18.9.D) Reemplazado por `status` + secciones del expediente en
   * el flujo refactorizado 18.9. Solo lo lee el wizard legacy.
   */
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;

  // ── Campos del flujo refactorizado v2 (18.9.A+) ──
  fiscalIdentity?: FiscalIdentity | null;
  /**
   * @deprecated (18.9.E) Ya no se captura la CLABE del cliente.
   * Mantenido para compatibilidad con datos persistidos en localStorage.
   */
  bankIdentity?: BankIdentity | null;
  /** CLABE virtual permanente del departamento (STP). Estable por unidad. */
  propertyVirtualCLABE?: string;
  payment?: PaymentRecord | null;
  cuentaCobranzaId?: string | null;
  convertedAt?: string | null;

  // ── Expediente (18.9.C.1+) ──
  expediente?: Expediente | null;

  // ── Hold tarjeta apartado provisional (F.1) ──
  hold?: HoldData | null;

  /** (F.2.A) Timestamp ISO cuando el cliente aceptó el contrato durante el periodo provisional. */
  contratoAcceptedDuringProvisional?: string | null;

  // ── Notificaciones automáticas y cancelación voluntaria (F.3.B) ──
  notifications?: ProvisionalNotification[];
  cancellationReason?: string | null;
  cancelledAt?: string | null;

  // ── Copropiedad (18.10.B) — solo poblado si buyerType === "copropiedad" ──
  coOwner?: CoOwnerInfo | null;
}

/**
 * Identificador de cliente para enforce del límite de holds.
 * Combina prospectId + RFC (cuando ya hay fiscalIdentity).
 */
export const getClientIdentifier = (fr: FormalReservation): string => {
  const rfc = fr.fiscalIdentity?.rfc?.toUpperCase().trim() ?? "";
  return `${fr.prospectId}::${rfc}`;
};

export const MAX_HOLDS_PER_CLIENT = 3;

/**
 * Cuenta holds activos de un cliente, excluyendo el FR actual.
 */
export const countActiveHoldsForClient = (
  reservations: FormalReservation[],
  clientIdentifier: string,
  excludeFormalReservationId: string
): number => {
  return reservations.filter((r) => {
    if (r.id === excludeFormalReservationId) return false;
    if (r.status !== "apartado_provisional") return false;
    if (!r.hold || r.hold.status !== "active") return false;
    return getClientIdentifier(r) === clientIdentifier;
  }).length;
};

// ── Storage helpers ──

const STORAGE_KEY = "sozu_formal_reservation_progress";

function loadFromStorage(): FormalReservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: FormalReservation[] = JSON.parse(raw);
    // 18.9.E backfill: asegurar propertyVirtualCLABE en FRs antiguos
    return parsed.map((r) => ({
      ...r,
      propertyVirtualCLABE: r.propertyVirtualCLABE ?? getVirtualCLABEForProperty(r.offerId),
    }));
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

  // ── Métodos del flujo refactorizado v2 ──
  setFiscalIdentity: (id: string, identity: FiscalIdentity) => void;
  setBankIdentity: (id: string, identity: BankIdentity) => void;
  recordPayment: (
    id: string,
    payment: Omit<PaymentRecord, "destinationCLABE" | "emisorRFC" | "rfcMatched"> &
      Partial<Pick<PaymentRecord, "destinationCLABE" | "emisorRFC" | "rfcMatched">>
  ) => string;
  updateRefactorStatus: (id: string, status: FormalReservationStatus) => void;

  // ── Expediente (18.9.C.1+) ──
  updateDatosPersonales: (id: string, data: Partial<DatosPersonalesCompletos>) => void;
  updateSeccionStatus: (id: string, seccion: keyof Expediente, status: SeccionExpedienteStatus) => void;
  // ── Expediente 18.9.C.2 ──
  setPlanPagos: (id: string, data: PlanPagosData) => void;
  addDocument: (id: string, doc: ExpedienteDocument) => void;
  removeDocument: (id: string, docId: string) => void;
  unlockNextSections: (id: string) => void;
  // ── Expediente 18.9.C.3 ──
  acceptContrato: (id: string, data: ContratoPreliminarData) => void;
  signWithMifiel: (id: string, data: FirmaData) => void;

  // ── Hold tarjeta (F.1) ──
  activateHold: (id: string, hold: HoldData) => boolean;
  releaseHold: (id: string, reason: "payment" | "manual" | "expired") => void;

  // ── Apartado provisional (F.2.A) ──
  acceptContratoDuringProvisional: (id: string) => void;

  // ── Notificaciones + cancelación voluntaria + expiración auto (F.3.B) ──
  markNotificationAsSent: (id: string, notificationId: string) => void;
  cancelHoldVoluntary: (id: string, reason: string) => void;
  markAsExpired: (id: string) => void;

  // ── Wizard /completar (18.10.B) ──
  enterCompletionWizard: (id: string) => void;
  setCoOwnerInvitation: (id: string, invitedEmail: string) => void;
  generateVirtualCLABE: (id: string) => void;

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
      // (18.10.B) La CLABE NO se genera al crear el FR. Se difiere al Paso 3
      // del wizard /completar via generateVirtualCLABE() para que el cliente
      // no vea una CLABE durante el periodo provisional. La backfill de
      // loadFromStorage() preserva FRs legacy que ya la tenían.
      notifications: [],
      cancellationReason: null,
      cancelledAt: null,
      coOwner: null,
    };

    const updated = [...get().reservations, reservation];
    saveToStorage(updated);
    set({ reservations: updated });
    return reservation;
  },

  setBuyerType: (id, buyerType) => {
    const isCopropiedad = buyerType === "copropiedad";
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
            // (18.10.B) Si es copropiedad, inicializar placeholder del segundo.
            // Si NO es copropiedad, limpiar coOwner por si venía de una selección previa.
            coOwner: isCopropiedad
              ? {
                  status: "pending_invitation" as const,
                  invitedEmail: null,
                  invitedAt: null,
                }
              : null,
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

  // ── Métodos del flujo refactorizado v2 ──

  setFiscalIdentity: (id, fiscalIdentity) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? { ...r, fiscalIdentity, status: "rfc_validado" as FormalReservationStatus, updatedAt: new Date().toISOString() }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  setBankIdentity: (id, bankIdentity) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? { ...r, bankIdentity, status: "clabe_vinculada" as FormalReservationStatus, updatedAt: new Date().toISOString() }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  recordPayment: (id, payment) => {
    const cuentaCobranzaId = `IDCO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      const virtualCLABE =
        r.propertyVirtualCLABE ?? getVirtualCLABEForProperty(r.offerId);
      const fiscalRFC = r.fiscalIdentity?.rfc ?? "";
      // SWAP POINT: en producción `emisorRFC` viene del webhook STP capturando
      // el RFC real del banco emisor. En mock asumimos coincidencia.
      const fullPayment: PaymentRecord = {
        ...payment,
        destinationCLABE: payment.destinationCLABE ?? virtualCLABE,
        emisorRFC: payment.emisorRFC ?? fiscalRFC,
        rfcMatched: payment.rfcMatched ?? true,
      };
      return {
        ...r,
        propertyVirtualCLABE: virtualCLABE,
        payment: fullPayment,
        cuentaCobranzaId,
        status: "pago_recibido" as FormalReservationStatus,
        convertedAt: now,
        updatedAt: now,
        expediente: r.expediente ?? createInitialExpediente(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
    return cuentaCobranzaId;
  },

  updateRefactorStatus: (id, status) => {
    const updated = get().reservations.map((r) =>
      r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  // ── Expediente (18.9.C.1+) ──

  updateDatosPersonales: (id, partialData) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      const expediente = r.expediente ?? createInitialExpediente();
      const currentData = expediente.datosPersonales.data ?? ({} as DatosPersonalesCompletos);
      const mergedDomicilio = partialData.domicilioFiscal
        ? { ...(currentData.domicilioFiscal ?? {}), ...partialData.domicilioFiscal }
        : currentData.domicilioFiscal;
      const nextData = {
        ...currentData,
        ...partialData,
        ...(mergedDomicilio ? { domicilioFiscal: mergedDomicilio } : {}),
      } as DatosPersonalesCompletos;
      return {
        ...r,
        expediente: {
          ...expediente,
          datosPersonales: {
            status: (expediente.datosPersonales.status === "completed" ? "completed" : "in_progress") as SeccionExpedienteStatus,
            data: nextData,
          },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  updateSeccionStatus: (id, seccion, status) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      return {
        ...r,
        expediente: {
          ...r.expediente,
          [seccion]: { ...r.expediente[seccion], status },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  setPlanPagos: (id, data) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      return {
        ...r,
        expediente: {
          ...r.expediente,
          planPagos: { status: "completed" as SeccionExpedienteStatus, data },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  addDocument: (id, doc) => {
    const allTypes: ExpedienteDocumentType[] = ["ine_anverso", "ine_reverso", "comprobante_domicilio"];
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      const currentDocs = r.expediente.documentos.data?.documents ?? [];
      const filtered = currentDocs.filter((d) => d.type !== doc.type);
      const nextDocs = [...filtered, doc];
      const allUploaded = allTypes.every((t) => nextDocs.some((d) => d.type === t));
      return {
        ...r,
        expediente: {
          ...r.expediente,
          documentos: {
            status: (allUploaded ? "completed" : "in_progress") as SeccionExpedienteStatus,
            data: { documents: nextDocs },
          },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  removeDocument: (id, docId) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      const currentDocs = r.expediente.documentos.data?.documents ?? [];
      const nextDocs = currentDocs.filter((d) => d.id !== docId);
      return {
        ...r,
        expediente: {
          ...r.expediente,
          documentos: {
            status: (nextDocs.length === 0 ? "pending" : "in_progress") as SeccionExpedienteStatus,
            data: nextDocs.length === 0 ? null : { documents: nextDocs },
          },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  unlockNextSections: (id) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      const e = r.expediente;
      const allPrevDone =
        e.identidadFiscal.status === "completed" &&
        e.datosPersonales.status === "completed" &&
        e.planPagos.status === "completed" &&
        e.documentos.status === "completed";
      if (!allPrevDone) return r;
      return {
        ...r,
        expediente: {
          ...e,
          contratoPreliminar: {
            ...e.contratoPreliminar,
            status: (e.contratoPreliminar.status === "locked" ? "pending" : e.contratoPreliminar.status) as SeccionExpedienteStatus,
          },
          firma: {
            ...e.firma,
            status: (e.firma.status === "locked" ? "pending" : e.firma.status) as SeccionExpedienteStatus,
          },
        },
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  acceptContrato: (id, data) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      return {
        ...r,
        expediente: {
          ...r.expediente,
          contratoPreliminar: { status: "completed" as SeccionExpedienteStatus, data },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  signWithMifiel: (id, data) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.expediente) return r;
      return {
        ...r,
        status: "expediente_completo" as FormalReservationStatus,
        expediente: {
          ...r.expediente,
          firma: { status: "completed" as SeccionExpedienteStatus, data },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  activateHold: (id, hold) => {
    const state = get();
    const fr = state.reservations.find((r) => r.id === id);
    if (!fr) return false;
    const clientId = getClientIdentifier(fr);
    const activeHolds = countActiveHoldsForClient(state.reservations, clientId, id);
    if (activeHolds >= MAX_HOLDS_PER_CLIENT) return false;
    const now = new Date().toISOString();
    // (F.3.C) developmentName/propertyLabel derivados del offer real
    const offer = getOfferById(fr.offerId);
    const developmentName = offer?.property?.projectName ?? "tu unidad";
    const propertyLabel = offer
      ? `${offer.property.unitModel} ${offer.property.unitNumber}`
      : "sin código";
    const notifications = generateScheduledNotifications(id, now, {
      clientName: fr.fiscalIdentity?.legalName?.split(" ")[0] ?? "cliente",
      developmentName,
      propertyLabel,
      cardLast4: hold.cardLast4,
      expiresAtISO: hold.expiresAt,
    });
    const updated = state.reservations.map((r) =>
      r.id === id
        ? {
            ...r,
            hold: { ...hold, activatedAt: now, status: "active" as const },
            status: "apartado_provisional" as FormalReservationStatus,
            notifications,
            updatedAt: now,
          }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
    return true;
  },

  releaseHold: (id, reason) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.hold) return r;
      const releasedStatus: HoldData["status"] =
        reason === "payment" ? "released_by_payment"
        : reason === "expired" ? "expired"
        : "released_manually";
      const newReservationStatus: FormalReservationStatus =
        reason === "expired" ? "provisional_expirado" : r.status;
      return {
        ...r,
        hold: { ...r.hold, status: releasedStatus, releasedAt: new Date().toISOString() },
        status: newReservationStatus,
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  acceptContratoDuringProvisional: (id) => {
    const updated = get().reservations.map((r) =>
      r.id === id
        ? { ...r, contratoAcceptedDuringProvisional: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : r
    );
    saveToStorage(updated);
    set({ reservations: updated });
  },

  markNotificationAsSent: (id, notificationId) => {
    const now = new Date().toISOString();
    const updated = get().reservations.map((r) => {
      if (r.id !== id || !r.notifications) return r;
      return {
        ...r,
        notifications: r.notifications.map((n) =>
          n.id === notificationId && n.status === "pending"
            ? { ...n, status: "sent" as NotificationStatus, sentAt: now }
            : n
        ),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  cancelHoldVoluntary: (id, reason) => {
    const now = new Date().toISOString();
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      if (!r.hold || r.hold.status !== "active") return r;
      return {
        ...r,
        status: "provisional_cancelado" as FormalReservationStatus,
        cancellationReason: reason,
        cancelledAt: now,
        hold: {
          ...r.hold,
          status: "released_voluntarily" as const,
          releasedAt: now,
          releaseReason: "voluntary" as HoldReleaseReason,
        },
        updatedAt: now,
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  markAsExpired: (id) => {
    const now = new Date().toISOString();
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      if (r.status !== "apartado_provisional") return r;
      if (!r.hold) return r;
      return {
        ...r,
        status: "provisional_expirado" as FormalReservationStatus,
        hold: {
          ...r.hold,
          status: "expired" as const,
          releasedAt: now,
          releaseReason: "expired" as HoldReleaseReason,
        },
        updatedAt: now,
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  // ── Wizard /completar (18.10.B) ──

  enterCompletionWizard: (id) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      // Solo transiciona desde apartado_provisional; el resto de status mantienen su valor.
      if (r.status !== "apartado_provisional") return r;
      return {
        ...r,
        status: "completando_apartado" as FormalReservationStatus,
        updatedAt: new Date().toISOString(),
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  setCoOwnerInvitation: (id, invitedEmail) => {
    const now = new Date().toISOString();
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      if (r.buyerType !== "copropiedad") return r;
      return {
        ...r,
        coOwner: {
          status: "invited" as const,
          invitedEmail,
          invitedAt: now,
        },
        updatedAt: now,
      };
    });
    saveToStorage(updated);
    set({ reservations: updated });
  },

  generateVirtualCLABE: (id) => {
    const updated = get().reservations.map((r) => {
      if (r.id !== id) return r;
      if (r.propertyVirtualCLABE) return r; // Idempotente
      // SWAP POINT: en producción la CLABE viene de STP via API.
      // Mock: 18 dígitos con prefijo "646" (código de banco STP).
      const generated =
        "646" +
        Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join("");
      return {
        ...r,
        propertyVirtualCLABE: generated,
        updatedAt: new Date().toISOString(),
      };
    });
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
    case "copropiedad":
      // (18.10.B) El cliente principal completa su lado como persona física mexicana.
      // Los docs del segundo copropietario se capturan tras invitación por magic link.
      return ["ine_front", "ine_back", "curp", "rfc_constancia", "address_proof"];
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
  copropiedad: {
    title: "Copropiedad",
    description: "Compra entre dos personas físicas con porcentajes definidos",
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
