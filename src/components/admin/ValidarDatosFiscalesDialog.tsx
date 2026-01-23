import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, X, Download, FileText, FileCheck, AlertTriangle, RefreshCw, User, Building2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadDocument } from "@/utils/googleDriveUrl";
import * as XLSX from 'xlsx';
import { 
  extraerDatos, 
  validarDatosFiscales, 
  prepararDatosExcelSat,
  DatosValidados,
  ComparisonResult,
  ExtractionResult
} from "@/services/validacionFiscalService";

interface ValidarDatosFiscalesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaCobranzaId: number;
  comprador: {
    id_persona: number;
    nombre_legal: string;
    rfc?: string;
  };
  xmlUrl: string;
  csfUrl?: string;
}

export function ValidarDatosFiscalesDialog({
  isOpen,
  onClose,
  cuentaCobranzaId,
  comprador,
  xmlUrl,
  csfUrl: initialCsfUrl
}: ValidarDatosFiscalesDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [csfUrl, setCsfUrl] = useState<string | undefined>(initialCsfUrl);
  const [datosValidados, setDatosValidados] = useState<DatosValidados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load CSF URL if not provided
  useEffect(() => {
    if (!initialCsfUrl && isOpen) {
      loadCsfUrl();
    }
  }, [isOpen, initialCsfUrl, comprador.id_persona, cuentaCobranzaId]);

  const loadCsfUrl = async () => {
    setIsLoading(true);
    try {
      // CSF is tipo_documento 6 (Constancia de Situación Fiscal)
      const { data, error } = await supabase
        .from('documentos')
        .select('url')
        .eq('id_cuenta_cobranza', cuentaCobranzaId)
        .eq('id_persona', comprador.id_persona)
        .eq('id_tipo_documento', 6)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading CSF:', error);
      }
      
      if (data) {
        setCsfUrl(data.url);
      }
    } catch (err) {
      console.error('Error loading CSF URL:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtraerYComparar = async () => {
    if (!xmlUrl || !csfUrl) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Se requieren tanto el XML como la CSF para validar"
      });
      return;
    }

    setIsExtracting(true);
    setError(null);
    setDatosValidados(null);

    try {
      const result: ExtractionResult = await extraerDatos(
        xmlUrl,
        csfUrl,
        cuentaCobranzaId,
        comprador.id_persona
      );

      // Verify the response has the expected structure
      if (!result.documentos_procesados?.constancia_situacion_fiscal || !result.documentos_procesados?.factura_cfdi) {
        throw new Error('La respuesta del servidor no tiene el formato esperado');
      }

      const { constancia_situacion_fiscal, factura_cfdi } = result.documentos_procesados;
      const validacion = validarDatosFiscales(constancia_situacion_fiscal, factura_cfdi);
      setDatosValidados(validacion);

      const coincidenciasRequeridas = validacion.comparacion.filter(c => c.esRequerido && c.coincide).length;
      const totalRequeridos = validacion.comparacion.filter(c => c.esRequerido).length;
      const coincidenciasTotales = validacion.comparacion.filter(c => c.coincide).length;
      const total = validacion.comparacion.length;

      toast({
        title: validacion.camposRequeridosCoinciden ? "Validación exitosa" : "Validación completada",
        description: `${coincidenciasRequeridas}/${totalRequeridos} campos requeridos coinciden (${coincidenciasTotales}/${total} total)`,
        variant: validacion.camposRequeridosCoinciden ? "default" : "destructive"
      });
    } catch (err) {
      console.error('Error extracting data:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al extraer datos');
      toast({
        variant: "destructive",
        title: "Error de extracción",
        description: err instanceof Error ? err.message : 'Error al procesar los documentos'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerarExcel = async () => {
    if (!datosValidados || !datosValidados.camposRequeridosCoinciden) {
      toast({
        variant: "destructive",
        title: "No se puede generar",
        description: "Los campos requeridos (RFC, Nombre, Código Postal) deben coincidir"
      });
      return;
    }

    setIsGeneratingExcel(true);

    try {
      const excelData = prepararDatosExcelSat(datosValidados, cuentaCobranzaId);
      console.log('Excel data prepared:', excelData);

      // Fetch the template
      const templateResponse = await fetch('/templates/template-aviso-sat-inmuebles.xlsm');
      if (!templateResponse.ok) {
        throw new Error('No se pudo cargar la plantilla del Excel');
      }

      const templateBuffer = await templateResponse.arrayBuffer();
      const workbook = XLSX.read(templateBuffer, { type: 'array' });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Fill in the data based on the template structure
      // Row 3: RFC emisor
      worksheet['C3'] = { t: 's', v: excelData.rfc_emisor };
      // Row 4: Periodo
      worksheet['C4'] = { t: 's', v: excelData.periodo };
      // Row 5: Referencia
      worksheet['C5'] = { t: 's', v: excelData.referencia };

      // Persona física starts at row 18 (based on template structure)
      // Columns: Nombre(s), Apellido Paterno, Apellido Materno, Fecha Nacimiento, RFC, CURP, País nacionalidad, Actividad económica
      const personaRow = 18;
      worksheet[`B${personaRow}`] = { t: 's', v: excelData.persona_fisica.nombres };
      worksheet[`C${personaRow}`] = { t: 's', v: excelData.persona_fisica.apellido_paterno };
      worksheet[`D${personaRow}`] = { t: 's', v: excelData.persona_fisica.apellido_materno };
      worksheet[`E${personaRow}`] = { t: 's', v: excelData.persona_fisica.fecha_nacimiento };
      worksheet[`F${personaRow}`] = { t: 's', v: excelData.persona_fisica.rfc };
      worksheet[`G${personaRow}`] = { t: 's', v: excelData.persona_fisica.curp };
      worksheet[`H${personaRow}`] = { t: 's', v: excelData.persona_fisica.pais_nacionalidad };
      worksheet[`I${personaRow}`] = { t: 's', v: excelData.persona_fisica.actividad_economica };

      // Domicilio nacional starts at row 54 (based on template structure)
      // Columns: Código postal, Estado, Municipio, Colonia, Calle, Número exterior, Número interior
      const domicilioRow = 54;
      worksheet[`B${domicilioRow}`] = { t: 's', v: excelData.domicilio.codigo_postal };
      worksheet[`C${domicilioRow}`] = { t: 's', v: excelData.domicilio.estado };
      worksheet[`D${domicilioRow}`] = { t: 's', v: excelData.domicilio.municipio };
      worksheet[`E${domicilioRow}`] = { t: 's', v: excelData.domicilio.colonia };
      worksheet[`F${domicilioRow}`] = { t: 's', v: excelData.domicilio.calle };
      worksheet[`G${domicilioRow}`] = { t: 's', v: excelData.domicilio.numero_exterior };
      worksheet[`H${domicilioRow}`] = { t: 's', v: excelData.domicilio.numero_interior };

      // Generate the file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsm', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      
      // Download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Aviso_SAT_CC-${cuentaCobranzaId}_${excelData.persona_fisica.rfc}.xlsm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Excel generado",
        description: "El archivo se ha descargado correctamente"
      });
    } catch (err) {
      console.error('Error generating Excel:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error al generar el archivo Excel"
      });
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleDownloadXml = () => {
    if (xmlUrl) {
      downloadDocument(xmlUrl, `factura_${cuentaCobranzaId}.xml`);
    }
  };

  const handleDownloadCsf = () => {
    if (csfUrl) {
      downloadDocument(csfUrl, `csf_${comprador.rfc || comprador.id_persona}.pdf`);
    }
  };

  const renderComparisonIcon = (coincide: boolean) => {
    return coincide ? (
      <Check className="h-5 w-5 text-green-600" />
    ) : (
      <X className="h-5 w-5 text-red-600" />
    );
  };

  const getCoincidenciasCount = () => {
    if (!datosValidados) return { requeridos: 0, totalRequeridos: 0, total: 0, totalCampos: 0 };
    const requeridos = datosValidados.comparacion.filter(c => c.esRequerido && c.coincide).length;
    const totalRequeridos = datosValidados.comparacion.filter(c => c.esRequerido).length;
    const total = datosValidados.comparacion.filter(c => c.coincide).length;
    return { requeridos, totalRequeridos, total, totalCampos: datosValidados.comparacion.length };
  };

  const { requeridos, totalRequeridos, total, totalCampos } = getCoincidenciasCount();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Validar Datos Fiscales para SAT
          </DialogTitle>
          <DialogDescription>
            Compara los datos del XML de factura (CFDI) con la Constancia de Situación Fiscal (CSF)
          </DialogDescription>
        </DialogHeader>

        {/* Información del Comprador */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Comprador</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Nombre:</span>
                <p className="font-medium">{comprador.nombre_legal}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">RFC:</span>
                <p className="font-medium font-mono">{comprador.rfc || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estado de Documentos */}
        <div className="grid grid-cols-2 gap-4">
          {/* XML */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Factura XML (CFDI)</span>
                </div>
                {xmlUrl ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">Disponible</Badge>
                    <Button variant="ghost" size="icon" onClick={handleDownloadXml}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant="destructive">No disponible</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CSF */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">CSF (Constancia SAT)</span>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : csfUrl ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">Disponible</Badge>
                    <Button variant="ghost" size="icon" onClick={handleDownloadCsf}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant="destructive">No disponible</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Missing Documents Warning */}
        {(!xmlUrl || !csfUrl) && !isLoading && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {!xmlUrl && !csfUrl 
                ? "Se requiere el XML de la factura y la CSF del comprador para realizar la validación."
                : !xmlUrl 
                  ? "Se requiere el XML de la factura para realizar la validación."
                  : "Se requiere la Constancia de Situación Fiscal (CSF) del comprador para realizar la validación."
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Botón Extraer y Comparar */}
        <div className="flex justify-center">
          <Button
            onClick={handleExtraerYComparar}
            disabled={!xmlUrl || !csfUrl || isExtracting}
            size="lg"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extrayendo datos...
              </>
            ) : datosValidados ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Volver a comparar
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Extraer y Comparar
              </>
            )}
          </Button>
        </div>

        {/* Tabla Comparativa */}
        {datosValidados && (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Campo</TableHead>
                    <TableHead>CFDI (Factura XML)</TableHead>
                    <TableHead>CSF (Constancia SAT)</TableHead>
                    <TableHead className="w-[100px] text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datosValidados.comparacion.map((resultado: ComparisonResult, index: number) => (
                    <TableRow 
                      key={index} 
                      className={!resultado.coincide ? (resultado.esRequerido ? 'bg-red-50 dark:bg-red-950/20' : 'bg-yellow-50 dark:bg-yellow-950/20') : ''}
                    >
                      <TableCell className="font-medium">
                        {resultado.campo}
                        {resultado.esRequerido && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {resultado.valorXml}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px]">
                        <div className="truncate">{resultado.valorCsf}</div>
                        {resultado.detalle && (
                          <p className="text-xs text-muted-foreground mt-1 font-sans">{resultado.detalle}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderComparisonIcon(resultado.coincide)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Datos Adicionales Extraídos */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Datos de la Factura</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UUID:</span>
                      <span className="font-mono text-xs">{datosValidados.cfdi.informacion_general.uuid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span>{datosValidados.cfdi.informacion_general.fecha}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-medium">${datosValidados.cfdi.totales.total?.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emisor:</span>
                      <span className="text-xs">{datosValidados.cfdi.emisor.nombre}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Datos de la CSF</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID CIF:</span>
                      <span className="font-mono">{datosValidados.csf.datos_identificacion.id_cif}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CURP:</span>
                      <span className="font-mono text-xs">{datosValidados.csf.datos_identificacion.curp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inicio Ops:</span>
                      <span className="text-xs">{datosValidados.csf.datos_identificacion.fecha_inicio_operaciones}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Domicilio:</span>
                      <span className="text-xs truncate max-w-[150px]">
                        {datosValidados.csf.domicilio_fiscal.vialidad}, {datosValidados.csf.domicilio_fiscal.colonia}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumen */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {datosValidados.camposRequeridosCoinciden ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <span className="font-medium">
                    {requeridos} de {totalRequeridos} campos requeridos coinciden
                  </span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({total}/{totalCampos} total)
                  </span>
                </div>
              </div>
              <Badge variant={datosValidados.camposRequeridosCoinciden ? "default" : "destructive"}>
                {datosValidados.camposRequeridosCoinciden ? "Puede generar Excel" : "Hay discrepancias"}
              </Badge>
            </div>

            {/* Leyenda */}
            <p className="text-xs text-muted-foreground">
              <span className="text-red-500">*</span> Campos requeridos para la validación fiscal
            </p>

            {/* Botón Generar Excel */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                onClick={handleGenerarExcel}
                disabled={!datosValidados.camposRequeridosCoinciden || isGeneratingExcel}
                className={datosValidados.camposRequeridosCoinciden ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {isGeneratingExcel ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Generar Excel SAT
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Close button when no validation done */}
        {!datosValidados && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
