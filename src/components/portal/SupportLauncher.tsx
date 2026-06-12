import AdvisorCard from "./AdvisorCard";
import { useAdvisorForProperty, type SupportContext } from "@/lib/offers/advisor-data";

interface SupportLauncherProps {
  context: SupportContext;
  variant?: "compact" | "expanded";
}

const SupportLauncher = ({ context, variant = "compact" }: SupportLauncherProps) => {
  const advisor = useAdvisorForProperty(context.propertyId, context.phaseOverride);
  return <AdvisorCard advisor={advisor} context={context} variant={variant} />;
};

export default SupportLauncher;
