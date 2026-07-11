import { supabase } from "@/integrations/supabase/client";
import type { Channel, Scenario } from "@/lib/portal-estructura-comisiones/types/simulator";

/**
 * Sincroniza Canales de Venta y Escenarios (incluyendo el % de comisión por
 * rol/canal, `commissionRules`) con Supabase, para que sean compartidos entre
 * todos los usuarios del portal en vez de vivir solo en `localStorage`.
 *
 * Consumido únicamente por `SimulatorContext.tsx` — el resto de los tabs
 * (Comisiones, Canales de Venta, Escenarios, Resultados, etc.) no cambian,
 * siguen leyendo/escribiendo `channels`/`scenarios` vía `useSimulator()`.
 *
 * Probe graceful: si las tablas aún no existen (DDL pendiente, ver
 * `Ejecuciones_manuales/motor_comisiones_canales_escenarios.md`), las
 * consultas devuelven `null` y el simulador sigue funcionando 100% local.
 */

function channelFromRow(row: any): Channel {
  return {
    id: row.id,
    name: row.nombre,
    externalCommissionPct: Number(row.comision_externa_pct ?? 0),
    minCommissionPct: Number(row.comision_min_pct ?? 0),
    maxCommissionPct: Number(row.comision_max_pct ?? 0),
    active: row.activo ?? true,
    code: row.codigo ?? undefined,
    description: row.descripcion ?? undefined,
    category: row.categoria ?? undefined,
    parentId: row.id_padre ?? null,
    baseCommissionPct: row.comision_base_pct != null ? Number(row.comision_base_pct) : undefined,
    participatesInScaling: row.participa_escalonamiento ?? true,
    participatesInBonuses: row.participa_bonos ?? true,
    participatesInSimulators: row.participa_simuladores ?? true,
    requiresOnboarding: row.requiere_onboarding ?? false,
    requiresTraining: row.requiere_capacitacion ?? false,
    requiresApproval: row.requiere_aprobacion ?? false,
    leadProtectionDays: row.proteccion_leads_dias ?? 0,
    allowsSubchannels: row.permite_subcanales ?? false,
    history: row.historial ?? [],
    profile: row.perfil ?? undefined,
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
  };
}

function channelToRow(channel: Channel) {
  return {
    id: channel.id,
    nombre: channel.name,
    comision_externa_pct: channel.externalCommissionPct,
    comision_min_pct: channel.minCommissionPct,
    comision_max_pct: channel.maxCommissionPct,
    activo: channel.active,
    codigo: channel.code ?? null,
    descripcion: channel.description ?? null,
    categoria: channel.category ?? null,
    id_padre: channel.parentId ?? null,
    comision_base_pct: channel.baseCommissionPct ?? null,
    participa_escalonamiento: channel.participatesInScaling ?? true,
    participa_bonos: channel.participatesInBonuses ?? true,
    participa_simuladores: channel.participatesInSimulators ?? true,
    requiere_onboarding: channel.requiresOnboarding ?? false,
    requiere_capacitacion: channel.requiresTraining ?? false,
    requiere_aprobacion: channel.requiresApproval ?? false,
    proteccion_leads_dias: channel.leadProtectionDays ?? 0,
    permite_subcanales: channel.allowsSubchannels ?? false,
    historial: channel.history ?? [],
    perfil: channel.profile ?? {},
    fecha_actualizacion: new Date().toISOString(),
  };
}

function scenarioFromRow(row: any): Scenario {
  return {
    id: row.id,
    name: row.nombre,
    description: row.descripcion ?? "",
    projectIds: row.proyecto_ids ?? [],
    commissionMode: row.modo_comision,
    totalCommissionPct: Number(row.comision_total_pct ?? 0),
    channelMix: row.mezcla_canal ?? {},
    channelExternalPcts: row.comisiones_externas_canal ?? {},
    commissionRules: row.reglas_comision ?? [],
    roleAssignments: row.asignaciones_rol ?? [],
    monthlyUnits: row.unidades_mensuales ?? [],
    isGroup: row.es_grupo ?? true,
  };
}

function scenarioToRow(scenario: Scenario) {
  return {
    id: scenario.id,
    nombre: scenario.name,
    descripcion: scenario.description ?? null,
    proyecto_ids: scenario.projectIds ?? [],
    modo_comision: scenario.commissionMode,
    comision_total_pct: scenario.totalCommissionPct,
    mezcla_canal: scenario.channelMix ?? {},
    comisiones_externas_canal: scenario.channelExternalPcts ?? {},
    reglas_comision: scenario.commissionRules ?? [],
    asignaciones_rol: scenario.roleAssignments ?? [],
    unidades_mensuales: scenario.monthlyUnits ?? [],
    es_grupo: scenario.isGroup ?? true,
    fecha_actualizacion: new Date().toISOString(),
  };
}

export async function fetchCanalesReales(): Promise<Channel[] | null> {
  const { data, error } = await (supabase as any).from("comisiones_canales").select("*").order("fecha_creacion");
  if (error || !data) return null;
  return (data as any[]).map(channelFromRow);
}

export async function fetchEscenariosReales(): Promise<Scenario[] | null> {
  const { data, error } = await (supabase as any).from("comisiones_escenarios").select("*").order("fecha_creacion");
  if (error || !data) return null;
  return (data as any[]).map(scenarioFromRow);
}

export async function upsertCanalRemoto(channel: Channel): Promise<boolean> {
  const { error } = await (supabase as any).from("comisiones_canales").upsert(channelToRow(channel));
  return !error;
}

export async function deleteCanalRemoto(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("comisiones_canales").delete().eq("id", id);
  return !error;
}

export async function upsertEscenarioRemoto(scenario: Scenario): Promise<boolean> {
  const { error } = await (supabase as any).from("comisiones_escenarios").upsert(scenarioToRow(scenario));
  return !error;
}

export async function deleteEscenarioRemoto(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("comisiones_escenarios").delete().eq("id", id);
  return !error;
}

export async function seedCanalesYEscenarios(channels: Channel[], scenarios: Scenario[]): Promise<void> {
  if (channels.length) await (supabase as any).from("comisiones_canales").upsert(channels.map(channelToRow));
  if (scenarios.length) await (supabase as any).from("comisiones_escenarios").upsert(scenarios.map(scenarioToRow));
}
