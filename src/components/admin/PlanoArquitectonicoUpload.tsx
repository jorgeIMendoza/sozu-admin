import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ImagePlus, Trash2, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Upload, Check, X, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanoArquitectonicoUploadProps {
  currentUrl?: string | null;
  onUrlChange: (url: string | null) => void;
  modeloId?: number;
  proyectoId?: string;
}

interface EdificioModeloInfo {
  id: number;
  id_edificio: number;
  edificio_nombre: string;
  niveles: number;
}

interface NivelPlanoData {
  nivel: number;
  planoUbicacionConfigured: boolean;
  departamentos: string[];
  planoArquitectonico: {
    id?: number;
    imagen_url: string;
    nombre_original: string;
    departamentos_asignados: string[];
  } | null;
}

interface UploadingState {
  edificioModeloId: number;
  nivel: number;
  uploading: boolean;
  validating: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const chunkSize = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      resolve(btoa(binary));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function PlanoArquitectonicoUpload({ currentUrl, onUrlChange, modeloId, proyectoId }: PlanoArquitectonicoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedEdificios, setExpandedEdificios] = useState<Set<number>>(new Set());
  const [expandedNiveles, setExpandedNiveles] = useState<Set<string>>(new Set());
  const [uploadingState, setUploadingState] = useState<UploadingState | null>(null);
  const [deptSelections, setDeptSelections] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{ emId: number; nivel: number } | null>(null);

  // If no modeloId, show simple upload (for new model creation)
  if (!modeloId) {
    return <SimplePlanoUpload currentUrl={currentUrl} onUrlChange={onUrlChange} />;
  }

  // Fetch edificios_modelos for this modelo
  const { data: edificiosModelos } = useQuery({
    queryKey: ["edificios-modelos-for-modelo", modeloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edificios_modelos")
        .select("id, id_edificio, edificios:edificios_modelos_id_edificio_fkey(nombre, numero_pisos)")
        .eq("id_modelo", modeloId)
        .eq("activo", true);
      if (error) throw error;
      return (data || []).map((em: any) => ({
        id: em.id,
        id_edificio: em.id_edificio,
        edificio_nombre: em.edificios?.nombre || "Edificio",
        niveles: parseInt(em.edificios?.numero_pisos || "0", 10),
      })) as EdificioModeloInfo[];
    },
    enabled: !!modeloId,
  });

  // Fetch existing planos de ubicacion for all edificios
  const edificioIds = (edificiosModelos || []).map(em => em.id_edificio);
  const { data: planosUbicacion } = useQuery({
    queryKey: ["planos-ubicacion-for-edificios", edificioIds],
    queryFn: async () => {
      if (edificioIds.length === 0) return [];
      const { data, error } = await supabase
        .from("edificios_niveles_planos" as any)
        .select("id, id_edificio, nivel, regiones")
        .in("id_edificio", edificioIds)
        .eq("activo", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: edificioIds.length > 0,
  });

  // Fetch existing architectural plans
  const emIds = (edificiosModelos || []).map(em => em.id);
  const { data: existingPlanos, refetch: refetchPlanos } = useQuery({
    queryKey: ["modelos-planos-arquitectonicos", emIds],
    queryFn: async () => {
      if (emIds.length === 0) return [];
      const { data, error } = await supabase
        .from("modelos_planos_arquitectonicos" as any)
        .select("*")
        .in("id_edificio_modelo", emIds)
        .eq("activo", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: emIds.length > 0,
  });

  const getNivelesData = (em: EdificioModeloInfo): NivelPlanoData[] => {
    const niveles: NivelPlanoData[] = [];
    for (let n = 1; n <= em.niveles; n++) {
      const planoUbicacion = (planosUbicacion || []).find(
        (p: any) => p.id_edificio === em.id_edificio && p.nivel === n
      );
      const regiones = Array.isArray(planoUbicacion?.regiones)
        ? planoUbicacion.regiones
        : [];
      const departamentos = regiones
        .filter((r: any) => {
          const un = (r?.unit_number ?? "").toString().trim();
          return un.length > 0 && Array.isArray(r?.polygon) && r.polygon.length >= 3;
        })
        .map((r: any) => (r.unit_number ?? "").toString().trim());

      const existingPlano = (existingPlanos || []).find(
        (p: any) => p.id_edificio_modelo === em.id && p.nivel === n && p.activo
      );

      niveles.push({
        nivel: n,
        planoUbicacionConfigured: departamentos.length > 0,
        departamentos,
        planoArquitectonico: existingPlano
          ? {
              id: existingPlano.id,
              imagen_url: existingPlano.imagen_url,
              nombre_original: existingPlano.nombre_original,
              departamentos_asignados: Array.isArray(existingPlano.departamentos) ? existingPlano.departamentos : [],
            }
          : null,
      });
    }
    return niveles;
  };

  const handleUploadClick = (emId: number, nivel: number) => {
    setPendingUpload({ emId, nivel });
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUpload) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const { emId, nivel } = pendingUpload;
    setUploadingState({ edificioModeloId: emId, nivel, uploading: true, validating: true });

    try {
      // Validate via AI
      const base64 = await fileToBase64(file);
      const { data: validationResult, error: fnError } = await supabase.functions.invoke("validate-architectural-plan", {
        body: { imageBase64: base64 },
      });

      if (fnError) throw fnError;

      if (!validationResult?.is_valid) {
        toast({
          title: "Imagen no válida",
          description: validationResult?.rejection_reason || "La imagen no parece ser un plano arquitectónico.",
          variant: "destructive",
        });
        setUploadingState(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploadingState(prev => prev ? { ...prev, validating: false } : null);

      // Upload to storage
      const fileName = file.name;
      const filePath = `planos-arquitectonicos/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("modelos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("modelos")
        .getPublicUrl(filePath);

      // Get all departments for this nivel
      const em = (edificiosModelos || []).find(e => e.id === emId);
      const nivelData = em ? getNivelesData(em).find(n => n.nivel === nivel) : null;
      const allDepts = nivelData?.departamentos || [];

      // Deactivate existing plan for this nivel
      const existing = (existingPlanos || []).find(
        (p: any) => p.id_edificio_modelo === emId && p.nivel === nivel && p.activo
      );
      if (existing) {
        await supabase
          .from("modelos_planos_arquitectonicos" as any)
          .update({ activo: false, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }

      // Insert new plan
      await supabase
        .from("modelos_planos_arquitectonicos" as any)
        .insert({
          id_edificio_modelo: emId,
          nivel,
          imagen_url: publicUrl,
          storage_path: filePath,
          nombre_original: fileName,
          departamentos: allDepts,
        });

      toast({
        title: "Plano arquitectónico subido",
        description: `${fileName} asignado al nivel ${nivel} con ${allDepts.length} departamentos.`,
      });

      refetchPlanos();
    } catch (error: any) {
      console.error("Error uploading architectural plan:", error);
      toast({
        title: "Error",
        description: error.message || "Error al subir el plano.",
        variant: "destructive",
      });
    } finally {
      setUploadingState(null);
      setPendingUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePlano = async (planoId: number) => {
    try {
      await supabase
        .from("modelos_planos_arquitectonicos" as any)
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq("id", planoId);
      toast({ title: "Plano eliminado" });
      refetchPlanos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeptToggle = async (planoId: number, dept: string, currentDepts: string[]) => {
    const newDepts = currentDepts.includes(dept)
      ? currentDepts.filter(d => d !== dept)
      : [...currentDepts, dept];

    try {
      await supabase
        .from("modelos_planos_arquitectonicos" as any)
        .update({ departamentos: newDepts, updated_at: new Date().toISOString() })
        .eq("id", planoId);
      refetchPlanos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleEdificio = (emId: number) => {
    setExpandedEdificios(prev => {
      const next = new Set(prev);
      if (next.has(emId)) next.delete(emId); else next.add(emId);
      return next;
    });
  };

  const toggleNivel = (key: string) => {
    setExpandedNiveles(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (!edificiosModelos || edificiosModelos.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Plano Arquitectónico</Label>
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-warning" />
          <p className="text-xs text-muted-foreground">
            Este modelo no está asignado a ningún edificio. Primero vincúlalo a un edificio en la sección de Edificios del proyecto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Planos Arquitectónicos por Piso</Label>
      <p className="text-[10px] text-muted-foreground">
        Sube planos arquitectónicos por piso. Solo se permite si el plano de ubicación del piso ya está configurado y enmallado.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {edificiosModelos.map((em) => {
          const niveles = getNivelesData(em);
          const isExpanded = expandedEdificios.has(em.id);
          const configuredCount = niveles.filter(n => n.planoArquitectonico).length;

          return (
            <Collapsible key={em.id} open={isExpanded} onOpenChange={() => toggleEdificio(em.id)}>
              <CollapsibleTrigger className="w-full flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium flex-1 text-left">{em.edificio_nombre}</span>
                <Badge variant="outline" className="text-[9px]">
                  {configuredCount}/{em.niveles} pisos
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1 pl-4">
                {niveles.map((nivel) => {
                  const nivelKey = `${em.id}-${nivel.nivel}`;
                  const isNivelExpanded = expandedNiveles.has(nivelKey);
                  const isUploading = uploadingState?.edificioModeloId === em.id && uploadingState?.nivel === nivel.nivel;

                  if (!nivel.planoUbicacionConfigured) {
                    return (
                      <div key={nivel.nivel} className="flex items-center gap-2 py-1.5 px-2 rounded border border-dashed border-border bg-muted/10">
                        <span className="text-[10px] font-medium text-muted-foreground w-8">N{nivel.nivel}</span>
                        <AlertTriangle className="h-3 w-3 text-warning/60" />
                        <span className="text-[9px] text-muted-foreground">
                          Plano de ubicación no configurado
                        </span>
                      </div>
                    );
                  }

                  if (nivel.planoArquitectonico) {
                    return (
                      <Collapsible key={nivel.nivel} open={isNivelExpanded} onOpenChange={() => toggleNivel(nivelKey)}>
                        <div className="flex items-center gap-2 py-1.5 px-2 rounded border border-primary/20 bg-primary/5">
                          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0">
                            {isNivelExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="text-[10px] font-bold text-primary w-8">N{nivel.nivel}</span>
                            <Check className="h-3 w-3 text-success" />
                            <span className="text-[9px] text-foreground truncate flex-1 text-left">
                              {nivel.planoArquitectonico.nombre_original}
                            </span>
                          </CollapsibleTrigger>
                          <Badge variant="outline" className="text-[8px] flex-shrink-0">
                            {nivel.planoArquitectonico.departamentos_asignados.length} deptos
                          </Badge>
                          <button
                            onClick={() => handleDeletePlano(nivel.planoArquitectonico!.id!)}
                            className="p-1 hover:bg-destructive/10 rounded flex-shrink-0"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                        <CollapsibleContent className="mt-1 ml-6 space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-muted-foreground font-medium">Departamentos asignados:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {nivel.departamentos.map(dept => {
                              const isAssigned = nivel.planoArquitectonico!.departamentos_asignados.includes(dept);
                              return (
                                <label
                                  key={dept}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border cursor-pointer transition-colors",
                                    isAssigned
                                      ? "bg-primary/10 border-primary/30 text-primary"
                                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                                  )}
                                >
                                  <Checkbox
                                    checked={isAssigned}
                                    onCheckedChange={() =>
                                      handleDeptToggle(
                                        nivel.planoArquitectonico!.id!,
                                        dept,
                                        nivel.planoArquitectonico!.departamentos_asignados
                                      )
                                    }
                                    className="h-2.5 w-2.5"
                                  />
                                  {dept}
                                </label>
                              );
                            })}
                          </div>
                          <div className="mt-1">
                            <img
                              src={nivel.planoArquitectonico.imagen_url}
                              alt={nivel.planoArquitectonico.nombre_original}
                              className="w-full h-24 object-contain rounded border border-border bg-background"
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }

                  return (
                    <div key={nivel.nivel} className="flex items-center gap-2 py-1.5 px-2 rounded border border-border bg-card hover:bg-muted/20 transition-colors">
                      <span className="text-[10px] font-medium text-muted-foreground w-8">N{nivel.nivel}</span>
                      <span className="text-[9px] text-muted-foreground flex-1">
                        {nivel.departamentos.length} deptos disponibles
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[9px] px-2"
                        onClick={() => handleUploadClick(em.id, nivel.nivel)}
                        disabled={!!isUploading}
                      >
                        {isUploading && uploadingState?.validating ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Validando IA...</>
                        ) : isUploading ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Subiendo...</>
                        ) : (
                          <><Upload className="h-3 w-3 mr-1" /> Subir plano</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// Simple fallback for new model creation (no modeloId yet)
function SimplePlanoUpload({ currentUrl, onUrlChange }: { currentUrl?: string | null; onUrlChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileName = file.name;
      const filePath = `planos-arquitectonicos/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("modelos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("modelos")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onUrlChange(publicUrl);
      toast({ title: "Imagen subida exitosamente" });
    } catch (error) {
      console.error("Error uploading:", error);
      toast({ title: "Error al subir la imagen", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUrlChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>Plano Arquitectónico</Label>
      <p className="text-[10px] text-muted-foreground">
        Sube un plano general. Después de crear el modelo y asignarlo a un edificio, podrás configurar planos por piso.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {previewUrl ? (
        <div className="relative border border-border rounded-lg overflow-hidden">
          <img
            src={previewUrl}
            alt="Plano arquitectónico"
            className="w-full h-48 object-contain bg-muted/20"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed flex flex-col gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Subir imagen del plano</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
