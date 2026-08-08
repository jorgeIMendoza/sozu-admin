import { describe, it, expect } from 'vitest';
import {
  createViewRuleRegistry,
  evaluateViewRules,
  isPathHidden,
  readOnlyNote,
  ruleMatchesScope,
} from '../rules';
import { agenteDependienteRule, type AgenteDependienteFacts } from '../rules/agente-dependiente';
import type { ViewRule, ViewRuleContext } from '../types';

const ctx = (over: Partial<ViewRuleContext<any>> = {}): ViewRuleContext<any> => ({
  pathname: '/admin/agent/inicio',
  viewMode: 'fiel',
  isImpersonating: true,
  fullAccess: false,
  target: { email: 'a@b.c', personaId: 1, nombre: 'A', rolId: 3 },
  facts: undefined,
  ...over,
});

const DEPENDIENTE: AgenteDependienteFacts = { hasInmobiliaria: true, inmobiliariaNombre: 'KRE' };
const INDEPENDIENTE: AgenteDependienteFacts = { hasInmobiliaria: false };

describe('registro de reglas', () => {
  it('empieza vacío y no impone recortes', () => {
    const registry = createViewRuleRegistry();
    expect(registry.list()).toHaveLength(0);
    expect(evaluateViewRules(registry.list(), ctx())).toEqual({ hiddenPaths: [], readOnly: {} });
  });

  it('registrar dos veces el mismo id reemplaza, no duplica', () => {
    const registry = createViewRuleRegistry();
    const v1: ViewRule = { id: 'x', evaluate: () => ({ hiddenPaths: ['/a'] }) };
    const v2: ViewRule = { id: 'x', evaluate: () => ({ hiddenPaths: ['/b'] }) };
    registry.register(v1);
    registry.register(v2);
    expect(registry.list()).toHaveLength(1);
    expect(evaluateViewRules(registry.list(), ctx()).hiddenPaths).toEqual(['/b']);
  });

  it('el scope acota por portal', () => {
    const rule: ViewRule = { id: 'agente', scope: '/admin/agent', evaluate: () => ({ hiddenPaths: ['/x'] }) };
    expect(ruleMatchesScope(rule, '/admin/agent/perfil')).toBe(true);
    expect(ruleMatchesScope(rule, '/admin/portal-cliente/inicio')).toBe(false);
    expect(ruleMatchesScope({ id: 'global', evaluate: () => null }, '/lo/que/sea')).toBe(true);
  });

  it('una regla fuera de scope no aporta recortes', () => {
    const rules = [{ id: 'a', scope: '/admin/agent', evaluate: () => ({ hiddenPaths: ['/x'] }) } as ViewRule];
    expect(evaluateViewRules(rules, ctx({ pathname: '/admin/portal-cliente/inicio' })).hiddenPaths).toEqual([]);
  });

  it('funde varias reglas sin duplicar rutas y sin pisar notas ya puestas', () => {
    const rules: ViewRule[] = [
      { id: 'a', evaluate: () => ({ hiddenPaths: ['/x'], readOnly: { csf: 'primera' } }) },
      { id: 'b', evaluate: () => ({ hiddenPaths: ['/x', '/y'], readOnly: { csf: 'segunda', banco: 'otra' } }) },
      { id: 'c', evaluate: () => null },
    ];
    const res = evaluateViewRules(rules, ctx());
    expect(res.hiddenPaths).toEqual(['/x', '/y']);
    expect(res.readOnly).toEqual({ csf: 'primera', banco: 'otra' });
  });

  it('helpers de consulta', () => {
    const res = evaluateViewRules(
      [{ id: 'a', evaluate: () => ({ hiddenPaths: ['/x'], readOnly: { csf: 'nota' } }) } as ViewRule],
      ctx()
    );
    expect(isPathHidden(res, '/x')).toBe(true);
    expect(isPathHidden(res, '/z')).toBe(false);
    expect(readOnlyNote(res, 'csf')).toBe('nota');
    expect(readOnlyNote(res, 'inexistente')).toBeNull();
  });
});

describe('regla agente dependiente (equivale a lo que hace el portal hoy)', () => {
  const run = (facts: AgenteDependienteFacts, fullAccess = false) =>
    evaluateViewRules([agenteDependienteRule], ctx({ fullAccess }), { [agenteDependienteRule.id]: facts });

  it('al dependiente le oculta Comisiones y marca fiscal/banco/CSF en solo lectura', () => {
    const res = run(DEPENDIENTE);
    expect(isPathHidden(res, '/admin/agent/comisiones')).toBe(true);
    expect(readOnlyNote(res, 'csf')).toBe('La sube KRE');
    expect(readOnlyNote(res, 'fiscal')).toBe('La administra KRE');
    expect(readOnlyNote(res, 'banco')).toBe('La administra KRE');
    expect(readOnlyNote(res, 'carta')).toBe('Solo aplica al agente independiente');
  });

  it('sin nombre de inmobiliaria usa el texto genérico', () => {
    const res = run({ hasInmobiliaria: true });
    expect(readOnlyNote(res, 'csf')).toBe('La sube tu inmobiliaria');
    expect(readOnlyNote(res, 'fiscal')).toBe('La administra tu inmobiliaria');
  });

  it('al independiente no le recorta nada', () => {
    expect(run(INDEPENDIENTE)).toEqual({ hiddenPaths: [], readOnly: {} });
  });

  it('con acceso completo (vista completa de soporte) no recorta, aunque sea dependiente', () => {
    expect(run(DEPENDIENTE, true)).toEqual({ hiddenPaths: [], readOnly: {} });
  });

  it('sin facts todavía cargados no recorta (evita el parpadeo de tabs)', () => {
    expect(evaluateViewRules([agenteDependienteRule], ctx())).toEqual({ hiddenPaths: [], readOnly: {} });
  });

  it('no aplica fuera del portal agente', () => {
    const res = evaluateViewRules([agenteDependienteRule], ctx({ pathname: '/admin/portal-cliente/inicio' }), {
      [agenteDependienteRule.id]: DEPENDIENTE,
    });
    expect(res.hiddenPaths).toEqual([]);
  });
});
