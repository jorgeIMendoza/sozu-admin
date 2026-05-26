import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/portal-administracion/ui";

export default function PortalAdministracionCFDIsEmitidosPage() {
  return (
    <>
      <PageHeader
        title="CFDIs Emitidos"
        description="Bitácora de CFDIs timbrados por SOZU al desarrollador"
        action={<Badge variant="outline">Próximamente</Badge>}
      />
      <Card className="rounded-xl border-dashed">
        <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Esta sección se construirá en Fase 4 del Portal de Administración.
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Por ahora consulta el Admin Panel para datos históricos.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
