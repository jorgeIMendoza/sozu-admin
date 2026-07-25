import { usePortal, type PersonType } from "@/lib/portal-cliente/onboarding-store";
import { Building2, User } from "lucide-react";

export function Step3PersonType() {
  const value = usePortal((s) => s.onboarding.personType);
  const setOnb = usePortal((s) => s.setOnboarding);

  const options: { key: PersonType; label: string; desc: string; Icon: typeof User }[] = [
    {
      key: "fisica",
      label: "Persona Física",
      desc: "Compraste la propiedad a título personal.",
      Icon: User,
    },
    {
      key: "moral",
      label: "Persona Moral",
      desc: "La compró una sociedad. Pediremos acta y poder del RL.",
      Icon: Building2,
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">¿Cómo adquiriste la propiedad?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto define los documentos que te pediremos en el siguiente paso.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setOnb({ personType: o.key })}
            className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
              value === o.key
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            <o.Icon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold text-foreground">{o.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
