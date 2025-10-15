import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RevisionDocumentacion() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Revisión de Documentación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Módulo en desarrollo para revisión de documentación notarial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
