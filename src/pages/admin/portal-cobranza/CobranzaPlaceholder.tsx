import { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

interface CobranzaPlaceholderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export default function CobranzaPlaceholder({ title, description, icon: Icon = Construction }: CobranzaPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground max-w-md">
        {description || "Este módulo está en desarrollo. Pronto estará disponible con toda su funcionalidad."}
      </p>
    </div>
  );
}
