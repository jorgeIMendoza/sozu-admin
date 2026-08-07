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
import { Loader2, Download, RefreshCw, Upload, FileCheck, AlertCircle, CheckCircle2, XCircle, Users, ShieldCheck, ShieldAlert, Ban, Search, MinusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SATNotificationService, SATNotificationStatus, CompradorSATStatus } from "@/services/satNotificationService";
import { AntilavadoService, AntilavadoStatus, CompradorAntilavadoStatus } from "@/services/antilavadoService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { supabase } from "@/integrations/supabase/client";

interface SATNotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaCobranzaId: number;
  cuentaLabel: string;
  onSuccess?: () => void;
}

/** Estado de la verificación antilavado de un comprador (una fila de la tabla). */
type AmlEstado = 'sin_rfc' | 'no_consultado' | 'consultando' | 'limpio' | 'en_lista' | 'error';

interface AmlRowState {
  estado: AmlEstado;
  fecha?: string | null;
  url?: string | null;
  vigente?: boolean;
  mensaje?: string | null;
}

/** dd mmm aaaa — mismo formato de fecha que el expediente de documentos. */
const formatFechaAml = (fecha?: string | null) =>
  fecha
    ? new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

/**
 * Deriva el estado de cada fila a partir del estado en BD, conservando los
 * resultados en vivo que la BD no puede representar (hallazgo en lista 69-B y
 * errores de consulta cuando aún no hay comprobante).
 */
const construirAmlRows = (
  data: AntilavadoStatus,
  previo: Record<number, AmlRowState>
): Record<number, AmlRowState> => {
  const next: Record<number, AmlRowState> = {};
  for (const comprador of data.compradores) {
    const anterior = previo[comprador.id_persona];
    if (anterior?.estado === 'en_lista') {
      next[comprador.id_persona] = anterior;
      continue;
    }
    if (anterior?.estado === 'error' && !comprador.tieneVerificacion) {
      next[comprador.id_persona] = anterior;
      continue;
    }
    if (!comprador.rfc) {
      next[comprador.id_persona] = { estado: 'sin_rfc' };
      continue;
    }
    if (comprador.tieneVerificacion) {
      next[comprador.id_persona] = {
        estado: 'limpio',
        fecha: comprador.fechaVerificacion,
        url: comprador.urlVerificacion,
        vigente: comprador.vigente,
      };
      continue;
    }
    next[comprador.id_persona] = { estado: 'no_consultado' };
  }
  return next;
};

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
  const [validationErrors, setValidationErrors] = useState<Array<{ campo: string; correcto: boolean; valor: string }> | null>(null);
  // Verificación antilavado (Art. 69-B) — informativa, no bloquea el flujo SAT.
  const [antilavado, setAntilavado] = useState<AntilavadoStatus | null>(null);
  const [amlRows, setAmlRows] = useState<Record<number, AmlRowState>>({});
  const [isAmlRunning, setIsAmlRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && cuentaCobranzaId) {
      // Estado antilavado limpio por cuenta (no arrastrar resultados de otra).
      setAntilavado(null);
      setAmlRows({});
      loadStatus();
      loadAntilavado();
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

  /**
   * Carga el estado antilavado. NO dispara ninguna consulta externa: solo lee
   * los comprobantes ya adjuntados en el expediente.
   */
  const loadAntilavado = async () => {
    try {
      const data = await AntilavadoService.getStatus(cuentaCobranzaId);
      setAntilavado(data);
      setAmlRows(prev => construirAmlRows(data, prev));
    } catch (error) {
      console.error('Error loading antilavado status:', error);
    }
  };

  /**
   * Consulta antilavado de UN comprador. Devuelve el resultado para que el
   * recorrido secuencial pueda armar el resumen.
   */
  const consultarComprador = async (
    comprador: CompradorAntilavadoStatus,
    force: boolean
  ): Promise<'limpio' | 'en_lista' | 'error' | 'sin_rfc'> => {
    if (!comprador.rfc) {
      setAmlRows(prev => ({ ...prev, [comprador.id_persona]: { estado: 'sin_rfc' } }));
      return 'sin_rfc';
    }

    setAmlRows(prev => ({
      ...prev,
      [comprador.id_persona]: { ...prev[comprador.id_persona], estado: 'consultando' }
    }));

    const result = await AntilavadoService.consultar({
      rfc: comprador.rfc,
      id_cuenta_cobranza: cuentaCobranzaId,
      id_persona: comprador.id_persona,
      id_propiedad: antilavado?.idPropiedad ?? undefined,
      force,
    });

    if (!result.success) {
      setAmlRows(prev => ({
        ...prev,
        [comprador.id_persona]: { estado: 'error', mensaje: result.error || 'Error en la consulta' }
      }));
      return 'error';
    }

    const fecha = result.comprobante?.fecha_consulta || new Date().toISOString();
    const url = result.documento?.url || result.comprobante?.url_verificacion || null;

    if (result.encontrado_en_sat) {
      setAmlRows(prev => ({
        ...prev,
        [comprador.id_persona]: { estado: 'en_lista', fecha, url, vigente: true }
      }));
      return 'en_lista';
    }

    setAmlRows(prev => ({
      ...prev,
      [comprador.id_persona]: { estado: 'limpio', fecha, url, vigente: true }
    }));
    return 'limpio';
  };

  /** Consulta de una sola fila (botón "Consultar" / "Reconsultar"). */
  const handleConsultarFila = async (comprador: CompradorAntilavadoStatus, force: boolean) => {
    const resultado = await consultarComprador(comprador, force);
    if (resultado === 'en_lista') {
      toast({
        title: "Comprador en lista 69-B",
        description: `${comprador.nombre_legal} aparece en la lista del Art. 69-B del CFF.`,
        variant: "destructive"
      });
    } else if (resultado === 'error') {
      toast({
        title: "Error en la verificación antilavado",
        description: `No se pudo consultar a ${comprador.nombre_legal}.`,
        variant: "destructive"
      });
    }
    await loadAntilavado();
    onSuccess?.();
  };

  /**
   * Recorre a TODOS los compradores uno por uno con await en serie
   * (nunca Promise.all). Un error en un comprador no aborta a los demás.
   */
  const handleConsultarAntilavado = async () => {
    if (!antilavado?.compradores.length) return;

    // Abrir el detalle para que se vea el avance fila por fila.
    setIsCompradoresOpen(true);
    setIsAmlRunning(true);
    let verificados = 0;
    let enLista = 0;
    let errores = 0;
    let sinRfc = 0;

    try {
      for (const comprador of antilavado.compradores) {
        try {
          const resultado = await consultarComprador(comprador, false);
          if (resultado === 'limpio') verificados++;
          else if (resultado === 'en_lista') enLista++;
          else if (resultado === 'sin_rfc') sinRfc++;
          else errores++;
        } catch (error) {
          console.error('Error consultando antilavado del comprador:', comprador.id_persona, error);
          const mensaje = error instanceof Error ? error.message : 'Error en la consulta';
          setAmlRows(prev => ({
            ...prev,
            [comprador.id_persona]: { estado: 'error', mensaje }
          }));
          errores++;
        }
      }

      const partes = [
        `${verificados} verificados`,
        `${enLista} en lista 69-B`,
        `${errores} con error`
      ];
      if (sinRfc > 0) partes.push(`${sinRfc} sin RFC`);

      toast({
        title: "Verificación antilavado completada",
        description: partes.join(', '),
        variant: enLista > 0 || errores > 0 ? "destructive" : "default"
      });

      await loadAntilavado();
      onSuccess?.();
    } finally {
      setIsAmlRunning(false);
    }
  };

  const handleGenerateSAT = async () => {
    setIsGenerating(true);
    try {
      // Get compradores for this cuenta
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_persona')
        .eq('id_cuenta_cobranza', cuentaCobranzaId)
        .eq('activo', true)
        .limit(1);

      if (!compradores?.length) {
        throw new Error('No se encontraron compradores');
      }

      const idPersona = compradores[0].id_persona;

      // Get the XML factura URL (type 21)
      const { data: xmlDoc } = await supabase
        .from('documentos')
        .select('url')
        .eq('id_cuenta_cobranza', cuentaCobranzaId)
        .eq('id_persona', idPersona)
        .eq('id_tipo_documento', 21)
        .eq('activo', true)
        .eq('es_draft', false)
        .order('fecha_creacion', { ascending: false })
        .limit(1);

      // Get the CSF URL (type 6)
      const { data: csfDoc } = await supabase
        .from('documentos')
        .select('url')
        .eq('id_persona', idPersona)
        .eq('id_tipo_documento', 6)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false })
        .limit(1);

      if (!xmlDoc?.length || !csfDoc?.length) {
        throw new Error('No se encontraron los documentos necesarios (XML y CSF)');
      }

      // Call Edge Function with the new endpoint
      const { data, error } = await supabase.functions.invoke('trigger-sat-notification', {
        body: {
          id_cuenta_cobranza: cuentaCobranzaId,
          id_persona: idPersona,
          xml_url: xmlDoc[0].url,
          csf_url: csfDoc[0].url,
          ambiente: 'produccion'
        }
      });

      if (error) throw error;

      console.log('SAT generation response:', JSON.stringify(data, null, 2));

      // Handle validation response (JSON with campo errors)
      if (data.success && data.type === 'validation') {
        console.log('Validation response received:', data);
        const campos = data.campos_con_error || [];
        const camposConError = campos.filter((c: any) => !c.correcto);
        
        if (data.tiene_errores || camposConError.length > 0) {
          // Show validation errors table
          setValidationErrors(campos);
          toast({
            title: "Errores de Validación",
            description: `Se encontraron ${data.total_errores || camposConError.length} error(es) en los datos fiscales`,
            variant: "destructive"
          });
        } else {
          // No errors in validation, but no file was generated
          toast({
            title: "Validación Exitosa",
            description: "Los datos fiscales son correctos, pero no se generó archivo"
          });
        }
        return;
      }

      // If the response contains a file URL (uploaded by edge function)
      if (data.success && data.type === 'file' && data.url) {
        // Clear any previous validation errors
        setValidationErrors(null);

        toast({
          title: "Éxito",
          description: "Archivo de notificación SAT generado correctamente"
        });

        // Reload status to show the new document and enable download button
        await loadStatus();
        onSuccess?.();
      } else if (data.success) {
        toast({
          title: "Éxito",
          description: "Notificación SAT procesada correctamente"
        });
        await loadStatus();
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Error al generar la notificación');
      }
    } catch (error: any) {
      console.error('Error generating SAT notification:', error);
      toast({
        title: "Error",
        description: error.message || "Error al generar la notificación",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    // Invalidate previous and regenerate
    setIsGenerating(true);
    try {
      await SATNotificationService.invalidatePrevious(cuentaCobranzaId);
      toast({
        title: "Archivo anterior invalidado",
        description: "Generando nuevo archivo..."
      });
      await handleGenerateSAT();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al regenerar",
        variant: "destructive"
      });
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

  /** Celda de la columna AML (verificación antilavado) de un comprador. */
  const renderAmlCell = (idPersona: number) => {
    const info = antilavado?.compradores.find(c => c.id_persona === idPersona);
    const row = amlRows[idPersona];

    // Aún no carga el estado antilavado
    if (!info || !row) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    if (row.estado === 'consultando') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Consultando…
        </span>
      );
    }

    if (row.estado === 'sin_rfc') {
      return (
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
            <MinusCircle className="h-3 w-3 mr-1" />
            Sin RFC
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>
                  <Search className="h-3 w-3" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>El comprador no tiene RFC registrado</p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    const botonConsultar = (label: string, force: boolean) => (
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isAmlRunning}
        onClick={() => handleConsultarFila(info, force)}
      >
        <Search className="h-3 w-3 mr-1" />
        {label}
      </Button>
    );

    if (row.estado === 'en_lista') {
      return (
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
            <Ban className="h-3 w-3 mr-1" />
            En lista 69-B
          </Badge>
          {botonConsultar('Reconsultar', true)}
        </div>
      );
    }

    if (row.estado === 'error') {
      return (
        <div className="flex items-center justify-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[260px]">{row.mensaje || 'Error en la consulta antilavado'}</p>
            </TooltipContent>
          </Tooltip>
          {botonConsultar('Reintentar', true)}
        </div>
      );
    }

    if (row.estado === 'limpio') {
      const vigente = row.vigente !== false;
      return (
        <div className="flex items-center justify-center gap-2">
          <Badge
            variant="outline"
            className={vigente
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"}
          >
            <ShieldCheck className="h-3 w-3 mr-1" />
            {vigente ? 'Limpio' : 'Vencido'}
            {row.fecha && (
              row.url ? (
                <button
                  type="button"
                  onClick={() => window.open(row.url as string, '_blank')}
                  className="ml-1 underline underline-offset-2 hover:opacity-80"
                  title="Ver comprobante"
                >
                  ({formatFechaAml(row.fecha)})
                </button>
              ) : (
                <span className="ml-1">({formatFechaAml(row.fecha)})</span>
              )
            )}
          </Badge>
          {botonConsultar('Reconsultar', true)}
        </div>
      );
    }

    // no_consultado
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">— No consultado</span>
        {botonConsultar('Consultar', false)}
      </div>
    );
  };

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
            <TableHead className="text-center w-[230px]">AML</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {compradoresStatus.map((comprador) => (
            <TableRow
              key={comprador.id_persona}
              className={
                amlRows[comprador.id_persona]?.estado === 'en_lista' || !comprador.cumpleRequisitos
                  ? "bg-red-50 dark:bg-red-950/20"
                  : ""
              }
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
              <TableCell className="text-center">
                {renderAmlCell(comprador.id_persona)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[85vh] overflow-y-auto">
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
            {/* Verificación Antilavado — Lista SAT (Art. 69-B).
                Informativa: no condiciona canGenerate ni "Validar y Generar".
                Nada se dispara sin el click explícito en "Consultar y adjuntar". */}
            <div className="space-y-3 p-4 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
              <h4 className="font-medium text-sm flex items-center gap-2 text-amber-900 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                Verificación Antilavado — Lista SAT (Art. 69-B)
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Antes de notificar al SAT se verifica que ningún comprador aparezca en la lista de
                contribuyentes con operaciones presuntamente inexistentes (Art. 69-B del CFF), como
                exige la LFPIORPI.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Al confirmar, el sistema consultará automáticamente el RFC de cada comprador en
                antilavado.com.mx, descargará el comprobante oficial en PDF y lo adjuntará al
                expediente del comprador en esta cuenta de cobranza. La consulta es pública y no
                tiene costo. Toma unos segundos por comprador.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleConsultarAntilavado}
                  disabled={isAmlRunning || !antilavado?.compradores.some(c => !!c.rfc)}
                >
                  {isAmlRunning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Consultar y adjuntar
                </Button>
                {antilavado && antilavado.totalCompradores > 0 && (
                  <Badge
                    variant="outline"
                    className={antilavado.vigentes === antilavado.totalCompradores
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                      : "text-xs"}
                  >
                    {antilavado.vigentes}/{antilavado.totalCompradores} con comprobante vigente
                  </Badge>
                )}
              </div>
            </div>

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
                    PDF = Factura PDF verificada | XML = Factura XML verificada | CSF = Constancia de Situación Fiscal verificada | AML = Verificación antilavado (Art. 69-B), vigencia 90 días
                  </p>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Validation Errors Table */}
            {validationErrors && validationErrors.length > 0 && (() => {
              const allFieldsEmpty = validationErrors.every(c => (!c.valor || c.valor === '-') && !c.correcto);
              return (
              <div className="space-y-2 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Errores de Validación Fiscal
                </h4>
                {allFieldsEmpty && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ No se pudieron extraer datos de la Constancia de Situación Fiscal.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Es probable que el archivo subido sea una <strong>imagen o fotografía</strong> de la constancia. 
                      Por favor, solicite al comprador que suba el <strong>PDF original descargado del portal del SAT</strong> para poder procesarlo correctamente.
                    </p>
                  </div>
                )}
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                  Los siguientes campos presentan discrepancias entre el XML de la factura y la Constancia de Situación Fiscal:
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Campo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="text-center w-[80px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationErrors.map((campo, index) => (
                      <TableRow 
                        key={`${campo.campo}-${index}`}
                        className={!campo.correcto ? "bg-red-100 dark:bg-red-900/30" : ""}
                      >
                        <TableCell className="font-medium text-sm capitalize">
                          {campo.campo.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {campo.valor || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {campo.correcto ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setValidationErrors(null)}
                  className="mt-2"
                >
                  Cerrar Errores
                </Button>
              </div>
              );
            })()}

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
              {/* Case 1: No archivo SAT - Show Validar y Generar button */}
              {!status.hasArchivoSAT && status.canGenerate && (
                <Button onClick={handleGenerateSAT} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4 mr-2" />
                  )}
                  Validar y Generar
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
