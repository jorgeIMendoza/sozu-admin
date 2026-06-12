import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ClipboardList, AlertTriangle, Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataSourceBadge, MockDataDisclaimer } from "@/components/admin/portal-crm/ui";
import {
  computeLeadIntelligence,
  LEAD_LABEL_TONE,
  type LeadIntelligence,
} from "@/lib/crm-lead-scoring";

type Props = {
  contact: any;
  attribution?: any | null;
  notes?: any[];
  tasks?: any[];
  appointments?: any[];
  deals?: any[];
  conversionEvents?: any[];
};

export function LeadIntelligencePanel(p: Props) {
  const intel: LeadIntelligence = useMemo(
    () => computeLeadIntelligence(p),
    [p.contact, p.attribution, p.notes, p.tasks, p.appointments, p.deals, p.conversionEvents],
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Lead Intelligence
        </CardTitle>
        <DataSourceBadge source="mock" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-semibold">{intel.final_score}<span className="text-xs text-muted-foreground">/100</span></div>
          <Badge variant="outline" className={LEAD_LABEL_TONE[intel.label] ?? ""}>{intel.label}</Badge>
        </div>
        <Progress value={intel.final_score} />

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <ScoreRow label="Fit" v={intel.fit.score} note={intel.fit.label} />
          <ScoreRow label="Engagement" v={intel.engagement.score} note={intel.engagement.label} />
          <ScoreRow label="Recency" v={intel.recency.score} note={intel.recency.label} />
          <ScoreRow label="Attribution" v={intel.attribution.score} note={intel.attribution.label} />
          <ScoreRow label="CRM progress" v={intel.crm_progress.score} note={intel.crm_progress.label} />
        </div>

        <Separator />

        <div className="text-xs">
          <div className="font-medium mb-1 flex items-center gap-1"><Activity className="h-3 w-3" /> Razones</div>
          <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
            {intel.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {intel.risks.length > 0 && (
          <div className="text-xs">
            <div className="font-medium mb-1 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> Riesgos</div>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-700/90">
              {intel.risks.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <div className="rounded-md border bg-muted/20 p-2 text-xs">
          <span className="font-medium">Próxima acción:</span> {intel.recommendation}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/portal-crm/crm/tasks">
              <ClipboardList className="h-3 w-3 mr-1" />Crear tarea
            </Link>
          </Button>
        </div>
        <MockDataDisclaimer />
      </CardContent>
    </Card>
  );
}

function ScoreRow({ label, v, note }: { label: string; v: number; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border rounded px-2 py-1">
      <div>
        <div className="font-medium">{label}</div>
        {note && <div className="text-[10px] text-muted-foreground">{note}</div>}
      </div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}
