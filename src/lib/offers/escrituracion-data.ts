// ── Escrituración (Deed) data types & mock ──

export interface NotaryInfo {
  name: string;
  number: string;
  notaryName: string;
  address: string;
  phone: string;
  email: string;
  mapsUrl: string;
}

export interface NotarialCostItem {
  concept: string;
  amount: number;
}

export interface NotarialCosts {
  items: NotarialCostItem[];
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  available: boolean; // false = still being calculated
}

export interface DeedDocument {
  available: boolean;
  fileName?: string;
  previewUrl?: string; // mock PDF URL
}

export interface AppointmentSlot {
  date: string; // ISO date
  displayDate: string;
  times: string[];
}

export interface ScheduledAppointment {
  date: string;
  time: string;
  notary: string;
  address: string;
}

export interface EscrituracionData {
  propertyId: string;
  notary: NotaryInfo;
  costs: NotarialCosts;
  deedDocument: DeedDocument;
  availableSlots: AppointmentSlot[];
  scheduledAppointment?: ScheduledAppointment;
}

// ── Mock data ──

const escrituracionMap: Record<string, EscrituracionData> = {
  "bottura-812": {
    propertyId: "bottura-812",
    notary: {
      name: "Notaría Pública No. 45",
      number: "45",
      notaryName: "Lic. Roberto Méndez Castellanos",
      address: "Av. Vallarta 3233, Piso 5, Col. Vallarta Poniente, 44110 Guadalajara, Jal.",
      phone: "+52 33 3615 8920",
      email: "notaria45@notariasgdl.com",
      mapsUrl: "https://maps.google.com/?q=Av.+Vallarta+3233+Guadalajara",
    },
    costs: {
      items: [
        { concept: "Impuesto sobre adquisición (ISAI)", amount: 56000 },
        { concept: "Derechos registrales", amount: 18500 },
        { concept: "Honorarios notariales", amount: 42000 },
        { concept: "Certificados y avalúos", amount: 8500 },
        { concept: "Gastos administrativos", amount: 4200 },
      ],
      totalAmount: 129200,
      amountPaid: 0,
      amountPending: 129200,
      available: true,
    },
    deedDocument: {
      available: true,
      fileName: "Proyecto_Escritura_Bottura_812.pdf",
      previewUrl: "/placeholder.svg", // mock
    },
    availableSlots: [
      {
        date: "2026-03-10",
        displayDate: "10 marzo 2026",
        times: ["10:00", "11:30", "13:00"],
      },
      {
        date: "2026-03-12",
        displayDate: "12 marzo 2026",
        times: ["09:30", "11:00", "14:00"],
      },
      {
        date: "2026-03-14",
        displayDate: "14 marzo 2026",
        times: ["10:00", "12:00"],
      },
      {
        date: "2026-03-17",
        displayDate: "17 marzo 2026",
        times: ["09:00", "10:30", "12:00", "15:00"],
      },
      {
        date: "2026-03-19",
        displayDate: "19 marzo 2026",
        times: ["11:00", "13:30"],
      },
    ],
  },
};

export function getEscrituracionData(propertyId: string): EscrituracionData | undefined {
  return escrituracionMap[propertyId];
}
