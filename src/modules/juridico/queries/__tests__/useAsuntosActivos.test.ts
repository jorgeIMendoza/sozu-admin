import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { buildAsuntoActivoRows } from '../useAsuntosActivos';

const EXPEDIENTE = {
  id: 110,
  id_propiedad: 5203,
  id_proyecto: 1453,
  folio_visible: 'EXP-000110',
  estado: 'ACTIVO',
};

const ASUNTO = {
  id: 98,
  id_expediente: 110,
  folio_visible: 'ASU-000098',
  id_tipo_asunto: 1,
  id_etapa_actual: null as number | null,
  fecha_limite_contestacion: null as string | null,
};

const TIPO = { id: 1, nombre: 'Demanda civil' };
const ETAPA = { id: 5, nombre: 'Contestación', es_terminal: false };
const PROYECTO = { id: 1453, nombre: 'Margot' };
const PROPIEDAD = { id: 5203, numero_propiedad: '706' };

function maps(overrides: Partial<{ expedientes: any[]; tipos: any[]; etapas: any[]; proyectos: any[]; propiedades: any[] }> = {}) {
  const expedientesMap = new Map((overrides.expedientes ?? [EXPEDIENTE]).map((e) => [e.id, e]));
  const tiposMap = new Map((overrides.tipos ?? [TIPO]).map((t) => [t.id, t]));
  const etapasMap = new Map((overrides.etapas ?? [ETAPA]).map((e) => [e.id, e]));
  const proyectosMap = new Map((overrides.proyectos ?? [PROYECTO]).map((p) => [p.id, p]));
  const propiedadesMap = new Map((overrides.propiedades ?? [PROPIEDAD]).map((p) => [p.id, p]));
  return { expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap };
}

describe('buildAsuntoActivoRows', () => {
  it('ensambla una fila completa a partir de un asunto sin etapa (recién creado por T3)', () => {
    const { expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const rows = buildAsuntoActivoRows([ASUNTO], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      idExpediente: '110',
      idAsunto: '98',
      idPropiedad: '5203',
      idProyecto: 1453,
      proyectoNombre: 'Margot',
      propiedadCodigo: '706',
      folioExpediente: 'EXP-000110',
      folioAsunto: 'ASU-000098',
      estadoExpediente: 'ACTIVO',
      idTipoAsunto: '1',
      tipoAsuntoNombre: 'Demanda civil',
      idEtapaActual: null,
      etapaActualNombre: null,
      etapaEsTerminal: false,
    });
  });

  it('resuelve el nombre de la etapa cuando id_etapa_actual no es null', () => {
    const asuntoConEtapa = { ...ASUNTO, id_etapa_actual: 5 };
    const { expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const rows = buildAsuntoActivoRows([asuntoConEtapa], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows[0].idEtapaActual).toBe('5');
    expect(rows[0].etapaActualNombre).toBe('Contestación');
    expect(rows[0].etapaEsTerminal).toBe(false);
  });

  it('marca etapaEsTerminal=true cuando la etapa resuelta es terminal', () => {
    const asuntoConEtapa = { ...ASUNTO, id_etapa_actual: 5 };
    const etapaTerminal = { id: 5, nombre: 'Cerrado', es_terminal: true };
    const { expedientesMap, tiposMap, proyectosMap, propiedadesMap } = maps();
    const etapasMap = new Map([[etapaTerminal.id, etapaTerminal]]);
    const rows = buildAsuntoActivoRows([asuntoConEtapa], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows[0].etapaEsTerminal).toBe(true);
  });

  it('usa "—" cuando el expediente no se encuentra en el mapa (defensivo)', () => {
    const { tiposMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const expedientesMap = new Map(); // vacío a propósito
    const rows = buildAsuntoActivoRows([ASUNTO], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows[0].idPropiedad).toBe('');
    expect(rows[0].proyectoNombre).toBe('—');
    expect(rows[0].propiedadCodigo).toBe('—');
    expect(rows[0].folioExpediente).toBe('—');
  });

  it('usa "—" cuando el tipo de asunto no se encuentra en el catálogo', () => {
    const { expedientesMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const tiposMap = new Map(); // vacío a propósito
    const rows = buildAsuntoActivoRows([ASUNTO], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows[0].tipoAsuntoNombre).toBe('—');
  });

  it('propaga fechaLimiteContestacion tal cual, sin transformar', () => {
    const asuntoConFecha = { ...ASUNTO, fecha_limite_contestacion: '2026-08-15' };
    const { expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const rows = buildAsuntoActivoRows([asuntoConFecha], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows[0].fechaLimiteContestacion).toBe('2026-08-15');
  });

  it('procesa múltiples asuntos independientemente', () => {
    const otroExpediente = { ...EXPEDIENTE, id: 111, id_propiedad: 5204, folio_visible: 'EXP-000111' };
    const otraPropiedad = { id: 5204, numero_propiedad: '1306' };
    const otroAsunto = { ...ASUNTO, id: 99, id_expediente: 111, folio_visible: 'ASU-000099' };

    const { tiposMap, etapasMap, proyectosMap } = maps();
    const expedientesMap = new Map([[EXPEDIENTE.id, EXPEDIENTE], [otroExpediente.id, otroExpediente]]);
    const propiedadesMap = new Map([[PROPIEDAD.id, PROPIEDAD], [otraPropiedad.id, otraPropiedad]]);

    const rows = buildAsuntoActivoRows([ASUNTO, otroAsunto], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.folioAsunto)).toEqual(['ASU-000098', 'ASU-000099']);
    expect(rows[1].propiedadCodigo).toBe('1306');
  });

  it('devuelve arreglo vacío cuando no hay asuntos', () => {
    const { expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap } = maps();
    const rows = buildAsuntoActivoRows([], expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);
    expect(rows).toEqual([]);
  });
});
