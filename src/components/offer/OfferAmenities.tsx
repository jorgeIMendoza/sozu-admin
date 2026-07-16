import { Sparkles, Check } from "lucide-react";
import SectionCard from "./SectionCard";

const OfferAmenities = ({ amenities }: { amenities: string[] }) => (
  <SectionCard icon={Sparkles} title="Amenidades del desarrollo">
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {amenities.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-success flex-shrink-0" />
          <span>{a}</span>
        </li>
      ))}
    </ul>
  </SectionCard>
);

export default OfferAmenities;
