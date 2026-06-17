import type {
  BrokerIncentiveConfig,
  BrokerCommissionBreakdown,
  BrokerSimulation,
  OperationInput,
  OperationBreakdown,
  DownPaymentEvaluation,
} from '../types/broker-incentives';

export function evaluateDownPayment(
  config: BrokerIncentiveConfig,
  operationDownPaymentPct: number
): DownPaymentEvaluation {
  if (!config.downPaymentEnabled) {
    return {
      ruleId: null, ruleName: null, ruleCondition: null,
      operationDownPaymentPct, meetsCondition: false, bonusPct: 0,
      reason: 'Bono por enganche desactivado',
    };
  }
  const activeRules = config.downPaymentRules
    .filter(r => r.active)
    .sort((a, b) => b.minPct - a.minPct);
  for (const rule of activeRules) {
    const meets = operationDownPaymentPct >= rule.minPct &&
      (rule.maxPct === null || operationDownPaymentPct <= rule.maxPct);
    if (meets) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleCondition: rule.maxPct ? `${rule.minPct}%–${rule.maxPct}%` : `${rule.minPct}%+`,
        operationDownPaymentPct,
        meetsCondition: true,
        bonusPct: rule.bonusPct,
        reason: `Enganche de ${operationDownPaymentPct}% cumple condición "${rule.name}"`,
      };
    }
  }
  const minRequired = activeRules.length > 0 ? Math.min(...activeRules.map(r => r.minPct)) : 0;
  return {
    ruleId: null, ruleName: null, ruleCondition: null,
    operationDownPaymentPct, meetsCondition: false, bonusPct: 0,
    reason: `Enganche de ${operationDownPaymentPct}% no alcanza mínimo (${minRequired}%)`,
  };
}

export function calculateBrokerBaseCommission(
  config: BrokerIncentiveConfig,
  sim: BrokerSimulation
): Omit<BrokerCommissionBreakdown, 'downPaymentBonus' | 'finalCommission'> & { baseWithVolume: number } {
  let baseCommission = config.baseCommissionPct;
  let volumeBonus = 0;
  let saleAmountBonus = 0;
  const appliedRules: string[] = [];

  if (config.volumeEnabled) {
    const activeRules = config.volumeRules
      .filter(r => r.active && r.period === sim.period)
      .sort((a, b) => b.minUnits - a.minUnits);
    for (const rule of activeRules) {
      if (sim.unitsSold >= rule.minUnits && (rule.maxUnits === null || sim.unitsSold <= rule.maxUnits)) {
        volumeBonus = rule.incrementalPct;
        baseCommission = rule.commissionPct;
        appliedRules.push(rule.name);
        break;
      }
    }
  }

  if (config.saleAmountEnabled) {
    const activeRules = config.saleAmountRules
      .filter(r => r.active)
      .sort((a, b) => b.minAmount - a.minAmount);
    for (const rule of activeRules) {
      if (sim.unitPrice >= rule.minAmount && (rule.maxAmount === null || sim.unitPrice <= rule.maxAmount)) {
        saleAmountBonus = rule.bonusPct;
        appliedRules.push(rule.name);
        break;
      }
    }
  }

  return {
    baseCommission, volumeBonus, saleAmountBonus, appliedRules,
    baseWithVolume: baseCommission + saleAmountBonus,
  };
}

export function calculateOperationBreakdown(
  config: BrokerIncentiveConfig,
  sim: BrokerSimulation,
  operation: OperationInput
): OperationBreakdown {
  const base = calculateBrokerBaseCommission(config, { ...sim, unitPrice: operation.unitPrice });
  const dpEval = evaluateDownPayment(config, operation.downPaymentPct);
  let opSaleAmountBonus = 0;
  const opAppliedRules = [...base.appliedRules];

  if (config.saleAmountEnabled) {
    const activeRules = config.saleAmountRules
      .filter(r => r.active)
      .sort((a, b) => b.minAmount - a.minAmount);
    for (const rule of activeRules) {
      if (operation.unitPrice >= rule.minAmount && (rule.maxAmount === null || operation.unitPrice <= rule.maxAmount)) {
        opSaleAmountBonus = rule.bonusPct;
        if (!opAppliedRules.includes(rule.name)) opAppliedRules.push(rule.name);
        break;
      }
    }
  }

  if (dpEval.meetsCondition && dpEval.ruleName) opAppliedRules.push(dpEval.ruleName);

  const finalCommission = base.baseCommission + opSaleAmountBonus + dpEval.bonusPct;
  const finalAmount = operation.unitPrice * (finalCommission / 100);

  return {
    operationId: operation.id,
    operationLabel: operation.label,
    unitPrice: operation.unitPrice,
    downPaymentPct: operation.downPaymentPct,
    date: operation.date,
    baseCommission: base.baseCommission,
    volumeBonus: base.volumeBonus,
    saleAmountBonus: opSaleAmountBonus,
    downPaymentEvaluation: dpEval,
    downPaymentBonus: dpEval.bonusPct,
    finalCommission, finalAmount,
    appliedRules: opAppliedRules,
  };
}

export function calculateBrokerCommission(
  config: BrokerIncentiveConfig,
  sim: BrokerSimulation
): BrokerCommissionBreakdown {
  const base = calculateBrokerBaseCommission(config, sim);
  const dpEval = evaluateDownPayment(config, sim.downPaymentPct);
  const finalCommission = base.baseCommission + base.saleAmountBonus + dpEval.bonusPct;
  return {
    baseCommission: base.baseCommission,
    volumeBonus: base.volumeBonus,
    saleAmountBonus: base.saleAmountBonus,
    downPaymentBonus: dpEval.bonusPct,
    finalCommission,
    appliedRules: [
      ...base.appliedRules,
      ...(dpEval.meetsCondition && dpEval.ruleName ? [dpEval.ruleName] : []),
    ],
  };
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

export function periodLabel(p: string): string {
  const map: Record<string, string> = {
    monthly: 'Mensual', quarterly: 'Trimestral',
    semiannual: 'Semestral', annual: 'Anual',
  };
  return map[p] || p;
}