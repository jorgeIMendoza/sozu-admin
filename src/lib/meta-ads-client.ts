const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export function isMetaConfigured(): boolean {
  const token = import.meta.env.VITE_META_ACCESS_TOKEN;
  const account = import.meta.env.VITE_META_AD_ACCOUNT_ID;
  return !!(token && account && token.length > 5 && account.length > 3);
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "ended";
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_time: string | null;
  stop_time: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
}

export interface MetaApiError {
  message: string;
  code?: number;
}

async function graphFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const token = import.meta.env.VITE_META_ACCESS_TOKEN;
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_BASE}${path}?${qs}`);
  const json = await res.json();
  if (!res.ok || json.error) {
    const err: MetaApiError = {
      message: json.error?.message ?? `HTTP ${res.status}`,
      code: json.error?.code,
    };
    throw err;
  }
  return json;
}

export async function fetchMetaCampaigns(): Promise<MetaCampaign[]> {
  const accountId = import.meta.env.VITE_META_AD_ACCOUNT_ID;
  const fields = [
    "id", "name", "status", "objective",
    "daily_budget", "lifetime_budget", "start_time", "stop_time",
    "insights.date_preset(last_30d){spend,impressions,clicks,actions,ctr}",
  ].join(",");

  const json = await graphFetch(`/act_${accountId}/campaigns`, {
    fields,
    limit: "100",
  });

  return (json.data ?? []).map((c: any): MetaCampaign => {
    const ins = c.insights?.data?.[0] ?? {};
    const actions: { action_type: string; value: string }[] = ins.actions ?? [];
    const leadsAction = actions.find(a => a.action_type === "lead");

    const rawStatus = (c.status ?? "").toUpperCase();
    const status: MetaCampaign["status"] =
      rawStatus === "ACTIVE" ? "active" :
      rawStatus === "PAUSED" ? "paused" : "ended";

    return {
      id: c.id,
      name: c.name,
      status,
      objective: c.objective ?? "—",
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      start_time: c.start_time ?? null,
      stop_time: c.stop_time ?? null,
      spend: Number(ins.spend ?? 0),
      impressions: Number(ins.impressions ?? 0),
      clicks: Number(ins.clicks ?? 0),
      leads: Number(leadsAction?.value ?? 0),
      ctr: Number(ins.ctr ?? 0),
    };
  });
}

export async function fetchMetaAdAccount(): Promise<{ name: string; currency: string; id: string } | null> {
  const accountId = import.meta.env.VITE_META_AD_ACCOUNT_ID;
  try {
    const json = await graphFetch(`/act_${accountId}`, { fields: "id,name,currency,account_status" });
    return { id: json.id, name: json.name, currency: json.currency };
  } catch {
    return null;
  }
}
