import { Building2 } from "lucide-react";
import type { DevelopmentInfo } from "@/lib/offers/offer-data";
import DevelopmentLogo from "./DevelopmentLogo";
import SectionCard from "./SectionCard";

interface Props {
  development: DevelopmentInfo;
  developmentName: string;
}

const DevelopmentPresenceSection = ({ development, developmentName }: Props) => {
  const { tagline } = development;

  return (
    <SectionCard icon={Building2} title="Conoce el desarrollo" bodyClassName="p-5 md:p-6">
      {/* Logo + tagline (el showroom vive ahora en la sección Ubicación) */}
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
    </SectionCard>
  );
};

export default DevelopmentPresenceSection;
