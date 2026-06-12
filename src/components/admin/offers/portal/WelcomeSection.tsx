const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
};

const formatLastAccess = (): string => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h = hours % 12 || 12;
  return `Hoy ${h}:${minutes} ${ampm}`;
};

interface WelcomeSectionProps {
  name: string;
  role?: string;
  activeProperties: number;
}

const WelcomeSection = ({ name, role = "Inversionista", activeProperties }: WelcomeSectionProps) => {
  return (
    <section className="px-5 md:px-0 pt-5 pb-2 animate-fade-in">
      <p className="text-sm text-muted-foreground">{getGreeting()},</p>
      <h2 className="font-display font-bold text-xl text-foreground tracking-tight mt-0.5">
        {name}
      </h2>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-xs text-muted-foreground">{role}</span>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span className="text-xs text-muted-foreground">
          {activeProperties} propiedad{activeProperties !== 1 ? "es" : ""} activa{activeProperties !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/60 mt-1.5">
        Último acceso: {formatLastAccess()}
      </p>
    </section>
  );
};

export default WelcomeSection;
