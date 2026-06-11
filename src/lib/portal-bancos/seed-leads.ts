import type { BankLead } from "./bank-leads";
import { amortMonthly } from "./bank-leads";

const dApart = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const hApart = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const uid = (s: string) => `lead_${s}`;

function buildCredit(monto: number, plazo: 5 | 10 | 15 | 20, rateMin: number, rateMax: number) {
  return {
    montoFinanciar: monto,
    plazoAnios: plazo,
    estMonthlyMin: Math.round(amortMonthly(monto, rateMin, plazo)),
    estMonthlyMax: Math.round(amortMonthly(monto, rateMax, plazo)),
    estRateMin: rateMin,
    estRateMax: rateMax,
    estCatMin: +(rateMin + 1.4).toFixed(2),
    estCatMax: +(rateMax + 1.8).toFixed(2),
  };
}

const sozuAgente = { name: "Pamela Ortiz", phone: "+52 55 9988 7766" };

export const SEED_LEADS: BankLead[] = [
  {
    id: uid("bbva_001"), bankId: "bbva", status: "nuevo",
    client: { fullName: "Alejandro García Rivas", phone: "+52 55 1234 5678", email: "alejandro.garcia@gmail.com", ingresoRange: "60k-120k", situacionLaboral: "asalariado", esClienteActual: true, consent: { granted: true, timestamp: dApart(-1), ley: "LFPDPPP" } },
    credit: buildCredit(700_000, 15, 9.15, 11.2),
    property: { project: "Bottura", unit: "U-709", address: "Av. Reforma 2210, Polanco, CDMX", totalValue: 4_200_000, saldoFinanciar: 700_000, avanceObra: 86, etapa: "Acabados", fechaEscrituracion: dApart(12) },
    sozu: { leadId: "SZ-2026-00041", score: "verde", declaredAt: dApart(-1), agenteComercial: sozuAgente },
    activity: [{ id: "a1", ts: dApart(-1), author: "Sistema SOZU", type: "creado", note: "Lead recibido del portal del inversionista." }],
    createdAt: dApart(-1), lastUpdate: dApart(-1),
  },
  {
    id: uid("bbva_002"), bankId: "bbva", status: "contactado", assignedAgentId: "e1",
    client: { fullName: "Sofía Hernández León", phone: "+52 55 2345 6789", email: "sofia.hernandez@outlook.com", ingresoRange: "30k-60k", situacionLaboral: "honorarios", esClienteActual: false, consent: { granted: true, timestamp: dApart(-3), ley: "LFPDPPP" } },
    credit: buildCredit(1_200_000, 20, 9.15, 11.2),
    property: { project: "Daiku", unit: "D-204", address: "Calle Tennyson 88, Polanco, CDMX", totalValue: 5_400_000, saldoFinanciar: 1_200_000, avanceObra: 62, etapa: "Albañilería", fechaEscrituracion: dApart(55) },
    sozu: { leadId: "SZ-2026-00038", score: "amarillo", declaredAt: dApart(-3), agenteComercial: sozuAgente },
    activity: [
      { id: "a2", ts: hApart(-66), author: "Mariana Ruiz", type: "status_change", from: "asignado", to: "contactado", note: "Primera llamada exitosa." },
      { id: "a1", ts: hApart(-70), author: "Sistema SOZU", type: "creado" },
    ],
    createdAt: hApart(-70), lastUpdate: hApart(-66),
  },
  {
    id: uid("bbva_003"), bankId: "bbva", status: "en_evaluacion", assignedAgentId: "e1",
    client: { fullName: "Roberto Castañeda Mora", phone: "+52 55 3456 7890", email: "rcastaneda@empresa.mx", ingresoRange: "120k+", situacionLaboral: "empresario", esClienteActual: true, consent: { granted: true, timestamp: dApart(-8), ley: "LFPDPPP" } },
    credit: buildCredit(2_800_000, 20, 9.15, 11.2),
    property: { project: "Margot", unit: "M-1502", address: "Av. Insurgentes Sur 1411, CDMX", totalValue: 8_900_000, saldoFinanciar: 2_800_000, avanceObra: 95, etapa: "Acabados", fechaEscrituracion: dApart(28) },
    sozu: { leadId: "SZ-2026-00032", score: "verde", declaredAt: dApart(-8), agenteComercial: sozuAgente },
    activity: [
      { id: "a3", ts: dApart(-6), author: "Mariana Ruiz", type: "status_change", from: "contactado", to: "en_evaluacion" },
      { id: "a2", ts: dApart(-7), author: "Mariana Ruiz", type: "status_change", from: "asignado", to: "contactado" },
      { id: "a1", ts: dApart(-8), author: "Sistema SOZU", type: "creado" },
    ],
    createdAt: dApart(-8), lastUpdate: dApart(-6),
  },
  {
    id: uid("sant_001"), bankId: "santander", status: "oferta_vinculante", assignedAgentId: "e4",
    client: { fullName: "Pablo Iturbide Sosa", phone: "+52 55 5678 9012", email: "pablo.iturbide@gmail.com", ingresoRange: "60k-120k", situacionLaboral: "asalariado", esClienteActual: true, consent: { granted: true, timestamp: dApart(-14), ley: "LFPDPPP" } },
    credit: buildCredit(1_500_000, 20, 8.85, 10.65),
    property: { project: "Margot", unit: "M-803", address: "Av. Insurgentes Sur 1411, CDMX", totalValue: 5_800_000, saldoFinanciar: 1_500_000, avanceObra: 90, etapa: "Acabados", fechaEscrituracion: dApart(22) },
    sozu: { leadId: "SZ-2026-00021", score: "verde", declaredAt: dApart(-14), agenteComercial: sozuAgente },
    activity: [
      { id: "a4", ts: dApart(-1),  author: "Diana Salgado", type: "status_change", from: "pre_aprobado", to: "oferta_vinculante" },
      { id: "a3", ts: dApart(-5),  author: "Diana Salgado", type: "status_change", from: "en_evaluacion", to: "pre_aprobado" },
      { id: "a2", ts: dApart(-10), author: "Diana Salgado", type: "status_change", from: "contactado", to: "en_evaluacion" },
      { id: "a1", ts: dApart(-14), author: "Sistema SOZU", type: "creado" },
    ],
    createdAt: dApart(-14), lastUpdate: dApart(-1),
  },
  {
    id: uid("sant_003"), bankId: "santander", status: "formalizado", assignedAgentId: "e4",
    client: { fullName: "Mauricio Salinas Cruz", phone: "+52 55 7890 1234", email: "msalinas@gmail.com", ingresoRange: "120k+", situacionLaboral: "empresario", esClienteActual: true, consent: { granted: true, timestamp: dApart(-45), ley: "LFPDPPP" } },
    credit: buildCredit(2_200_000, 20, 8.85, 10.65),
    property: { project: "Daiku", unit: "D-1101", address: "Calle Tennyson 88, Polanco, CDMX", totalValue: 7_500_000, saldoFinanciar: 2_200_000, avanceObra: 100, etapa: "Terminado", fechaEscrituracion: dApart(-3) },
    sozu: { leadId: "SZ-2026-00012", score: "verde", declaredAt: dApart(-45), agenteComercial: sozuAgente },
    activity: [{ id: "a1", ts: dApart(-5), author: "Diana Salgado", type: "status_change", from: "en_coordinacion", to: "formalizado", note: "Firmado en notaría 87." }],
    createdAt: dApart(-45), lastUpdate: dApart(-5),
  },
  {
    id: uid("bnte_001"), bankId: "banorte", status: "rechazado", assignedAgentId: "e7", closeReason: "Historial crediticio (Buró)",
    client: { fullName: "Eduardo Pineda Lara", phone: "+52 55 8901 2345", email: "epineda@gmail.com", ingresoRange: "15k-30k", situacionLaboral: "asalariado", esClienteActual: false, consent: { granted: true, timestamp: dApart(-20), ley: "LFPDPPP" } },
    credit: buildCredit(600_000, 15, 9.15, 10.95),
    property: { project: "Monócolo", unit: "MO-108", address: "Calle Amsterdam 244, Condesa, CDMX", totalValue: 2_800_000, saldoFinanciar: 600_000, avanceObra: 80, etapa: "Acabados", fechaEscrituracion: dApart(40) },
    sozu: { leadId: "SZ-2026-00018", score: "rojo", declaredAt: dApart(-20), agenteComercial: sozuAgente },
    activity: [
      { id: "a2", ts: dApart(-10), author: "Hugo Ramírez", type: "status_change", from: "en_evaluacion", to: "rechazado", note: "Historial crediticio (Buró)" },
      { id: "a1", ts: dApart(-20), author: "Sistema SOZU", type: "creado" },
    ],
    createdAt: dApart(-20), lastUpdate: dApart(-10),
  },
  {
    id: uid("bnte_002"), bankId: "banorte", status: "nuevo",
    client: { fullName: "Ximena Trejo Olvera", phone: "+52 55 9012 3456", email: "ximena.trejo@gmail.com", ingresoRange: "60k-120k", situacionLaboral: "asalariado", esClienteActual: false, consent: { granted: true, timestamp: dApart(0), ley: "LFPDPPP" } },
    credit: buildCredit(1_100_000, 20, 9.15, 10.95),
    property: { project: "Bottura", unit: "U-1004", address: "Av. Reforma 2210, Polanco, CDMX", totalValue: 4_800_000, saldoFinanciar: 1_100_000, avanceObra: 86, etapa: "Acabados", fechaEscrituracion: dApart(35) },
    sozu: { leadId: "SZ-2026-00046", score: "verde", declaredAt: dApart(0), agenteComercial: sozuAgente },
    activity: [{ id: "a1", ts: dApart(0), author: "Sistema SOZU", type: "creado" }],
    createdAt: dApart(0), lastUpdate: dApart(0),
  },
];