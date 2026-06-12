export interface EntregaAppointment {
  date: string;
  time: string;
  location: string;
  contactName: string;
  contactPhone: string;
}

export interface DefectTicket {
  id: string;
  folio: string;
  category: string;
  description: string;
  location: string;
  photos: string[];
  status: "abierto" | "en_revision" | "en_proceso" | "resuelto";
  createdAt: string;
}

export interface EntregaData {
  propertyId: string;
  availableSlots: { date: string; displayDate: string; times: string[] }[];
  scheduledAppointment?: EntregaAppointment;
  deliveryAccepted: boolean;
  signatureDate?: string;
  tickets: DefectTicket[];
}

const entregaDataMap: Record<string, EntregaData> = {
  "bottura-915": {
    propertyId: "bottura-915",
    availableSlots: [
      { date: "2026-03-16", displayDate: "Lun 16 Mar", times: ["10:00", "11:00", "12:00"] },
      { date: "2026-03-17", displayDate: "Mar 17 Mar", times: ["10:00", "11:30"] },
      { date: "2026-03-18", displayDate: "Mié 18 Mar", times: ["09:00", "10:00", "11:00", "12:00"] },
      { date: "2026-03-19", displayDate: "Jue 19 Mar", times: ["10:00", "12:00"] },
      { date: "2026-03-20", displayDate: "Vie 20 Mar", times: ["10:00", "11:00"] },
    ],
    deliveryAccepted: false,
    tickets: [],
  },
};

export function getEntregaData(propertyId: string): EntregaData | undefined {
  return entregaDataMap[propertyId];
}

export const defectCategories = [
  "Acabados",
  "Instalaciones eléctricas",
  "Instalaciones hidráulicas",
  "Carpintería",
  "Equipamiento",
  "Herrería / Aluminio",
  "Pintura",
  "Pisos y azulejos",
  "Otro",
];

export const unitLocations = [
  "Sala / Comedor",
  "Cocina",
  "Recámara principal",
  "Recámara 2",
  "Baño principal",
  "Baño 2",
  "Balcón / Terraza",
  "Pasillo",
  "Área de lavado",
  "Clóset",
  "Entrada",
];
