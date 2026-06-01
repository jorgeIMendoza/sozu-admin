import { Sparkles, Check } from "lucide-react";

const OfferAmenities = ({ amenities }: { amenities: string[] }) => (
  <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
    <div className="flex items-center gap-2 mb-4">
      <Sparkles className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Amenidades del desarrollo</h2>
    </div>
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {amenities.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-primary flex-shrink-0" />
          <span>{a}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default OfferAmenities;
