import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registrarActuacion,
  normalizeJuridicoError,
  JuridicoServiceError,
  RegistrarActuacionInput,
} from '../registrarActuacion';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
const mockRpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

// ── Fixture de entrada válida ──────────────────────────────────────────────────

const VALID_INPUT: RegistrarActuacionInput = {
  idAsunto:       '68',
  tipoActuacion:  'NOTIFICACION',
  origen:         'JUZGADO',
  fechaActuacion: '2026-07-23',
  descripcion:    'Notificación de prueba UAT',
};

const SUCCESS_RESPONSE = {
  data:  { success: true, data: { id: '42', id_asunto: '68' } },
  error: null,
};

// ── Tests: normalizeJuridicoError ─────────────────────────────────────────────

describe('normalizeJuridicoError', () => {
  it.each([
    ['P0090', 'JUR-0000'],
    ['P0009', 'JUR-0009'],
    ['P0010', 'JUR-0010'],
    ['P0011', 'JUR-0011'],
    ['P0012', 'JUR-0012'],
    ['P0013', 'JUR-0013'],
    ['P0014', 'JUR-0014'],
    ['P0015', 'JUR-0015'],
    ['P0016', 'JUR-0016'],
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
      message: 'Asunto no encontrado. [JUR-0011]',
    });
    expect(err.code).toBe('JUR-0011');
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
    const original = { code: 'P0011', message: 'not found' };
    const err = normalizeJuridicoError(original);
    expect(err.originalError).toBe(original);
  });
});

// ── Tests: registrarActuacion — happy path ────────────────────────────────────

describe('registrarActuacion — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it('devuelve id e idAsunto como strings', async () => {
    const result = await registrarActuacion(VALID_INPUT);

    expect(result.id).toBe('42');
    expect(result.idAsunto).toBe('68');
    expect(typeof result.id).toBe('string');
    expect(typeof result.idAsunto).toBe('string');
  });

  it('llama al RPC con los parámetros correctos', async () => {
    await registrarActuacion(VALID_INPUT);

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('registrar_actuacion', {
      p_id_asunto:       '68',
      p_tipo_actuacion:  'NOTIFICACION',
      p_origen:          'JUZGADO',
      p_fecha_actuacion: '2026-07-23',
      p_descripcion:     'Notificación de prueba UAT',
      p_resultado:       null,
      p_tipo_fuente:     'MANUAL',
      p_id_documento:    null,
    });
  });

  it('aplica tipoFuente=MANUAL por defecto', async () => {
    await registrarActuacion(VALID_INPUT);
    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_actuacion',
      expect.objectContaining({ p_tipo_fuente: 'MANUAL' }),
    );
  });

  it('aplica idDocumento=null por defecto', async () => {
    await registrarActuacion(VALID_INPUT);
    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_actuacion',
      expect.objectContaining({ p_id_documento: null }),
    );
  });

  it('pasa resultado=null cuando no se especifica', async () => {
    await registrarActuacion(VALID_INPUT);
    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_actuacion',
      expect.objectContaining({ p_resultado: null }),
    );
  });

  it('acepta idAsunto como número y lo pasa sin convertir', async () => {
    await registrarActuacion({ ...VALID_INPUT, idAsunto: 68 });
    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_actuacion',
      expect.objectContaining({ p_id_asunto: 68 }),
    );
  });

  it('acepta idDocumento como string', async () => {
    await registrarActuacion({ ...VALID_INPUT, idDocumento: '7' });
    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_actuacion',
      expect.objectContaining({ p_id_documento: '7' }),
    );
  });
});

// ── Tests: registrarActuacion — errores de negocio ────────────────────────────

describe('registrarActuacion — errores de negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each([
    ['P0090', 'JUR-0000'],
    ['P0009', 'JUR-0009'],
    ['P0010', 'JUR-0010'],
    ['P0011', 'JUR-0011'],
    ['P0012', 'JUR-0012'],
    ['P0013', 'JUR-0013'],
    ['P0014', 'JUR-0014'],
    ['P0015', 'JUR-0015'],
    ['P0016', 'JUR-0016'],
  ])('error %s → JuridicoServiceError %s', async (pgCode, expectedCode) => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: pgCode, message: `Error ${pgCode}` },
    });

    const call = registrarActuacion(VALID_INPUT);
    await expect(call).rejects.toBeInstanceOf(JuridicoServiceError);
    await expect(call).rejects.toMatchObject({ code: expectedCode, pgCode });
  });
});

// ── Tests: registrarActuacion — violaciones de contrato ──────────────────────

describe('registrarActuacion — violaciones de contrato', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lanza JUR-CONTRACT_VIOLATION cuando success=false (error ya manejado en BD)', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: false, error: { code: 'JUR-0011', message: 'not found' } },
      error: null,
    });
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando id es number en lugar de string', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: true, data: { id: 42, id_asunto: '68' } }, // id como number — violación de contrato v1
      error: null,
    });
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando id_asunto es number en lugar de string', async () => {
    mockRpc.mockResolvedValue({
      data:  { success: true, data: { id: '42', id_asunto: 68 } }, // id_asunto como number
      error: null,
    });
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es null sin error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando data es string inesperado', async () => {
    mockRpc.mockResolvedValue({ data: 'unexpected string', error: null });
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });

  it('lanza JUR-CONTRACT_VIOLATION cuando falta la clave data anidada', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null }); // sin .data.id
    await expect(registrarActuacion(VALID_INPUT)).rejects.toMatchObject({
      code: 'JUR-CONTRACT_VIOLATION',
    });
  });
});
