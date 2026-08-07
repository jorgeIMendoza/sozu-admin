import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock supabase ──────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

import { supabase } from '@/integrations/supabase/client';
import { AntilavadoService, DIAS_VIGENCIA_ANTILAVADO } from '../antilavadoService';

const mockFrom = (supabase as any).from as ReturnType<typeof vi.fn>;
const mockInvoke = (supabase as any).functions.invoke as ReturnType<typeof vi.fn>;

/**
 * Query builder encadenable: cualquier metodo devuelve el mismo objeto y el
 * resultado se entrega al await final (o al `maybeSingle()`).
 */
function queryBuilder(resultado: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[metodo] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(resultado);
  builder.single = () => Promise.resolve(resultado);
  builder.then = (resolve: (valor: unknown) => unknown) => Promise.resolve(resultado).then(resolve);
  return builder;
}

/** Respuestas por tabla, en el orden en que el servicio las consulta. */
function mockTablas(respuestas: Record<string, { data: unknown; error: unknown }>) {
  mockFrom.mockImplementation((tabla: string) =>
    queryBuilder(respuestas[tabla] ?? { data: null, error: null })
  );
}

const hace = (dias: number) =>
  new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

const CUENTA = 531;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getStatus ─────────────────────────────────────────────────────────────────

describe('AntilavadoService.getStatus', () => {
  it('marca vigente al comprobante de menos de 90 dias y no vigente al mas viejo', async () => {
    const reciente = hace(10);
    const viejo = hace(DIAS_VIGENCIA_ANTILAVADO + 5);

    mockTablas({
      compradores: {
        data: [
          { id_persona: 1, personas: { nombre_legal: 'Ana Ruiz', rfc: 'RUBY8811062HA' } },
          { id_persona: 2, personas: { nombre_legal: 'Beto Mena', rfc: 'MEID861230U72' } },
        ],
        error: null,
      },
      cuentas_cobranza: { data: { id: CUENTA, id_propiedad: 77, ofertas: null }, error: null },
      documentos: {
        data: [
          { id: 900, url: 'https://x/ana.pdf', id_persona: 1, fecha_creacion: reciente },
          { id: 800, url: 'https://x/beto.pdf', id_persona: 2, fecha_creacion: viejo },
        ],
        error: null,
      },
    });

    const status = await AntilavadoService.getStatus(CUENTA);

    expect(status.totalCompradores).toBe(2);
    expect(status.verificados).toBe(2);
    expect(status.vigentes).toBe(1);
    expect(status.idPropiedad).toBe(77);
    expect(status.compradores[0]).toMatchObject({
      id_persona: 1,
      nombre_legal: 'Ana Ruiz',
      rfc: 'RUBY8811062HA',
      tieneVerificacion: true,
      vigente: true,
      docId: 900,
    });
    expect(status.compradores[1]).toMatchObject({ vigente: false, docId: 800 });
  });

  it('conserva solo el comprobante mas reciente por comprador', async () => {
    mockTablas({
      compradores: {
        data: [{ id_persona: 1, personas: { nombre_legal: 'Ana Ruiz', rfc: 'RUBY8811062HA' } }],
        error: null,
      },
      cuentas_cobranza: { data: { id: CUENTA, id_propiedad: 77, ofertas: null }, error: null },
      // El servicio pide order(fecha desc): el primero de la lista es el vigente.
      documentos: {
        data: [
          { id: 950, url: 'https://x/nuevo.pdf', id_persona: 1, fecha_creacion: hace(1) },
          { id: 900, url: 'https://x/viejo.pdf', id_persona: 1, fecha_creacion: hace(40) },
        ],
        error: null,
      },
    });

    const status = await AntilavadoService.getStatus(CUENTA);

    expect(status.compradores[0].docId).toBe(950);
    expect(status.compradores[0].urlVerificacion).toBe('https://x/nuevo.pdf');
  });

  it('reporta rfc nulo y sin comprobante', async () => {
    mockTablas({
      compradores: {
        data: [{ id_persona: 3, personas: { nombre_legal: 'Sin Datos', rfc: null } }],
        error: null,
      },
      cuentas_cobranza: { data: { id: CUENTA, id_propiedad: null, ofertas: { id_propiedad: 55 } }, error: null },
      documentos: { data: [], error: null },
    });

    const status = await AntilavadoService.getStatus(CUENTA);

    expect(status.compradores[0]).toMatchObject({
      rfc: null,
      tieneVerificacion: false,
      vigente: false,
      docId: null,
    });
    expect(status.verificados).toBe(0);
    // Cae al camino historico cuenta -> oferta -> propiedad.
    expect(status.idPropiedad).toBe(55);
  });
});

// ── consultar ─────────────────────────────────────────────────────────────────

describe('AntilavadoService.consultar', () => {
  const PARAMS = { rfc: 'RUBY8811062HA', id_cuenta_cobranza: CUENTA, id_persona: 1, id_propiedad: 77 };

  it('devuelve el payload del backend tal cual cuando la consulta es limpia', async () => {
    const payload = {
      success: true,
      rfc: 'RUBY8811062HA',
      encontrado_en_sat: false,
      reutilizado: false,
      comprobante: { numero: 'ABC123', fecha_consulta: '2026-08-07T02:54:29Z', resultado: 'NO ENCONTRADO' },
      documento: { id: 1234, url: 'https://x/comprobante.pdf' },
    };
    mockInvoke.mockResolvedValue({ data: payload, error: null });

    const resultado = await AntilavadoService.consultar(PARAMS);

    expect(resultado).toEqual(payload);
    expect(mockInvoke).toHaveBeenCalledWith('trigger-antilavado', {
      body: {
        rfc: 'RUBY8811062HA',
        id_cuenta_cobranza: CUENTA,
        id_persona: 1,
        id_propiedad: 77,
        force: false,
      },
    });
  });

  it('propaga encontrado_en_sat sin documento adjunto', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, encontrado_en_sat: true, documento: null, message: 'aparece en la lista 69-B' },
      error: null,
    });

    const resultado = await AntilavadoService.consultar(PARAMS);

    expect(resultado.success).toBe(true);
    expect(resultado.encontrado_en_sat).toBe(true);
    expect(resultado.documento).toBeNull();
  });

  it('rescata el mensaje del backend cuando la Edge Function responde non-2xx', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: { json: async () => ({ success: false, message: 'RFC invalido: se recibieron 6.' }) },
      }),
    });

    const resultado = await AntilavadoService.consultar(PARAMS);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBe('RFC invalido: se recibieron 6.');
  });

  it('cae al mensaje generico si el error no trae body JSON', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Failed to send a request'), {
        context: { json: async () => { throw new Error('no json'); } },
      }),
    });

    const resultado = await AntilavadoService.consultar(PARAMS);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBe('Failed to send a request');
  });

  it('no llama a la Edge Function si el comprador no tiene RFC', async () => {
    const resultado = await AntilavadoService.consultar({ ...PARAMS, rfc: '' });

    expect(resultado).toEqual({ success: false, error: 'El comprador no tiene RFC registrado' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('manda force=true cuando se reconsulta', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await AntilavadoService.consultar({ ...PARAMS, force: true });

    expect(mockInvoke).toHaveBeenCalledWith(
      'trigger-antilavado',
      expect.objectContaining({ body: expect.objectContaining({ force: true }) })
    );
  });
});
