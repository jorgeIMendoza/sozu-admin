import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Settings } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableMenuCard } from '@/components/admin/SortableMenuCard';
import { SortableSubmenuRow } from '@/components/admin/SortableSubmenuRow';
import { NewSubmenuDialog } from '@/components/admin/NewSubmenuDialog';
import { toast } from 'sonner';

interface Menu {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
}

interface Submenu {
  id: number;
  nombre: string;
  vista_front_end: string | null;
  menu_id: number;
  orden: number;
  activo: boolean;
  solo_usuarioA?: boolean;
}

export default function AdministrarMenus() {
  const queryClient = useQueryClient();
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [showNewSubmenuDialog, setShowNewSubmenuDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: menus = [], isLoading: loadingMenus } = useQuery({
    queryKey: ['admin-menus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('id, nombre, orden, activo')
        .order('orden');
      if (error) throw error;
      return data as Menu[];
    },
  });

  const { data: submenus = [], isLoading: loadingSubmenus } = useQuery({
    queryKey: ['admin-submenus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submenus')
        .select('id, nombre, vista_front_end, menu_id, orden, activo')
        .order('orden');
      if (error) throw error;
      // Cast to include solo_usuarioA which exists in DB but not in generated types yet
      return data as unknown as Submenu[];
    },
  });

  const toggleMenu = (menuId: number) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-menus'] });
    queryClient.invalidateQueries({ queryKey: ['admin-submenus'] });
  };

  const handleMenuDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = menus.findIndex(m => m.id === active.id);
    const newIndex = menus.findIndex(m => m.id === over.id);
    
    const newMenus = arrayMove(menus, oldIndex, newIndex);
    
    // Update orden in DB
    try {
      const updates = newMenus.map((menu, index) => 
        supabase
          .from('menus')
          .update({ orden: index + 1 })
          .eq('id', menu.id)
      );
      await Promise.all(updates);
      toast.success('Orden actualizado');
      refetch();
    } catch (error) {
      toast.error('Error al reordenar');
    }
  };

  const handleSubmenuDragEnd = async (event: DragEndEvent, menuId: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const menuSubmenus = submenus.filter(s => s.menu_id === menuId);
    const oldIndex = menuSubmenus.findIndex(s => `submenu-${s.id}` === active.id);
    const newIndex = menuSubmenus.findIndex(s => `submenu-${s.id}` === over.id);
    
    const newSubmenus = arrayMove(menuSubmenus, oldIndex, newIndex);
    
    // Update orden in DB
    try {
      const updates = newSubmenus.map((submenu, index) => 
        supabase
          .from('submenus')
          .update({ orden: index + 1 })
          .eq('id', submenu.id)
      );
      await Promise.all(updates);
      toast.success('Orden actualizado');
      refetch();
    } catch (error) {
      toast.error('Error al reordenar');
    }
  };

  const isLoading = loadingMenus || loadingSubmenus;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Administrar Menus</h1>
        </div>
        <Button onClick={() => setShowNewSubmenuDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Submenu
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Menus Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Menus (Grupos)</CardTitle>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleMenuDragEnd}
              >
                <SortableContext
                  items={menus.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {menus.map(menu => (
                      <SortableMenuCard
                        key={menu.id}
                        menu={menu}
                        onUpdate={refetch}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          {/* Submenus Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Submenus (por grupo)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {menus.map(menu => {
                  const menuSubmenus = submenus.filter(s => s.menu_id === menu.id);
                  const isExpanded = expandedMenus.has(menu.id);
                  
                  return (
                    <Collapsible key={menu.id} open={isExpanded} onOpenChange={() => toggleMenu(menu.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-2 px-3"
                        >
                          <span className="font-medium">{menu.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              ({menuSubmenus.length})
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-4 mt-2 space-y-1">
                          {menuSubmenus.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              Sin submenus
                            </p>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleSubmenuDragEnd(e, menu.id)}
                            >
                              <SortableContext
                                items={menuSubmenus.map(s => `submenu-${s.id}`)}
                                strategy={verticalListSortingStrategy}
                              >
                                {menuSubmenus.map(submenu => (
                                  <SortableSubmenuRow
                                    key={submenu.id}
                                    submenu={submenu}
                                    onUpdate={refetch}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <NewSubmenuDialog
        open={showNewSubmenuDialog}
        onOpenChange={setShowNewSubmenuDialog}
        menus={menus}
        onSuccess={refetch}
      />
    </div>
  );
}
