import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Edit, Wand2, Trash2, Image as ImageIcon, Camera, Images } from "lucide-react";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadField } from "./ImageUploadField";
import { optimizedImage } from "@/lib/image-transform";

interface EditAmenityDialogProps {
  amenityId: number;
  amenityName: string;
  onAmenityUpdated?: () => void;
  onAmenityDeleted?: () => void;
  trigger?: React.ReactNode;
  /** Foto real de ESTA amenidad en el proyecto actual (por proyecto, no compartida).
   *  Solo se muestra la sección si se pasa onProjectImageChange. */
  projectImageUrl?: string;
  onProjectImageChange?: (url: string) => void;
  /** Proyecto actual. Habilita elegir la foto real desde la multimedia ya cargada. */
  projectId?: number;
}

export function EditAmenityDialog({
  amenityId,
  amenityName: initialName,
  onAmenityUpdated,
  onAmenityDeleted,
  trigger,
  projectImageUrl,
  onProjectImageChange,
  projectId,
}: EditAmenityDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amenityName, setAmenityName] = useState(initialName);
  const [iconUrl, setIconUrl] = useState("");
  const [iconDescription, setIconDescription] = useState("");
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);

  // Id de la categoría/etiqueta "Amenidades" para priorizar esas imágenes en el picker.
  const { data: amenidadCatId = null } = useQuery({
    queryKey: ['categoriaAmenidadesId'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_multimedia_proyecto')
        .select('id, nombre')
        .ilike('nombre', 'amenidades')
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: open && showPicker,
  });

  // Imágenes ya cargadas en la Multimedia del proyecto — para asignar como foto real
  // sin volver a subirlas (el usuario pudo subirlas directo en Multimedia).
  const { data: projectMultimedia = [] } = useQuery({
    queryKey: ['amenityMultimediaPicker', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multimedias_proyecto')
        .select('id, url, es_imagen, activo, id_categoria')
        .eq('id_proyecto', projectId as number)
        .eq('es_imagen', true)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && showPicker && projectId != null,
  });

  // Por defecto solo las etiquetadas "Amenidades" (orden); toggle "Ver todas" como respaldo.
  const pickerImages =
    !showAllCats && amenidadCatId != null
      ? projectMultimedia.filter((m) => m.id_categoria === amenidadCatId)
      : projectMultimedia;

  // Fetch amenity details when dialog opens
  const { data: amenityDetails } = useQuery({
    queryKey: ['amenidad', amenityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenidades')
        .select('*')
        .eq('id', amenityId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!amenityId
  });

  useEffect(() => {
    if (amenityDetails) {
      setAmenityName(amenityDetails.nombre);
      setIconUrl(amenityDetails.url || "");
      // Auto-populate description with amenity name when opening AI generator
      if (showAiGenerator && !iconDescription) {
        setIconDescription(`Icono de ${amenityDetails.nombre.toLowerCase()}, estilo minimalista`);
      }
    }
  }, [amenityDetails, showAiGenerator]);

  const updateAmenityMutation = useMutation({
    mutationFn: async (amenityData: { name: string; iconUrl: string }) => {
      const { data, error } = await supabase
        .from('amenidades')
        .update({
          nombre: amenityData.name,
          url: amenityData.iconUrl,
        })
        .eq('id', amenityId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenidades'] });
      queryClient.invalidateQueries({ queryKey: ['amenidad', amenityId] });
      setOpen(false);
      resetForm();
      onAmenityUpdated?.();
      toast({ title: "Amenidad actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar amenidad", variant: "destructive" });
    }
  });

  const deleteAmenityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('amenidades')
        .update({ activo: false })
        .eq('id', amenityId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenidades'] });
      setOpen(false);
      resetForm();
      onAmenityDeleted?.();
      toast({ title: "Amenidad eliminada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar amenidad", variant: "destructive" });
    }
  });

  const generateIconMutation = useMutation({
    mutationFn: async (description: string) => {
      console.log('🔧 Iniciando generación de icono con descripción:', description, 'y nombre:', amenityName);
      const { data, error } = await supabase.functions.invoke('generate-amenity-icon', {
        body: { 
          description: description,
          amenityName: amenityName
        }
      });
      
      console.log('🔧 Respuesta de generate-amenity-icon:', { data, error });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('🔧 Éxito en generar icono, data recibida:', data);
      if (data?.iconUrl) {
        console.log('🔧 Estableciendo iconUrl:', data.iconUrl);
        setIconUrl(data.iconUrl);
        setShowAiGenerator(false);
        setIconDescription("");
        toast({ title: "Icono generado exitosamente" });
        
        // Guardar automáticamente en la BD
        console.log('🔧 Guardando automáticamente en BD...');
        updateAmenityMutation.mutate({
          name: amenityName.trim(),
          iconUrl: data.iconUrl
        });
      } else {
        console.log('🔧 Error: No se encontró iconUrl en la respuesta:', data);
        toast({ title: "Error: No se pudo obtener la URL del icono", variant: "destructive" });
      }
    },
    onError: (error) => {
      console.error('🔧 Error generating icon:', error);
      toast({ title: "Error al generar icono", variant: "destructive" });
    }
  });

  const handleUpdate = () => {
    if (!amenityName.trim()) {
      toast({ title: "Por favor ingresa un nombre para la amenidad", variant: "destructive" });
      return;
    }

    updateAmenityMutation.mutate({
      name: amenityName.trim(),
      iconUrl: iconUrl.trim()
    });
  };

  const handleDelete = () => {
    if (confirm("¿Estás seguro de que quieres eliminar esta amenidad? Esta acción no se puede deshacer.")) {
      deleteAmenityMutation.mutate();
    }
  };

  const handleGenerateIcon = () => {
    if (!iconDescription.trim()) {
      toast({ title: "Por favor ingresa una descripción para el icono", variant: "destructive" });
      return;
    }

    console.log('🔧 Iniciando generación de icono...');
    setIsGeneratingIcon(true);
    generateIconMutation.mutate(iconDescription.trim());
  };

  useEffect(() => {
    if (!generateIconMutation.isPending) {
      setIsGeneratingIcon(false);
    }
  }, [generateIconMutation.isPending]);

  const resetForm = () => {
    setAmenityName(initialName);
    setIconUrl("");
    setIconDescription("");
    setShowAiGenerator(false);
    setIsGeneratingIcon(false);
    setShowPicker(false);
    setShowAllCats(false);
  };

  const defaultTrigger = (
    <IconTooltip label="Editar amenidad">
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Editar amenidad">
        <Edit className="h-3.5 w-3.5" />
      </Button>
    </IconTooltip>
  );

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <div 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'contents' }}
      >
        {trigger || defaultTrigger}
      </div>
      
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Amenidad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-1">
          <div>
            <Label htmlFor="amenity-name">Nombre de la Amenidad</Label>
            <Input
              id="amenity-name"
              value={amenityName}
              onChange={(e) => setAmenityName(e.target.value)}
              placeholder="Ej: Piscina, Gimnasio, Área de juegos..."
              className="mt-1"
            />
          </div>

          <div className={`grid gap-4 ${onProjectImageChange ? "md:grid-cols-2" : ""}`}>
            {/* Columna: Icono (catálogo global) */}
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold leading-none">Icono</h4>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Símbolo del tipo de amenidad. Compartido en todos los proyectos.
                </p>
              </div>

              <ImageUploadField
                label="Icono de la amenidad"
                variant="card"
                value={iconUrl}
                onChange={setIconUrl}
                accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAiGenerator(!showAiGenerator)}
                className="w-full gap-2"
              >
                <Wand2 className="h-4 w-4" />
                {showAiGenerator ? "Ocultar generador IA" : "Generar con IA"}
              </Button>

              {showAiGenerator && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div>
                    <Label htmlFor="icon-description" className="text-xs">Descripción para el icono</Label>
                    <Textarea
                      id="icon-description"
                      value={iconDescription}
                      onChange={(e) => setIconDescription(e.target.value)}
                      placeholder={`Ej: Icono de ${amenityName.toLowerCase()}, estilo minimalista...`}
                      className="mt-1"
                      rows={2}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGenerateIcon}
                    disabled={isGeneratingIcon || !iconDescription.trim()}
                    className="w-full gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    {isGeneratingIcon ? "Generando..." : "Generar Icono"}
                  </Button>
                </div>
              )}
            </div>

            {/* Columna: Foto real (por proyecto) */}
            {onProjectImageChange && (
              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Camera className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-semibold leading-none">Foto real</h4>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Foto real de esta amenidad en este proyecto. Se usa en oferta y portales. Opcional; no se comparte con otros proyectos.
                  </p>
                </div>

                <ImageUploadField
                  label="Foto real de esta amenidad"
                  variant="card"
                  value={projectImageUrl || ""}
                  onChange={(url) => onProjectImageChange(url)}
                  accept="image/*"
                />

                {projectId != null && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPicker(!showPicker)}
                      className="w-full gap-2"
                    >
                      <Images className="h-4 w-4" />
                      {showPicker ? "Ocultar multimedia" : "Elegir de Multimedia"}
                    </Button>

                    {showPicker && (
                      <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {showAllCats ? "Todas las etiquetas" : "Etiqueta: Amenidades"}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setShowAllCats(!showAllCats)}
                          >
                            {showAllCats ? "Solo Amenidades" : "Ver todas"}
                          </Button>
                        </div>
                        {pickerImages.length > 0 ? (
                          <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto">
                            {pickerImages.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  onProjectImageChange(m.url);
                                  setShowPicker(false);
                                  toast({ title: "Foto asignada desde Multimedia" });
                                }}
                                className={`relative aspect-square overflow-hidden rounded-md border transition-colors hover:border-primary ${
                                  projectImageUrl === m.url ? "border-primary ring-2 ring-primary" : "border-border"
                                }`}
                                aria-label="Usar esta imagen como foto real"
                              >
                                <img
                                  src={optimizedImage(m.url, { width: 160 })}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            {showAllCats
                              ? "No hay imágenes en la Multimedia del proyecto"
                              : 'No hay imágenes con etiqueta "Amenidades". Usa "Ver todas".'}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteAmenityMutation.isPending}
            className="mr-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteAmenityMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateAmenityMutation.isPending}
            >
              {updateAmenityMutation.isPending ? "Actualizando..." : "Actualizar Amenidad"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}