import { TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataSourceBadge } from "@/components/admin/portal-crm/ui";
import { enrichDeal, fmtMoney, RISK_TONE } from "@/lib/crm-forecasting";

type Props = {
  deals: any[];
  attribution?: any;
  onCreateTask?: () => void;
};

export function RevenueIntelligencePanel({ deals, attribution, onCreateTask }: Props) {
  const open = (deals ?? []).filter((d: any) => !["won", "lost"].includes(d.deal_stage));
  const active = open.sort((a: any, b: any) => Number(b.value ?? 0) - Number(a.value ?? 0))[0];

  if (!active) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Revenue Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DataSourceBadge source="mock" />
          <p className="text-xs text-muted-foreground">Sin deal activo.</p>
          {onCreateTask && (
            <Button size="sm" variant="outline" className="w-full" onClick={onCreateTask}>
              <Plus className="h-3 w-3 mr-1" /> Crear tarea de prospección
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const e = enrichDeal(active);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Revenue Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <DataSourceBadge source="mock" />
          <Badge variant="outline" className={`text-[10px] ${RISK_TONE[e.risk_level]}`}>{e.risk_level}</Badge>
        </div>
        <Row k="Valor deal activo" v={fmtMoney(e.value_safe)} />
        <Row k="Valor ponderado" v={fmtMoney(e.weighted)} />
        <Row k="Probabilidad etapa" v={`${Math.round(e.probability * 100)}%`} />
        <Row k="Días en etapa" v={`${e.days_in_stage}d`} />
        <Row k="Edad del deal" v={`${e.deal_age_days}d`} />
        <Row k="Forecast base" v={fmtMoney(e.base)} />
        <Row k="Forecast agresivo" v={fmtMoney(e.aggressive)} />
        <div className="pt-1 border-t mt-2">
          <div className="text-muted-foreground">Siguiente acción</div>
          <div className="font-medium">{e.recommended_action}</div>
        </div>
        {e.risk_level !== "low" && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10">
            <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-600 shrink-0" />
            <span>{e.risk_reason}</span>
          </div>
        )}
        {(attribution?.last_touch_source || active.source_campaign_id) && (
          <div className="pt-1 border-t">
            <div className="text-muted-foreground">Atribución</div>
            <div>{attribution?.last_touch_source ?? active.source_platform ?? "—"} · {attribution?.last_touch_campaign ?? active.source_campaign_id ?? "—"}</div>
          </div>
        )}
        {onCreateTask && (
          <div className="flex flex-wrap gap-1 pt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCreateTask}>
              <Plus className="h-3 w-3 mr-1" />Tarea
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
