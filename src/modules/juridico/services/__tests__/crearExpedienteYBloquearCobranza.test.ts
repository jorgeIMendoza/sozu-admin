import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  crearExpedienteYBloquearCobranza,
  normalizeJuridicoError,
  JuridicoServiceError,
  CrearExpedienteYBloquearCobranzaInput,
} from '../crearExpedienteYBloquearCobranza';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
const mockRpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

// ── Fixture de entrada válida ──────────────────────────────────────────────────

const VALID_INPUT: CrearExpedienteYBloquearCobranzaInput = {
  idCuentaCobranza: '408',
  idProyecto:       1743,
  idTipoAsunto:     '2',
  origen:           'COMPRADOR_ACTOR',
  posicionSozu:     'DEMANDADO',
};

const SUCCESS_RESPONSE = {
  data: {
    success: true,
    data: {
      id_expediente:        '45',
      id_asunto:            '123',
      folio_expediente:     'EXP-000045',
      folio_asunto:         'ASU-000123',
      id_tipo_asunto:       '2',
      idPropiedadBloqueada: '4938',
    },
  },
  error: null,
};

// ── Tests: normalizeJuridicoError — catálogo del orquestador ──────────────────

describe('normalizeJuridicoError — orquestador crear_expediente_y_bloquear_cobranza', () => {
  it('SQLSTATE P0028 → JUR-0028', () => {
    const err = normalizeJuridicoError({ code: 'P0028', message: 'Cuenta inválida.' });
    expect(err).toBeInstanceOf(JuridicoServiceError);
    expect(err.code).toBe('JUR-0028');
    expect(err.pgCode).toBe('P0028');
  });

  it.each([
    ['P0090', 'JUR-0000'],
    ['P0021', 'JUR-0021'],
    ['P0025', 'JUR-0025'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
  ])('propaga errores de T3 (%s → %s) sin transformarlos', (pgCode, expectedCode) => {
    const err = normalizeJuridicoError({ code: pgCode, message: `Error ${pgCode}` });
    expect(err.code).toBe(expectedCode);
  });
});

// ── Tests: crearExpedienteYBloquearCobranza — happy path ──────────────────────

describe('crearExpedienteYBloquearCobranza — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it('devuelve ids, folios e idPropiedadBloqueada como strings', async () => {
    const result = await crearExpedienteYBloquearCobranza(VALID_INPUT);

    expect(result.idExpediente).toBe('45');
    expect(result.idAsunto).toBe('123');
    expect(result.folioExpediente).toBe('EXP-000045');
    expect(result.folioAsunto).toBe('ASU-000123');
    expect(result.idTipoAsunto).toBe('2');
    expect(result.idPropiedadBloqueada).toBe('4938');
    expect(typeof result.idPropiedadBloqueada).toBe('string');
  });

  it('llama al RPC orquestador con los parámetros correctos', async () => {
    await crearExpedienteYBloquearCobranza(VALID_INPUT);

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('crear_expediente_y_bloquear_cobranza', {
      p_id_cuenta_cobranza: '408',
      p_id_proyecto:        1743,
      p_id_tipo_asunto:     '2',
      p_origen:             'COMPRADOR_ACTOR',
      p_posicion_sozu:      'DEMANDADO',
    });
  });

  it('acepta idCuentaCobranza e idTipoAsunto como number', async () => {
    await crearExpedienteYBloquearCobranza({ ...VALID_INPUT, idCuentaCobranza: 408, idTipoAsunto: 2 });
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_expediente_y_bloquear_cobranza',
      expect.objectContaining({ p_id_cuenta_cobranza: 408, p_id_tipo_asunto: 2 }),
    );
  });
});

// ── Tests: crearExpedienteYBloquearCobranza — errores propios y propagados ───

describe('crearExpedienteYBloquearCobranza — errores de negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([
    ['P0028', 'JUR-0028'], // propio del orquestador
    ['P0090', 'JUR-0000'], // propagado de T3
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

    const call = crearExpedienteYBloquearCobranza(VALID_INPUT);
    await expect(call).rejects.toBeInstanceOf(JuridicoServiceError);
    await expect(call).rejects.toMatchObject({ code: expectedCode, pgCode });
  });
});

// ── Tests: crearExpedienteYBloquearCobranza — violaciones de contrato ────────

describe('crearExpedienteYBloquearCobranza — violaciones de contrato', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza JUR-CONTRACT_VIOLATION cuando success=false', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: false, error: { code: 'JUR-0028', message: 'cuenta inválida' } },
      error: null,
    });
    await expect(crearExpedienteYBloquearCobranza(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it.each([
    'id_expediente',
    'id_asunto',
    'folio_expediente',
    'folio_asunto',
    'id_tipo_asunto',
    'idPropiedadBloqueada',
  ])('lanza JUR-CONTRACT_VIOLATION cuando %s es number en lugar de string', async (field) => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        data: { ...SUCCESS_RESPONSE.data.data, [field]: 999 },
      },
      error: null,
    });
    await expect(crearExpedienteYBloquearCobranza(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es null sin error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(crearExpedienteYBloquearCobranza(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando falta data anidada', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await expect(crearExpedienteYBloquearCobranza(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });
});
