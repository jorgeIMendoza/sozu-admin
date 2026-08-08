import { describe, it, expect } from 'vitest';
import {
  isFielViewActive,
  resolveEffectivePersonaId,
  resolveEffectiveRolId,
  resolveFullAccess,
  resolveIsSuperAdminView,
  usesTargetRole,
} from '../effective-identity';
import type { EffectiveIdentityInput, ImpersonationTarget } from '../types';

/**
 * Estos tests fijan el comportamiento ACTUAL del portal antes de migrar lo
 * legacy. Si un cambio los rompe, es que la migración alteró lo que ve alguien.
 */

const SUPER_ADMIN: Pick<EffectiveIdentityInput, 'profileRolId' | 'profileRolNombre' | 'puedeImpersonar'> = {
  profileRolId: 1,
  profileRolNombre: 'Super Administrador',
  puedeImpersonar: true,
};

const ADMIN_SOPORTE: Pick<EffectiveIdentityInput, 'profileRolId' | 'profileRolNombre' | 'puedeImpersonar'> = {
  profileRolId: 30,
  profileRolNombre: 'Admin Soporte',
  puedeImpersonar: true,
};

const AGENTE: Pick<EffectiveIdentityInput, 'profileRolId' | 'profileRolNombre' | 'puedeImpersonar'> = {
  profileRolId: 3,
  profileRolNombre: 'Agente Inmobiliario',
  puedeImpersonar: false,
};

const TARGET_AGENTE: ImpersonationTarget = {
  email: 'ana_rojas@krinmobiliaria.com',
  personaId: 1845,
  nombre: 'Ana María Rojas Félix',
  rolId: 3,
  rolNombre: 'Agente Inmobiliario',
};

/** Portal aún no migrado: publica el impersonado pero no su rol. */
const TARGET_LEGACY: ImpersonationTarget = {
  email: 'cliente@ejemplo.com',
  personaId: 999,
  nombre: 'Cliente Ejemplo',
  rolId: null,
};

const input = (over: Partial<EffectiveIdentityInput> = {}): EffectiveIdentityInput => ({
  ...SUPER_ADMIN,
  profilePersonaId: 10,
  target: null,
  viewMode: 'completa',
  ...over,
});

describe('vista fiel activa', () => {
  it('no está activa sin impersonación, aunque el modo quede en fiel', () => {
    expect(isFielViewActive(null, 'fiel')).toBe(false);
  });

  it('no está activa impersonando en vista completa', () => {
    expect(isFielViewActive(TARGET_AGENTE, 'completa')).toBe(false);
  });

  it('está activa impersonando en vista fiel', () => {
    expect(isFielViewActive(TARGET_AGENTE, 'fiel')).toBe(true);
  });

  it('no usa el rol del impersonado si el portal no lo publica (legacy)', () => {
    expect(isFielViewActive(TARGET_LEGACY, 'fiel')).toBe(true);
    expect(usesTargetRole(TARGET_LEGACY, 'fiel')).toBe(false);
  });
});

describe('rol efectivo', () => {
  it('sin impersonación usa el rol del perfil (comportamiento de hoy)', () => {
    expect(resolveEffectiveRolId(input())).toBe(1);
    expect(resolveEffectiveRolId(input({ ...AGENTE }))).toBe(3);
  });

  it('impersonando en vista completa sigue usando el rol del perfil', () => {
    expect(resolveEffectiveRolId(input({ target: TARGET_AGENTE, viewMode: 'completa' }))).toBe(1);
  });

  it('impersonando en vista fiel usa el rol del impersonado', () => {
    expect(resolveEffectiveRolId(input({ target: TARGET_AGENTE, viewMode: 'fiel' }))).toBe(3);
  });

  it('cae al rol del perfil si el portal legacy no publica rol', () => {
    expect(resolveEffectiveRolId(input({ target: TARGET_LEGACY, viewMode: 'fiel' }))).toBe(1);
  });

  it('devuelve null si no hay perfil ni target', () => {
    expect(resolveEffectiveRolId(input({ profileRolId: null }))).toBeNull();
  });
});

describe('persona efectiva', () => {
  it('sin impersonación es la del perfil', () => {
    expect(resolveEffectivePersonaId(input())).toBe(10);
  });

  it('impersonando es la del impersonado en AMBOS modos', () => {
    expect(resolveEffectivePersonaId(input({ target: TARGET_AGENTE, viewMode: 'completa' }))).toBe(1845);
    expect(resolveEffectivePersonaId(input({ target: TARGET_AGENTE, viewMode: 'fiel' }))).toBe(1845);
  });
});

describe('acceso completo', () => {
  it('Super Admin y puede_impersonar lo tienen sin impersonar', () => {
    expect(resolveFullAccess(input())).toBe(true);
    expect(resolveFullAccess(input({ ...ADMIN_SOPORTE }))).toBe(true);
  });

  it('un agente normal no lo tiene', () => {
    expect(resolveFullAccess(input({ ...AGENTE }))).toBe(false);
  });

  it('se conserva impersonando en vista completa (modo soporte)', () => {
    expect(resolveFullAccess(input({ target: TARGET_AGENTE, viewMode: 'completa' }))).toBe(true);
    expect(resolveFullAccess(input({ ...ADMIN_SOPORTE, target: TARGET_AGENTE, viewMode: 'completa' }))).toBe(true);
  });

  it('se apaga en vista fiel, incluso para Super Admin', () => {
    expect(resolveFullAccess(input({ target: TARGET_AGENTE, viewMode: 'fiel' }))).toBe(false);
  });

  it('se apaga en vista fiel aunque el portal sea legacy sin rol', () => {
    expect(resolveFullAccess(input({ target: TARGET_LEGACY, viewMode: 'fiel' }))).toBe(false);
  });
});

describe('atajo de Super Admin al resolver permisos', () => {
  it('sin impersonación depende del perfil', () => {
    expect(resolveIsSuperAdminView(input())).toBe(true);
    expect(resolveIsSuperAdminView(input({ ...AGENTE }))).toBe(false);
  });

  it('en vista fiel depende del impersonado, no del admin', () => {
    expect(resolveIsSuperAdminView(input({ target: TARGET_AGENTE, viewMode: 'fiel' }))).toBe(false);
  });

  it('en vista fiel sobre otro Super Admin, el atajo se mantiene', () => {
    const target: ImpersonationTarget = { ...TARGET_AGENTE, rolId: 1, rolNombre: 'Super Administrador' };
    expect(resolveIsSuperAdminView(input({ target, viewMode: 'fiel' }))).toBe(true);
  });

  it('resuelve por nombre de rol cuando el portal solo publica el nombre', () => {
    const target: ImpersonationTarget = { ...TARGET_AGENTE, rolId: null, rolNombre: 'Super Administrador' };
    expect(resolveIsSuperAdminView(input({ target, viewMode: 'fiel' }))).toBe(true);
  });

  it('portal legacy sin rol: conserva el comportamiento del admin', () => {
    expect(resolveIsSuperAdminView(input({ target: TARGET_LEGACY, viewMode: 'fiel' }))).toBe(true);
  });
});
