import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function InformacionFinanciera() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Información Financiera</h1>
        <p className="text-muted-foreground">Consulta consolidada de información financiera.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Construction className="h-14 w-14 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Página en construcción</h2>
            <p className="text-muted-foreground">
              Esta sección está en desarrollo. Pronto estará disponible.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
