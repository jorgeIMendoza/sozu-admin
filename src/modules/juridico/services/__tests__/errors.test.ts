import { describe, it, expect } from 'vitest';
import {
  JuridicoServiceError,
  normalizeJuridicoError,
  SQLSTATE_MAP,
} from '../errors';

// ── JuridicoServiceError — clase base ─────────────────────────────────────────

describe('JuridicoServiceError', () => {
  it('hereda de Error', () => {
    const err = new JuridicoServiceError('JUR-0011', 'mensaje');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(JuridicoServiceError);
  });

  it('name es JuridicoServiceError', () => {
    const err = new JuridicoServiceError('JUR-0011', 'mensaje');
    expect(err.name).toBe('JuridicoServiceError');
  });

  it('asigna code, message y pgCode', () => {
    const err = new JuridicoServiceError('JUR-0017', 'etapa not found', 'P0017');
    expect(err.code).toBe('JUR-0017');
    expect(err.message).toBe('etapa not found');
    expect(err.pgCode).toBe('P0017');
  });

  it('pgCode es undefined cuando no se pasa', () => {
    const err = new JuridicoServiceError('JUR-CONTRACT_VIOLATION', 'envelope inválido');
    expect(err.pgCode).toBeUndefined();
  });

  it('preserva originalError sin alteraciones', () => {
    const raw = { code: 'P0018', message: 'cross-type', extra: 42 };
    const err = new JuridicoServiceError('JUR-0018', 'cross-type', 'P0018', raw);
    expect(err.originalError).toBe(raw);
  });

  it('originalError es undefined cuando no se pasa', () => {
    const err = new JuridicoServiceError('JUR-UNKNOWN', 'desconocido');
    expect(err.originalError).toBeUndefined();
  });
});

// ── SQLSTATE_MAP — mapa institucional completo ────────────────────────────────

describe('SQLSTATE_MAP — completitud del catálogo', () => {
  // T1: registrar_actuacion
  const t1Entries: [string, string][] = [
    ['P0090', 'JUR-0000'],
    ['P0009', 'JUR-0009'],
    ['P0010', 'JUR-0010'],
    ['P0011', 'JUR-0011'],
    ['P0012', 'JUR-0012'],
    ['P0013', 'JUR-0013'],
    ['P0014', 'JUR-0014'],
    ['P0015', 'JUR-0015'],
    ['P0016', 'JUR-0016'],
  ];

  // T2: cambiar_etapa_asunto
  const t2Entries: [string, string][] = [
    ['P0017', 'JUR-0017'],
    ['P0018', 'JUR-0018'],
    ['P0019', 'JUR-0019'],
    ['P0020', 'JUR-0020'],
  ];

  // T3: crear_expediente
  const t3Entries: [string, string][] = [
    ['P0021', 'JUR-0021'],
    ['P0022', 'JUR-0022'],
    ['P0023', 'JUR-0023'],
    ['P0024', 'JUR-0024'],
    ['P0025', 'JUR-0025'],
    ['P0026', 'JUR-0026'],
    ['P0027', 'JUR-0027'],
  ];

  // Orquestador: crear_expediente_y_bloquear_cobranza
  const orquestadorEntries: [string, string][] = [
    ['P0028', 'JUR-0028'],
  ];

  it.each(t1Entries)('T1 — %s → %s', (pgCode, jurCode) => {
    expect(SQLSTATE_MAP[pgCode]).toBe(jurCode);
  });

  it.each(t2Entries)('T2 — %s → %s', (pgCode, jurCode) => {
    expect(SQLSTATE_MAP[pgCode]).toBe(jurCode);
  });

  it.each(t3Entries)('T3 — %s → %s', (pgCode, jurCode) => {
    expect(SQLSTATE_MAP[pgCode]).toBe(jurCode);
  });

  it.each(orquestadorEntries)('Orquestador — %s → %s', (pgCode, jurCode) => {
    expect(SQLSTATE_MAP[pgCode]).toBe(jurCode);
  });

  it('contiene exactamente 21 entradas (T1×9 + T2×4 + T3×7 + Orquestador×1)', () => {
    expect(Object.keys(SQLSTATE_MAP)).toHaveLength(21);
  });

  it('no contiene entradas desconocidas', () => {
    const known = new Set([
      'P0090','P0009','P0010','P0011','P0012','P0013','P0014','P0015','P0016',
      'P0017','P0018','P0019','P0020',
      'P0021','P0022','P0023','P0024','P0025','P0026','P0027',
      'P0028',
    ]);
    for (const key of Object.keys(SQLSTATE_MAP)) {
      expect(known.has(key)).toBe(true);
    }
  });

  it('T3 no reutiliza P0011/P0012 de T1/T2 (colisión detectada y corregida 2026-07-24)', () => {
    expect(SQLSTATE_MAP['P0011']).toBe('JUR-0011'); // "asunto no encontrado" — heredado T1/T2
    expect(SQLSTATE_MAP['P0012']).toBe('JUR-0012'); // "asunto inactivo" — heredado T1/T2
    expect(SQLSTATE_MAP['P0026']).toBe('JUR-0026'); // "usuario no encontrado" — propio de T3
    expect(SQLSTATE_MAP['P0027']).toBe('JUR-0027'); // "rol sin permisos" — propio de T3
  });
});

// ── normalizeJuridicoError — mapeo SQLSTATE ───────────────────────────────────

describe('normalizeJuridicoError — mapeo directo desde SQLSTATE_MAP', () => {
  it.each(Object.entries(SQLSTATE_MAP))(
    'SQLSTATE %s → JuridicoServiceError con code %s',
    (pgCode, jurCode) => {
      const raw = { code: pgCode, message: `Error ${pgCode}` };
      const err = normalizeJuridicoError(raw);

      expect(err).toBeInstanceOf(JuridicoServiceError);
      expect(err.code).toBe(jurCode);
      expect(err.pgCode).toBe(pgCode);
      expect(err.message).toBe(`Error ${pgCode}`);
      expect(err.originalError).toBe(raw);
    }
  );
});

// ── normalizeJuridicoError — fallback por mensaje ─────────────────────────────

describe('normalizeJuridicoError — fallback por mensaje', () => {
  it('extrae código JUR del mensaje cuando SQLSTATE no está mapeado', () => {
    const err = normalizeJuridicoError({
      code: 'XX000',
      message: 'Algo salió mal. [JUR-0019]',
    });
    expect(err.code).toBe('JUR-0019');
    expect(err.pgCode).toBe('XX000');
  });

  it('extrae el primer código JUR cuando hay varios en el mensaje', () => {
    const err = normalizeJuridicoError({
      code: 'XX000',
      message: 'Error [JUR-0020] y también [JUR-0011]',
    });
    expect(err.code).toBe('JUR-0020');
  });

  it('devuelve JUR-UNKNOWN cuando SQLSTATE no está mapeado y mensaje no tiene [JUR-XXXX]', () => {
    const err = normalizeJuridicoError({ code: 'XX000', message: 'Error genérico sin código' });
    expect(err.code).toBe('JUR-UNKNOWN');
    expect(err.pgCode).toBe('XX000');
  });

  it('devuelve JUR-UNKNOWN con pgCode undefined cuando el error es un objeto vacío', () => {
    const err = normalizeJuridicoError({});
    expect(err.code).toBe('JUR-UNKNOWN');
    expect(err.pgCode).toBeUndefined();
    expect(err).toBeInstanceOf(JuridicoServiceError);
  });

  it('pgCode es undefined (no string vacío) cuando el raw no tiene code', () => {
    const err = normalizeJuridicoError({ message: 'sin code' });
    expect(err.pgCode).toBeUndefined();
  });

  it('maneja error null', () => {
    const err = normalizeJuridicoError(null);
    expect(err.code).toBe('JUR-UNKNOWN');
    expect(err).toBeInstanceOf(JuridicoServiceError);
  });

  it('maneja error undefined', () => {
    const err = normalizeJuridicoError(undefined);
    expect(err.code).toBe('JUR-UNKNOWN');
    expect(err).toBeInstanceOf(JuridicoServiceError);
  });

  it('preserva originalError en todos los casos', () => {
    const raw = { code: 'XX999', message: 'raro' };
    const err = normalizeJuridicoError(raw);
    expect(err.originalError).toBe(raw);
  });
});
