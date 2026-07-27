export const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const REVENUE_BY_PROJECT = [
  { name: "Daiku", value: 45200000 },
  { name: "Bottura", value: 32800000 },
  { name: "Monócolo", value: 18500000 },
];

export const REVENUE_BY_CHANNEL = [
  { name: "Inmobiliaria", value: 38000000 },
  { name: "Broker", value: 22000000 },
  { name: "Canal Interno", value: 15000000 },
  { name: "Embajador", value: 8500000 },
  { name: "Referido", value: 4200000 },
];

export const MONTHLY_TREND = [
  { month: "Ene", ingresos: 7200000, comisiones: 1080000 },
  { month: "Feb", ingresos: 8100000, comisiones: 1215000 },
  { month: "Mar", ingresos: 6800000, comisiones: 1020000 },
  { month: "Abr", ingresos: 9500000, comisiones: 1425000 },
  { month: "May", ingresos: 11200000, comisiones: 1680000 },
  { month: "Jun", ingresos: 10800000, comisiones: 1620000 },
];

export const CHART_COLORS = ["#22C55E", "#3B82F6", "#F97316", "#A855F7", "#14B8A6"];

export const AUDIT_EVENTS = [
  { id: "AUD-1", at: "hace 2 h", text: "Aprobada oferta OFR-2041 · Daiku A-201 · $4,500,000.00 MXN" },
  { id: "AUD-2", at: "hace 4 h", text: "Comisión COM-118 marcada como pagada · agente Carlos Mendoza" },
  { id: "AUD-3", at: "hace 6 h", text: "Cuenta de cobranza COB-088 conciliada al 100%" },
  { id: "AUD-4", at: "ayer",     text: "Contrato CTR-204 firmado por ambas partes (Mifiel)" },
  { id: "AUD-5", at: "ayer",     text: "Nuevo prospecto creado · canal Broker · proyecto Bottura" },
];