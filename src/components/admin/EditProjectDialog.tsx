import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit, Trash2, MapPin, Search, CheckCircle, Grid3x3, Eye, Building2, Plus, Info, SlidersHorizontal, Images, CalendarClock, Tag, BookOpen, ClipboardList, Calendar, Store, DollarSign, Package, PenLine, Globe, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuildingManagement } from "./BuildingManagement";
import { PaymentSchemeManagement } from "./PaymentSchemeManagement";
import { ProjectLegalEntitiesSection } from "./ProjectLegalEntitiesSection";
import { ProjectMultimediaSection } from "./ProjectMultimediaSection";
import { ProjectReservableSpacesSection } from "./ProjectReservableSpacesSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NewAmenityDialog } from "./NewAmenityDialog";
import { EditAmenityDialog } from "./EditAmenityDialog";
import { ImageUploadField } from "./ImageUploadField";
import { ProjectLegalNoticesSection } from "./ProjectLegalNoticesSection";
import { ProjectBrochuresSection } from "./ProjectBrochuresSection";
import { ProjectFichaTecnicaSection } from "./ProjectFichaTecnicaSection";
import { ProjectPuntosInteresSection } from "./ProjectPuntosInteresSection";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { FieldGrid } from "@/components/admin/project-form/FieldGrid";
import { MapLink } from "@/components/admin/project-form/MapLink";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional(),
  direccion: z.string().optional(),
  id_tipo_uso: z.string().min(1, "El tipo de uso es requerido"),
  id_estatus_proyecto: z.string().min(1, "El estatus del proyecto es requerido"),
  precio_m2_actual: z.string().optional(),
  fecha_lanzamiento: z.string().optional(),
  fecha_inicio_construccion: z.string().optional(),
  fecha_entrega: z.string().optional(),
  direccion_id_pais: z.string().optional(),
  direccion_id_estado: z.string().optional(),
  direccion_id_municipio: z.string().optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
  amenidades: z.array(z.string()).default([]),
  url_logo: z.string().optional(),
  url_firma_recibos: z.string().optional(),
  nombre_firmante_recibos: z.string().optional(),
  url_imagen_portada: z.string().optional(),
  costo_mantenimiento_m2: z.string().optional(),
  monto_mensual_cuota_extraordinaria: z.string()
    .optional()
    .refine((val) => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 5000), {
      message: "El monto debe ser entre 0 y 5000"
    }),
  monto_garantia_renta: z.string().optional(),
  mostrar_precio_m2_en_oferta: z.boolean().default(true),
  mostrar_piso_en_oferta: z.boolean().default(true),
  mostrar_seccion_efectivo_en_oferta: z.boolean().default(true),
  slogan: z.string().optional(),
  url_sitio_web: z.string().optional(),
  instagram_handle: z.string().optional(),
  facebook_handle: z.string().optional(),
  youtube_handle: z.string().optional(),
});

interface EditProjectDialogProps {
  projectId: number;
  onProjectUpdated: () => void;
  trigger?: React.ReactNode;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export const EditProjectDialog = ({ projectId, onProjectUpdated, trigger, canCreate = true, canUpdate = true, canDelete = true }: EditProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showrooms, setShowrooms] = useState<Array<{ id?: number; nombre: string; descripcion_direccion: string; latitud: number | null; longitud: number | null }>>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amenidadesSearchTerm, setAmenidadesSearchTerm] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      direccion: "",
      id_tipo_uso: "",
      id_estatus_proyecto: "",
      precio_m2_actual: "",
      fecha_lanzamiento: "",
      fecha_inicio_construccion: "",
      fecha_entrega: "",
      direccion_id_pais: "",
      direccion_id_estado: "",
      direccion_id_municipio: "",
      latitud: undefined,
      longitud: undefined,
      amenidades: [],
      url_logo: "",
      url_firma_recibos: "",
      nombre_firmante_recibos: "",
      url_imagen_portada: "",
      costo_mantenimiento_m2: "",
      monto_mensual_cuota_extraordinaria: "",
      monto_garantia_renta: "",
      mostrar_precio_m2_en_oferta: true,
      mostrar_piso_en_oferta: true,
      mostrar_seccion_efectivo_en_oferta: true,
      slogan: "",
      url_sitio_web: "",
      instagram_handle: "",
      facebook_handle: "",
      youtube_handle: "",
    },
  });

  // Determinar si es proyecto de tipo Productos, Servicios o Mantenimientos
  const isSpecialProject = form.watch("id_tipo_uso") === "9" || form.watch("id_tipo_uso") === "10" || form.watch("id_tipo_uso") === "11";

  // Query para verificar si todas las propiedades del proyecto tienen estatus > 3
  const { data: propiedadesPendientes } = useQuery({
    queryKey: ["propiedades-pendientes-proyecto", projectId],
    queryFn: async () => {
      // Obtener edificios del proyecto
      const { data: edificios, error: edError } = await supabase
        .from("edificios")
        .select("id")
        .eq("id_proyecto", projectId)
        .eq("activo", true);
      if (edError) throw edError;
      if (!edificios || edificios.length === 0) return 0;

      // Obtener edificios_modelos de esos edificios
      const edificioIds = edificios.map(e => e.id);
      const { data: edModelos, error: emError } = await supabase
        .from("edificios_modelos")
        .select("id")
        .in("id_edificio", edificioIds)
        .eq("activo", true);
      if (emError) throw emError;
      if (!edModelos || edModelos.length === 0) return 0;

      // Contar propiedades con estatus <= 3
      const emIds = edModelos.map(em => em.id);
      const { count, error } = await supabase
        .from("propiedades")
        .select("id", { count: "exact", head: true })
        .in("id_edificio_modelo", emIds)
        .lte("id_estatus_disponibilidad", 3)
        .eq("activo", true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: open,
  });

  const todasVendidas = propiedadesPendientes === 0;

  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          direccion,
          id_tipo_uso,
          id_estatus_proyecto,
          precio_m2_actual,
          fecha_lanzamiento,
          fecha_inicio_construccion,
          fecha_entrega,
          direccion_id_pais,
          direccion_id_estado,
          direccion_id_municipio,
          latitud,
          longitud,
          url_logo,
          url_firma_recibos,
          nombre_firmante_recibos,
          url_imagen_portada,
          costo_mantenimiento_m2,
          monto_mensual_cuota_extraordinaria,
          monto_garantia_renta,
          mostrar_precio_m2_en_oferta,
          mostrar_piso_en_oferta,
          mostrar_seccion_efectivo_en_oferta,
          slogan,
          url_sitio_web,
          instagram_handle,
          facebook_handle,
          youtube_handle,
          activo,
          fecha_creacion,
          fecha_actualizacion,
          amenidades_proyectos (
            id_amenidad
          )
        `)
        .eq("id", projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Query showrooms for this project
  const { data: projectShowrooms = [] } = useQuery({
    queryKey: ["showrooms-proyecto", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('showrooms_proyecto')
        .select('id, nombre, descripcion_direccion, latitud, longitud')
        .eq('id_proyecto', projectId)
        .eq('activo', true);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Populate showrooms only once per dialog open, to avoid overwriting in-progress local edits
  // (e.g. when the user clicks the map to move the marker).
  const showroomsHydratedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      showroomsHydratedRef.current = false;
      return;
    }
    if (showroomsHydratedRef.current) return;
    if (projectShowrooms.length > 0) {
      setShowrooms(projectShowrooms.map(s => ({
        id: s.id,
        nombre: s.nombre || '',
        descripcion_direccion: s.descripcion_direccion,
        latitud: s.latitud != null ? Number(s.latitud) : null,
        longitud: s.longitud != null ? Number(s.longitud) : null,
      })));
      showroomsHydratedRef.current = true;
    } else if (project) {
      setShowrooms([]);
      showroomsHydratedRef.current = true;
    }
  }, [open, projectShowrooms, project]);

  // Geocode an address using Google Maps Geocoder
  const geocodeAddress = (address: string, idx: number) => {
    if (!address.trim() || !(window as any).google?.maps) return;
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address, componentRestrictions: { country: "mx" } }, (results: any, status: string) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setShowrooms(prev => {
          const updated = [...prev];
          if (updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              latitud: loc.lat(),
              longitud: loc.lng(),
              descripcion_direccion: results[0].formatted_address || updated[idx].descripcion_direccion,
            };
          }
          return updated;
        });
      }
    });
  };

  const { data: vistas } = useQuery({
    queryKey: ["vistas-proyecto", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistas")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: tiposUso } = useQuery({
    queryKey: ["tipos-uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_uso")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: amenidades } = useQuery({
    queryKey: ["amenidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amenidades")
        .select("*")
        .eq("activo", true)
        .eq("habilitar_asignar", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: estatusProyecto } = useQuery({
    queryKey: ["estatus-proyecto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estatus_proyecto")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: paises } = useQuery({
    queryKey: ["paises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paises")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: estados } = useQuery({
    queryKey: ["estados", selectedCountry],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estados_mx")
        .select("*")
        .eq("activo", true)
        .eq("id_pais", selectedCountry)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
    enabled: selectedCountry === "MX",
  });

  const { data: municipios } = useQuery({
    queryKey: ["municipios", form.watch("direccion_id_estado")],
    queryFn: async () => {
      const estadoId = form.watch("direccion_id_estado");
      if (!estadoId) return [];
      
      const { data, error } = await supabase
        .from("municipios_mx")
        .select("*")
        .eq("activo", true)
        .eq("id_estado", parseInt(estadoId))
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
    enabled: !!form.watch("direccion_id_estado") && selectedCountry === "MX",
  });

  // Populate form when project data is loaded
  useEffect(() => {
    if (project) {
      const initialLocation = project.latitud && project.longitud 
        ? { lat: project.latitud, lng: project.longitud }
        : null;
      
      setSelectedLocation(initialLocation);
      
      form.reset({
        nombre: project.nombre || "",
        descripcion: project.descripcion || "",
        direccion: project.direccion || "",
        id_tipo_uso: project.id_tipo_uso?.toString() || "",
        id_estatus_proyecto: project.id_estatus_proyecto?.toString() || "",
        precio_m2_actual: (project as any).precio_m2_actual?.toString() || "",
        fecha_lanzamiento: project.fecha_lanzamiento || "",
        fecha_inicio_construccion: project.fecha_inicio_construccion || "",
        fecha_entrega: project.fecha_entrega || "",
        direccion_id_pais: project.direccion_id_pais || "",
        direccion_id_estado: project.direccion_id_estado?.toString() || "",
        direccion_id_municipio: project.direccion_id_municipio?.toString() || "",
        latitud: project.latitud || undefined,
        longitud: project.longitud || undefined,
        amenidades: project.amenidades_proyectos?.map((ap: any) => ap.id_amenidad.toString()) || [],
        url_logo: project.url_logo || "",
        url_firma_recibos: project.url_firma_recibos || "",
        nombre_firmante_recibos: project.nombre_firmante_recibos || "",
        url_imagen_portada: project.url_imagen_portada || "",
        costo_mantenimiento_m2: project.costo_mantenimiento_m2?.toString() || "",
        monto_mensual_cuota_extraordinaria: (project as any).monto_mensual_cuota_extraordinaria?.toString() || "",
        monto_garantia_renta: (project as any).monto_garantia_renta?.toString() || "",
        mostrar_precio_m2_en_oferta: project.mostrar_precio_m2_en_oferta ?? true,
        mostrar_piso_en_oferta: project.mostrar_piso_en_oferta ?? true,
        mostrar_seccion_efectivo_en_oferta: project.mostrar_seccion_efectivo_en_oferta ?? true,
        slogan: (project as any).slogan || "",
        url_sitio_web: (project as any).url_sitio_web || "",
        instagram_handle: (project as any).instagram_handle || "",
        facebook_handle: (project as any).facebook_handle || "",
        youtube_handle: (project as any).youtube_handle || "",
      });
      
      setSelectedCountry(project.direccion_id_pais || "");
    }
  }, [project, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('🔍 [DEBUG] Valores del formulario recibidos en onSubmit:', values);
    console.log('🔍 [DEBUG] url_logo recibido:', values.url_logo);
    
    setIsSubmitting(true);
    try {
      const projectData = {
        nombre: values.nombre,
        descripcion: values.descripcion || null,
        direccion: values.direccion || null,
        id_tipo_uso: parseInt(values.id_tipo_uso),
        id_estatus_proyecto: parseInt(values.id_estatus_proyecto),
        precio_m2_actual: values.precio_m2_actual ? parseFloat(values.precio_m2_actual) : null,
        fecha_lanzamiento: values.fecha_lanzamiento || null,
        fecha_inicio_construccion: values.fecha_inicio_construccion || null,
        fecha_entrega: values.fecha_entrega || null,
        direccion_id_pais: values.direccion_id_pais || null,
        direccion_id_estado: values.direccion_id_estado ? parseInt(values.direccion_id_estado) : null,
        direccion_id_municipio: values.direccion_id_municipio ? parseInt(values.direccion_id_municipio) : null,
        latitud: selectedLocation?.lat || null,
        longitud: selectedLocation?.lng || null,
        url_logo: values.url_logo || null,
        url_firma_recibos: values.url_firma_recibos || null,
        nombre_firmante_recibos: values.nombre_firmante_recibos || null,
        url_imagen_portada: values.url_imagen_portada || null,
        costo_mantenimiento_m2: values.costo_mantenimiento_m2 ? parseFloat(values.costo_mantenimiento_m2) : null,
        monto_mensual_cuota_extraordinaria: values.monto_mensual_cuota_extraordinaria ? parseFloat(values.monto_mensual_cuota_extraordinaria) : null,
        monto_garantia_renta: values.monto_garantia_renta ? parseFloat(values.monto_garantia_renta) : null,
        mostrar_precio_m2_en_oferta: values.mostrar_precio_m2_en_oferta,
        mostrar_piso_en_oferta: values.mostrar_piso_en_oferta,
        mostrar_seccion_efectivo_en_oferta: values.mostrar_seccion_efectivo_en_oferta,
        slogan: values.slogan || null,
        url_sitio_web: values.url_sitio_web || null,
        instagram_handle: values.instagram_handle || null,
        facebook_handle: values.facebook_handle || null,
        youtube_handle: values.youtube_handle || null,
      };

      console.log('🔍 [DEBUG] Objeto projectData preparado para enviar:', projectData);
      console.log('🔍 [DEBUG] url_logo en projectData:', projectData.url_logo);

      const { error: updateError } = await (supabase as any)
        .from("proyectos")
        .update(projectData)
        .eq("id", projectId);
      
      console.log('🔍 [DEBUG] Resultado del update - Error:', updateError);

      if (updateError) throw updateError;

      // Update amenities relationships
      // First, delete existing relationships
      const { error: deleteError } = await supabase
        .from("amenidades_proyectos")
        .delete()
        .eq("id_proyecto", projectId);

      if (deleteError) throw deleteError;

      // Then, insert new relationships if any selected
      if (values.amenidades && values.amenidades.length > 0) {
        const amenityRelations = values.amenidades.map(amenidadId => ({
          id_proyecto: projectId,
          id_amenidad: parseInt(amenidadId),
        }));

        const { error: amenityError } = await supabase
          .from("amenidades_proyectos")
          .insert(amenityRelations);

        if (amenityError) throw amenityError;
      }

      // Update showrooms - upsert existing, insert new, deactivate removed
      const validShowrooms = showrooms.filter(s => s.descripcion_direccion && s.latitud && s.longitud);
      const currentIds = validShowrooms.filter(s => s.id).map(s => s.id!);

      // Deactivate only removed showrooms (those with IDs no longer in the list)
      if (currentIds.length > 0) {
        await supabase
          .from('showrooms_proyecto')
          .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
          .eq('id_proyecto', projectId)
          .eq('activo', true)
          .not('id', 'in', `(${currentIds.join(',')})`);
      } else {
        // All showrooms were removed
        await supabase
          .from('showrooms_proyecto')
          .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
          .eq('id_proyecto', projectId)
          .eq('activo', true);
      }

      // Update existing showrooms
      for (const s of validShowrooms.filter(s => s.id)) {
        console.log('[EditProjectDialog] Updating showroom', {
          id: s.id,
          nombre: s.nombre,
          descripcion_direccion: s.descripcion_direccion,
          latitud: s.latitud,
          longitud: s.longitud,
        });
        const { error: updateErr, data: updData } = await supabase
          .from('showrooms_proyecto')
          .update({
            nombre: s.nombre,
            descripcion_direccion: s.descripcion_direccion,
            latitud: s.latitud!,
            longitud: s.longitud!,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', s.id!)
          .select();
        console.log('[EditProjectDialog] Update result', { id: s.id, updData, updateErr });
        if (updateErr) throw updateErr;
      }

      // Insert new showrooms (those without id)
      const newShowrooms = validShowrooms.filter(s => !s.id);
      if (newShowrooms.length > 0) {
        const showroomInserts = newShowrooms.map(s => ({
          id_proyecto: projectId,
          nombre: s.nombre,
          descripcion_direccion: s.descripcion_direccion,
          latitud: s.latitud!,
          longitud: s.longitud!,
          activo: true,
        }));
        const { error: showroomError } = await supabase
          .from('showrooms_proyecto')
          .insert(showroomInserts);
        if (showroomError) throw showroomError;
      }

      toast({
        title: "Proyecto actualizado",
        description: "El proyecto se ha actualizado exitosamente.",
      });

      await queryClient.invalidateQueries({ queryKey: ["showrooms-proyecto", projectId] });
      setOpen(false);
      onProjectUpdated();
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "Hubo un error al actualizar el proyecto.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!trigger && (
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-[min(1140px,96vw)] w-full h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Editar Proyecto</DialogTitle>
        </DialogHeader>
        {isLoadingProject ? (
          <div className="flex-1 grid place-items-center">
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col" id="edit-project-form">
              <Tabs defaultValue="information" orientation="vertical" className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-0">
                <TabsList className="shrink-0 h-auto md:h-full w-full md:w-52 flex md:flex-col md:items-stretch md:justify-start gap-1 bg-muted/40 border-b md:border-b-0 md:border-r p-2 md:p-3 rounded-none overflow-x-auto md:overflow-y-auto">
                  <TabsTrigger value="information" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><Info className="h-4 w-4 shrink-0" /> Información</TabsTrigger>
                  {!isSpecialProject && <TabsTrigger value="images" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><SlidersHorizontal className="h-4 w-4 shrink-0" /> Config. general</TabsTrigger>}
                  {!isSpecialProject && <TabsTrigger value="multimedia" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><Images className="h-4 w-4 shrink-0" /> Multimedia</TabsTrigger>}
                  <TabsTrigger value="legal-entities" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><Building2 className="h-4 w-4 shrink-0" /> Entidades Legales</TabsTrigger>
                  {!isSpecialProject && <TabsTrigger value="reservable-spaces" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><CalendarClock className="h-4 w-4 shrink-0" /> Espacios</TabsTrigger>}
                  {!isSpecialProject && <TabsTrigger value="offer-config" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><Tag className="h-4 w-4 shrink-0" /> Config. oferta</TabsTrigger>}
                  {!isSpecialProject && <TabsTrigger value="vistas" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><Eye className="h-4 w-4 shrink-0" /> Vistas</TabsTrigger>}
                  <TabsTrigger value="brochures" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><BookOpen className="h-4 w-4 shrink-0" /> Brochures</TabsTrigger>
                  {!isSpecialProject && <TabsTrigger value="ficha-tecnica" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><ClipboardList className="h-4 w-4 shrink-0" /> Ficha Técnica</TabsTrigger>}
                  {!isSpecialProject && <TabsTrigger value="puntos-interes" className="justify-start gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"><MapPin className="h-4 w-4 shrink-0" /> Puntos Interés</TabsTrigger>}
                </TabsList>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">

                <TabsContent value="information" className="mt-0 space-y-5">
                  <FormSection title="Datos generales" icon={Info}>
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Proyecto</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ingrese el nombre del proyecto" 
                            {...field} 
                            readOnly 
                            className="bg-muted cursor-not-allowed"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FieldGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="id_tipo_uso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Uso</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSpecialProject}>
                          <FormControl>
                            <SelectTrigger className={isSpecialProject ? "bg-muted cursor-not-allowed" : ""}>
                              <SelectValue placeholder="Selecciona un tipo de uso" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposUso?.map((tipo) => (
                              <SelectItem 
                                key={tipo.id} 
                                value={tipo.id.toString()}
                                disabled={tipo.id === 9 || tipo.id === 10 || tipo.id === 11}
                              >
                                {tipo.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                  )}
                />

                {!isSpecialProject && (
                    <FormField
                        control={form.control}
                        name="id_estatus_proyecto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estatus del Proyecto</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un estatus" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {estatusProyecto?.map((estatus) => {
                                  const totalEstatus = estatusProyecto.length || 13;
                                  const porcentaje = Math.round((estatus.id / totalEstatus) * 100);
                                  return (
                                    <SelectItem key={estatus.id} value={estatus.id.toString()}>
                                      {estatus.nombre} ({porcentaje}%)
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                )}
                  </FieldGrid>
                {!isSpecialProject && (
                  <>
                      <FormField
                        control={form.control}
                        name="descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Descripción del proyecto" rows={6} className="resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                        <FormField
                          control={form.control}
                          name="precio_m2_actual"
                          render={({ field }) => {
                            const formattedValue = field.value
                              ? parseFloat(field.value).toLocaleString('es-MX', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })
                              : '';

                            return (
                              <FormItem>
                                <FormLabel>
                                  Precio por m² actual
                                  {!todasVendidas && " (se habilita cuando todas las propiedades estén vendidas)"}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="text"
                                    placeholder="0.00"
                                    value={formattedValue}
                                    disabled={!todasVendidas}
                                    className={!todasVendidas ? "bg-muted" : ""}
                                    readOnly={!todasVendidas}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                                      field.onChange(raw);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                    </>
                  )}
                  </FormSection>

                  {!isSpecialProject && (
                    <>
                      <FormSection title="Fechas" icon={Calendar}>
                        <FieldGrid cols={3}>
                         <FormField
                           control={form.control}
                           name="fecha_lanzamiento"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Fecha de Lanzamiento</FormLabel>
                               <FormControl>
                                 <Input type="date" {...field} className="block [&::-webkit-calendar-picker-indicator]:ml-auto" />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={form.control}
                           name="fecha_inicio_construccion"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Fecha de Inicio Construcción</FormLabel>
                               <FormControl>
                                 <Input type="date" {...field} className="block [&::-webkit-calendar-picker-indicator]:ml-auto" />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />

                         <FormField
                           control={form.control}
                           name="fecha_entrega"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Fecha de Entrega</FormLabel>
                               <FormControl>
                                 <Input type="date" {...field} className="block [&::-webkit-calendar-picker-indicator]:ml-auto" />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                        </FieldGrid>
                      </FormSection>

                      <FormSection title="Ubicación" icon={MapPin}>
                       {/* Address Fields */}
                       <FieldGrid cols={3}>
                         <FormField
                           control={form.control}
                           name="direccion_id_pais"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>País</FormLabel>
                               <Select 
                                 onValueChange={(value) => {
                                   field.onChange(value);
                                   setSelectedCountry(value);
                                   // Reset state and municipality when country changes
                                   if (value !== "MX") {
                                     form.setValue("direccion_id_estado", "");
                                     form.setValue("direccion_id_municipio", "");
                                   }
                                 }} 
                                 value={field.value}
                               >
                                 <FormControl>
                                   <SelectTrigger>
                                     <SelectValue placeholder="Selecciona un país" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {paises?.map((pais) => (
                                     <SelectItem key={pais.id} value={pais.id}>
                                       {pais.nombre}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                               <FormMessage />
                             </FormItem>
                           )}
                         />

                         {selectedCountry === "MX" && (
                           <>
                             <FormField
                               control={form.control}
                               name="direccion_id_estado"
                               render={({ field }) => (
                                 <FormItem>
                                   <FormLabel>Estado</FormLabel>
                                   <Select 
                                     onValueChange={(value) => {
                                       field.onChange(value);
                                       // Reset municipality when state changes
                                       form.setValue("direccion_id_municipio", "");
                                     }} 
                                     value={field.value}
                                   >
                                     <FormControl>
                                       <SelectTrigger>
                                         <SelectValue placeholder="Selecciona un estado" />
                                       </SelectTrigger>
                                     </FormControl>
                                     <SelectContent>
                                       {estados?.map((estado) => (
                                         <SelectItem key={estado.id} value={estado.id.toString()}>
                                           {estado.nombre}
                                         </SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                   <FormMessage />
                                 </FormItem>
                               )}
                             />

                             <FormField
                               control={form.control}
                               name="direccion_id_municipio"
                               render={({ field }) => (
                                 <FormItem>
                                   <FormLabel>Municipio</FormLabel>
                                   <Select onValueChange={field.onChange} value={field.value}>
                                     <FormControl>
                                       <SelectTrigger>
                                         <SelectValue placeholder="Selecciona un municipio" />
                                       </SelectTrigger>
                                     </FormControl>
                                     <SelectContent>
                                       {municipios?.map((municipio) => (
                                         <SelectItem key={municipio.id} value={municipio.id.toString()}>
                                           {municipio.nombre}
                                         </SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                   <FormMessage />
                                 </FormItem>
                               )}
                             />
                           </>
                         )}
                       </FieldGrid>

                      {/* Location and Address Section */}
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="direccion"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dirección</FormLabel>
                                <FormControl>
                                  <Input placeholder="Dirección del proyecto" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {selectedLocation && (
                            <MapLink
                              lat={selectedLocation.lat}
                              lng={selectedLocation.lng}
                              onCopy={() => toast({ title: "Coordenadas copiadas", description: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}` })}
                            />
                          )}
                        </div>
                      </div>
                      </FormSection>

                      {/* Showrooms Section */}
                      <FormSection
                        title={`Showrooms (${showrooms.length})`}
                        icon={Store}
                        actions={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowrooms([...showrooms, { nombre: '', descripcion_direccion: '', latitud: null, longitud: null }])}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Agregar Showroom
                          </Button>
                        }
                      >
                        {showrooms.map((showroom, idx) => (
                          <div key={idx} className="space-y-4 rounded-lg border border-border bg-card p-4 relative">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Showroom {idx + 1}</span>
                              <IconTooltip label="Eliminar showroom">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  aria-label="Eliminar showroom"
                                  onClick={() => setShowrooms(showrooms.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </IconTooltip>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Nombre</label>
                              <Input
                                placeholder="Ej: Showroom Guadalajara"
                                value={showroom.nombre}
                                onChange={(e) => {
                                  const updated = [...showrooms];
                                  updated[idx] = { ...updated[idx], nombre: e.target.value };
                                  setShowrooms(updated);
                                }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Dirección</label>
                              <Input
                                placeholder="Escribe la dirección del showroom"
                                value={showroom.descripcion_direccion}
                                onChange={(e) => {
                                  const updated = [...showrooms];
                                  updated[idx] = { ...updated[idx], descripcion_direccion: e.target.value };
                                  setShowrooms(updated);
                                }}
                                onBlur={(e) => {
                                  // Auto-geocode when user finishes typing the address manually
                                  if (e.target.value.trim() && (!showroom.latitud || !showroom.longitud)) {
                                    geocodeAddress(e.target.value, idx);
                                  }
                                }}
                              />
                            </div>
                            </div>
                            {showroom.latitud && showroom.longitud && (
                              <MapLink lat={showroom.latitud} lng={showroom.longitud} />
                            )}
                            {(showroom.descripcion_direccion && (!showroom.latitud || !showroom.longitud)) || (!showroom.descripcion_direccion && showroom.latitud && showroom.longitud) ? (
                              <p className="text-xs text-destructive">
                                Debes llenar tanto la dirección como la ubicación en el mapa.
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </FormSection>

                      {/* Building Management Section */}
                      <FormSection title="Edificios del Proyecto" icon={Building2}>
                        <BuildingManagement projectId={projectId} />
                      </FormSection>

                      {/* Payment Scheme Management Section */}
                      <FormSection title="Esquemas de Pago del Proyecto" icon={DollarSign}>
                        <PaymentSchemeManagement
                          projectId={projectId}
                          canCreate={canCreate}
                          canUpdate={canUpdate}
                          canDelete={canDelete}
                        />
                      </FormSection>

                      {/* Amenidades Section - Con separación adicional */}
                      <FormSection
                        title="Amenidades"
                        icon={Package}
                        actions={<NewAmenityDialog onAmenityCreated={() => queryClient.invalidateQueries({ queryKey: ['amenidades'] })} />}
                      >
                      <FormField
                        control={form.control}
                        name="amenidades"
                        render={({ field }) => {
                          const selectedAmenidades = field.value || [];
                          let filteredAmenidades = amenidades?.filter(amenidad => 
                            amenidad.nombre.toLowerCase().includes(amenidadesSearchTerm.toLowerCase())
                          ) || [];
                          
                          if (showOnlySelected) {
                            filteredAmenidades = filteredAmenidades.filter(amenidad => 
                              selectedAmenidades.includes(amenidad.id.toString())
                            );
                          }
                          
                          return (
                            <FormItem>
                              
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Buscar amenidad..."
                                    value={amenidadesSearchTerm}
                                    onChange={(e) => setAmenidadesSearchTerm(e.target.value)}
                                    className="pl-8"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant={showOnlySelected ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => setShowOnlySelected(!showOnlySelected)}
                                  className="whitespace-nowrap"
                                >
                                  {showOnlySelected ? (
                                    <>
                                      <Grid3x3 className="h-4 w-4 mr-1" />
                                      Ver Todas
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Ver Seleccionadas ({selectedAmenidades.length})
                                    </>
                                  )}
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                {filteredAmenidades.length > 0 ? (
                                  filteredAmenidades.map((amenidad) => (
                                    <FormField
                                      key={amenidad.id}
                                      control={form.control}
                                      name="amenidades"
                                      render={({ field }) => {
                                        return (
                                          <FormItem
                                            key={amenidad.id}
                                            className={`flex flex-row items-center gap-2.5 space-y-0 rounded-lg border px-3 py-2 transition-colors cursor-pointer ${field.value?.includes(amenidad.id.toString()) ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                                          >
                                            <FormControl>
                                              <Checkbox
                                                className="shrink-0"
                                                checked={field.value?.includes(amenidad.id.toString())}
                                                onCheckedChange={(checked) => {
                                                  return checked
                                                    ? field.onChange([...field.value, amenidad.id.toString()])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                          (value) => value !== amenidad.id.toString()
                                                        )
                                                      )
                                                }}
                                              />
                                            </FormControl>
                                            <div className="flex flex-1 items-center gap-2 min-w-0">
                                              <span className="text-sm truncate flex-1 min-w-0 leading-tight">{amenidad.nombre}</span>
                                              <div className="shrink-0">
                                                <EditAmenityDialog
                                                  amenityId={amenidad.id}
                                                  amenityName={amenidad.nombre}
                                                  onAmenityUpdated={() => {
                                                    queryClient.invalidateQueries({ queryKey: ['amenidades'] })
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </FormItem>
                                        )
                                      }}
                                    />
                                  ))
                                ) : (
                                  <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                                    No se encontraron amenidades
                                  </p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                      </FormSection>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="images" className="mt-0 space-y-5">
                  <FormSection title="Identidad" icon={ImageIcon}>
                    <FormField
                      control={form.control}
                      name="url_logo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              label="Logo del Proyecto"
                              value={field.value}
                              onChange={field.onChange}
                              accept="image/*"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="url_imagen_portada"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUploadField
                              label="Imagen de Portada"
                              value={field.value}
                              onChange={field.onChange}
                              accept="image/*"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FormSection>

                  <FormSection title="Firma de recibos" icon={PenLine}>
                    <FieldGrid cols={2}>
                      <FormField
                        control={form.control}
                        name="url_firma_recibos"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <ImageUploadField
                                label="Imagen de Firma para Recibos"
                                value={field.value}
                                onChange={field.onChange}
                                accept="image/*"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nombre_firmante_recibos"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Firmante</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre completo del firmante" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </FieldGrid>
                  </FormSection>

                  <FormSection title="Costos" icon={DollarSign}>
                    <FieldGrid cols={3}>
                      <FormField
                        control={form.control}
                        name="costo_mantenimiento_m2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Costo Mantenimiento M²</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="monto_mensual_cuota_extraordinaria"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto mensual de cuota extraordinaria</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="monto_garantia_renta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto mensual de garantía de renta</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </FieldGrid>
                  </FormSection>

                  <FormSection title="Presencia digital" icon={Globe}>
                    <FieldGrid cols={2}>
                      <FormField
                        control={form.control}
                        name="slogan"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Slogan</FormLabel>
                            <FormControl>
                              <Input placeholder="Slogan del proyecto" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="url_sitio_web"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Sitio Web Oficial</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="instagram_handle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instagram</FormLabel>
                            <FormControl>
                              <Input placeholder="@usuario" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="facebook_handle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facebook</FormLabel>
                            <FormControl>
                              <Input placeholder="@usuario o URL" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="youtube_handle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>YouTube</FormLabel>
                            <FormControl>
                              <Input placeholder="@canal o URL" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </FieldGrid>
                  </FormSection>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="multimedia" className="mt-6">
                  <ProjectMultimediaSection projectId={projectId} />
                </TabsContent>
                
                <TabsContent value="legal-entities" className="mt-6">
                  <ProjectLegalEntitiesSection projectId={projectId} isProductosOrServicios={isSpecialProject} />
                </TabsContent>
                
                <TabsContent value="reservable-spaces" className="mt-6">
                  <ProjectReservableSpacesSection projectId={projectId} />
                </TabsContent>
                
                <TabsContent value="offer-config" className="mt-0 space-y-5">
                  <div>
                    <ProjectLegalNoticesSection projectId={projectId} />
                  </div>

                  <FormSection
                    title="Mostrar en la oferta"
                    description="Selecciona qué elementos aparecerán en el PDF de la oferta."
                    icon={Eye}
                  >
                    <FieldGrid cols={3}>
                      <FormField
                        control={form.control}
                        name="mostrar_precio_m2_en_oferta"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Precio por m²</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mostrar_piso_en_oferta"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Piso</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mostrar_seccion_efectivo_en_oferta"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Sección En efectivo</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </FieldGrid>
                  </FormSection>
                </TabsContent>

                <TabsContent value="vistas" className="mt-0 space-y-5">
                  <FormSection title="Vistas" icon={Eye}>
                    {vistas && vistas.length > 0 ? (
                      <FieldGrid cols={3}>
                        {vistas.map((vista: any) => (
                          <div key={vista.id} className="border rounded-lg p-4 space-y-2">
                            <div className="font-medium">{vista.nombre}</div>
                            {vista.url && (
                              <img 
                                src={vista.url} 
                                alt={vista.nombre}
                                className="w-full h-32 object-cover rounded-md"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg';
                                }}
                              />
                            )}
                            {!vista.url && (
                              <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-sm">
                                Sin imagen
                              </div>
                            )}
                          </div>
                        ))}
                      </FieldGrid>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay vistas asignadas a este proyecto</p>
                        <p className="text-sm mt-1">Puedes agregar vistas desde la sección "Vistas" en el menú de Inventarios</p>
                      </div>
                    )}
                  </FormSection>
                </TabsContent>

                <TabsContent value="brochures" className="mt-6">
                  <ProjectBrochuresSection projectId={projectId} />
                </TabsContent>

                {!isSpecialProject && (
                  <TabsContent value="ficha-tecnica" className="mt-6">
                    <ProjectFichaTecnicaSection projectId={projectId} />
                  </TabsContent>
                )}

                {!isSpecialProject && (
                  <TabsContent value="puntos-interes" className="mt-6">
                    <ProjectPuntosInteresSection projectId={projectId} />
                  </TabsContent>
                )}
                </div>
              </Tabs>
            </form>
          </Form>
        )}
        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};