import type {
  Scenario, Project, Role, Channel,
  ScenarioResults, ChannelBreakdown, RoleBreakdown, MonthlyPL
} from '../types/simulator';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function calculateScenario(
  scenario: Scenario,
  projects: Project[],
  roles: Role[],
  channels: Channel[]
): ScenarioResults {
  const scenarioProjects = projects.filter(p => scenario.projectIds.includes(p.id));
  const avgPrice = scenarioProjects.length > 0
    ? scenarioProjects.reduce((s, p) => s + p.averagePrice, 0) / scenarioProjects.length
    : 0;

  const totalUnits = scenario.monthlyUnits.reduce((a, b) => a + b, 0);
  const totalSalesAmount = totalUnits * avgPrice;
  const totalCommissionPct = scenario.totalCommissionPct / 100;
  const totalCommissionAmount = totalSalesAmount * totalCommissionPct;

  const channelBreakdown: ChannelBreakdown[] = channels.map(ch => {
    const mixPct = (scenario.channelMix[ch.id] || 0) / 100;
    const salesAmount = totalSalesAmount * mixPct;
    const extPct = (scenario.channelExternalPcts[ch.id] ?? ch.externalCommissionPct) / 100;
    const totalChComm = salesAmount * totalCommissionPct;
    const externalComm = salesAmount * extPct;
    const internalComm = totalChComm - externalComm;

    const channelRules = scenario.commissionRules.filter(r => r.channelId === ch.id);
    const rolePayments = channelRules.map(rule => {
      const role = roles.find(r => r.id === rule.roleId);
      let amount: number;
      if (scenario.commissionMode === 'on_sale_value') {
        amount = salesAmount * (rule.percentage / 100);
      } else {
        amount = internalComm * (rule.percentage / 100);
      }
      return {
        roleId: rule.roleId,
        roleName: role?.name || 'Unknown',
        amount,
        pct: rule.percentage
      };
    });

    return {
      channelId: ch.id,
      channelName: ch.name,
      salesPct: mixPct * 100,
      salesAmount,
      totalCommission: totalChComm,
      externalCommission: externalComm,
      internalCommission: internalComm,
      rolePayments
    };
  });

  const totalExternalCommission = channelBreakdown.reduce((s, c) => s + c.externalCommission, 0);
  const totalInternalCommission = channelBreakdown.reduce((s, c) => s + c.internalCommission, 0);

  const roleBreakdownMap = new Map<string, RoleBreakdown>();
  for (const ra of scenario.roleAssignments) {
    const role = roles.find(r => r.id === ra.roleId);
    if (!role) continue;
    const totalFixed = ra.headcount * (ra.baseSalary * (1 + ra.benefitsPct / 100) + ra.fixedBonus);
    const existing = roleBreakdownMap.get(ra.roleId);
    if (existing) {
      existing.headcount += ra.headcount;
      existing.totalFixedCost += totalFixed;
    } else {
      const pool = role.belongsTo === 'sozu_central' ? 'sozu' as const : 'project' as const;
      roleBreakdownMap.set(ra.roleId, {
        roleId: ra.roleId,
        roleName: role.name,
        pool,
        headcount: ra.headcount,
        baseSalary: ra.baseSalary,
        totalFixedCost: totalFixed,
        totalCommissionEarned: 0,
        totalCost: totalFixed,
        payoutRatio: 0,
      });
    }
  }

  for (const cb of channelBreakdown) {
    for (const rp of cb.rolePayments) {
      const rb = roleBreakdownMap.get(rp.roleId);
      if (rb) rb.totalCommissionEarned += rp.amount;
    }
  }

  const roleBreakdown = Array.from(roleBreakdownMap.values()).map(rb => ({
    ...rb,
    totalCost: rb.totalFixedCost * 12 + rb.totalCommissionEarned,
    payoutRatio: rb.totalFixedCost > 0 ? rb.totalCommissionEarned / (rb.totalFixedCost * 12) : 0
  }));

  const monthlyFixedCost = roleBreakdown.reduce((s, r) => s + r.totalFixedCost, 0);
  const sozuRoles = roleBreakdown.filter(r => r.pool === 'sozu');
  const projectRoles = roleBreakdown.filter(r => r.pool === 'project');

  const sozuFixedAnnual = sozuRoles.reduce((s, r) => s + r.totalFixedCost * 12, 0);
  const sozuCommissions = sozuRoles.reduce((s, r) => s + r.totalCommissionEarned, 0);
  const projectCommissions = projectRoles.reduce((s, r) => s + r.totalCommissionEarned, 0);

  const sozuMargin = totalInternalCommission - sozuCommissions - sozuFixedAnnual;
  const projectMargin = totalCommissionAmount - totalExternalCommission - projectCommissions;

  const totalCommercialCost = monthlyFixedCost * 12 + totalExternalCommission + totalInternalCommission;
  const cacCommercial = totalUnits > 0 ? totalCommercialCost / totalUnits : 0;
  const costPerUnit = totalUnits > 0 ? totalCommercialCost / totalUnits : 0;
  const sozuNetProfit = totalInternalCommission - sozuFixedAnnual - sozuCommissions;

  const payoutRatio: Record<string, number> = {};
  roleBreakdown.forEach(r => { payoutRatio[r.roleId] = r.payoutRatio; });

  const monthlyPL: MonthlyPL[] = scenario.monthlyUnits.map((units, i) => {
    const salesAmt = units * avgPrice;
    const totalComm = salesAmt * totalCommissionPct;
    const extComm = channels.reduce((s, ch) => {
      const mix = (scenario.channelMix[ch.id] || 0) / 100;
      const ext = (scenario.channelExternalPcts[ch.id] ?? ch.externalCommissionPct) / 100;
      return s + salesAmt * mix * ext;
    }, 0);
    const intComm = totalComm - extComm;
    return {
      month: i + 1, label: MONTH_LABELS[i], units,
      salesAmount: salesAmt, totalCommission: totalComm,
      externalCommission: extComm, internalCommission: intComm,
      fixedCosts: monthlyFixedCost, variableCosts: extComm + intComm,
      sozuMargin: intComm - monthlyFixedCost, netProfit: intComm - monthlyFixedCost
    };
  });

  return {
    scenarioId: scenario.id,
    totalSalesAmount, totalCommissionAmount,
    totalExternalCommission, totalInternalCommission,
    monthlyFixedCost,
    monthlyVariableCost: (totalExternalCommission + totalInternalCommission) / 12,
    sozuMargin, projectMargin, cacCommercial, costPerUnit, sozuNetProfit,
    payoutRatio, channelBreakdown, roleBreakdown, monthlyPL,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(Math.round(value));
}

export function validateChannelMix(mix: Record<string, number>): { valid: boolean; total: number } {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  return { valid: Math.abs(total - 100) < 0.01, total };
}

export function validateCommissionRules(
  rules: { roleId: string; percentage: number }[],
  mode: 'on_sale_value' | 'on_internal_remainder',
  totalCommPct: number,
  externalPct: number
): { valid: boolean; total: number; expected: number } {
  const total = rules.reduce((a, r) => a + r.percentage, 0);
  if (mode === 'on_sale_value') {
    const expected = totalCommPct - externalPct;
    return { valid: Math.abs(total - expected) < 0.01, total, expected };
  }
  return { valid: Math.abs(total - 100) < 0.01, total, expected: 100 };
}