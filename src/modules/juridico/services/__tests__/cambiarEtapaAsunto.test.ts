import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cambiarEtapaAsunto,
  normalizeJuridicoError,
  JuridicoServiceError,
  CambiarEtapaAsuntoInput,
} from '../cambiarEtapaAsunto';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
const mockRpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

// ── Fixture de entrada válida ──────────────────────────────────────────────────

const VALID_INPUT: CambiarEtapaAsuntoInput = {
  idAsunto:     '45',
  idEtapaNueva: '3',
  descripcion:  'Cambio de etapa UAT',
};

const SUCCESS_RESPONSE = {
  data:  { success: true, data: { id: '99', id_asunto: '45' } },
  error: null,
};

// ── Tests: normalizeJuridicoError ─────────────────────────────────────────────

describe('normalizeJuridicoError', () => {
  it.each([
    ['P0090', 'JUR-0000'],
    ['P0009', 'JUR-0009'],
    ['P0011', 'JUR-0011'],
    ['P0012', 'JUR-0012'],
    ['P0016', 'JUR-0016'],
    ['P0017', 'JUR-0017'],
    ['P0018', 'JUR-0018'],
    ['P0019', 'JUR-0019'],
    ['P0020', 'JUR-0020'],
  ])('SQLSTATE %s → %s', (pgCode, expectedCode) => {
    const err = normalizeJuridicoError({ code: pgCode, message: `Error [${pgCode}]` });

    expect(err).toBeInstanceOf(JuridicoServiceError);
    expect(err.code).toBe(expectedCode);
    expect(err.pgCode).toBe(pgCode);
    expect(err.name).toBe('JuridicoServiceError');
  });

  it('extrae código JUR del mensaje cuando SQLSTATE no está mapeado', () => {
    const err = normalizeJuridicoError({
      code: 'XX000',
      message: 'Etapa no encontrada. [JUR-0017]',
    });
    expect(err.code).toBe('JUR-0017');
    expect(err.pgCode).toBe('XX000');
  });

  it('devuelve JUR-UNKNOWN para errores completamente desconocidos', () => {
    const err = normalizeJuridicoError({ code: 'XX000', message: 'Error interno genérico' });
    expect(err.code).toBe('JUR-UNKNOWN');
  });

  it('maneja error sin code ni message', () => {
    const err = normalizeJuridicoError({});
    expect(err.code).toBe('JUR-UNKNOWN');
    expect(err).toBeInstanceOf(JuridicoServiceError);
  });

  it('preserva el error original en originalError', () => {
    const original = { code: 'P0017', message: 'etapa not found' };
    const err = normalizeJuridicoError(original);
    expect(err.originalError).toBe(original);
  });
});

// ── Tests: cambiarEtapaAsunto — happy path ────────────────────────────────────

describe('cambiarEtapaAsunto — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it('devuelve id e idAsunto como strings', async () => {
    const result = await cambiarEtapaAsunto(VALID_INPUT);

    expect(result.id).toBe('99');
    expect(result.idAsunto).toBe('45');
    expect(typeof result.id).toBe('string');
    expect(typeof result.idAsunto).toBe('string');
  });

  it('llama al RPC con los parámetros correctos', async () => {
    await cambiarEtapaAsunto(VALID_INPUT);

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('cambiar_etapa_asunto', {
      p_id_asunto:      '45',
      p_id_etapa_nueva: '3',
      p_descripcion:    'Cambio de etapa UAT',
    });
  });

  it('acepta idAsunto como número', async () => {
    await cambiarEtapaAsunto({ ...VALID_INPUT, idAsunto: 45 });
    expect(mockRpc).toHaveBeenCalledWith(
      'cambiar_etapa_asunto',
      expect.objectContaining({ p_id_asunto: 45 }),
    );
  });

  it('acepta idEtapaNueva como número', async () => {
    await cambiarEtapaAsunto({ ...VALID_INPUT, idEtapaNueva: 3 });
    expect(mockRpc).toHaveBeenCalledWith(
      'cambiar_etapa_asunto',
      expect.objectContaining({ p_id_etapa_nueva: 3 }),
    );
  });
});

// ── Tests: cambiarEtapaAsunto — errores de negocio T2 ─────────────────────────

describe('cambiarEtapaAsunto — errores de negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([
    ['P0090', 'JUR-0000'],
    ['P0009', 'JUR-0009'],
    ['P0011', 'JUR-0011'],
    ['P0012', 'JUR-0012'],
    ['P0016', 'JUR-0016'],
    ['P0017', 'JUR-0017'],
    ['P0018', 'JUR-0018'],
    ['P0019', 'JUR-0019'],
    ['P0020', 'JUR-0020'],
  ])('error %s → JuridicoServiceError %s', async (pgCode, expectedCode) => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: pgCode, message: `Error ${pgCode}` },
    });

    const call = cambiarEtapaAsunto(VALID_INPUT);
    await expect(call).rejects.toBeInstanceOf(JuridicoServiceError);
    await expect(call).rejects.toMatchObject({ code: expectedCode, pgCode });
  });
});

// ── Tests: cambiarEtapaAsunto — violaciones de contrato ──────────────────────

describe('cambiarEtapaAsunto — violaciones de contrato', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza JUR-CONTRACT_VIOLATION cuando success=false', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: false, error: { code: 'JUR-0017', message: 'etapa not found' } },
      error: null,
    });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando id es number en lugar de string', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: true, data: { id: 99, id_asunto: '45' } },
      error: null,
    });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando id_asunto es number en lugar de string', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: true, data: { id: '99', id_asunto: 45 } },
      error: null,
    });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es null sin error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando falta data anidada', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es string inesperado', async () => {
    mockRpc.mockResolvedValue({ data: 'unexpected', error: null });
    await expect(cambiarEtapaAsunto(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });
});
