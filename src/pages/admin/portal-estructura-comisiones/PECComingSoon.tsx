import { Sparkles } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export default function PECComingSoon({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {description ??
            "Esta vista del Portal de Estructura de Comisiones está en preparación. Próximamente se migrará la funcionalidad completa desde el simulador."}
        </p>
      </div>
    </div>
  );
}