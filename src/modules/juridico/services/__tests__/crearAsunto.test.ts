import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  crearAsunto,
  normalizeJuridicoError,
  JuridicoServiceError,
  CrearAsuntoInput,
} from '../crearAsunto';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
const mockRpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

// ── Fixture de entrada válida ──────────────────────────────────────────────────

const VALID_INPUT: CrearAsuntoInput = {
  idExpediente: '113',
  idTipoAsunto: '3',
  origen:       'PROFECO',
  posicionSozu: 'PROVEEDOR',
};

const SUCCESS_RESPONSE = {
  data: {
    success: true,
    data: {
      id_expediente:    '113',
      id_asunto:        '150',
      folio_expediente: 'EXP-000113',
      folio_asunto:     'ASU-000150',
      id_tipo_asunto:   '3',
    },
  },
  error: null,
};

// ── Tests: normalizeJuridicoError — catálogo T4 ───────────────────────────────

describe('normalizeJuridicoError — T4 crear_asunto', () => {
  it.each([
    ['P0090', 'JUR-0000'],
    ['P0022', 'JUR-0022'],
    ['P0023', 'JUR-0023'],
    ['P0024', 'JUR-0024'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
    ['P0029', 'JUR-0029'],
    ['P0030', 'JUR-0030'],
  ])('SQLSTATE %s → %s', (pgCode, expectedCode) => {
    const err = normalizeJuridicoError({ code: pgCode, message: `Error [${pgCode}]` });

    expect(err).toBeInstanceOf(JuridicoServiceError);
    expect(err.code).toBe(expectedCode);
    expect(err.pgCode).toBe(pgCode);
    expect(err.name).toBe('JuridicoServiceError');
  });

  it('JUR-0029 no colisiona con ningún código previo (T1-T3/orquestador)', () => {
    const err = normalizeJuridicoError({ code: 'P0029', message: 'Expediente no encontrado.' });
    expect(err.code).toBe('JUR-0029');
    expect(['JUR-0011', 'JUR-0021', 'JUR-0025', 'JUR-0028']).not.toContain(err.code);
  });
});

// ── Tests: crearAsunto — happy path ────────────────────────────────────────────

describe('crearAsunto — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it('devuelve ids y folios como strings', async () => {
    const result = await crearAsunto(VALID_INPUT);

    expect(result.idExpediente).toBe('113');
    expect(result.idAsunto).toBe('150');
    expect(result.folioExpediente).toBe('EXP-000113');
    expect(result.folioAsunto).toBe('ASU-000150');
    expect(result.idTipoAsunto).toBe('3');
    expect(typeof result.idExpediente).toBe('string');
    expect(typeof result.idAsunto).toBe('string');
  });

  it('llama al RPC crear_asunto (no crear_expediente) con los parámetros correctos', async () => {
    await crearAsunto(VALID_INPUT);

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('crear_asunto', {
      p_id_expediente:  '113',
      p_id_tipo_asunto: '3',
      p_origen:         'PROFECO',
      p_posicion_sozu:  'PROVEEDOR',
    });
  });

  it('no envía p_id_propiedad ni p_id_proyecto (a diferencia de crear_expediente)', async () => {
    await crearAsunto(VALID_INPUT);
    const callArgs = mockRpc.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('p_id_propiedad');
    expect(callArgs).not.toHaveProperty('p_id_proyecto');
  });

  it('acepta idExpediente e idTipoAsunto como number', async () => {
    await crearAsunto({ ...VALID_INPUT, idExpediente: 113, idTipoAsunto: 3 });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_asunto',
      expect.objectContaining({ p_id_expediente: 113, p_id_tipo_asunto: 3 }),
    );
  });

  it.each([
    ['SOZU_ACTORA'],
    ['COMPRADOR_ACTOR'],
    ['PROFECO'],
  ])('acepta origen=%s', async (origen) => {
    await crearAsunto({ ...VALID_INPUT, origen: origen as any });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_asunto',
      expect.objectContaining({ p_origen: origen }),
    );
  });

  it.each([
    ['ACTOR'],
    ['DEMANDADO'],
    ['PROMOVENTE'],
    ['PROVEEDOR'],
  ])('acepta posicionSozu=%s', async (posicion) => {
    await crearAsunto({ ...VALID_INPUT, posicionSozu: posicion as any });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_asunto',
      expect.objectContaining({ p_posicion_sozu: posicion }),
    );
  });
});

// ── Tests: crearAsunto — errores de negocio T4 ────────────────────────────────

describe('crearAsunto — errores de negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([
    ['P0090', 'JUR-0000'],
    ['P0022', 'JUR-0022'],
    ['P0023', 'JUR-0023'],
    ['P0024', 'JUR-0024'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
    ['P0029', 'JUR-0029'],
    ['P0030', 'JUR-0030'],
  ])('error %s → JuridicoServiceError %s', async (pgCode, expectedCode) => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: pgCode, message: `Error ${pgCode}` },
    });

    const call = crearAsunto(VALID_INPUT);
    await expect(call).rejects.toBeInstanceOf(JuridicoServiceError);
    await expect(call).rejects.toMatchObject({ code: expectedCode, pgCode });
  });
});

// ── Tests: crearAsunto — violaciones de contrato ─────────────────────────────

describe('crearAsunto — violaciones de contrato', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza JUR-CONTRACT_VIOLATION cuando success=false', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: false, error: { code: 'JUR-0030', message: 'expediente no activo' } },
      error: null,
    });
    await expect(crearAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it.each([
    'id_expediente',
    'id_asunto',
    'folio_expediente',
    'folio_asunto',
    'id_tipo_asunto',
  ])('lanza JUR-CONTRACT_VIOLATION cuando %s es number en lugar de string', async (field) => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        data: { ...SUCCESS_RESPONSE.data.data, [field]: 999 },
      },
      error: null,
    });
    await expect(crearAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es null sin error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(crearAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando falta data anidada', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await expect(crearAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es string inesperado', async () => {
    mockRpc.mockResolvedValue({ data: 'unexpected', error: null });
    await expect(crearAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });
});
