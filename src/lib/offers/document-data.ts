// ── Expediente documental: tipos, datos mock e helpers ──
// Modelo central que unifica documentos de todas las propiedades del cliente.

import { create } from "zustand";
export type DocumentStatus =
  | "pendiente"
  | "recibido"
  | "validado"
  | "rechazado"
  | "firmado";

export type DocumentType =
  | "contrato"
  | "escritura"
  | "comprobante"
  | "cfdi"
  | "identificacion"
  | "garantia"
  | "otro";

export type DocumentOrigin = "sozu_generated" | "client_uploaded" | "third_party";

export interface DocumentRecord {
  id: string;
  propertyId: string;
  type: DocumentType;
  status: DocumentStatus;
  name: string;
  origin: DocumentOrigin;
  description?: string;
  fileExtension?: "pdf" | "jpg" | "png" | "xml";
  fileSize?: number;
  fileName?: string;
  url?: string;
  uploadedAt?: string;
  validatedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  signedAt?: string;
  signatureProvider?: "mifiel" | "manual";
  nom151ConstancyUrl?: string;
  stageId?: string;
  additionalProductId?: string;
  installmentNumber?: number;
}

const initialDocumentStore: DocumentRecord[] = [
  // ── MARGOT 707 ──
  {
    id: "doc-margot-707-001",
    propertyId: "margot-707",
    type: "contrato",
    status: "firmado",
    name: "Contrato de compraventa",
    origin: "sozu_generated",
    fileExtension: "pdf",
    fileSize: 487300,
    fileName: "contrato-compraventa-margot-707.pdf",
    url: "#",
    signedAt: "2024-08-12T15:30:00",
    signatureProvider: "mifiel",
    nom151ConstancyUrl: "#",
    stageId: "preventa",
  },
  {
    id: "doc-margot-707-002",
    propertyId: "margot-707",
    type: "escritura",
    status: "firmado",
    name: "Escritura pública",
    origin: "third_party",
    fileExtension: "pdf",
    fileSize: 2348000,
    fileName: "escritura-margot-707.pdf",
    url: "#",
    signedAt: "2024-12-03T11:00:00",
    signatureProvider: "manual",
    stageId: "escrituracion",
  },
  {
    id: "doc-margot-707-003",
    propertyId: "margot-707",
    type: "identificacion",
    status: "validado",
    name: "INE titular",
    origin: "client_uploaded",
    fileExtension: "jpg",
    fileSize: 234000,
    fileName: "ine-titular.jpg",
    url: "#",
    uploadedAt: "2024-07-10T09:20:00",
    validatedAt: "2024-07-11T14:00:00",
  },
  {
    id: "doc-margot-707-004",
    propertyId: "margot-707",
    type: "cfdi",
    status: "validado",
    name: "CFDI mantenimiento enero 2026",
    origin: "sozu_generated",
    fileExtension: "xml",
    fileSize: 8420,
    fileName: "cfdi-mant-202601.xml",
    url: "#",
    uploadedAt: "2026-01-15T10:00:00",
    validatedAt: "2026-01-15T10:00:00",
  },
  {
    id: "doc-margot-707-005",
    propertyId: "margot-707",
    type: "comprobante",
    status: "pendiente",
    name: "Comprobante mantenimiento mayo 2026",
    origin: "client_uploaded",
    description: "Si pagaste en efectivo, sube el comprobante de ventanilla.",
  },
  {
    id: "doc-margot-707-006",
    propertyId: "margot-707",
    type: "garantia",
    status: "validado",
    name: "Póliza de garantía estructural",
    origin: "sozu_generated",
    fileExtension: "pdf",
    fileSize: 156000,
    fileName: "poliza-garantia-margot-707.pdf",
    url: "#",
    uploadedAt: "2024-12-10T16:00:00",
    validatedAt: "2024-12-10T16:00:00",
    stageId: "entrega",
  },

  // ── BOTTURA 709 ──
  {
    id: "doc-bottura-709-001",
    propertyId: "bottura-709",
    type: "contrato",
    status: "firmado",
    name: "Contrato de compraventa",
    origin: "sozu_generated",
    fileExtension: "pdf",
    fileSize: 412000,
    fileName: "contrato-bottura-709.pdf",
    url: "#",
    signedAt: "2025-09-20T14:00:00",
    signatureProvider: "mifiel",
    nom151ConstancyUrl: "#",
    stageId: "preventa",
  },
  {
    id: "doc-bottura-709-002",
    propertyId: "bottura-709",
    type: "identificacion",
    status: "rechazado",
    name: "Comprobante de domicilio",
    origin: "client_uploaded",
    fileExtension: "jpg",
    fileSize: 1820000,
    fileName: "comp-domicilio-v1.jpg",
    url: "#",
    uploadedAt: "2026-04-15T11:30:00",
    rejectedAt: "2026-04-16T09:00:00",
    rejectionReason:
      "La imagen está borrosa. Por favor sube una versión más clara, donde se lea el nombre y la dirección completa.",
  },
  {
    id: "doc-bottura-709-003",
    propertyId: "bottura-709",
    type: "comprobante",
    status: "recibido",
    name: "Comprobante pago parcialidad 9 de 12",
    origin: "client_uploaded",
    fileExtension: "pdf",
    fileSize: 98000,
    fileName: "comp-par9.pdf",
    url: "#",
    uploadedAt: "2026-05-05T16:20:00",
    installmentNumber: 9,
  },
  {
    id: "doc-bottura-709-004",
    propertyId: "bottura-709",
    type: "cfdi",
    status: "pendiente",
    name: "CFDI pago final",
    origin: "sozu_generated",
    description: "Se emitirá automáticamente al confirmarse tu pago final.",
  },

  // ── DAIKU 712 ──
  {
    id: "doc-daiku-712-001",
    propertyId: "daiku-712",
    type: "contrato",
    status: "firmado",
    name: "Contrato de compraventa",
    origin: "sozu_generated",
    fileExtension: "pdf",
    fileSize: 524000,
    fileName: "contrato-daiku-712.pdf",
    url: "#",
    signedAt: "2025-12-08T17:00:00",
    signatureProvider: "mifiel",
    nom151ConstancyUrl: "#",
    stageId: "preventa",
  },
  {
    id: "doc-daiku-712-002",
    propertyId: "daiku-712",
    type: "cfdi",
    status: "validado",
    name: "CFDI enganche",
    origin: "sozu_generated",
    fileExtension: "xml",
    fileSize: 12400,
    fileName: "cfdi-enganche-daiku.xml",
    url: "#",
    uploadedAt: "2026-01-14T18:35:00",
    validatedAt: "2026-01-14T18:35:00",
    installmentNumber: 1,
  },
  {
    id: "doc-daiku-712-003",
    propertyId: "daiku-712",
    type: "cfdi",
    status: "validado",
    name: "CFDI parcialidad 2",
    origin: "sozu_generated",
    fileExtension: "xml",
    fileSize: 11800,
    fileName: "cfdi-par2-daiku.xml",
    url: "#",
    uploadedAt: "2026-02-04T10:20:00",
    validatedAt: "2026-02-04T10:20:00",
    installmentNumber: 2,
  },
  {
    id: "doc-daiku-712-004",
    propertyId: "daiku-712",
    type: "otro",
    status: "validado",
    name: "Carta acuerdo bodega",
    origin: "sozu_generated",
    fileExtension: "pdf",
    fileSize: 95000,
    fileName: "carta-bodega-daiku.pdf",
    url: "#",
    uploadedAt: "2026-01-20T12:00:00",
    validatedAt: "2026-01-20T12:00:00",
    additionalProductId: "bodega-daiku",
  },
];

interface DocumentState {
  documents: DocumentRecord[];
  uploadDocument: (id: string, fileName: string, ext: "pdf" | "jpg" | "png", size: number) => void;
  simulateValidation: (id: string) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: structuredClone(initialDocumentStore),
  uploadDocument: (id, fileName, ext, size) => {
    set({
      documents: get().documents.map((d) =>
        d.id !== id
          ? d
          : {
              ...d,
              status: "recibido",
              fileName,
              fileExtension: ext,
              fileSize: size,
              uploadedAt: new Date().toISOString(),
              rejectionReason: undefined,
              rejectedAt: undefined,
              url: "#",
            },
      ),
    });
  },
  simulateValidation: (id) => {
    set({
      documents: get().documents.map((d) =>
        d.id !== id || d.status !== "recibido"
          ? d
          : { ...d, status: "validado", validatedAt: new Date().toISOString() },
      ),
    });
  },
  reset: () => set({ documents: structuredClone(initialDocumentStore) }),
}));

export function getAllDocuments(): DocumentRecord[] {
  return useDocumentStore.getState().documents;
}

export function getDocumentsByProperty(propertyId: string): DocumentRecord[] {
  return useDocumentStore.getState().documents.filter((d) => d.propertyId === propertyId);
}

export function getDocumentById(id: string): DocumentRecord | undefined {
  return useDocumentStore.getState().documents.find((d) => d.id === id);
}

export function useAllDocuments(): DocumentRecord[] {
  return useDocumentStore((s) => s.documents);
}

export function useDocumentById(id: string): DocumentRecord | undefined {
  return useDocumentStore((s) => s.documents.find((d) => d.id === id));
}

export function getDocumentStats(docs: DocumentRecord[]) {
  return {
    total: docs.length,
    pendiente: docs.filter((d) => d.status === "pendiente").length,
    recibido: docs.filter((d) => d.status === "recibido").length,
    validado: docs.filter((d) => d.status === "validado").length,
    rechazado: docs.filter((d) => d.status === "rechazado").length,
    firmado: docs.filter((d) => d.status === "firmado").length,
  };
}

export function getStatusInfo(status: DocumentStatus): {
  label: string;
  tone: "warning" | "primary" | "success" | "destructive";
  className: string;
} {
  switch (status) {
    case "pendiente":
      return { label: "Pendiente", tone: "warning", className: "bg-warning/10 text-warning" };
    case "recibido":
      return { label: "Recibido", tone: "primary", className: "bg-primary/10 text-primary" };
    case "validado":
      return { label: "Validado", tone: "success", className: "bg-success/10 text-success" };
    case "rechazado":
      return { label: "Rechazado", tone: "destructive", className: "bg-destructive/10 text-destructive" };
    case "firmado":
      return { label: "Firmado", tone: "success", className: "bg-success/15 text-success" };
  }
}

export function getTypeInfo(type: DocumentType): { label: string; icon: string } {
  switch (type) {
    case "contrato":
      return { label: "Contrato", icon: "FileSignature" };
    case "escritura":
      return { label: "Escritura", icon: "Landmark" };
    case "comprobante":
      return { label: "Comprobante", icon: "Receipt" };
    case "cfdi":
      return { label: "CFDI", icon: "FileCode2" };
    case "identificacion":
      return { label: "Identificación", icon: "BadgeCheck" };
    case "garantia":
      return { label: "Garantía", icon: "ShieldCheck" };
    case "otro":
      return { label: "Otro", icon: "FileText" };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadDocument(
  documentId: string,
  fileName: string,
  fileExtension: "pdf" | "jpg" | "png",
  fileSize: number,
): void {
  useDocumentStore.getState().uploadDocument(documentId, fileName, fileExtension, fileSize);
}

// SWAP POINT: en producción esto vendría de webhook de ops SOZU.
export function simulateValidation(documentId: string): void {
  useDocumentStore.getState().simulateValidation(documentId);
}
