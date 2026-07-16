import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Power, PowerOff, Plus, Upload, Play, X, Images, Youtube, ExternalLink, Tag, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { optimizedImage } from "@/lib/image-transform";
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

interface ProjectMultimediaSectionProps {
  projectId: number;
}

export function ProjectMultimediaSection({ projectId }: ProjectMultimediaSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const [confirmYoutubeOpen, setConfirmYoutubeOpen] = useState(false);
  const [newMultimedia, setNewMultimedia] = useState({
    es_imagen: true,
    url: "",
    id_categoria: null as number | null
  });
  const [filterCategoria, setFilterCategoria] = useState<number | "all">("all");
  const [youtubeForm, setYoutubeForm] = useState({
    nombre: '',
    link: ''
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const { data: multimedia = [] } = useQuery({
    queryKey: ['projectMultimedia', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multimedias_proyecto')
        .select('*')
        .eq('id_proyecto', projectId)
        .order('fecha_creacion', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categoriasMultimediaProyecto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_multimedia_proyecto')
        .select('id, nombre, orden')
        .eq('activo', true)
        .order('orden');

      if (error) throw error;
      return data || [];
    }
  });

  // Default the uploader category to "General" (fallback to first) once loaded.
  useEffect(() => {
    if (newMultimedia.id_categoria == null && categorias.length > 0) {
      const general = categorias.find(c => c.nombre === 'General') ?? categorias[0];
      setNewMultimedia(prev => ({ ...prev, id_categoria: general.id }));
    }
  }, [categorias, newMultimedia.id_categoria]);

  const { data: youtubeVideos = [] } = useQuery({
    queryKey: ['projectYoutubeVideos', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos_youtube')
        .select('*')
        .eq('id_proyecto', projectId)
        .is('id_propiedad', null)
        .order('fecha_creacion', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Load notification config for "nuevo_avance_de_obra" so the confirmation
  // dialog reflects the actual configuration (channel + recipient roles).
  const { data: avanceObraConfig } = useQuery({
    queryKey: ['notif-config', 'nuevo_avance_de_obra'],
    queryFn: async () => {
      const { data: config } = await (supabase as any)
        .from('notificaciones_configuracion')
        .select('tipo_evento, descripcion, canal, roles_destino, activo')
        .eq('tipo_evento', 'nuevo_avance_de_obra')
        .maybeSingle();
      if (!config) return null;
      let roleNames: string[] = [];
      if (Array.isArray(config.roles_destino) && config.roles_destino.length > 0) {
        const { data: roles } = await supabase
          .from('roles')
          .select('id, nombre')
          .in('id', config.roles_destino);
        roleNames = (roles || []).map((r: any) => r.nombre);
      }
      return { ...config, roleNames };
    },
  });

  const addMutation = useMutation({
    mutationFn: async (multimediaData: typeof newMultimedia) => {
      const { data, error } = await supabase
        .from('multimedias_proyecto')
        .insert([{
          ...multimediaData,
          id_proyecto: projectId
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMultimedia', projectId] });
      setNewMultimedia({ es_imagen: true, url: "", id_categoria: null });
      setIsAdding(false);
      toast({ title: "Multimedia agregado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al agregar multimedia", variant: "destructive" });
    }
  });

  const addYoutubeMutation = useMutation({
    mutationFn: async (videoData: typeof youtubeForm) => {
      const { data, error } = await supabase
        .from('videos_youtube')
        .insert([{
          nombre: videoData.nombre,
          link: videoData.link,
          id_proyecto: projectId,
          id_propiedad: null,
          activo: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectYoutubeVideos', projectId] });
      // Trigger notification for "nuevo_avance_de_obra"
      supabase.functions.invoke('notificar-agentes', {
        body: {
          tipo_evento: 'nuevo_avance_de_obra',
          id_proyecto: projectId,
          datos: { nombre_video: youtubeForm.nombre, link_video: youtubeForm.link },
        },
      }).catch(err => console.error('Error sending notification:', err));
      setYoutubeForm({ nombre: '', link: '' });
      setIsAddingYoutube(false);
      toast({ title: "Video de YouTube agregado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al agregar video de YouTube", variant: "destructive" });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ multimediaId, newStatus }: { multimediaId: number; newStatus: boolean }) => {
      const { error } = await supabase
        .from('multimedias_proyecto')
        .update({ activo: newStatus })
        .eq('id', multimediaId);
      
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['projectMultimedia', projectId] });
      toast({ 
        title: newStatus ? "Multimedia reactivado exitosamente" : "Multimedia inactivado exitosamente" 
      });
    },
    onError: () => {
      toast({ title: "Error al cambiar estado del multimedia", variant: "destructive" });
    }
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ multimediaId, id_categoria }: { multimediaId: number; id_categoria: number }) => {
      const { error } = await supabase
        .from('multimedias_proyecto')
        .update({ id_categoria })
        .eq('id', multimediaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMultimedia', projectId] });
      toast({ title: "Etiqueta actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar etiqueta", variant: "destructive" });
    }
  });

  const toggleYoutubeStatusMutation = useMutation({
    mutationFn: async ({ videoId, newStatus }: { videoId: number; newStatus: boolean }) => {
      const { error } = await supabase
        .from('videos_youtube')
        .update({ activo: newStatus })
        .eq('id', videoId);
      
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['projectYoutubeVideos', projectId] });
      toast({ 
        title: newStatus ? "Video reactivado exitosamente" : "Video inactivado exitosamente" 
      });
    },
    onError: () => {
      toast({ title: "Error al cambiar estado del video", variant: "destructive" });
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length > 10) {
      toast({ 
        title: "Límite excedido", 
        description: "Solo puedes subir hasta 10 archivos a la vez",
        variant: "destructive" 
      });
      return;
    }

    setSelectedFiles(files);
    toast({ title: `${files.length} archivo(s) seleccionado(s)` });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    
    if (selectedFiles.length === 0 && !newMultimedia.url) {
      toast({ title: "Por favor selecciona archivos o proporciona una URL", variant: "destructive" });
      return;
    }

    if (selectedFiles.length > 0) {
      // Bulk upload
      setUploading(true);
      
      const uploadPromises = selectedFiles.map(async (file) => {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `projects/${projectId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documentos')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('documentos')
            .getPublicUrl(filePath);

          const { error: insertError } = await supabase
            .from('multimedias_proyecto')
            .insert([{
              es_imagen: file.type.startsWith('image/'),
              url: data.publicUrl,
              id_proyecto: projectId,
              id_categoria: newMultimedia.id_categoria
            }]);

          if (insertError) throw insertError;
          return { success: true, fileName: file.name };
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          return { success: false, fileName: file.name };
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      queryClient.invalidateQueries({ queryKey: ['projectMultimedia', projectId] });
      setSelectedFiles([]);
      setNewMultimedia({ es_imagen: true, url: "", id_categoria: null });
      setIsAdding(false);
      setUploading(false);

      toast({
        title: `Proceso completado`,
        description: `${successful} archivo(s) agregado(s) exitosamente${failed > 0 ? `. ${failed} fallaron` : ''}`
      });
    } else {
      // Single URL submission
      addMutation.mutate(newMultimedia);
    }
  };

  const handleYoutubeSubmit = () => {
    if (!youtubeForm.nombre.trim() || !youtubeForm.link.trim()) {
      toast({ title: "Debes completar todos los campos", variant: "destructive" });
      return;
    }
    setConfirmYoutubeOpen(true);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  };

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const isVideoUrl = (url: string) => {
    return /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
  };

  return (
    <div className="space-y-5">
      <Tabs defaultValue="multimedia" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="multimedia" className="gap-2"><Images className="h-4 w-4" /> Multimedia</TabsTrigger>
          <TabsTrigger value="youtube" className="gap-2"><Youtube className="h-4 w-4" /> Videos YouTube</TabsTrigger>
        </TabsList>

        <TabsContent value="multimedia" className="mt-4">
          <FormSection
            title={`Multimedia del Proyecto (${multimedia.length})`}
            icon={Images}
            actions={
              <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            }
          >
          {isAdding && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tipo">Tipo de Multimedia</Label>
                    <Select
                      value={newMultimedia.es_imagen ? "imagen" : "video"}
                      onValueChange={(value) => 
                        setNewMultimedia(prev => ({ ...prev, es_imagen: value === "imagen" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imagen">Imagen</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoría</Label>
                    <Select
                      value={newMultimedia.id_categoria != null ? String(newMultimedia.id_categoria) : undefined}
                      onValueChange={(value) =>
                        setNewMultimedia(prev => ({ ...prev, id_categoria: Number(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="file">Subir Archivos (máximo 10)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="file"
                        type="file"
                        accept={newMultimedia.es_imagen ? "image/*" : "video/*"}
                        onChange={handleFileUpload}
                        disabled={uploading}
                        multiple
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Subiendo..." : "Subir"}
                      </Button>
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>{selectedFiles.length} archivo(s) seleccionado(s) (máximo 10)</Label>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedFiles([])}
                        >
                          Eliminar todos
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="relative border rounded-md p-2">
                            <div className="aspect-square bg-muted rounded overflow-hidden mb-1">
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                              ) : (
                                <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <p className="text-xs truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6"
                              aria-label="Quitar archivo"
                              onClick={() => handleRemoveFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="url">O ingresa URL directamente</Label>
                    <Input
                      id="url"
                      type="url"
                      value={newMultimedia.url}
                      onChange={(e) => setNewMultimedia(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                      disabled={selectedFiles.length > 0}
                    />
                  </div>

                  {newMultimedia.url && selectedFiles.length === 0 && (
                    <div className="mt-4">
                      <Label>Vista previa:</Label>
                      <div className="mt-2 border rounded-md p-2">
                        {isImageUrl(newMultimedia.url) ? (
                          <img 
                            src={newMultimedia.url} 
                            alt="Preview" 
                            className="max-w-full h-48 object-contain"
                          />
                        ) : isVideoUrl(newMultimedia.url) ? (
                          <video 
                            src={newMultimedia.url} 
                            controls 
                            className="max-w-full h-48"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Vista previa no disponible para este tipo de archivo
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      onClick={handleSubmit}
                      disabled={addMutation.isPending || uploading}
                    >
                      {addMutation.isPending || uploading ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false);
                        setSelectedFiles([]);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
            </div>
          )}

          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={filterCategoria === "all" ? "all" : String(filterCategoria)}
              onValueChange={(value) => setFilterCategoria(value === "all" ? "all" : Number(value))}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {multimedia
              .filter((item) => filterCategoria === "all" || item.id_categoria === filterCategoria)
              .map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
                   <div className="flex items-start justify-between gap-2 p-3">
                     <div className="flex flex-wrap gap-1.5">
                       <Badge variant="outline">
                         {item.es_imagen ? "Imagen" : "Video"}
                       </Badge>
                       <Badge variant={item.activo ? "default" : "secondary"}>
                         {item.activo ? "Activo" : "Inactivo"}
                       </Badge>
                     </div>
                     <IconTooltip label={item.activo ? "Inactivar" : "Reactivar"}>
                       <Button
                         type="button"
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 shrink-0"
                         aria-label={item.activo ? "Inactivar" : "Reactivar"}
                         onClick={() => toggleStatusMutation.mutate({
                           multimediaId: item.id,
                           newStatus: !item.activo
                         })}
                         disabled={toggleStatusMutation.isPending}
                       >
                         {item.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                       </Button>
                     </IconTooltip>
                   </div>

                    {item.es_imagen && isImageUrl(item.url) ? (
                      // Contenedor de alto fijo (4/3) + object-contain: imagen COMPLETA sin
                      // recorte ni deformación, y tarjetas de tamaño uniforme. Verticales u
                      // horizontales caben con letterbox gris; nunca se estiran.
                      <div className="aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center">
                        <img
                          src={optimizedImage(item.url, { width: 640 })}
                          alt="Multimedia"
                          loading="lazy"
                          className={`max-w-full max-h-full object-contain ${!item.activo ? 'grayscale opacity-50' : ''}`}
                        />
                      </div>
                    ) : !item.es_imagen && isVideoUrl(item.url) ? (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <video
                          src={item.url}
                          controls={item.activo}
                          className={`w-full h-full object-cover ${!item.activo ? 'grayscale opacity-50' : ''}`}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted overflow-hidden flex items-center justify-center">
                        <p className="text-xs text-muted-foreground text-center p-2">
                          Vista previa no disponible
                        </p>
                      </div>
                    )}

                  <div className="flex items-center gap-2 px-3 pt-3">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Select
                      value={item.id_categoria != null ? String(item.id_categoria) : undefined}
                      onValueChange={(value) =>
                        updateCategoriaMutation.mutate({ multimediaId: item.id, id_categoria: Number(value) })
                      }
                      disabled={updateCategoriaMutation.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs" aria-label="Etiqueta / categoría">
                        <SelectValue placeholder="Sin etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate p-3 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    Ver archivo original
                  </a>
              </div>
            ))}

            {multimedia.length === 0 && !isAdding && (
              <div className="col-span-full rounded-lg border border-dashed py-10 text-center text-muted-foreground">
                <Images className="mx-auto mb-2 h-10 w-10 opacity-40" />
                <p className="text-sm">No hay multimedia registrado</p>
              </div>
            )}
          </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="youtube" className="mt-4">
          <FormSection
            title={`Videos de YouTube (${youtubeVideos.length})`}
            description="Avances de obra. Al agregar se puede notificar a los interesados."
            icon={Youtube}
            actions={
              <Button size="sm" onClick={() => setIsAddingYoutube(true)} disabled={isAddingYoutube}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            }
          >
          {isAddingYoutube && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="titulo">Título</Label>
                    <Input
                      id="titulo"
                      value={youtubeForm.nombre}
                      onChange={(e) => setYoutubeForm({...youtubeForm, nombre: e.target.value})}
                      placeholder="Título del video"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="youtube-url">URL de YouTube</Label>
                    <Input
                      id="youtube-url"
                      value={youtubeForm.link}
                      onChange={(e) => setYoutubeForm({...youtubeForm, link: e.target.value})}
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleYoutubeSubmit}
                      disabled={addYoutubeMutation.isPending}
                    >
                      {addYoutubeMutation.isPending ? 'Agregando...' : 'Agregar Video'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddingYoutube(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {youtubeVideos.map((video) => (
              <div key={video.id} className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-600/10 text-red-600">
                        <Play className="h-4 w-4" />
                      </span>
                      <h4 className="truncate font-medium">{video.nombre}</h4>
                    </div>
                    <IconTooltip label={video.activo ? "Desactivar" : "Activar"}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={video.activo ? "Desactivar" : "Activar"}
                        onClick={() => toggleYoutubeStatusMutation.mutate({
                          videoId: video.id,
                          newStatus: !video.activo
                        })}
                        disabled={toggleYoutubeStatusMutation.isPending}
                      >
                        {video.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    </IconTooltip>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant={video.activo ? "default" : "secondary"}>
                      {video.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <a
                      href={video.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver en YouTube
                    </a>
                  </div>
                </div>
                {video.activo && (
                  <iframe
                    src={getYouTubeEmbedUrl(video.link)}
                    className="h-48 w-full border-0"
                    allowFullScreen
                    title={video.nombre}
                  />
                )}
              </div>
            ))}
            {youtubeVideos.length === 0 && !isAddingYoutube && (
              <div className="col-span-full rounded-lg border border-dashed py-10 text-center text-muted-foreground">
                <Youtube className="mx-auto mb-2 h-10 w-10 opacity-40" />
                <p className="text-sm">No hay videos de YouTube registrados</p>
              </div>
            )}
          </div>
          </FormSection>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmYoutubeOpen} onOpenChange={setConfirmYoutubeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar nuevo avance de obra?</AlertDialogTitle>
            <AlertDialogDescription>
              {avanceObraConfig ? (
                <>
                  Al agregar este video se enviará una notificación por{' '}
                  <strong>
                    {avanceObraConfig.canal === 'ambos'
                      ? 'Email y WhatsApp'
                      : avanceObraConfig.canal === 'email'
                      ? 'Email'
                      : avanceObraConfig.canal === 'whatsapp'
                      ? 'WhatsApp'
                      : avanceObraConfig.canal}
                  </strong>{' '}
                  a los usuarios con rol{' '}
                  <strong>
                    {avanceObraConfig.roleNames.length > 0
                      ? avanceObraConfig.roleNames.join(', ')
                      : 'sin roles configurados'}
                  </strong>{' '}
                  con acceso al desarrollo, según la configuración del evento{' '}
                  <strong>{avanceObraConfig.tipo_evento}</strong>.
                  {!avanceObraConfig.activo && (
                    <>
                      <br /><br />
                      <span className="text-destructive">
                        ⚠️ El evento está desactivado, no se enviarán notificaciones.
                      </span>
                    </>
                  )}
                  <br /><br />
                  ¿Deseas continuar?
                </>
              ) : (
                <>Cargando configuración de la notificación...</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmYoutubeOpen(false);
                addYoutubeMutation.mutate(youtubeForm);
              }}
            >
              Sí, agregar y notificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}