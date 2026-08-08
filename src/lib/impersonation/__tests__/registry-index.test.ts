import { describe, it, expect } from 'vitest';
import '../rules/index';
import { viewRuleRegistry, evaluateViewRules } from '../rules';
import { AGENTE_DEPENDIENTE_RULE_ID, type AgenteDependienteFacts } from '../rules/agente-dependiente';
import type { ViewRuleContext } from '../types';

/**
 * Red de seguridad del punto de extensión: si alguien agrega una regla y olvida
 * importarla en `rules/index.ts`, el portal deja de recortar en silencio. Aquí
 * se verifica que el registro global quede cargado al importar el index.
 */
describe('registro global de reglas', () => {
  it('carga la regla del agente dependiente', () => {
    expect(viewRuleRegistry.list().map((r) => r.id)).toContain(AGENTE_DEPENDIENTE_RULE_ID);
  });

  it('el registro global aplica el recorte de punta a punta', () => {
    const ctx: ViewRuleContext<AgenteDependienteFacts> = {
      pathname: '/admin/agent/inicio',
      viewMode: 'fiel',
      isImpersonating: true,
      fullAccess: false,
      target: { email: 'a@b.c', personaId: 1, nombre: 'A', rolId: 3 },
      facts: undefined as never,
    };
    const res = evaluateViewRules(viewRuleRegistry.list(), ctx, {
      [AGENTE_DEPENDIENTE_RULE_ID]: { hasInmobiliaria: true, inmobiliariaNombre: 'KRE' },
    });
    expect(res.hiddenPaths).toContain('/admin/agent/comisiones');
    expect(res.readOnly.fiscal).toBe('La administra KRE');
  });
});
