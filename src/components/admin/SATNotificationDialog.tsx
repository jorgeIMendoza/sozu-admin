import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw, Upload, FileCheck, AlertCircle, CheckCircle2, XCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SATNotificationService, SATNotificationStatus, CompradorSATStatus } from "@/services/satNotificationService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SATNotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaCobranzaId: number;
  cuentaLabel: string;
  onSuccess?: () => void;
}

export function SATNotificationDialog({
  isOpen,
  onClose,
  cuentaCobranzaId,
  cuentaLabel,
  onSuccess
}: SATNotificationDialogProps) {
  const [status, setStatus] = useState<SATNotificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompradoresOpen, setIsCompradoresOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && cuentaCobranzaId) {
      loadStatus();
    }
  }, [isOpen, cuentaCobranzaId]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const statusData = await SATNotificationService.getStatus(cuentaCobranzaId);
      setStatus(statusData);
      // Auto-expand if there are issues
      if (statusData.compradoresListos < statusData.totalCompradores) {
        setIsCompradoresOpen(true);
      }
    } catch (error) {
      console.error('Error loading SAT status:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el estado de notificación SAT",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await SATNotificationService.generate(cuentaCobranzaId);
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Archivo de notificación SAT generado correctamente"
        });
        await loadStatus();
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al generar el archivo",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al generar el archivo",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await SATNotificationService.regenerate(cuentaCobranzaId);
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Archivo de notificación SAT regenerado correctamente"
        });
        await loadStatus();
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al regenerar el archivo",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al regenerar el archivo",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (status?.archivoSATUrl) {
      window.open(status.archivoSATUrl, '_blank');
    }
  };

  const handleViewAcuse = () => {
    if (status?.acuseSATUrl) {
      window.open(status.acuseSATUrl, '_blank');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await SATNotificationService.uploadAcuse(cuentaCobranzaId, file);
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Acuse de notificación SAT subido correctamente"
        });
        await loadStatus();
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al subir el acuse",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al subir el acuse",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const renderConditionBadge = (label: string, met: boolean) => (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={met ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
        {label}
      </span>
    </div>
  );

  const renderStatusIcon = (met: boolean) => (
    met ? (
      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500 mx-auto" />
    )
  );

  const renderCompradoresTable = (compradoresStatus: CompradorSATStatus[]) => {
    if (compradoresStatus.length === 0) {
      return (
        <div className="text-sm text-muted-foreground text-center py-4">
          No hay compradores registrados
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Comprador</TableHead>
            <TableHead className="text-center w-[60px]">PDF</TableHead>
            <TableHead className="text-center w-[60px]">XML</TableHead>
            <TableHead className="text-center w-[60px]">CSF</TableHead>
            <TableHead className="text-center w-[80px]">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {compradoresStatus.map((comprador) => (
            <TableRow 
              key={comprador.id_persona}
              className={!comprador.cumpleRequisitos ? "bg-red-50 dark:bg-red-950/20" : ""}
            >
              <TableCell className="font-medium text-sm">
                {comprador.nombre_legal.length > 25 
                  ? comprador.nombre_legal.substring(0, 25) + '...' 
                  : comprador.nombre_legal}
              </TableCell>
              <TableCell className="text-center">
                {renderStatusIcon(comprador.tieneFacturaPdf && comprador.facturaPdfVerificada)}
              </TableCell>
              <TableCell className="text-center">
                {renderStatusIcon(comprador.tieneFacturaXml && comprador.facturaXmlVerificada)}
              </TableCell>
              <TableCell className="text-center">
                {renderStatusIcon(comprador.tieneConstancia && comprador.constanciaVerificada)}
              </TableCell>
              <TableCell className="text-center">
                {comprador.cumpleRequisitos ? (
                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    Listo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                    Falta
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold text-sm px-2 py-1">SAT</Badge>
            Notificación al SAT
          </DialogTitle>
          <DialogDescription>
            Cuenta: {cuentaLabel}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : status ? (
          <div className="space-y-4">
            {/* General status */}
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-3">Requisitos Generales:</h4>
              {renderConditionBadge(
                `Propiedad Pagada Completamente (${status.estaPagadaCompletamente ? 
                  `$${status.totalPagado.toLocaleString('es-MX')} / $${status.precioFinal.toLocaleString('es-MX')}` : 
                  `Falta: $${(status.precioFinal - status.totalPagado).toLocaleString('es-MX')}`})`,
                status.estaPagadaCompletamente
              )}
              
              {/* Compradores summary with badge */}
              <div className="flex items-center gap-2 mt-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Compradores con documentos completos:</span>
                <Badge 
                  variant={status.compradoresListos === status.totalCompradores ? "default" : "destructive"}
                  className={status.compradoresListos === status.totalCompradores ? "bg-green-600" : ""}
                >
                  {status.compradoresListos}/{status.totalCompradores}
                </Badge>
              </div>
            </div>

            {/* Collapsible compradores detail */}
            {status.totalCompradores > 0 && (
              <Collapsible open={isCompradoresOpen} onOpenChange={setIsCompradoresOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4" />
                      Detalle por Comprador
                    </span>
                    {isCompradoresOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg overflow-hidden">
                    {renderCompradoresTable(status.compradoresStatus)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF = Factura PDF verificada | XML = Factura XML verificada | CSF = Constancia de Situación Fiscal verificada
                  </p>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Current status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Archivo de Notificación:</span>
                {status.hasArchivoSAT ? (
                  <Badge variant="default" className="bg-green-600">
                    <FileCheck className="h-3 w-3 mr-1" />
                    Generado
                  </Badge>
                ) : (
                  <Badge variant="secondary">No generado</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Acuse de Envío:</span>
                {status.hasAcuseSAT ? (
                  <Badge variant="default" className="bg-green-600">
                    <FileCheck className="h-3 w-3 mr-1" />
                    Subido
                  </Badge>
                ) : (
                  <Badge variant="secondary">No subido</Badge>
                )}
              </div>
            </div>

            {!status.canGenerate && !status.hasArchivoSAT && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No se cumplen los requisitos para generar la notificación. 
                  {!status.estaPagadaCompletamente && " La propiedad debe estar pagada completamente."}
                  {status.compradoresListos < status.totalCompradores && 
                    ` Faltan documentos verificados para ${status.totalCompradores - status.compradoresListos} comprador(es).`}
                </AlertDescription>
              </Alert>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se pudo cargar el estado
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {status && !isLoading && (
            <>
              {/* Case 1: No archivo SAT - Show Generate button */}
              {!status.hasArchivoSAT && status.canGenerate && (
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4 mr-2" />
                  )}
                  Generar Archivo
                </Button>
              )}

              {/* Case 2: Has archivo SAT but no acuse - Show Download, Regenerate, Upload Acuse */}
              {status.hasArchivoSAT && !status.hasAcuseSAT && (
                <>
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                  <Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Regenerar
                  </Button>
                  <Button onClick={handleUploadClick} disabled={isUploading}>
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Subir Acuse
                  </Button>
                </>
              )}

              {/* Case 3: Has both archivo and acuse - Only Download and View Acuse */}
              {status.hasArchivoSAT && status.hasAcuseSAT && (
                <>
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Archivo
                  </Button>
                  <Button variant="outline" onClick={handleViewAcuse}>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Ver Acuse
                  </Button>
                </>
              )}
            </>
          )}
          
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
