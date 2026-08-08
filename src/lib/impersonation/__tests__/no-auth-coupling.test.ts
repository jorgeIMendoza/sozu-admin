import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regresión del 2026-08-08.
 *
 * `useAllowedMenus` resuelve AUTORIZACIÓN de rutas: lo consume `PermissionRoute`.
 * Al hacerlo depender del rol impersonado, un Super Admin en "Vista del usuario"
 * perdía el acceso a la ruta, caía en `/admin/access-denied` —que se pinta fuera
 * del layout del portal— y ahí ya no existe el selector para dejar de
 * impersonar: quedaba encerrado.
 *
 * Invariante: la vista fiel simula lo que el portal PINTA, nunca lo que el
 * usuario tiene DERECHO a abrir. Estos archivos no deben acoplarse a la
 * impersonación.
 */
const ARCHIVOS_DE_AUTORIZACION = [
  'src/hooks/useAllowedMenus.ts',
  'src/components/auth/PermissionRoute.tsx',
];

const ACOPLES_PROHIBIDOS = [
  'ImpersonationTargetContext',
  'ImpersonationViewModeContext',
  'resolveEffectiveRolId',
  'resolveIsSuperAdminView',
  'useViewRestrictions',
];

describe('la autorización de rutas no depende de la impersonación', () => {
  ARCHIVOS_DE_AUTORIZACION.forEach((rel) => {
    it(`${rel} no importa el núcleo de impersonación`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      const encontrados = ACOPLES_PROHIBIDOS.filter((token) => src.includes(token));
      expect(encontrados).toEqual([]);
    });
  });
});
