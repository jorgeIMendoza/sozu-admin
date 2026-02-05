import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isValidRoute } from '@/utils/validRoutes';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Submenu {
  id: number;
  nombre: string;
  vista_front_end: string | null;
  menu_id: number;
  orden: number;
  activo: boolean;
  solo_usuarioA?: boolean;
}

interface SortableSubmenuRowProps {
  submenu: Submenu;
  onUpdate: () => void;
}

export function SortableSubmenuRow({ submenu, onUpdate }: SortableSubmenuRowProps) {
  const [nombre, setNombre] = useState(submenu.nombre);
  const [vistaFrontEnd, setVistaFrontEnd] = useState(submenu.vista_front_end || '');
  const [activo, setActivo] = useState(submenu.activo);
  const [soloUsuarioA, setSoloUsuarioA] = useState(submenu.solo_usuarioA || false);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `submenu-${submenu.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    setNombre(submenu.nombre);
    setVistaFrontEnd(submenu.vista_front_end || '');
    setActivo(submenu.activo);
    setSoloUsuarioA(submenu.solo_usuarioA || false);
  }, [submenu]);

  const routeIsValid = isValidRoute(vistaFrontEnd);

  const handleNombreBlur = async () => {
    if (nombre === submenu.nombre) return;
    
    setIsUpdating(true);
    const { error } = await supabase
      .from('submenus')
      .update({ nombre, fecha_actualizacion: new Date().toISOString() })
      .eq('id', submenu.id);

    if (error) {
      toast.error('Error al actualizar nombre');
      setNombre(submenu.nombre);
    } else {
      onUpdate();
    }
    setIsUpdating(false);
  };

  const handleRutaBlur = async () => {
    if (vistaFrontEnd === (submenu.vista_front_end || '')) return;
    
    setIsUpdating(true);
    const { error } = await supabase
      .from('submenus')
      .update({ vista_front_end: vistaFrontEnd || null, fecha_actualizacion: new Date().toISOString() })
      .eq('id', submenu.id);

    if (error) {
      toast.error('Error al actualizar ruta');
      setVistaFrontEnd(submenu.vista_front_end || '');
    } else {
      onUpdate();
    }
    setIsUpdating(false);
  };

  const handleActivoChange = async (checked: boolean) => {
    setActivo(checked);
    setIsUpdating(true);
    
    const { error } = await supabase
      .from('submenus')
      .update({ activo: checked, fecha_actualizacion: new Date().toISOString() })
      .eq('id', submenu.id);

    if (error) {
      toast.error('Error al actualizar estado');
      setActivo(submenu.activo);
    } else {
      onUpdate();
    }
    setIsUpdating(false);
  };

  const handleSoloUsuarioAChange = async (checked: boolean) => {
    setSoloUsuarioA(checked);
    setIsUpdating(true);
    
    const { error } = await supabase
      .from('submenus')
      .update({ solo_usuarioA: checked, fecha_actualizacion: new Date().toISOString() })
      .eq('id', submenu.id);

    if (error) {
      toast.error('Error al actualizar restricción');
      setSoloUsuarioA(submenu.solo_usuarioA || false);
    } else {
      onUpdate();
    }
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    
    // First delete related permissions
    await supabase
      .from('submenus_permisos')
      .delete()
      .eq('submenu_id', submenu.id);
    
    const { error } = await supabase
      .from('submenus')
      .delete()
      .eq('id', submenu.id);

    if (error) {
      toast.error('Error al eliminar submenu');
    } else {
      toast.success('Submenu eliminado');
      onUpdate();
    }
    setIsUpdating(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-muted/50 border rounded ${
        isDragging ? 'shadow-md ring-2 ring-primary' : ''
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={handleNombreBlur}
        className="max-w-[150px] h-7 text-sm"
        placeholder="Nombre"
        disabled={isUpdating}
      />
      
      <div className="flex items-center gap-1 flex-1">
        <Input
          value={vistaFrontEnd}
          onChange={(e) => setVistaFrontEnd(e.target.value)}
          onBlur={handleRutaBlur}
          className="max-w-[200px] h-7 text-sm"
          placeholder="/admin/..."
          disabled={isUpdating}
        />
        {vistaFrontEnd && !routeIsValid && (
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Esta ruta no existe en el código. Deberás crear la página manualmente.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Activo</span>
        <Switch
          checked={activo}
          onCheckedChange={handleActivoChange}
          disabled={isUpdating}
          className="scale-75"
        />
      </div>
      
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Solo Usuario A</span>
        <Switch
          checked={soloUsuarioA}
          onCheckedChange={handleSoloUsuarioAChange}
          disabled={isUpdating}
          className="scale-75"
        />
      </div>
      
      <span className="text-xs text-muted-foreground">#{submenu.id}</span>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isUpdating}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar submenu?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{submenu.nombre}" y todos sus permisos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
