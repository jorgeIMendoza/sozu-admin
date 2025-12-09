import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ChevronDown, ChevronRight, Loader2, Check, X, Save, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Role {
  id: number;
  nombre: string;
  activo: boolean;
}

interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface Menu {
  id: number;
  nombre: string;
  submenus: Submenu[];
}

interface Submenu {
  id: number;
  nombre: string;
  menu_id: number;
}

interface SubmenuPermiso {
  submenu_id: number;
  permiso_id: number;
  rol_id: number;
  activo: boolean;
}

export default function RolesPermisos() {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [isNewRoleDialogOpen, setIsNewRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch roles
  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['roles-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, nombre, activo')
        .order('id');
      
      if (error) throw error;
      return data as Role[];
    },
  });

  // Fetch permisos
  const { data: permisos = [] } = useQuery({
    queryKey: ['permisos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permisos')
        .select('id, nombre, descripcion')
        .eq('activo', true)
        .order('id');
      
      if (error) throw error;
      return data as Permiso[];
    },
  });

  // Fetch menus with submenus
  const { data: menus = [] } = useQuery({
    queryKey: ['menus-submenus'],
    queryFn: async () => {
      const { data: menusData, error: menusError } = await supabase
        .from('menus')
        .select('id, nombre')
        .eq('activo', true)
        .order('id');
      
      if (menusError) throw menusError;

      const { data: submenusData, error: submenusError } = await supabase
        .from('submenus')
        .select('id, nombre, menu_id')
        .eq('activo', true)
        .order('id');
      
      if (submenusError) throw submenusError;

      return (menusData || []).map(menu => ({
        ...menu,
        submenus: (submenusData || []).filter(s => s.menu_id === menu.id)
      })) as Menu[];
    },
  });

  // Fetch submenus_permisos for selected role
  const { data: rolePermisos = [], isLoading: loadingPermisos } = useQuery({
    queryKey: ['role-permisos', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      
      const { data, error } = await supabase
        .from('submenus_permisos')
        .select('submenu_id, permiso_id, rol_id, activo')
        .eq('rol_id', selectedRoleId)
        .eq('activo', true);
      
      if (error) throw error;
      return data as SubmenuPermiso[];
    },
    enabled: !!selectedRoleId,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (nombre: string) => {
      const { data, error } = await supabase
        .from('roles')
        .insert({ nombre, activo: true })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-management'] });
      toast.success('Rol creado correctamente');
      setIsNewRoleDialogOpen(false);
      setNewRoleName("");
    },
    onError: (error) => {
      toast.error(`Error al crear el rol: ${error.message}`);
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, nombre }: { id: number; nombre: string }) => {
      const { error } = await supabase
        .from('roles')
        .update({ nombre, fecha_actualizacion: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-management'] });
      toast.success('Rol actualizado correctamente');
      setIsEditRoleDialogOpen(false);
      setEditingRole(null);
    },
    onError: (error) => {
      toast.error(`Error al actualizar el rol: ${error.message}`);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('roles')
        .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-management'] });
      toast.success('Rol eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      if (selectedRoleId === roleToDelete?.id) {
        setSelectedRoleId(null);
      }
    },
    onError: (error) => {
      toast.error(`Error al eliminar el rol: ${error.message}`);
    },
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoleId || pendingChanges.size === 0) return;

      for (const [key, shouldHave] of pendingChanges) {
        const [submenuId, permisoId] = key.split('-').map(Number);
        
        if (shouldHave) {
          // Insert or update to active
          const { error } = await supabase
            .from('submenus_permisos')
            .upsert({
              submenu_id: submenuId,
              permiso_id: permisoId,
              rol_id: selectedRoleId,
              activo: true,
            }, {
              onConflict: 'submenu_id,permiso_id,rol_id'
            });
          if (error) throw error;
        } else {
          // Deactivate
          const { error } = await supabase
            .from('submenus_permisos')
            .update({ activo: false })
            .eq('submenu_id', submenuId)
            .eq('permiso_id', permisoId)
            .eq('rol_id', selectedRoleId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permisos', selectedRoleId] });
      toast.success('Permisos guardados correctamente');
      setPendingChanges(new Map());
    },
    onError: (error) => {
      toast.error(`Error al guardar permisos: ${error.message}`);
    },
  });

  // Check if permission is active for current role
  const hasPermission = (submenuId: number, permisoId: number): boolean => {
    const key = `${submenuId}-${permisoId}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    return rolePermisos.some(
      rp => rp.submenu_id === submenuId && rp.permiso_id === permisoId && rp.activo
    );
  };

  // Toggle permission
  const togglePermission = (submenuId: number, permisoId: number) => {
    const key = `${submenuId}-${permisoId}`;
    const currentValue = hasPermission(submenuId, permisoId);
    
    const newChanges = new Map(pendingChanges);
    
    // Check if the new value is the same as the original
    const originalValue = rolePermisos.some(
      rp => rp.submenu_id === submenuId && rp.permiso_id === permisoId && rp.activo
    );
    
    if (originalValue === !currentValue) {
      newChanges.delete(key);
    } else {
      newChanges.set(key, !currentValue);
    }
    
    setPendingChanges(newChanges);
  };

  // Toggle menu expansion
  const toggleMenu = (menuId: number) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  // Expand all menus
  const expandAll = () => {
    setExpandedMenus(new Set(menus.map(m => m.id)));
  };

  // Collapse all menus
  const collapseAll = () => {
    setExpandedMenus(new Set());
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const activeRoles = roles.filter(r => r.activo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Roles y Permisos
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los roles del sistema y sus permisos por módulo
          </p>
        </div>
        <Button onClick={() => setIsNewRoleDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Rol
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Roles</CardTitle>
            <CardDescription>
              {activeRoles.length} roles activos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-3">
                {loadingRoles ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  activeRoles.map((role) => (
                    <div
                      key={role.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedRoleId === role.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        setSelectedRoleId(role.id);
                        setPendingChanges(new Map());
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-medium">{role.nombre}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${selectedRoleId === role.id ? 'hover:bg-primary-foreground/20' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRole(role);
                            setIsEditRoleDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {role.id !== 1 && ( // Can't delete Super Admin
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${selectedRoleId === role.id ? 'hover:bg-primary-foreground/20' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleToDelete(role);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Permissions Matrix */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedRole ? `Permisos: ${selectedRole.nombre}` : 'Selecciona un rol'}
                </CardTitle>
                <CardDescription>
                  {selectedRole 
                    ? 'Configura los permisos por módulo para este rol'
                    : 'Selecciona un rol de la lista para configurar sus permisos'
                  }
                </CardDescription>
              </div>
              {selectedRole && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expandir todo
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Colapsar todo
                  </Button>
                  {pendingChanges.size > 0 && (
                    <Button 
                      size="sm" 
                      onClick={() => savePermissionsMutation.mutate()}
                      disabled={savePermissionsMutation.isPending}
                    >
                      {savePermissionsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar ({pendingChanges.size} cambios)
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRole ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Shield className="h-12 w-12 mb-4 opacity-50" />
                <p>Selecciona un rol para configurar sus permisos</p>
              </div>
            ) : loadingPermisos ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                {/* Permissions header */}
                <div className="sticky top-0 bg-background z-10 border-b pb-2 mb-2">
                  <div className="grid gap-2" style={{ gridTemplateColumns: `200px repeat(${permisos.length}, 80px)` }}>
                    <div className="font-medium text-sm">Módulo</div>
                    {permisos.map(permiso => (
                      <div key={permiso.id} className="text-center">
                        <Badge variant="outline" className="text-xs capitalize">
                          {permiso.nombre}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Menus and submenus */}
                <div className="space-y-2">
                  {menus.map(menu => (
                    <Collapsible 
                      key={menu.id} 
                      open={expandedMenus.has(menu.id)}
                      onOpenChange={() => toggleMenu(menu.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                          {expandedMenus.has(menu.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium text-sm">{menu.nombre}</span>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {menu.submenus.length} submenús
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1 pl-6 pt-2">
                          {menu.submenus.map(submenu => (
                            <div 
                              key={submenu.id} 
                              className="grid gap-2 py-2 border-b border-border/50 last:border-0"
                              style={{ gridTemplateColumns: `200px repeat(${permisos.length}, 80px)` }}
                            >
                              <div className="text-sm text-muted-foreground truncate">
                                {submenu.nombre}
                              </div>
                              {permisos.map(permiso => {
                                const isChecked = hasPermission(submenu.id, permiso.id);
                                const key = `${submenu.id}-${permiso.id}`;
                                const hasChange = pendingChanges.has(key);
                                
                                return (
                                  <div key={permiso.id} className="flex justify-center">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => togglePermission(submenu.id, permiso.id)}
                                      className={hasChange ? 'border-amber-500 data-[state=checked]:bg-amber-500' : ''}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Role Dialog */}
      <Dialog open={isNewRoleDialogOpen} onOpenChange={setIsNewRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Rol</DialogTitle>
            <DialogDescription>
              Ingresa el nombre del nuevo rol. Podrás configurar sus permisos después.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Nombre del rol</Label>
              <Input
                id="roleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ej: Supervisor de ventas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createRoleMutation.mutate(newRoleName)}
              disabled={!newRoleName.trim() || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear Rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Rol</DialogTitle>
            <DialogDescription>
              Modifica el nombre del rol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editRoleName">Nombre del rol</Label>
              <Input
                id="editRoleName"
                value={editingRole?.nombre || ''}
                onChange={(e) => setEditingRole(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                placeholder="Nombre del rol"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => editingRole && updateRoleMutation.mutate({ id: editingRole.id, nombre: editingRole.nombre })}
              disabled={!editingRole?.nombre.trim() || updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el rol "{roleToDelete?.nombre}"? 
              Esta acción desactivará el rol y todos los usuarios con este rol perderán acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && deleteRoleMutation.mutate(roleToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}