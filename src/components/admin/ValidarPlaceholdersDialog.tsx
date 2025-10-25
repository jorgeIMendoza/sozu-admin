import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertCircle, XCircle, FileText, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ValidacionData {
  placeholders_en_template: string[];
  placeholders_disponibles: Array<{placeholder: string, valor: string, estado: string}>;
  placeholders_faltantes: string[];
  placeholders_vacios: string[];
  total_template: number;
  total_disponibles: number;
  total_faltantes: number;
  total_vacios: number;
  tiene_problemas: boolean;
}

interface ValidarPlaceholdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validacion: ValidacionData | null;
  compradores: any[];
  tipoPersona: string;
  templateName: string;
  onGenerarContrato?: () => void;
  isGenerating?: boolean;
}

export function ValidarPlaceholdersDialog({
  open,
  onOpenChange,
  validacion,
  compradores,
  tipoPersona,
  templateName,
  onGenerarContrato,
  isGenerating = false
}: ValidarPlaceholdersDialogProps) {
  if (!validacion) return null;

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'ok':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> OK</Badge>;
      case 'vacío':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><AlertCircle className="w-3 h-3 mr-1" /> Vacío</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falta</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Validación de Placeholders - {templateName}
          </DialogTitle>
          <DialogDescription>
            Revisión de placeholders antes de generar el contrato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total en Template</div>
              <div className="text-2xl font-bold">{validacion.total_template}</div>
            </Card>
            <Card className="p-4 border-green-500">
              <div className="text-sm text-muted-foreground">Disponibles</div>
              <div className="text-2xl font-bold text-green-500">{validacion.total_disponibles}</div>
            </Card>
            <Card className="p-4 border-yellow-500">
              <div className="text-sm text-muted-foreground">Vacíos</div>
              <div className="text-2xl font-bold text-yellow-500">{validacion.total_vacios}</div>
            </Card>
            <Card className="p-4 border-red-500">
              <div className="text-sm text-muted-foreground">Faltantes</div>
              <div className="text-2xl font-bold text-red-500">{validacion.total_faltantes}</div>
            </Card>
          </div>

          {/* Información de compradores */}
          <Card className="p-4 bg-muted/50">
            <div className="text-sm font-medium mb-2">👥 Compradores ({compradores.length})</div>
            <div className="space-y-1">
              {compradores.map((c, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{c.nombre}</span> - {c.porcentaje_copropiedad}% copropiedad
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Tipo: {tipoPersona === 'pf' ? 'Persona Física' : 'Persona Moral'}
            </div>
          </Card>

          {/* Placeholders Faltantes */}
          {validacion.placeholders_faltantes.length > 0 && (
            <Card className="p-4 border-red-500">
              <div className="text-sm font-medium text-red-500 mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                ⚠️ Placeholders NO GENERADOS (aparecerán en ROJO en el contrato)
              </div>
              <ScrollArea className="h-[100px]">
                <div className="space-y-1">
                  {validacion.placeholders_faltantes.map((ph, i) => (
                    <div key={i} className="text-sm font-mono bg-red-50 dark:bg-red-950 p-2 rounded">
                      {`{{${ph}}}`}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Placeholders Vacíos */}
          {validacion.placeholders_vacios.length > 0 && (
            <Card className="p-4 border-yellow-500">
              <div className="text-sm font-medium text-yellow-500 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Placeholders con datos VACÍOS (aparecerán en AMARILLO en el contrato)
              </div>
              <ScrollArea className="h-[100px]">
                <div className="space-y-1">
                  {validacion.placeholders_vacios.map((ph, i) => (
                    <div key={i} className="text-sm font-mono bg-yellow-50 dark:bg-yellow-950 p-2 rounded">
                      {`{{${ph}}}`}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Tabla completa de placeholders */}
          <div>
            <div className="text-sm font-medium mb-2">📋 Todos los Placeholders Disponibles</div>
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Placeholder</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validacion.placeholders_disponibles.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{estadoBadge(item.estado)}</TableCell>
                      <TableCell className="font-mono text-sm">{`{{${item.placeholder}}}`}</TableCell>
                      <TableCell className="text-sm max-w-md truncate">{item.valor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Advertencia final */}
          {validacion.tiene_problemas && (
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-500">
              <div className="text-sm font-medium mb-2">⚠️ Advertencia</div>
              <div className="text-sm text-muted-foreground">
                Si generas el contrato ahora, los placeholders faltantes aparecerán en ROJO y los vacíos en AMARILLO.
                Puedes continuar de todas formas, pero deberás completar manualmente esos campos en Google Docs.
              </div>
            </Card>
          )}

          {!validacion.tiene_problemas && (
            <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-500">
              <div className="text-sm font-medium mb-2">✅ Todo listo</div>
              <div className="text-sm text-muted-foreground">
                Todos los placeholders están correctamente mapeados. El contrato se generará sin problemas.
              </div>
            </Card>
          )}
        </div>

        {onGenerarContrato && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                onGenerarContrato();
                onOpenChange(false);
              }}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generar Contrato Ahora
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
