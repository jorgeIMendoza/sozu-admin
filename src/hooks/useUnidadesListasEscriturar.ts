import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTATUS_ESCRITURABLES = [5, 7, 9];

// id_producto de ofertas que entran a escrituración
// null → propiedad principal · 4 → bodega Bottura · 10 → estacionamiento Bottura
const ESCRITURABLE_PRODUCTOS_IDS = [4, 10];

const CEP_CUTOFF_BUSINESS_DAYS = 10;

// Grupos de documentos obligatorios (mismo patrón que ExpedientesDashboard)
export const OBLIGATORIO_GRUPOS = [
  { key: 'csf',       label: 'Constancia de Situación Fiscal', ids: [6] },
  { key: 'domicilio', label: 'Comprobante de domicilio',       ids: [8] },
  { key: 'ine',       label: 'INE / Identificación oficial',   ids: [2, 59] },
  { key: 'curp',      label: 'CURP',                           ids: [5] },
  { key: 'acta',      label: 'Acta de nacimiento',             ids: [1] },
] as const;

const ALL_OBLIGATORIO_IDS = OBLIGATORIO_GRUPOS.flatMap(g => [...g.ids]);

const ID_TO_GROUP_KEY: Record<number, string> = {};
OBLIGATORIO_GRUPOS.forEach(g => g.ids.forEach(id => { ID_TO_GROUP_KEY[id] = g.key; }));

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstadoValidacion = 'coincide' | 'error' | 'no_coincide' | null;
export type ConclusionEscrituracion = 'LISTA' | 'BLOQUEADA' | 'PENDIENTE_REVISION';

export interface CompradoresInfo {
  id_persona: number;
  nombre: string;
  rfc: string | null;
  porcentaje: number;
}

export interface UnidadEscriturable {
  propiedadId: number;
  numeroPropiedad: string;
  proyecto: string;
  proyectoId: number;
  edificio: string;
  modelo: string;
  estatusDisponibilidadId: number;

  // Pagos (aggregate over all escriturable cuentas)
  totalPagos: number;
  pagosError: number;        // estado 'error' | 'no_coincide'
  pagosSinValidar: number;   // no hay registro en pago_validaciones
  pagosCoincide: number;
  pagosCepPendiente: number; // STP sin CEP dentro de los últimos 10 hábiles (no bloqueante)

  // Expediente
  docsCompletos: number;     // grupos obligatorios con doc validado (0–5)
  expedienteOk: boolean;     // docsCompletos >= 5

  // Morosidad — acuerdos vencidos > 30 días sin completar
  acuerdosVencidos: number;
  diasMaxVencimiento: number;

  // Compradores
  compradores: CompradoresInfo[];
  clienteNombre: string;

  // Clasificación
  blockers: string[];
  warnings: string[];
  conclusion: ConclusionEscrituracion;
}

export interface UseUnidadesListasEscriturarResult {
  unidades: UnidadEscriturable[];
  proyectos: { id: number; nombre: string }[];
  isLoading: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function subtract10BusinessDays(from: Date): Date {
  const d = new Date(from);
  let count = 0;
  while (count < CEP_CUTOFF_BUSINESS_DAYS) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

function buildLatestValidacionByPago(
  validaciones: { id: number; id_pago: number; estado: string | null; fecha_creacion: string }[]
): Record<number, { estado: EstadoValidacion }> {
  const map: Record<number, { estado: EstadoValidacion; fecha: string; id: number }> = {};
  for (const v of validaciones) {
    const ex = map[v.id_pago];
    const fecha = v.fecha_creacion ?? '1970-01-01';
    if (!ex || fecha > ex.fecha || (fecha === ex.fecha && v.id > ex.id)) {
      map[v.id_pago] = { estado: v.estado as EstadoValidacion, fecha, id: v.id };
    }
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { estado: v.estado }]));
}

function buildLatestDocByKey(
  docs: { id: number; id_persona: number; id_tipo_documento: number; id_estatus_verificacion: number; fecha_creacion: string | null }[]
): Record<string, { id: number; estatusId: number }> {
  const map: Record<string, { id: number; estatusId: number; fecha: string }> = {};
  docs.forEach(d => {
    if (!d.id_persona) return;
    const groupKey = ID_TO_GROUP_KEY[d.id_tipo_documento];
    if (!groupKey) return;
    const key = `${d.id_persona}__${groupKey}`;
    const fecha = d.fecha_creacion ?? '9999-12-31T23:59:59Z';
    const ex = map[key];
    if (!ex || fecha > ex.fecha || (fecha === ex.fecha && d.id > ex.id)) {
      map[key] = { id: d.id, estatusId: d.id_estatus_verificacion, fecha };
    }
  });
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { id: v.id, estatusId: v.estatusId }]));
}

function countValidatedGroups(
  personaId: number,
  latestDocByKey: Record<string, { id: number; estatusId: number }>
): number {
  let count = 0;
  for (const grupo of OBLIGATORIO_GRUPOS) {
    const latest = latestDocByKey[`${personaId}__${grupo.key}`];
    if (latest && latest.estatusId === 2) count++;
  }
  return count;
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useUnidadesListasEscriturar(proyectoId: number | null): UseUnidadesListasEscriturarResult {
  // Proyectos SOZU
  const { data: proyectos = [] } = useQuery({
    queryKey: ['ule-proyectos'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = (rels ?? []).map(r => r.id_proyecto).filter(Boolean) as number[];
      if (!ids.length) return [];
      const { data: proys } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', ids)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');
      return (proys ?? []) as { id: number; nombre: string }[];
    },
    staleTime: 60_000,
  });

  // Unidades escriturables (waterfall completo)
  const {
    data: unidades = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ule-unidades', proyectoId],
    queryFn: async (): Promise<UnidadEscriturable[]> => {
      if (!proyectoId) return [];

      // ── Paso 1: edificios del proyecto ──────────────────────────────────
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id, nombre')
        .eq('id_proyecto', proyectoId)
        .eq('activo', true);
      if (!edificios?.length) return [];

      const edificioIdMap: Record<number, string> = {};
      edificios.forEach(e => { edificioIdMap[e.id] = e.nombre; });

      // ── Paso 2: edificios_modelos + modelos ─────────────────────────────
      const { data: emods } = await supabase
        .from('edificios_modelos')
        .select('id, id_edificio, id_modelo')
        .in('id_edificio', edificios.map(e => e.id));
      if (!emods?.length) return [];

      const modeloIds = [...new Set(emods.map(e => e.id_modelo))];
      const { data: modelos } = await supabase
        .from('modelos')
        .select('id, nombre')
        .in('id', modeloIds);

      const modeloNombreMap: Record<number, string> = {};
      (modelos ?? []).forEach(m => { modeloNombreMap[m.id] = m.nombre; });

      const emodEdificioMap: Record<number, number> = {};
      const emodModeloMap: Record<number, number> = {};
      emods.forEach(e => {
        emodEdificioMap[e.id] = e.id_edificio;
        emodModeloMap[e.id] = e.id_modelo;
      });

      // ── Paso 3: propiedades con estatus 5/7/9 ───────────────────────────
      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_estatus_disponibilidad, id_edificio_modelo')
        .eq('activo', true)
        .in('id_edificio_modelo', emods.map(e => e.id))
        .in('id_estatus_disponibilidad', ESTATUS_ESCRITURABLES)
        .order('numero_propiedad');
      if (!props?.length) return [];

      const propIds = props.map(p => p.id);

      // ── Paso 4: cuentas_cobranza de estas propiedades ────────────────────
      const { data: todasCuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, id_oferta, precio_final')
        .eq('activo', true)
        .in('id_propiedad', propIds);

      if (!todasCuentas?.length) return [];

      // ── Paso 5: ofertas → id_producto ─────────────────────────────────────
      const ofertaIds = [...new Set(
        todasCuentas.map(c => c.id_oferta).filter((id): id is number => id != null)
      )];
      const ofertaProductoMap: Record<number, number | null> = {};
      if (ofertaIds.length) {
        const { data: ofertas } = await supabase
          .from('ofertas')
          .select('id, id_producto')
          .in('id', ofertaIds);
        (ofertas ?? []).forEach(o => { ofertaProductoMap[o.id] = o.id_producto; });
      }

      // Clasificar cada cuenta como escriturable o no
      const isEscriturable = (c: { id_oferta: number | null }) => {
        if (c.id_oferta == null) return true; // sin oferta → se incluye
        const prod = ofertaProductoMap[c.id_oferta];
        if (prod === undefined) return true; // oferta no encontrada → conservador
        return prod === null || ESCRITURABLE_PRODUCTOS_IDS.includes(prod);
      };

      const isPrincipal = (c: { id_oferta: number | null }) => {
        if (c.id_oferta == null) return true;
        const prod = ofertaProductoMap[c.id_oferta];
        return prod === null || prod === undefined;
      };

      const escriturableCuentas = todasCuentas.filter(isEscriturable);
      const escriturableCuentaIds = escriturableCuentas.map(c => c.id);
      const principalCuentaIds = new Set(todasCuentas.filter(isPrincipal).map(c => c.id));

      // Mapa cuenta → propiedad
      const cuentaPropMap: Record<number, number> = {};
      todasCuentas.forEach(c => { cuentaPropMap[c.id] = c.id_propiedad; });

      // ── Paso 6: pagos de cuentas escriturables (chunks 500) ───────────────
      type PagoRow = { id: number; id_cuenta_cobranza: number; monto: number; clave_rastreo: string | null; url_cep: string | null; fecha_pago: string };
      const allPagos: PagoRow[] = [];
      for (const chunk of chunkArray(escriturableCuentaIds, 500)) {
        const { data } = await (supabase as any)
          .from('pagos')
          .select('id, id_cuenta_cobranza, monto, clave_rastreo, url_cep, fecha_pago')
          .in('id_cuenta_cobranza', chunk)
          .eq('activo', true);
        if (data) allPagos.push(...data);
      }

      // ── Paso 7: pago_validaciones (chunks 500) ────────────────────────────
      const pagoIds = allPagos.map(p => p.id);
      const allValidaciones: { id: number; id_pago: number; estado: string | null; fecha_creacion: string }[] = [];
      for (const chunk of chunkArray(pagoIds, 500)) {
        const { data } = await (supabase as any)
          .from('pago_validaciones')
          .select('id, id_pago, estado, fecha_creacion')
          .in('id_pago', chunk);
        if (data) allValidaciones.push(...data);
      }
      const latestValByPago = buildLatestValidacionByPago(allValidaciones);

      // ── Paso 8: compradores de cuentas principales (chunks 500) ──────────
      const principalCuentaIdsArr = [...principalCuentaIds].filter(id => escriturableCuentaIds.includes(id));
      type ComprRow = { id_cuenta_cobranza: number; id_persona: number; porcentaje_copropiedad: number };
      const allComprs: ComprRow[] = [];
      for (const chunk of chunkArray(principalCuentaIdsArr, 500)) {
        const { data } = await supabase
          .from('compradores')
          .select('id_cuenta_cobranza, id_persona, porcentaje_copropiedad')
          .in('id_cuenta_cobranza', chunk)
          .eq('activo', true)
          .order('porcentaje_copropiedad', { ascending: false });
        if (data) allComprs.push(...(data as ComprRow[]));
      }

      // ── Paso 9: personas ──────────────────────────────────────────────────
      const personaIds = [...new Set(allComprs.map(c => c.id_persona))];
      const personaMap: Record<number, { nombre_legal: string; rfc: string | null }> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal, rfc')
          .in('id', personaIds);
        (personas ?? []).forEach(p => { personaMap[p.id] = { nombre_legal: p.nombre_legal, rfc: p.rfc }; });
      }

      // compradores agrupados por cuenta
      const comprsByCuentaId: Record<number, CompradoresInfo[]> = {};
      allComprs.forEach(c => {
        if (!comprsByCuentaId[c.id_cuenta_cobranza]) comprsByCuentaId[c.id_cuenta_cobranza] = [];
        const p = personaMap[c.id_persona];
        comprsByCuentaId[c.id_cuenta_cobranza].push({
          id_persona: c.id_persona,
          nombre: p?.nombre_legal ?? '—',
          rfc: p?.rfc ?? null,
          porcentaje: c.porcentaje_copropiedad,
        });
      });

      // ── Paso 10: documentos obligatorios (chunks 100) ─────────────────────
      type DocRow = { id: number; id_persona: number; id_tipo_documento: number; id_estatus_verificacion: number; fecha_creacion: string | null };
      const allDocs: DocRow[] = [];
      for (const chunk of chunkArray(personaIds, 100)) {
        const { data } = await (supabase as any)
          .from('documentos')
          .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion')
          .in('id_persona', chunk)
          .in('id_tipo_documento', ALL_OBLIGATORIO_IDS)
          .eq('activo', true)
          .eq('es_draft', false)
          .limit(5000);
        if (data) allDocs.push(...data);
      }
      const latestDocByKey = buildLatestDocByKey(allDocs);

      // ── Paso 11: acuerdos_pago vencidos > 30 días (chunks 500) ───────────
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cutoff30 = new Date(today);
      cutoff30.setDate(cutoff30.getDate() - 30);
      const cutoff30Str = cutoff30.toISOString().split('T')[0];

      type AcuerdoRow = { id: number; id_cuenta_cobranza: number; fecha_pago: string | null };
      const allAcuerdosVencidos: AcuerdoRow[] = [];
      for (const chunk of chunkArray(escriturableCuentaIds, 500)) {
        const { data } = await (supabase as any)
          .from('acuerdos_pago')
          .select('id, id_cuenta_cobranza, fecha_pago')
          .in('id_cuenta_cobranza', chunk)
          .eq('activo', true)
          .eq('pago_completado', false)
          .lt('fecha_pago', cutoff30Str);
        if (data) allAcuerdosVencidos.push(...data);
      }

      // ── Paso 12: CEP cutoff ───────────────────────────────────────────────
      const cepCutoff = subtract10BusinessDays(today);
      const cepCutoffStr = cepCutoff.toISOString().split('T')[0];

      // ── Paso 13: join + clasificar ────────────────────────────────────────

      // Índices por propiedad
      const pagosByPropId: Record<number, PagoRow[]> = {};
      allPagos.forEach(p => {
        const propId = cuentaPropMap[p.id_cuenta_cobranza];
        if (!propId) return;
        if (!pagosByPropId[propId]) pagosByPropId[propId] = [];
        pagosByPropId[propId].push(p);
      });

      const acuerdosVencidosByPropId: Record<number, AcuerdoRow[]> = {};
      allAcuerdosVencidos.forEach(a => {
        const propId = cuentaPropMap[a.id_cuenta_cobranza];
        if (!propId) return;
        if (!acuerdosVencidosByPropId[propId]) acuerdosVencidosByPropId[propId] = [];
        acuerdosVencidosByPropId[propId].push(a);
      });

      // Compradores por propiedad (vía cuenta principal)
      const comprsByPropId: Record<number, CompradoresInfo[]> = {};
      Object.entries(comprsByCuentaId).forEach(([cuentaId, comprs]) => {
        const propId = cuentaPropMap[Number(cuentaId)];
        if (!propId) return;
        if (!comprsByPropId[propId]) comprsByPropId[propId] = [];
        // Solo agregar si no hay ya compradores (tomar primer cuenta principal)
        if (!comprsByPropId[propId].length) comprsByPropId[propId] = comprs;
      });

      // Construir UnidadEscriturable por propiedad
      return props.map(prop => {
        const emodId = prop.id_edificio_modelo;
        const edificioId = emodEdificioMap[emodId];
        const modeloId = emodModeloMap[emodId];

        const pagos = pagosByPropId[prop.id] ?? [];
        let pagosError = 0, pagosSinValidar = 0, pagosCoincide = 0, pagosCepPendiente = 0;
        for (const pago of pagos) {
          const val = latestValByPago[pago.id];
          const estado = val?.estado ?? null;
          if (estado === 'error' || estado === 'no_coincide') pagosError++;
          else if (estado === null) pagosSinValidar++;
          else if (estado === 'coincide') pagosCoincide++;
          // CEP pendiente (orthogonal al estado de validación)
          if (pago.clave_rastreo != null && pago.url_cep == null && pago.fecha_pago >= cepCutoffStr) {
            pagosCepPendiente++;
          }
        }

        const acuerdosVencidos = (acuerdosVencidosByPropId[prop.id] ?? []);
        const acuerdosVencidosCount = acuerdosVencidos.length;
        let diasMaxVencimiento = 0;
        if (acuerdosVencidosCount > 0) {
          diasMaxVencimiento = Math.max(...acuerdosVencidos.map(a => {
            if (!a.fecha_pago) return 0;
            const d = Math.floor((today.getTime() - new Date(a.fecha_pago).getTime()) / 86_400_000);
            return d;
          }));
        }

        const compradores = comprsByPropId[prop.id] ?? [];
        const allPersonaIds = compradores.map(c => c.id_persona);
        let docsCompletos = 0;
        if (allPersonaIds.length > 0) {
          // Conservador: mínimo entre todos los compradores
          const counts = allPersonaIds.map(pid => countValidatedGroups(pid, latestDocByKey));
          docsCompletos = Math.min(...counts);
        }
        const expedienteOk = docsCompletos >= OBLIGATORIO_GRUPOS.length;

        const blockers: string[] = [];
        const warnings: string[] = [];

        if (pagosError > 0) blockers.push(`${pagosError} pago(s) con error de validación`);
        if (acuerdosVencidosCount > 0) blockers.push(`${acuerdosVencidosCount} acuerdo(s) vencido(s) (${diasMaxVencimiento} días)`);

        if (pagosSinValidar > 0) warnings.push(`${pagosSinValidar} pago(s) sin validar`);
        if (!expedienteOk) warnings.push(`Expediente: ${docsCompletos}/${OBLIGATORIO_GRUPOS.length} grupos`);
        if (pagosCepPendiente > 0) warnings.push(`${pagosCepPendiente} CEP pendiente`);

        const bloqueada = blockers.length > 0;
        const pendiente = !bloqueada && (warnings.length > 0);
        const conclusion: ConclusionEscrituracion = bloqueada ? 'BLOQUEADA' : pendiente ? 'PENDIENTE_REVISION' : 'LISTA';

        return {
          propiedadId: prop.id,
          numeroPropiedad: prop.numero_propiedad,
          proyecto: '',
          proyectoId: proyectoId!,
          edificio: edificioIdMap[edificioId] ?? '—',
          modelo: modeloNombreMap[modeloId] ?? '—',
          estatusDisponibilidadId: prop.id_estatus_disponibilidad,
          totalPagos: pagos.length,
          pagosError,
          pagosSinValidar,
          pagosCoincide,
          pagosCepPendiente,
          docsCompletos,
          expedienteOk,
          acuerdosVencidos: acuerdosVencidosCount,
          diasMaxVencimiento,
          compradores,
          clienteNombre: compradores[0]?.nombre ?? '—',
          blockers,
          warnings,
          conclusion,
        } satisfies UnidadEscriturable;
      });
    },
    staleTime: 30_000,
    enabled: proyectoId != null,
  });

  // Inyectar nombre del proyecto en los resultados
  const unidadesConProyecto = unidades.map(u => {
    const proy = proyectos.find(p => p.id === u.proyectoId);
    return { ...u, proyecto: proy?.nombre ?? u.proyecto };
  });

  return {
    unidades: unidadesConProyecto,
    proyectos,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
