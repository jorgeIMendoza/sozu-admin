import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Upload, Eye, Trash2, AlertTriangle, Loader2, CheckCircle2, History, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentHistoryDialog } from "./DocumentHistoryDialog";
import { DocumentStatusChangeDialog } from "./DocumentStatusChangeDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { N8N_WEBHOOK_BASE_URL, ENVIRONMENT } from '@/lib/config';
import {
  TIPO_DOC_FACTURA_COMISION_EXTERNA,
  sincronizarFacturaComisionEnCuenta,
} from "@/utils/facturaComisionExterna";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

interface DocumentsTabProps {
  entityId?: number;
  entityType: 'persona' | 'propiedad' | 'cuenta_cobranza';
  tipoPersona?: 'pf' | 'pm'; // Tipo de persona para filtrar documentos
  pendingDocuments?: Array<{
    file: File;
    tipoDocumento: string;
    tempId: string;
  }>;
  onPendingDocumentsChange?: (docs: Array<{
    file: File;
    tipoDocumento: string;
    tempId: string;
  }>) => void;
  onDocumentAdded?: () => void;
  shouldAutoGenerateInvoice?: boolean; // Flag to disable invoice options when auto-generated
  compradores?: Array<{ id_persona: number; nombre_legal: string }>; // Lista de compradores
  propiedadId?: number; // ID de la propiedad asociada
  onGenerateFinalInvoice?: (idPersona: number, idDocumento: number) => Promise<void>; // Callback para generar factura final
  isReadOnly?: boolean; // Modo solo lectura cuando la propiedad está entregada
  hideStatusChange?: boolean; // Ocultar botón de cambiar estatus (pero permitir eliminar)
  canEditStatus?: boolean; // Permiso para editar estatus de documentos (default: true)
}

interface TipoDocumento {
  id: number;
  nombre: string;
  id_categoria_documento?: number;
}

interface Documento {
  id: number;
  numero: string | null;
  url: string;
  id_estatus_verificacion: number; // 1=Pendiente, 2=Validado, 3=Rechazado, 4=Expirado
  activo: boolean;
  id_tipo_documento: number;
  fecha_creacion: string;
  id_persona?: number;
  id_propiedad?: number;
  tipo_documento_nombre?: string;
  es_draft?: boolean;
  comprador_nombre?: string;
  id_categoria_documento?: number;
}

export function DocumentsTab({ 
  entityId, 
  entityType, 
  tipoPersona = 'pf',
  pendingDocuments = [], 
  onPendingDocumentsChange, 
  onDocumentAdded,
  shouldAutoGenerateInvoice = false,
  compradores = [],
  propiedadId,
  onGenerateFinalInvoice,
  isReadOnly = false,
  hideStatusChange = false,
  canEditStatus = true
}: DocumentsTabProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTipoDocumento, setSelectedTipoDocumento] = useState<string>("");
  const [numeroDocumento, setNumeroDocumento] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewerDialog, setViewerDialog] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });
  const [dialogAlreadyShown, setDialogAlreadyShown] = useState(false);
  const [selectedComprador, setSelectedComprador] = useState<string>("");
  const [hasInvoices, setHasInvoices] = useState(false);
  const [showConfirmEntrega, setShowConfirmEntrega] = useState(false);
  const [documentoPendienteVerificar, setDocumentoPendienteVerificar] = useState<Documento | null>(null);
  const [adminValidation, setAdminValidation] = useState<{
    isLoading: boolean;
    hasAdmin: boolean;
    adminName: string | null;
    hasCuentaMadre: boolean;
    cuentaMadre: string | null;
  }>({
    isLoading: false,
    hasAdmin: false,
    adminName: null,
    hasCuentaMadre: false,
    cuentaMadre: null
  });
  const [historyDialog, setHistoryDialog] = useState<{ isOpen: boolean; documentId: number | null; documentName: string }>({
    isOpen: false,
    documentId: null,
    documentName: ''
  });
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ 
    isOpen: boolean; 
    document: Documento | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    document: null,
    isLoading: false
  });
  const [documentToDelete, setDocumentToDelete] = useState<Documento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Context for pending status change that triggers delivery flow
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    documentId: number;
    newStatus: number;
    comment: string;
  } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Auto-select comprador if only one exists and invoice type is selected
  useEffect(() => {
    if (!shouldAutoGenerateInvoice && entityType === 'cuenta_cobranza' && compradores.length === 1) {
      const tipoDoc = tiposDocumento.find(t => t.id.toString() === selectedTipoDocumento);
      const isInvoice = tipoDoc?.nombre.toLowerCase().includes('factura');
      if (isInvoice && !selectedComprador) {
        setSelectedComprador(compradores[0].id_persona.toString());
      }
    }
  }, [selectedTipoDocumento, compradores, shouldAutoGenerateInvoice, entityType, tiposDocumento, selectedComprador]);

  // Load document types based on entity type and person type
  const loadTiposDocumento = async () => {
    try {
      // Filter by asignado_a based on entity type
      // For cuenta_cobranza, use 'prop' since documents are property-related
      const asignadoA = (entityType === 'propiedad' || entityType === 'cuenta_cobranza') ? 'prop' : 'per';
      
      // Build query
      let query = supabase
        .from('tipos_documento')
        .select('id, nombre, id_categoria_documento')
        .eq('activo', true)
        .eq('asignado_a', asignadoA);
      
      // For persona entity type, filter by padre based on tipoPersona
      if (entityType === 'persona' && tipoPersona) {
        // For personas físicas: padre = 'pf' or 'a'
        // For personas morales: padre = 'pm' or 'a'
        const filtros = tipoPersona === 'pf' ? ['pf', 'a'] : ['pm', 'a'];
        query = query.in('padre', filtros);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading document types:', error);
      } else {
        // Sort alphabetically by nombre
        const sortedData = (data || []).sort((a, b) => 
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        );
        setTiposDocumento(sortedData);
      }
    } catch (err) {
      console.error('Error loading document types:', err);
    }
  };

  // Load existing documents
  const loadDocumentos = async () => {
    if (!entityId) return;
    
    setIsLoading(true);
    const column = entityType === 'persona' 
      ? 'id_persona' 
      : entityType === 'cuenta_cobranza'
      ? 'id_cuenta_cobranza'
      : 'id_propiedad';
    
    try {
      const { data: docsData, error: docsError } = await supabase
        .from('documentos')
        .select('*')
        .eq(column, entityId)
        .eq('activo', true);
      
      if (docsError) throw docsError;
      
      // Get document types separately (including category)
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_documento')
        .select('id, nombre, id_categoria_documento')
        .eq('activo', true);
      
      if (tiposError) throw tiposError;
      
      // Create types map with category
      const tiposMap = new Map<number, { nombre: string; id_categoria_documento: number | null }>();
      if (tiposData) {
        tiposData.forEach((tipo) => {
          tiposMap.set(tipo.id, { nombre: tipo.nombre, id_categoria_documento: tipo.id_categoria_documento });
        });
      }
      
      // Get compradores names if they exist
      const personaIds = docsData?.filter(doc => doc.id_persona).map(doc => doc.id_persona) || [];
      let personasMap = new Map<number, string>();
      
      if (personaIds.length > 0) {
        const { data: personasData } = await supabase
          .from('personas')
          .select('id, nombre_legal')
          .in('id', personaIds);
        
        if (personasData) {
          personasData.forEach((persona) => {
            personasMap.set(persona.id, persona.nombre_legal);
          });
        }
      }
      
      // Combine the data and filter out invoices (Facturas PDF/XML)
      // First check if there are any invoices
      const allDocs = docsData || [];
      const invoicesExist = allDocs.some((doc) => {
        const tipoData = tiposMap.get(doc.id_tipo_documento);
        const tipoNombre = tipoData?.nombre.toLowerCase() || '';
        return tipoNombre.includes('factura') && (tipoNombre.includes('pdf') || tipoNombre.includes('xml'));
      });
      
      setHasInvoices(invoicesExist);
      
      const docs = allDocs
        .filter((doc) => {
          const tipoData = tiposMap.get(doc.id_tipo_documento);
          const tipoNombre = tipoData?.nombre.toLowerCase() || '';
          // Excluir facturas PDF y XML
          return !(tipoNombre.includes('factura') && (tipoNombre.includes('pdf') || tipoNombre.includes('xml')));
        })
        .map((doc) => {
          const tipoData = tiposMap.get(doc.id_tipo_documento);
          return {
            ...doc,
            numero: doc.numero != null ? String(doc.numero) : null,
            tipo_documento_nombre: tipoData?.nombre || 'Tipo desconocido',
            id_categoria_documento: tipoData?.id_categoria_documento || undefined,
            comprador_nombre: doc.id_persona ? personasMap.get(doc.id_persona) : undefined
          };
        })
        .sort((a, b) => {
          // Primero ordenar por tipo de documento (alfabéticamente)
          const tipoComparison = (a.tipo_documento_nombre || '').localeCompare(b.tipo_documento_nombre || '', 'es', { sensitivity: 'base' });
          if (tipoComparison !== 0) return tipoComparison;
          
          // Luego ordenar por fecha (más reciente primero)
          return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
        });
      
      setDocumentos(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data when component mounts or entityId/tipoPersona changes
  useEffect(() => {
    loadTiposDocumento();
    loadDocumentos();
  }, [entityId, entityType, tipoPersona]);

  // El efecto automático fue removido - ahora solo se procesa cuando el usuario confirma

  const handleUpload = async () => {
    if (!selectedFile || !selectedTipoDocumento) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Faltan datos requeridos",
      });
      return;
    }
    
    // Verificar si es factura y dueño NO factura
    const tipoDoc = tiposDocumento.find(t => t.id.toString() === selectedTipoDocumento);
    const isInvoice = tipoDoc?.nombre.toLowerCase().includes('factura');
    
    if (isInvoice && !shouldAutoGenerateInvoice && entityType === 'cuenta_cobranza' && compradores.length > 0) {
      // Si no hay comprador seleccionado, mostrar error
      if (!selectedComprador) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debe seleccionar un comprador para la factura",
        });
        return;
      }
    }

    // If no entityId, add to pending documents
    if (!entityId) {
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const newPendingDoc = {
        file: selectedFile,
        tipoDocumento: selectedTipoDocumento,
        tempId
      };
      
      onPendingDocumentsChange?.([...pendingDocuments, newPendingDoc]);
      
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedTipoDocumento("");
      setNumeroDocumento("");
      setSelectedComprador("");
      onDocumentAdded?.();
      
      toast({
        title: "Documento agregado",
        description: "El documento se agregará al guardar la información básica"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${entityType}_${entityId}_${Date.now()}.${fileExt}`;
      const filePath = fileName; // Sin prefijo 'documentos/' para evitar duplicación

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      // Use user-provided numero or leave as null
      const numeroValue = numeroDocumento && numeroDocumento.trim() !== '' 
        ? numeroDocumento.trim() 
        : null;

      // Get cuenta_cobranza and propiedad based on entity type
      let idCuentaCobranza = null;
      let idPropiedad = null;
      let idPersona = null;
      
      if (entityType === 'propiedad') {
        // First get the ofertas for this property
        const { data: ofertasData } = await supabase
          .from('ofertas')
          .select('id')
          .eq('id_propiedad', entityId)
          .eq('activo', true);
        
        if (ofertasData && ofertasData.length > 0) {
          const ofertaIds = ofertasData.map(o => o.id);
          
          // Get the first cuenta_cobranza
          const { data: cuentaData } = await supabase
            .from('cuentas_cobranza')
            .select('id')
            .in('id_oferta', ofertaIds)
            .eq('activo', true)
            .limit(1)
            .maybeSingle();
          
          if (cuentaData) {
            idCuentaCobranza = cuentaData.id;
          }
        }
        idPropiedad = entityId;
      } else if (entityType === 'cuenta_cobranza') {
        idCuentaCobranza = entityId;
        
        // Get propiedad from cuenta_cobranza
        const { data: cuentaData } = await supabase
          .from('cuentas_cobranza')
          .select('id_oferta')
          .eq('id', entityId)
          .single();
          
        if (cuentaData) {
          const { data: ofertaData } = await supabase
            .from('ofertas')
            .select('id_propiedad')
            .eq('id', cuentaData.id_oferta)
            .single();
            
          if (ofertaData) {
            idPropiedad = ofertaData.id_propiedad;
          }
        }
        
        // Si es factura y dueño NO factura, usar el comprador seleccionado
        if (isInvoice && !shouldAutoGenerateInvoice && compradores.length > 0) {
          idPersona = parseInt(selectedComprador);
        }
      }

      // Determinar si es una factura PDF o XML
      const nombreTipoDoc = tipoDoc?.nombre.toLowerCase() || '';
      const esFactura = nombreTipoDoc.includes('factura pdf') || nombreTipoDoc.includes('factura xml');
      // 1=Pendiente, 2=Validado
      const idEstatusVerificacion = esFactura ? 2 : 1;

      // Create new documento record (permitir múltiples documentos del mismo tipo)
      const documentoData: any = {
        numero: numeroValue,
        url: urlData.publicUrl,
        id_tipo_documento: parseInt(selectedTipoDocumento),
        activo: true,
        id_estatus_verificacion: idEstatusVerificacion,
      };

      // Add foreign keys based on entity type
      if (entityType === 'persona') {
        documentoData.id_persona = entityId;
      } else if (entityType === 'propiedad') {
        documentoData.id_propiedad = idPropiedad;
        documentoData.id_cuenta_cobranza = idCuentaCobranza;
      } else if (entityType === 'cuenta_cobranza') {
        documentoData.id_cuenta_cobranza = idCuentaCobranza;
        documentoData.id_propiedad = idPropiedad;
        if (idPersona) {
          documentoData.id_persona = idPersona;
        }
      }

      const { error: insertError } = await supabase.from('documentos').insert(documentoData);

      if (insertError) throw insertError;

      // Si es documento tipo 23 (Escritura) y tiene número, actualizar numero_escritura en cuenta_cobranza
      if (parseInt(selectedTipoDocumento) === 23 && numeroValue && idCuentaCobranza) {
        const { error: updateError } = await supabase
          .from('cuentas_cobranza')
          .update({ numero_escritura: numeroValue })
          .eq('id', idCuentaCobranza);

        if (updateError) {
          console.error('Error actualizando numero_escritura:', updateError);
        }
      }

      // Factura de comisión externa: sincronizar cuentas_cobranza para que la
      // cuenta entre al pipeline de cobro al desarrollador (habilita el botón
      // "Ejecutar pago" en Pagos a externos)
      if (parseInt(selectedTipoDocumento) === TIPO_DOC_FACTURA_COMISION_EXTERNA && idCuentaCobranza) {
        const esXml = selectedFile.name.toLowerCase().endsWith('.xml');
        try {
          await sincronizarFacturaComisionEnCuenta(
            idCuentaCobranza,
            esXml ? { xml: urlData.publicUrl } : { pdf: urlData.publicUrl },
          );
        } catch (syncError) {
          console.error('Error sincronizando factura de comisión en cuenta:', syncError);
        }
      }

      // Reload documents
      await loadDocumentos();
      
      // Clear form
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedTipoDocumento("");
      setNumeroDocumento("");
      setSelectedComprador("");
      
      toast({
        title: "Éxito",
        description: "Documento subido correctamente",
      });

      // Notify parent
      onDocumentAdded?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al subir el documento: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePending = (tempId: string) => {
    const updatedPending = pendingDocuments.filter(doc => doc.tempId !== tempId);
    onPendingDocumentsChange?.(updatedPending);
    toast({
      title: "Documento eliminado",
      description: "El documento pendiente ha sido eliminado"
    });
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('documentos')
        .update({ activo: false })
        .eq('id', documentToDelete.id);

      if (error) throw error;
      
      await loadDocumentos();
      setDocumentToDelete(null);
      toast({
        title: "Éxito",
        description: "Documento eliminado correctamente",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al eliminar el documento: ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVerification = async (documento: Documento) => {
    try {
      // 🔹 NUEVO: Si es cuenta_cobranza y se está verificando (no des-verificando)
      // id_estatus_verificacion: 1=Pendiente, 2=Validado
      if (entityType === 'cuenta_cobranza' && documento.id_estatus_verificacion !== 2) {
        // Verificar si este documento es de categoría 7
        const tipoDocResp = await supabase
          .from('tipos_documento')
          .select('id_categoria_documento')
          .eq('id', documento.id_tipo_documento)
          .single();
        
        if (tipoDocResp.data?.id_categoria_documento === 7) {
          // Obtener todos los documentos de categoría 7
          const tiposCategoria7Resp = await supabase
            .from('tipos_documento')
            .select('id')
            .eq('id_categoria_documento', 7)
            .eq('activo', true);

          if (tiposCategoria7Resp.data) {
            const categoria7Ids = tiposCategoria7Resp.data.map((t: any) => t.id);
            
            const { data: allDocs } = await supabase
              .from('documentos')
              .select('id, id_estatus_verificacion')
              .eq('id_cuenta_cobranza', entityId)
              .in('id_tipo_documento', categoria7Ids)
              .eq('activo', true);
            
            // Verificar si este es el ÚNICO documento sin verificar (estatus != 2)
            const docsNoVerificados = allDocs?.filter(d => d.id_estatus_verificacion !== 2) || [];
            const esUltimoSinVerificar = docsNoVerificados.length === 1 && docsNoVerificados[0].id === documento.id;
            
            if (esUltimoSinVerificar) {
              // 🎯 Es el último! Validar administradora antes de mostrar diálogo
              setDocumentoPendienteVerificar(documento);
              setAdminValidation({ isLoading: true, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
              setShowConfirmEntrega(true);
              
              // Ejecutar validación asíncrona
              (async () => {
                try {
                  // Obtener proyecto desde la cuenta de cobranza
                  const cuentaResp = await supabase
                    .from('cuentas_cobranza')
                    .select('id_oferta')
                    .eq('id', entityId)
                    .single();
                  
                  if (!cuentaResp.data?.id_oferta) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }
                  
                  const ofertaResp = await supabase
                    .from('ofertas')
                    .select('id_propiedad')
                    .eq('id', cuentaResp.data.id_oferta)
                    .single();
                  
                  if (!ofertaResp.data?.id_propiedad) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }
                  
                  const propResp = await supabase
                    .from('propiedades')
                    .select('id_entidad_relacionada_dueno')
                    .eq('id', ofertaResp.data.id_propiedad)
                    .single();
                  
                  if (!propResp.data?.id_entidad_relacionada_dueno) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }
                  
                  const entRelResp = await supabase
                    .from('entidades_relacionadas')
                    .select('id_proyecto')
                    .eq('id', propResp.data.id_entidad_relacionada_dueno)
                    .single();
                  
                  if (!entRelResp.data?.id_proyecto) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }
                  
                  // Buscar entidad administradora con cuenta madre STP
                  const adminResp = await supabase
                    .from('entidades_relacionadas')
                    .select('id, cuenta_madre_stp, personas!fk_entrel_persona!inner(nombre_legal)')
                    .eq('id_proyecto', entRelResp.data.id_proyecto)
                    .eq('id_tipo_entidad', 6)
                    .eq('activo', true)
                    .maybeSingle();
                  
                  if (!adminResp.data) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                  } else {
                    const personaData = adminResp.data.personas as any;
                    setAdminValidation({
                      isLoading: false,
                      hasAdmin: true,
                      adminName: personaData?.nombre_legal || 'Administradora',
                      hasCuentaMadre: !!adminResp.data.cuenta_madre_stp,
                      cuentaMadre: adminResp.data.cuenta_madre_stp || null
                    });
                  }
                } catch (error) {
                  console.error('Error validando administradora:', error);
                  setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                }
              })();
              
              return; // No verificar todavía
            }
          }
        }
      }

      // 🔹 Flujo normal: verificar/des-verificar documento
      // Si es cuenta_cobranza y el documento NO está verificado (estatus != 2), validamos antes de verificar
      if (entityType === 'cuenta_cobranza' && documento.id_estatus_verificacion !== 2 && entityId) {
        // Verificar si es documento de categoría 7
        const supabaseClient = supabase as any;
        const tipoDocResp = await supabaseClient
          .from('tipos_documento')
          .select('id_categoria_documento')
          .eq('id', documento.id_tipo_documento)
          .single();
        
        if (tipoDocResp.data?.id_categoria_documento === 7) {
          // Obtener todos los documentos de categoría 7 para esta cuenta
          const tiposCategoria7Resp = await supabaseClient
            .from('tipos_documento')
            .select('id')
            .eq('id_categoria_documento', 7)
            .eq('activo', true);
          
          if (tiposCategoria7Resp.data) {
            const categoria7Ids = tiposCategoria7Resp.data.map((t: any) => t.id);
            const categoria7Docs = documentos.filter(
              d => categoria7Ids.includes(d.id_tipo_documento) && d.activo
            );
            
            // Contar cuántos NO están verificados (estatus != 2)
            const noVerificados = categoria7Docs.filter(d => d.id_estatus_verificacion !== 2);
            
            // Validar entidad administradora antes de verificar cualquier documento de categoría 7
            if (noVerificados.length >= 1) {
              // Obtener la oferta de la cuenta de cobranza
              const cuentaResp = await supabaseClient
                .from('cuentas_cobranza')
                .select('id_oferta')
                .eq('id', entityId)
                .single();
              
              if (!cuentaResp.data?.id_oferta) {
                throw new Error('No se pudo determinar la oferta');
              }
              
              // Obtener el proyecto desde la oferta (puede ser de propiedad o producto)
              const ofertaResp = await supabaseClient
                .from('ofertas')
                .select('id_propiedad, id_producto')
                .eq('id', cuentaResp.data.id_oferta)
                .single();
              
              let proyectoId = null;
              
              // Si es una propiedad
              if (ofertaResp.data?.id_propiedad) {
                const propResp = await supabaseClient
                  .from('propiedades')
                  .select('id_entidad_relacionada_dueno')
                  .eq('id', ofertaResp.data.id_propiedad)
                  .single();
                
                if (propResp.data?.id_entidad_relacionada_dueno) {
                  const entRelResp = await supabaseClient
                    .from('entidades_relacionadas')
                    .select('id_proyecto')
                    .eq('id', propResp.data.id_entidad_relacionada_dueno)
                    .single();
                  
                  proyectoId = entRelResp.data?.id_proyecto;
                }
              }
              // Si es un producto
              else if (ofertaResp.data?.id_producto) {
                const prodResp = await supabaseClient
                  .from('productos_servicios')
                  .select('id_entidad_relacionada_dueno')
                  .eq('id', ofertaResp.data.id_producto)
                  .single();
                
                if (prodResp.data?.id_entidad_relacionada_dueno) {
                  const entRelResp = await supabaseClient
                    .from('entidades_relacionadas')
                    .select('id_proyecto')
                    .eq('id', prodResp.data.id_entidad_relacionada_dueno)
                    .single();
                  
                  proyectoId = entRelResp.data?.id_proyecto;
                }
              }
              
              if (!proyectoId) {
                throw new Error('No se pudo determinar el proyecto');
              }
              
              // Verificar que existe entidad Administradora
              const administradoraResp = await supabaseClient
                .from('entidades_relacionadas')
                .select('id, cuenta_madre_stp, personas!fk_entrel_persona!inner(nombre_legal)')
                .eq('id_proyecto', proyectoId)
                .eq('id_tipo_entidad', 6) // Administradora
                .eq('activo', true)
                .maybeSingle();

              // Validar que existe y tiene cuenta_madre_stp
              if (!administradoraResp.data || !administradoraResp.data.cuenta_madre_stp) {
                const mensajeError = !administradoraResp.data 
                  ? "No existe una entidad legal Administradora configurada en el proyecto."
                  : "La entidad Administradora existe pero no tiene asignada una cuenta madre STP.";
                
                toast({
                  variant: "destructive",
                  title: "Entidad Administradora requerida",
                  description: `Para verificar documentos de entrega de propiedad, ${mensajeError} Por favor complete la configuración en Entidades Legales.`,
                  duration: 6000
                });
                return;
              }
            }
          }
        }
      }

      // Toggle: si está validado (2) -> pendiente (1), si no está validado -> validado (2)
      const nuevoEstatus = documento.id_estatus_verificacion === 2 ? 1 : 2;
      
      const { error } = await supabase
        .from('documentos')
        .update({ id_estatus_verificacion: nuevoEstatus })
        .eq('id', documento.id);
        
      if (error) throw error;
      
      await loadDocumentos();
      
      toast({ 
        title: "Éxito", 
        description: documento.id_estatus_verificacion === 2 ? "Documento marcado como no verificado" : "Documento verificado correctamente"
      });

      // 🔹 NUEVO: Si se está verificando un contrato firmado (tipo 18) en cuenta_cobranza
      if (documento.id_estatus_verificacion !== 2 && documento.id_tipo_documento === 18 && entityType === 'cuenta_cobranza' && entityId) {
        console.log('[DocumentsTab] Contrato firmado verificado. Llamando a check-property-sold-status...');
        
        try {
          const { data, error: functionError } = await supabase.functions.invoke('check-property-sold-status', {
            body: { id_cuenta_cobranza: entityId }
          });
          
          if (functionError) {
            console.error('[DocumentsTab] Error al llamar edge function:', functionError);
          } else {
            console.log('[DocumentsTab] Respuesta del edge function:', data);
            
            if (data?.status_changed) {
              toast({
                title: "Propiedad actualizada",
                description: "La propiedad ha sido marcada como Vendida automáticamente",
              });
              
              // Invalidar queries relevantes
              if (onDocumentAdded) {
                onDocumentAdded();
              }
            } else if (data?.conditions_met) {
              const { enganche_completado, contrato_verificado } = data.conditions_met;
              console.log(`[DocumentsTab] Estado actual - Enganche: ${enganche_completado}, Contrato: ${contrato_verificado}`);
            }
          }
        } catch (functionCallError) {
          console.error('[DocumentsTab] Error ejecutando edge function:', functionCallError);
        }
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: `Error al actualizar verificación: ${error.message}` 
      });
    }
  };

  const handleStatusChange = async (newStatus: number, comment: string) => {
    const documento = statusChangeDialog.document;
    if (!documento) return;

    setStatusChangeDialog(prev => ({ ...prev, isLoading: true }));

    try {
      // 🔹 Check if this is a category 7 doc being validated as the last one
      if (newStatus === 2 && entityType === 'cuenta_cobranza' && entityId) {
        // Check if document belongs to category 7
        const isCategory7 = documento.id_categoria_documento === 7;

        if (isCategory7) {
          // Get all category 7 document type IDs
          const { data: tiposCat7 } = await supabase
            .from('tipos_documento')
            .select('id')
            .eq('id_categoria_documento', 7)
            .eq('activo', true);

          if (tiposCat7) {
            const cat7Ids = tiposCat7.map(t => t.id);

            const { data: allCat7Docs } = await supabase
              .from('documentos')
              .select('id, id_estatus_verificacion')
              .eq('id_cuenta_cobranza', entityId)
              .in('id_tipo_documento', cat7Ids)
              .eq('activo', true);

            // Count unverified excluding the current one being validated
            const otherUnverified = allCat7Docs?.filter(
              d => d.id_estatus_verificacion !== 2 && d.id !== documento.id
            ) || [];

            if (otherUnverified.length === 0) {
              // This is the last one! Save context and open confirm entrega dialog
              setPendingStatusChange({
                documentId: documento.id,
                newStatus,
                comment: comment || `Estatus cambiado a Validado`,
              });
              setDocumentoPendienteVerificar(documento);
              setAdminValidation({ isLoading: true, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
              setShowConfirmEntrega(true);
              setStatusChangeDialog({ isOpen: false, document: null, isLoading: false });

              // Run admin validation async
              (async () => {
                try {
                  const cuentaResp = await supabase
                    .from('cuentas_cobranza')
                    .select('id_oferta')
                    .eq('id', entityId)
                    .single();

                  if (!cuentaResp.data?.id_oferta) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }

                  const ofertaResp = await supabase
                    .from('ofertas')
                    .select('id_propiedad')
                    .eq('id', cuentaResp.data.id_oferta)
                    .single();

                  if (!ofertaResp.data?.id_propiedad) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }

                  const propResp = await supabase
                    .from('propiedades')
                    .select('id_entidad_relacionada_dueno')
                    .eq('id', ofertaResp.data.id_propiedad)
                    .single();

                  if (!propResp.data?.id_entidad_relacionada_dueno) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }

                  const entRelResp = await supabase
                    .from('entidades_relacionadas')
                    .select('id_proyecto')
                    .eq('id', propResp.data.id_entidad_relacionada_dueno)
                    .single();

                  if (!entRelResp.data?.id_proyecto) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                    return;
                  }

                  const adminResp = await supabase
                    .from('entidades_relacionadas')
                    .select('id, cuenta_madre_stp, personas!fk_entrel_persona!inner(nombre_legal)')
                    .eq('id_proyecto', entRelResp.data.id_proyecto)
                    .eq('id_tipo_entidad', 6)
                    .eq('activo', true)
                    .maybeSingle();

                  if (!adminResp.data) {
                    setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                  } else {
                    const personaData = adminResp.data.personas as any;
                    setAdminValidation({
                      isLoading: false,
                      hasAdmin: true,
                      adminName: personaData?.nombre_legal || 'Administradora',
                      hasCuentaMadre: !!adminResp.data.cuenta_madre_stp,
                      cuentaMadre: adminResp.data.cuenta_madre_stp || null
                    });
                  }
                } catch (error) {
                  console.error('Error validando administradora:', error);
                  setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                }
              })();

              return; // Don't do normal update - wait for confirm entrega
            }
          }
        }
      }

      // Normal flow: update document status directly
      const { error: updateError } = await supabase
        .from('documentos')
        .update({ id_estatus_verificacion: newStatus })
        .eq('id', documento.id);

      if (updateError) throw updateError;

      // Insert comment into history
      const { error: commentError } = await supabase
        .from('comentarios_verificacion_documento')
        .insert({
          id_documento: documento.id,
          id_estatus_verificacion: newStatus,
          comentario: comment || `Estatus cambiado a ${newStatus === 1 ? 'Pendiente' : newStatus === 2 ? 'Validado' : newStatus === 3 ? 'Rechazado' : 'Expirado'}`,
          email_usuario: user?.email || null,
          activo: true
        });

      if (commentError) throw commentError;

      // Notify client if document was rejected
      if (newStatus === 3) {
        const personaId = documento.id_persona ?? (entityType === 'persona' ? entityId : undefined);
        if (personaId) {
          supabase
            .from('usuarios')
            .select('email')
            .eq('id_persona', personaId)
            .eq('rol_id', 23)
            .maybeSingle()
            .then(({ data: u }) => {
              if (!u?.email) return;
              (supabase as any).from('notificaciones_cliente').insert({
                email_cliente: u.email,
                tipo: 'accionable',
                categoria: 'documentos',
                titulo: `${documento.tipo_documento_nombre ?? 'Documento'} rechazado`,
                descripcion: comment || 'Tu documento fue rechazado. Sube uno nuevo para continuar.',
                url_accion: '/admin/portal-cliente/perfil',
                etiqueta_accion: 'Actualizar documento',
                leida: false,
                descartada: false,
                activo: true,
              });
            })
            .catch(() => {});
        }
      }

      await loadDocumentos();

      toast({
        title: "Éxito",
        description: "Estatus del documento actualizado correctamente"
      });

      setStatusChangeDialog({ isOpen: false, document: null, isLoading: false });

      // Notify parent
      onDocumentAdded?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al cambiar estatus: ${error.message}`
      });
      setStatusChangeDialog(prev => ({ ...prev, isLoading: false }));
    }
  };

  const procesarUltimoDocumento = async () => {
    // 1. Obtener la oferta desde la cuenta de cobranza
    const { data: cuentaData, error: cuentaError } = await supabase
      .from('cuentas_cobranza')
      .select('id_oferta')
      .eq('id', entityId)
      .single();

    if (cuentaError || !cuentaData?.id_oferta) {
      throw new Error('No se pudo obtener la oferta de la cuenta');
    }

    // 2. Obtener la propiedad desde la oferta
    const { data: ofertaData, error: ofertaError } = await supabase
      .from('ofertas')
      .select('id_propiedad')
      .eq('id', cuentaData.id_oferta)
      .single();

    if (ofertaError || !ofertaData?.id_propiedad) {
      throw new Error('No se pudo obtener la propiedad de la oferta');
    }

    // 3. Obtener la entidad relacionada dueño y metros cuadrados desde la propiedad
    const { data: propiedadData, error: propiedadError } = await supabase
      .from('propiedades')
      .select('id_entidad_relacionada_dueno, m2_interiores, m2_exteriores, numero_propiedad')
      .eq('id', ofertaData.id_propiedad)
      .single();

    if (propiedadError || !propiedadData?.id_entidad_relacionada_dueno) {
      throw new Error('No se pudo obtener la entidad dueña de la propiedad');
    }

    // 4. Obtener el proyecto desde la entidad relacionada
    const { data: entidadData, error: entidadError } = await supabase
      .from('entidades_relacionadas')
      .select('id_proyecto')
      .eq('id', propiedadData.id_entidad_relacionada_dueno)
      .single();

    if (entidadError || !entidadData?.id_proyecto) {
      throw new Error('No se pudo obtener el proyecto');
    }

    // 4.1. Obtener el costo_mantenimiento_m2 del proyecto
    const { data: proyectoData, error: proyectoError } = await supabase
      .from('proyectos')
      .select('costo_mantenimiento_m2')
      .eq('id', entidadData.id_proyecto)
      .single();

    if (proyectoError) {
      throw new Error('No se pudo obtener el costo de mantenimiento del proyecto');
    }

    // 5. Obtener la entidad administradora del proyecto CON cuenta madre STP
    const { data: entidadAdmin, error: adminError } = await supabase
      .from('entidades_relacionadas')
      .select('id, cuenta_madre_stp')
      .eq('id_proyecto', entidadData.id_proyecto)
      .eq('id_tipo_entidad', 6) // 6 = Administradora
      .eq('activo', true)
      .single();

    if (adminError || !entidadAdmin) {
      throw new Error('No se encontró la entidad administradora del proyecto');
    }

    // Validar que tenga cuenta madre STP configurada
    if (!entidadAdmin.cuenta_madre_stp) {
      throw new Error('La entidad administradora no tiene cuenta madre STP configurada');
    }

    // 6. Obtener compradores con sus datos
    const { data: compradoresData, error: compradoresError } = await supabase
      .from('compradores')
      .select('id_persona, porcentaje_copropiedad')
      .eq('id_cuenta_cobranza', entityId)
      .eq('activo', true);

    if (compradoresError || !compradoresData || compradoresData.length === 0) {
      throw new Error('No se pudieron obtener los compradores');
    }

    // 7. Obtener los datos de las personas compradoras
    const personaIds = compradoresData.map(c => c.id_persona);
    const { data: personasData, error: personasError } = await supabase
      .from('personas')
      .select('id, nombre_legal, email')
      .in('id', personaIds);

    if (personasError || !personasData) {
      throw new Error('No se pudieron obtener los datos de los compradores');
    }

    const compradoresPayload = personasData.map(p => {
      const compradorData = compradoresData.find(c => c.id_persona === p.id);
      return {
        id_comprador: p.id,
        nombre: p.nombre_legal,
        email: p.email || '',
        porcentaje_copropiedad: compradorData?.porcentaje_copropiedad || 0
      };
    });

    // 8. Llamar al webhook de N8N
    const response = await fetch(`${N8N_WEBHOOK_BASE_URL}/generaCuentaMantenimiento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id_cuenta_cobranza: entityId,
        id_entidad_administrador: entidadAdmin.id,
        compradores: compradoresPayload,
        costo_mantenimiento_m2: proyectoData?.costo_mantenimiento_m2 || 0,
        m2_escriturables: ((propiedadData?.m2_interiores || 0) + (propiedadData?.m2_exteriores || 0)),
        id_propiedad: ofertaData.id_propiedad,
        numero_propiedad: propiedadData?.numero_propiedad || '',
        environment: ENVIRONMENT
      }),
    });

    if (!response.ok) {
      throw new Error('Error al generar cuenta de mantenimiento');
    }

    const result = await response.json();

    toast({
      title: "Cuenta de mantenimiento generada",
      description: `CLABE STP: ${result.clabe_stp || 'N/A'}`,
      duration: 8000
    });

    // Recargar documentos
    await loadDocumentos();
  };

  if (!entityId && pendingDocuments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Documentos</h3>
          <Button type="button" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir Documento
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="text-center py-6">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-center">
                Puedes agregar documentos que se guardarán al crear la persona
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subir Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tipo-documento">Tipo de Documento</Label>
                <Select value={selectedTipoDocumento} onValueChange={setSelectedTipoDocumento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDocumento
                      .filter((tipo) => {
                        // Filter out document types that are already added (in saved or pending documents)
                        const existsInSaved = documentos.some(doc => doc.id_tipo_documento === tipo.id && doc.activo);
                        const existsInPending = pendingDocuments.some(doc => doc.tipoDocumento === tipo.id.toString());
                        
                        // Filter out invoice types when shouldAutoGenerateInvoice is true (owner doesn't have facturar enabled)
                        const isInvoiceType = tipo.nombre.toLowerCase().includes('factura');
                        if (shouldAutoGenerateInvoice && isInvoiceType) {
                          return false;
                        }
                        
                        return !existsInSaved && !existsInPending;
                      })
                      .map((tipo) => {
                        return (
                          <SelectItem 
                            key={tipo.id} 
                            value={tipo.id.toString()}
                          >
                            {tipo.nombre}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="numero-documento-temp">Número de Documento (Opcional)</Label>
                <Input
                  id="numero-documento-temp"
                  type="number"
                  placeholder="Ej: 12345"
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="file">Archivo</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setSelectedFile(null);
                  setSelectedTipoDocumento("");
                  setNumeroDocumento("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || !selectedTipoDocumento}
              >
                Agregar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {isLoading ? 'Cargando...' : `${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setIsUploadDialogOpen(true)}
          disabled={isReadOnly}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Upload className="size-3.5" />Subir documento
        </button>
      </div>

      {hasInvoices && entityType === 'cuenta_cobranza' && (
        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-[12px] text-blue-700 dark:text-blue-300">
            Las facturas se muestran en la pestaña Facturas
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px] text-muted-foreground">Cargando documentos...</p>
        </div>
      ) : documentos.length === 0 && pendingDocuments.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <FileText className="h-7 w-7 mx-auto text-muted-foreground/20" />
          <p className="text-[13px] text-muted-foreground">No hay documentos adjuntos</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="sozu-thead">
                {['Tipo de documento', 'Número', 'Estatus', 'Fecha', ''].map((h, i) => (
                  <th key={i} className={cn('px-3 py-2.5 text-[10px] whitespace-nowrap', i === 2 && 'text-center', i === 4 && 'text-center w-px')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Pending documents */}
              {pendingDocuments.map((pendingDoc) => {
                const tipoDocumentoNombre = tiposDocumento.find(t => t.id.toString() === pendingDoc.tipoDocumento)?.nombre || 'Tipo desconocido';
                return (
                  <tr key={pendingDoc.tempId} className="border-b border-border/50 bg-muted/20">
                    <td className="px-3 py-2.5 text-[12px]">{tipoDocumentoNombre}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">-</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-muted-foreground">{new Date().toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 text-center">
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeletePending(pendingDoc.tempId)}
                          title="Eliminar"
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Saved documents */}
              {documentos.map((documento, index) => {
                const estatusCfg = documento.id_estatus_verificacion === 2
                  ? { label: 'Validado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                  : documento.id_estatus_verificacion === 3
                  ? { label: 'Rechazado', cls: 'bg-red-50 text-red-700 border-red-200' }
                  : documento.id_estatus_verificacion === 4
                  ? { label: 'Expirado', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
                  : { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
                return (
                  <tr key={`${documento.numero}-${index}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px]">{documento.tipo_documento_nombre}</span>
                        {documento.id_categoria_documento === 6 && (
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700">Escrituración</span>
                        )}
                        {documento.id_categoria_documento === 7 && (
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">Entrega</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{documento.numero || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', estatusCfg.cls)}>{estatusCfg.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(documento.fecha_creacion).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          title="Ver documento"
                          onClick={() => setViewerDialog({ isOpen: true, url: documento.url, title: documento.tipo_documento_nombre || 'Documento' })}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Ver historial de verificación"
                          onClick={() => setHistoryDialog({ isOpen: true, documentId: documento.id, documentName: documento.tipo_documento_nombre || 'Documento' })}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <History className="size-3.5" />
                        </button>
                        {!isReadOnly && !hideStatusChange && canEditStatus && (
                          <button
                            type="button"
                            title="Cambiar estatus"
                            onClick={() => setStatusChangeDialog({ isOpen: true, document: documento, isLoading: false })}
                            className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit className="size-3.5" />
                          </button>
                        )}
                        {!isReadOnly && (
                          <button
                            type="button"
                            title="Eliminar documento"
                            onClick={() => setDocumentToDelete(documento)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Viewer Dialog */}
      <Dialog open={viewerDialog.isOpen} onOpenChange={(open) => setViewerDialog({ ...viewerDialog, isOpen: open })}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-3 border-b shrink-0">
            <DialogTitle>{viewerDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={`${viewerDialog.url}#page=1&view=FitH`}
              className="w-full h-full border-0"
              title={viewerDialog.title}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tipo-documento">Tipo de Documento</Label>
              <Select value={selectedTipoDocumento} onValueChange={setSelectedTipoDocumento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de documento" />
                </SelectTrigger>
                <SelectContent>
                  {tiposDocumento
                    .filter((tipo) => {
                      // Filter out invoice types when shouldAutoGenerateInvoice is true (owner doesn't have facturar enabled)
                      const isInvoiceType = tipo.nombre.toLowerCase().includes('factura');
                      if (shouldAutoGenerateInvoice && isInvoiceType) {
                        return false;
                      }
                      
                      return true;
                    })
                    .map((tipo) => {
                      const isDeliveryDoc = tipo.id_categoria_documento === 7;
                      return (
                        <SelectItem 
                          key={tipo.id} 
                          value={tipo.id.toString()}
                        >
                          {tipo.nombre}
                          {isDeliveryDoc && (
                            <span className="ml-2 text-xs text-primary font-medium">(Doc. Entrega)</span>
                          )}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="numero-documento">Número de Documento (Opcional)</Label>
              <Input
                id="numero-documento"
                type="text"
                placeholder="Ej: ABC123"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
              />
            </div>
            {/* Selector de comprador para facturas cuando dueño NO factura */}
            {(() => {
              const tipoDoc = tiposDocumento.find(t => t.id.toString() === selectedTipoDocumento);
              const isInvoice = tipoDoc?.nombre.toLowerCase().includes('factura');
              return isInvoice && !shouldAutoGenerateInvoice && entityType === 'cuenta_cobranza' && compradores.length > 0 && (
                <div>
                  <Label htmlFor="comprador">Comprador</Label>
                  <Select value={selectedComprador} onValueChange={setSelectedComprador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el comprador" />
                    </SelectTrigger>
                    <SelectContent>
                      {compradores.map((comprador) => (
                        <SelectItem key={comprador.id_persona} value={comprador.id_persona.toString()}>
                          {comprador.nombre_legal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div>
              <Label htmlFor="file">Archivo</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
                setSelectedTipoDocumento("");
                setNumeroDocumento("");
                setSelectedComprador("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || !selectedTipoDocumento || isUploading}
            >
              {isUploading ? "Subiendo..." : entityId ? "Subir" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmEntrega} onOpenChange={(open) => {
        setShowConfirmEntrega(open);
        if (!open) {
          setDocumentoPendienteVerificar(null);
          setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
          setPendingStatusChange(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar entrega de propiedad?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Este es el último documento de entrega pendiente por verificar.</p>
                
                {/* Validación de Administradora */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-semibold text-foreground">Validación de prerequisitos:</p>
                  
                  {adminValidation.isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verificando configuración...</span>
                    </div>
                  ) : (
                    <>
                      {/* Estado de Administradora */}
                      <div className={`flex items-start gap-2 ${adminValidation.hasAdmin ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                        {adminValidation.hasAdmin ? (
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        )}
                        <span>
                          {adminValidation.hasAdmin 
                            ? `Administradora: ${adminValidation.adminName}` 
                            : 'No hay entidad Administradora configurada en el proyecto'}
                        </span>
                      </div>
                      
                      {/* Estado de Cuenta Madre STP */}
                      {adminValidation.hasAdmin && (
                        <div className={`flex items-start gap-2 ${adminValidation.hasCuentaMadre ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                          {adminValidation.hasCuentaMadre ? (
                            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          )}
                          <span>
                            {adminValidation.hasCuentaMadre 
                              ? `Cuenta madre STP: ${adminValidation.cuentaMadre}` 
                              : 'La Administradora no tiene cuenta madre STP configurada'}
                          </span>
                        </div>
                      )}
                      
                      {/* Mensaje de error si falta algo */}
                      {(!adminValidation.hasAdmin || !adminValidation.hasCuentaMadre) && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Configure los prerequisitos en la sección de Entidades Legales del proyecto antes de continuar.
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                {/* Advertencia solo si todo está bien */}
                {adminValidation.hasAdmin && adminValidation.hasCuentaMadre && (
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Esta acción es IRREVOCABLE
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                      <li>El documento se verificará</li>
                      <li>La propiedad cambiará a estatus "Entregado"</li>
                      <li>Se generará automáticamente una cuenta de cobranza de mantenimiento</li>
                      <li>Todas las secciones quedarán en modo solo lectura</li>
                    </ul>
                  </div>
                )}
                
                <p className="text-sm font-medium pt-2">¿Desea continuar con la entrega?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminValidation.isLoading || !adminValidation.hasAdmin || !adminValidation.hasCuentaMadre}
              onClick={async () => {
                setShowConfirmEntrega(false);
                
                if (!documentoPendienteVerificar) return;
                
                try {
                  // 1. Primero llamar al webhook - CRÍTICO: webhook debe ejecutarse ANTES de verificar
                  await procesarUltimoDocumento();
                  
                  // 2. Solo si el webhook fue exitoso, verificar el documento (estatus 2 = Validado)
                  const { error: verifyError } = await supabase
                    .from('documentos')
                    .update({ id_estatus_verificacion: 2 })
                    .eq('id', documentoPendienteVerificar.id);
                  
                  if (verifyError) throw verifyError;

                  // 3. If this came from status change dialog, insert the comment
                  if (pendingStatusChange && pendingStatusChange.documentId === documentoPendienteVerificar.id) {
                    const { error: commentError } = await supabase
                      .from('comentarios_verificacion_documento')
                      .insert({
                        id_documento: pendingStatusChange.documentId,
                        id_estatus_verificacion: pendingStatusChange.newStatus,
                        comentario: pendingStatusChange.comment,
                        email_usuario: user?.email || null,
                        activo: true
                      });
                    
                    if (commentError) {
                      console.error('Error insertando comentario:', commentError);
                    }
                    setPendingStatusChange(null);
                  }
                  
                  // 4. Recargar documentos
                  await loadDocumentos();
                  
                  // 5. Limpiar estado
                  setDocumentoPendienteVerificar(null);
                  setAdminValidation({ isLoading: false, hasAdmin: false, adminName: null, hasCuentaMadre: false, cuentaMadre: null });
                  
                  // 6. Notify parent
                  onDocumentAdded?.();
                } catch (error: any) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: `Error al procesar: ${error.message}`
                  });
                }
              }}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Entrega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document History Dialog */}
      <DocumentHistoryDialog
        isOpen={historyDialog.isOpen}
        onClose={() => setHistoryDialog({ isOpen: false, documentId: null, documentName: '' })}
        documentId={historyDialog.documentId}
        documentName={historyDialog.documentName}
      />

      {/* Document Status Change Dialog */}
      <DocumentStatusChangeDialog
        isOpen={statusChangeDialog.isOpen}
        onClose={() => setStatusChangeDialog({ isOpen: false, document: null, isLoading: false })}
        onConfirm={handleStatusChange}
        currentStatus={statusChangeDialog.document?.id_estatus_verificacion || 1}
        documentName={statusChangeDialog.document?.tipo_documento_nombre || 'Documento'}
        isLoading={statusChangeDialog.isLoading}
      />

      {/* Delete Document Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!documentToDelete}
        onOpenChange={(open) => !open && setDocumentToDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar documento?"
        description={`¿Estás seguro de que deseas eliminar el documento "${documentToDelete?.tipo_documento_nombre || 'seleccionado'}"? Esta acción no se puede deshacer.`}
        isLoading={isDeleting}
      />
    </div>
  );
}