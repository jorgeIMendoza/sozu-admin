import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildLatestPorPersonaTipo,
  evaluarCuenta,
  fetchDocsObligatorios,
  fetchPersonasExpediente,
  type PersonaExpedienteResuelta,
} from '@/utils/expediente-obligatorios';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTATUS_ESCRITURABLES = [5, 7, 9];

// id_producto de ofertas que entran a escrituración
// null → propiedad principal · 4 → bodega Bottura · 10 → estacionamiento Bottura
const ESCRITURABLE_PRODUCTOS_IDS = [4, 10];

const CEP_CUTOFF_BUSINESS_DAYS = 10;

// Los grupos obligatorios salen de la FUENTE ÚNICA (`utils/expediente-obligatorios`),
// no de una copia local: la que vivía aquí no distinguía persona física de moral,
// ignoraba al representante legal y listaba el tipo 59 —del que no hay un solo
// documento validado en producción— mientras dejaba fuera el pasaporte.

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
  docsCompletos: number;     // grupos obligatorios con doc validado
  docsTotal: number;         // total exigido: depende de PF/PM y del estado civil
  docsFaltantes: string[];   // etiquetas de lo que falta
  expedienteOk: boolean;     // docsCompletos >= docsTotal

  // Morosidad — fuente: get_bandeja_operativa (mismo origen que portal-cobranza)
  diasSinPagar: number;       // bloquear solo si > 30
  parcialidadesVencidas: number;

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

      // ── Paso 10: expediente por la fuente única ───────────────────────────
      // Las personas del expediente son los compradores MÁS su representante legal
      // (persona moral) y su cónyuge: sus documentos viven bajo su propia persona.
      const personasExpediente = await fetchPersonasExpediente({ personaIds }, supabase as never);
      const personaExpedienteById = new Map<number, PersonaExpedienteResuelta>(
        personasExpediente.map(p => [p.personaId, p]),
      );
      const idsParaDocs = [...new Set([
        ...personasExpediente.map(p => p.personaId),
        ...personasExpediente.map(p => p.repPersonaId).filter((v): v is number => v != null),
      ])];
      const latestDocByKey = buildLatestPorPersonaTipo(
        await fetchDocsObligatorios(idsParaDocs, supabase),
      );

      // ── Paso 11: morosidad via get_bandeja_operativa (fuente oficial) ─────
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      type BandejaRow = { cuenta_id: number; dias_sin_pagar: number; parcialidades_vencidas: number };
      const { data: bandejaData } = await supabase.rpc('get_bandeja_operativa', {
        p_proyecto_id: proyectoId,
        p_search: null,
        p_solo_vencidas: false,
      });
      const bandejaRaw = (bandejaData as unknown as BandejaRow[]) ?? [];

      const bandejaByCtaId: Record<number, { diasSinPagar: number; parcialidadesVencidas: number }> = {};
      bandejaRaw.forEach(r => {
        bandejaByCtaId[r.cuenta_id] = {
          diasSinPagar: r.dias_sin_pagar ?? 0,
          parcialidadesVencidas: r.parcialidades_vencidas ?? 0,
        };
      });

      const diasSinPagarByPropId: Record<number, number> = {};
      const parcialidadesVencidasByPropId: Record<number, number> = {};
      escriturableCuentas.forEach(c => {
        const b = bandejaByCtaId[c.id];
        if (!b) return;
        const propId = c.id_propiedad;
        diasSinPagarByPropId[propId] = Math.max(diasSinPagarByPropId[propId] ?? 0, b.diasSinPagar);
        parcialidadesVencidasByPropId[propId] = (parcialidadesVencidasByPropId[propId] ?? 0) + b.parcialidadesVencidas;
      });

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

        const diasSinPagar = diasSinPagarByPropId[prop.id] ?? 0;
        const parcialidadesVencidas = parcialidadesVencidasByPropId[prop.id] ?? 0;

        const compradores = comprsByPropId[prop.id] ?? [];
        // Conservador en copropiedad: vale lo que el comprador peor documentado.
        const evaluacion = evaluarCuenta(
          compradores
            .map(c => personaExpedienteById.get(c.id_persona))
            .filter((p): p is PersonaExpedienteResuelta => !!p),
          latestDocByKey,
          'escrituracion',
        );
        const docsCompletos = evaluacion.completos;
        const docsTotal = evaluacion.total;
        const expedienteOk = docsTotal > 0 && docsCompletos >= docsTotal;

        const blockers: string[] = [];
        const warnings: string[] = [];

        if (pagosError > 0) blockers.push(`${pagosError} pago(s) con error de validación`);
        if (diasSinPagar > 30) blockers.push(`Morosidad: ${diasSinPagar} días sin pago`);

        if (pagosSinValidar > 0) warnings.push(`${pagosSinValidar} pago(s) sin validar`);
        if (!expedienteOk) warnings.push(`Expediente: ${docsCompletos}/${docsTotal} grupos`);
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
          docsTotal,
          docsFaltantes: evaluacion.faltantes,
          expedienteOk,
          diasSinPagar,
          parcialidadesVencidas,
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
