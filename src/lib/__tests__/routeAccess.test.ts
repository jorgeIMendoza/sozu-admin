import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PORTAL_GATES,
  decidePortalAccess,
  findPortalGate,
  isRolDeBanco,
  tieneAccesoBajo,
  type PortalAccessContext,
} from '../routeAccess';

const ctx = (over: Partial<PortalAccessContext> = {}): PortalAccessContext => ({
  rolId: 30,
  rolNombre: 'Admin Soporte',
  allowedPaths: new Set<string>(),
  isSuperAdmin: false,
  hasEmbajadorRole: false,
  ...over,
});

describe('decidePortalAccess — el permiso en BD siempre alcanza', () => {
  // Regresión del ticket de Keity (Admin Soporte, rol 30): submenu 164
  // '/admin/portal-embajador/inicio' tenía permiso de lectura para el rol 30, el
  // sidebar lo mostraba, y el gate hardcodeado a rol_id 1/2/23 devolvía 403.
  it('deja entrar a portal-embajador a un rol no listado que tiene permiso en BD', () => {
    const decision = decidePortalAccess(
      '/admin/portal-embajador/inicio',
      ctx({ allowedPaths: new Set(['/admin/portal-embajador/inicio']) }),
    );
    expect(decision).toBe('allow');
  });

  // Invariante que hace de red: si el rol tiene permiso de lectura bajo el
  // prefijo de CUALQUIER portal de la tabla, la ruta abre. Un gate nuevo que
  // olvide consultar la BD rompe este test.
  it.each(PORTAL_GATES.map((g) => g.prefix))(
    'permiso en BD bajo %s autoriza el portal para un rol sin bypass',
    (prefix) => {
      const decision = decidePortalAccess(
        `${prefix}/una-subruta-sin-submenu/42`,
        ctx({ rolId: 999, rolNombre: 'Rol Inventado', allowedPaths: new Set([`${prefix}/inicio`]) }),
      );
      expect(decision).toBe('allow');
    },
  );

  it.each(PORTAL_GATES.map((g) => g.prefix))(
    'niega %s a un rol sin permiso ni bypass',
    (prefix) => {
      const decision = decidePortalAccess(
        `${prefix}/inicio`,
        ctx({ rolId: 999, rolNombre: 'Rol Inventado' }),
      );
      expect(decision).toBe('deny');
    },
  );
});

describe('decidePortalAccess — bypass por rol', () => {
  it('Super Admin entra aunque su allowedPaths sea el wildcard', () => {
    const decision = decidePortalAccess(
      '/admin/portal-cobranza/expediente/7',
      ctx({ rolId: 1, rolNombre: 'Super Administrador', isSuperAdmin: true, allowedPaths: new Set(['*']) }),
    );
    expect(decision).toBe('allow');
  });

  it('el rol Cliente (23) entra a portal-embajador sin fila en user_roles', () => {
    expect(
      decidePortalAccess('/admin/portal-embajador/inicio', ctx({ rolId: 23, rolNombre: 'Cliente' })),
    ).toBe('allow');
  });

  it('un rol dual por user_roles entra a portal-embajador', () => {
    expect(
      decidePortalAccess(
        '/admin/portal-embajador/comisiones',
        ctx({ rolId: 3, rolNombre: 'Agente Inmobiliario', hasEmbajadorRole: true }),
      ),
    ).toBe('allow');
  });

  it('espera (pending) mientras user_roles no resuelve y no hay otra señal', () => {
    expect(
      decidePortalAccess(
        '/admin/portal-embajador/inicio',
        ctx({ rolId: 3, rolNombre: 'Agente Inmobiliario', hasEmbajadorRole: null }),
      ),
    ).toBe('pending');
  });

  it('no espera si el permiso en BD ya alcanza', () => {
    expect(
      decidePortalAccess(
        '/admin/portal-embajador/inicio',
        ctx({ hasEmbajadorRole: null, allowedPaths: new Set(['/admin/portal-embajador/inicio']) }),
      ),
    ).toBe('allow');
  });

  it('el rol Banco entra a portal-bancos sin permisos asignados', () => {
    expect(
      decidePortalAccess('/admin/portal-bancos/dashboard', ctx({ rolId: 28, rolNombre: 'Banco' })),
    ).toBe('allow');
  });
});

describe('decidePortalAccess — rutas de administración del portal', () => {
  it('exige permiso EXACTO: el coarse del portal no abre /portal-bancos/equipo', () => {
    expect(
      decidePortalAccess(
        '/admin/portal-bancos/equipo',
        ctx({ rolId: 32, rolNombre: 'Supervisor Banco', allowedPaths: new Set(['/admin/portal-bancos/dashboard']) }),
      ),
    ).toBe('deny');
  });

  it('abre /portal-bancos/equipo con el permiso exacto', () => {
    expect(
      decidePortalAccess(
        '/admin/portal-bancos/equipo',
        ctx({ rolId: 32, rolNombre: 'Supervisor Banco', allowedPaths: new Set(['/admin/portal-bancos/equipo']) }),
      ),
    ).toBe('allow');
  });

  it('el bypass por nombre de rol NO abre las rutas de administración', () => {
    expect(
      decidePortalAccess('/admin/portal-bancos/bancos', ctx({ rolId: 28, rolNombre: 'Banco' })),
    ).toBe('deny');
  });
});

describe('findPortalGate', () => {
  it('devuelve null para rutas fuera de la tabla', () => {
    expect(findPortalGate('/admin/cuentas-cobranza/12/detalle')).toBeNull();
    expect(decidePortalAccess('/admin/usuarios', ctx())).toBeNull();
  });

  it('no confunde portal-socio-bancario con portal-bancos', () => {
    expect(findPortalGate('/admin/portal-socio-bancario/dashboard')?.prefix).toBe(
      '/admin/portal-socio-bancario',
    );
    expect(findPortalGate('/admin/portal-bancos/dashboard')?.prefix).toBe('/admin/portal-bancos');
  });

  it('gana el prefijo más largo cuando dos gates cubren la ruta', () => {
    const gate = findPortalGate('/admin/portal-bancos/equipo');
    expect(gate?.prefix).toBe('/admin/portal-bancos');
  });
});

describe('tieneAccesoBajo', () => {
  it('itera el Set y compara por prefijo', () => {
    const paths = new Set(['/admin/portal-crm/leads', '/admin/usuarios']);
    expect(tieneAccesoBajo(paths, '/admin/portal-crm')).toBe(true);
    expect(tieneAccesoBajo(paths, '/admin/portal-cobranza')).toBe(false);
  });

  it('el wildcard de Super Admin no hace match por prefijo (de ahí el flag aparte)', () => {
    expect(tieneAccesoBajo(new Set(['*']), '/admin/portal-crm')).toBe(false);
  });
});

describe('isRolDeBanco', () => {
  it('tolera singular/plural y mayúsculas', () => {
    expect(isRolDeBanco('Banco')).toBe(true);
    expect(isRolDeBanco('Operador Bancos')).toBe(true);
    expect(isRolDeBanco('supervisor banco')).toBe(true);
    expect(isRolDeBanco('Admin Soporte')).toBe(false);
    expect(isRolDeBanco(null)).toBe(false);
  });
});

// Guardia estructural: el bug original nació de copiar un `if` por portal dentro
// de PermissionRoute y olvidar el bucle sobre allowedPaths. La autorización de
// portales debe quedarse en la tabla; PermissionRoute solo la consulta.
describe('PermissionRoute no re-introduce gates por portal', () => {
  it('no contiene startsWith de prefijos de portal fuera de los bypass abiertos', () => {
    const fuente = readFileSync(
      resolve(__dirname, '../../components/auth/PermissionRoute.tsx'),
      'utf8',
    );
    // Solo código: los comentarios del archivo citan prefijos a propósito.
    const codigo = fuente
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('//'))
      .join('\n');
    const prefijosHardcodeados = [
      ...codigo.matchAll(/startsWith\('(\/admin\/[^']+)'\)/g),
    ].map((m) => m[1]);
    // /admin/agent/ y /admin/portal-cliente son passthrough deliberados para
    // cualquier rol autenticado, no gates de permisos.
    const permitidos = new Set(['/admin/agent/', '/admin/portal-cliente']);
    expect(prefijosHardcodeados.filter((p) => !permitidos.has(p))).toEqual([]);
  });
});
