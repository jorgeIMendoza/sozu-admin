import type { Embajador, Referral } from "@/types/embajadores";

export const MOCK_EMBAJADORES: Embajador[] = [
  {
    id: "EMB-0001", fullName: "Andrea Martínez", phone: "+52 55 1234 5678",
    email: "andrea.martinez@example.com", company: "Inversiones AM",
    type: "socio", status: "activo", createdAt: "2025-09-12T10:00:00Z",
    code: "EMB-0001", referralLink: "https://sozu.com/r/EMB-0001",
    commissionPct: 2.0, commissionTrigger: "enganche",
    notes: "Embajador top — 12 referidos cerrados YTD.",
  },
  {
    id: "EMB-0002", fullName: "Carlos Rivera", phone: "+52 55 9876 5432",
    email: "carlos.rivera@example.com", type: "cliente", status: "activo",
    createdAt: "2025-11-03T15:30:00Z", code: "EMB-0002",
    referralLink: "https://sozu.com/r/EMB-0002", commissionPct: 1.5,
    commissionTrigger: "promesa",
  },
  {
    id: "EMB-0003", fullName: "María López", phone: "+52 81 5555 7777",
    email: "maria.lopez@example.com", company: "MLR Bienes Raíces",
    type: "aliado", status: "pendiente", createdAt: "2026-04-21T08:15:00Z",
    code: "EMB-0003", referralLink: "https://sozu.com/r/EMB-0003",
    commissionPct: 2.5, commissionTrigger: "escrituracion",
  },
  {
    id: "EMB-0004", fullName: "Jorge Hernández", phone: "+52 33 4444 8888",
    email: "jorge.hernandez@example.com", type: "referidor_externo",
    status: "activo", createdAt: "2026-01-10T12:00:00Z", code: "EMB-0004",
    referralLink: "https://sozu.com/r/EMB-0004", commissionPct: 2.0,
    commissionTrigger: "apartado",
  },
];

export const MOCK_REFERRALS: Referral[] = [
  {
    id: "REF-1001", embajadorId: "EMB-0001", clientName: "Luis Gómez",
    phone: "+52 55 1111 2222", email: "luis.gomez@example.com",
    interestType: "vivir", productInterest: "Depto 2 rec — Polanco",
    registeredAt: "2026-05-01T09:00:00Z", status: "venta_cerrada",
    assignedAdvisorName: "Patricia Soto", saleAmount: 4_800_000,
    commissionAmount: 96_000, commissionStatus: "autorizada",
  },
  {
    id: "REF-1002", embajadorId: "EMB-0001", clientName: "Sofía Núñez",
    phone: "+52 55 3333 4444", email: "sofia.nunez@example.com",
    interestType: "inversion", productInterest: "Studio — Roma Norte",
    registeredAt: "2026-05-10T11:30:00Z", status: "en_seguimiento",
    assignedAdvisorName: "Patricia Soto", commissionAmount: 0,
    commissionStatus: "potencial",
  },
  {
    id: "REF-1003", embajadorId: "EMB-0002", clientName: "Daniel Pérez",
    phone: "+52 55 5555 6666", email: "daniel.perez@example.com",
    interestType: "patrimonial", productInterest: "Penthouse — Reforma",
    registeredAt: "2026-04-18T14:00:00Z", status: "comision_pagada",
    assignedAdvisorName: "Roberto Vargas", saleAmount: 12_500_000,
    commissionAmount: 187_500, commissionStatus: "pagada",
    paymentDate: "2026-05-15T10:00:00Z",
  },
  {
    id: "REF-1004", embajadorId: "EMB-0004", clientName: "Ana Castillo",
    phone: "+52 33 7777 8888", email: "ana.castillo@example.com",
    interestType: "vivir", productInterest: "Casa — Zapopan",
    registeredAt: "2026-05-18T16:00:00Z", status: "cita_agendada",
    assignedAdvisorName: "Miguel Ángel Ríos", commissionAmount: 0,
    commissionStatus: "potencial",
  },
  {
    id: "REF-1005", embajadorId: "EMB-0001", clientName: "Verónica Salinas",
    phone: "+52 55 9090 1010", email: "veronica.salinas@example.com",
    interestType: "indefinido", registeredAt: "2026-05-20T10:00:00Z",
    status: "registrado", commissionAmount: 0, commissionStatus: "potencial",
  },
];

export const KPIS_GLOBALES = {
  embajadoresActivos: MOCK_EMBAJADORES.filter(e => e.status === 'activo').length,
  referidosTotales: MOCK_REFERRALS.length,
  referidosCerrados: MOCK_REFERRALS.filter(r =>
    ['venta_cerrada','comision_generada','comision_pagada'].includes(r.status)).length,
  comisionPotencial: 245_000,
  comisionAutorizada: MOCK_REFERRALS
    .filter(r => r.commissionStatus === 'autorizada')
    .reduce((s,r) => s + r.commissionAmount, 0),
  comisionPagada: MOCK_REFERRALS
    .filter(r => r.commissionStatus === 'pagada')
    .reduce((s,r) => s + r.commissionAmount, 0),
};