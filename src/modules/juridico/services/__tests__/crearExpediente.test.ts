import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  crearExpediente,
  normalizeJuridicoError,
  JuridicoServiceError,
  CrearExpedienteInput,
} from '../crearExpediente';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
const mockRpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

// ── Fixture de entrada válida ──────────────────────────────────────────────────

const VALID_INPUT: CrearExpedienteInput = {
  idPropiedad:  '123',
  idProyecto:   7,
  idTipoAsunto: '2',
  origen:       'SOZU_ACTORA',
  posicionSozu: 'ACTOR',
};

const SUCCESS_RESPONSE = {
  data: {
    success: true,
    data: {
      id_expediente:    '45',
      id_asunto:        '123',
      folio_expediente: 'EXP-000045',
      folio_asunto:     'ASU-000123',
      id_tipo_asunto:   '2',
    },
  },
  error: null,
};

// ── Tests: normalizeJuridicoError — catálogo T3 ───────────────────────────────

describe('normalizeJuridicoError — T3 crear_expediente', () => {
  it.each([
    ['P0090', 'JUR-0000'],
    ['P0021', 'JUR-0021'],
    ['P0022', 'JUR-0022'],
    ['P0023', 'JUR-0023'],
    ['P0024', 'JUR-0024'],
    ['P0025', 'JUR-0025'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
  ])('SQLSTATE %s → %s', (pgCode, expectedCode) => {
    const err = normalizeJuridicoError({ code: pgCode, message: `Error [${pgCode}]` });

    expect(err).toBeInstanceOf(JuridicoServiceError);
    expect(err.code).toBe(expectedCode);
    expect(err.pgCode).toBe(pgCode);
    expect(err.name).toBe('JuridicoServiceError');
  });

  it('JUR-0026 no colisiona con JUR-0011 (usuario vs. asunto no encontrado)', () => {
    const err = normalizeJuridicoError({ code: 'P0026', message: 'Usuario no encontrado o inactivo.' });
    expect(err.code).toBe('JUR-0026');
    expect(err.code).not.toBe('JUR-0011');
  });

  it('JUR-0027 no colisiona con JUR-0012 (rol sin permisos vs. asunto inactivo)', () => {
    const err = normalizeJuridicoError({ code: 'P0027', message: 'Rol sin permisos para crear expedientes.' });
    expect(err.code).toBe('JUR-0027');
    expect(err.code).not.toBe('JUR-0012');
  });
});

// ── Tests: crearExpediente — happy path ────────────────────────────────────────

describe('crearExpediente — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it('devuelve ids y folios como strings', async () => {
    const result = await crearExpediente(VALID_INPUT);

    expect(result.idExpediente).toBe('45');
    expect(result.idAsunto).toBe('123');
    expect(result.folioExpediente).toBe('EXP-000045');
    expect(result.folioAsunto).toBe('ASU-000123');
    expect(result.idTipoAsunto).toBe('2');
    expect(typeof result.idExpediente).toBe('string');
    expect(typeof result.idAsunto).toBe('string');
  });

  it('llama al RPC con los parámetros correctos', async () => {
    await crearExpediente(VALID_INPUT);

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('crear_expediente', {
      p_id_propiedad:   '123',
      p_id_proyecto:    7,
      p_id_tipo_asunto: '2',
      p_origen:         'SOZU_ACTORA',
      p_posicion_sozu:  'ACTOR',
    });
  });

  it('acepta idPropiedad e idTipoAsunto como number', async () => {
    await crearExpediente({ ...VALID_INPUT, idPropiedad: 123, idTipoAsunto: 2 });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_expediente',
      expect.objectContaining({ p_id_propiedad: 123, p_id_tipo_asunto: 2 }),
    );
  });

  it.each([
    ['SOZU_ACTORA'],
    ['COMPRADOR_ACTOR'],
    ['PROFECO'],
  ])('acepta origen=%s', async (origen) => {
    await crearExpediente({ ...VALID_INPUT, origen: origen as any });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_expediente',
      expect.objectContaining({ p_origen: origen }),
    );
  });

  it.each([
    ['ACTOR'],
    ['DEMANDADO'],
    ['PROMOVENTE'],
    ['PROVEEDOR'],
  ])('acepta posicionSozu=%s', async (posicion) => {
    await crearExpediente({ ...VALID_INPUT, posicionSozu: posicion as any });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_expediente',
      expect.objectContaining({ p_posicion_sozu: posicion }),
    );
  });
});

// ── Tests: crearExpediente — errores de negocio T3 ────────────────────────────

describe('crearExpediente — errores de negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([
    ['P0090', 'JUR-0000'],
    ['P0021', 'JUR-0021'],
    ['P0022', 'JUR-0022'],
    ['P0023', 'JUR-0023'],
    ['P0024', 'JUR-0024'],
    ['P0025', 'JUR-0025'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
  ])('error %s → JuridicoServiceError %s', async (pgCode, expectedCode) => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: pgCode, message: `Error ${pgCode}` },
    });

    const call = crearExpediente(VALID_INPUT);
    await expect(call).rejects.toBeInstanceOf(JuridicoServiceError);
    await expect(call).rejects.toMatchObject({ code: expectedCode, pgCode });
  });
});

// ── Tests: crearExpediente — violaciones de contrato ─────────────────────────

describe('crearExpediente — violaciones de contrato', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza JUR-CONTRACT_VIOLATION cuando success=false', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: false, error: { code: 'JUR-0025', message: 'expediente activo ya existe' } },
      error: null,
    });
    await expect(crearExpediente(VALID_INPUT)).rejects.toMatchObject({
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
    await expect(crearExpediente(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es null sin error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(crearExpediente(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando falta data anidada', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await expect(crearExpediente(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es string inesperado', async () => {
    mockRpc.mockResolvedValue({ data: 'unexpected', error: null });
    await expect(crearExpediente(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });
});
