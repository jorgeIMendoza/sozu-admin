import { MapPin, Clock } from "lucide-react";
import type { DevelopmentInfo } from "@/lib/offers/offer-data";
import type { Agent } from "@/lib/offers/agent-data";
import DevelopmentLogo from "./DevelopmentLogo";
import DevelopmentShowroomBlock from "./DevelopmentShowroomBlock";

interface Props {
  development: DevelopmentInfo;
  developmentName: string;
  agent?: Agent;
}

const DevelopmentPresenceSection = ({ development, developmentName, agent }: Props) => {
  const { tagline, showroom } = development;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2">
        {development.logoUrl && (
          <DevelopmentLogo
            development={development}
            developmentName={developmentName}
            variant="section"
          />
        )}
        {tagline && (
          <p className="text-sm text-muted-foreground italic">"{tagline}"</p>
        )}
      </div>

      {/* Showroom */}
      {showroom ? (
        <DevelopmentShowroomBlock
          showroom={showroom}
          developmentName={developmentName}
          agent={agent}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground/40" />
            <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/60">
              Showroom
            </p>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded-lg w-3/4" />
            <div className="h-3 bg-muted/50 rounded-lg w-1/2" />
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <Clock className="w-3 h-3 text-muted-foreground/30" />
            <p className="text-[11px] text-muted-foreground/50">
              Dirección y horarios disponibles próximamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevelopmentPresenceSection;
