import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useDynamicMenus, DynamicMenuItem } from "@/hooks/useDynamicMenus";
import { useInmobiliariaDataStatus } from "@/hooks/useInmobiliariaDataStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronRight, LogOut, X, Lock, ExternalLink } from "lucide-react";
 
 interface AdminSidebarProps {
   isOpen: boolean;
   onClose: () => void;
   currentPath: string;
 }
 
export const AdminSidebar = ({ isOpen, onClose, currentPath }: AdminSidebarProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { menuItems, isLoading: isLoadingMenus, isSuperAdmin } = useDynamicMenus();

  // Check if user is Inmobiliaria role (rol_id 4)
  const isInmobiliariaRole = profile?.rol_id === 4;

  // Fetch inmobiliaria data for Inmobiliaria role users
  // For primary users: id_persona points to the inmobiliaria
  // For secondary users: we need to look up via entidades_relacionadas
  const { data: inmobiliariaData } = useQuery({
    queryKey: ['sidebar-inmobiliaria-data', profile?.id_persona, profile?.email],
    queryFn: async () => {
      if (!profile) return null;

      // First check if user's persona IS the inmobiliaria (primary user)
      if (profile.id_persona) {
        const { data: personaData, error: personaError } = await supabase
          .from('personas')
          .select('id, nombre_legal, nombre_comercial, url_logo, email')
          .eq('id', profile.id_persona)
          .single();

        if (!personaError && personaData) {
          // Check if this persona is an inmobiliaria (tipo_entidad = 5)
          const { data: entidadData } = await supabase
            .from('entidades_relacionadas')
            .select('id')
            .eq('id_persona', profile.id_persona)
            .eq('id_tipo_entidad', 5)
            .eq('activo', true)
            .maybeSingle();

          if (entidadData) {
            // User's persona IS the inmobiliaria
            return {
              nombre_legal: personaData.nombre_legal,
              nombre_comercial: personaData.nombre_comercial,
              logo_url: personaData.url_logo,
              inmobiliaria_id: personaData.id,
            };
          }
        }
      }

      // Secondary user: look up inmobiliaria via proyectos_acceso -> entidades_relacionadas
      if (profile.email) {
        const { data: proyectoAcceso } = await supabase
          .from('proyectos_acceso')
          .select('id_entidad_relacionada_dueno')
          .eq('usuario_id', profile.email)
          .eq('activo', true)
          .not('id_entidad_relacionada_dueno', 'is', null)
          .limit(1)
          .maybeSingle();

        if (proyectoAcceso?.id_entidad_relacionada_dueno) {
          const { data: entidadDuena } = await supabase
            .from('entidades_relacionadas')
            .select('id_persona, personas!entidades_relacionadas_id_persona_fkey(id, nombre_legal, nombre_comercial, url_logo)')
            .eq('id', proyectoAcceso.id_entidad_relacionada_dueno)
            .eq('activo', true)
            .maybeSingle();

          if (entidadDuena?.personas) {
            const inmob = entidadDuena.personas as any;
            return {
              nombre_legal: inmob.nombre_legal,
              nombre_comercial: inmob.nombre_comercial,
              logo_url: inmob.url_logo,
              inmobiliaria_id: inmob.id,
            };
          }
        }
      }

      return null;
    },
    enabled: isInmobiliariaRole && !!profile,
  });

  // Use the hook to check if inmobiliaria data is complete
  const { isDataComplete, missingFields, isLoading: isLoadingDataStatus } = useInmobiliariaDataStatus(
    isInmobiliariaRole ? profile?.id_persona : null
  );

  // Routes that should be blocked when data is incomplete
  const blockedRoutes = [
    '/admin/inmobiliarias/mis-propiedades',
    '/admin/inmobiliarias/mis-ventas',
    '/admin/inmobiliarias/mis-agentes',
  ];

  const isRouteBlocked = (href: string) => {
    if (isSuperAdmin) return false; // Super Admin always has access
    if (!isInmobiliariaRole) return false;
    return !isDataComplete && blockedRoutes.includes(href);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };
 
   // Get user initials for avatar
   const getInitials = (name: string | undefined) => {
     if (!name) return "U";
     const parts = name.split(" ");
     if (parts.length >= 2) {
       return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
     }
     return name.substring(0, 2).toUpperCase();
   };
 
   // Auto-expand the group that contains the current path
   const getInitialExpandedGroups = (items: DynamicMenuItem[]) => {
     const expanded = new Set<string>();
     items.forEach(item => {
       if (item.children) {
         const hasActiveChild = item.children.some(child => currentPath === child.href);
         if (hasActiveChild) {
           expanded.add(item.title);
         }
       }
     });
     return expanded;
   };
 
   const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
 
   // Update expanded groups when menuItems change
   useEffect(() => {
     if (menuItems.length > 0) {
       setExpandedGroups(getInitialExpandedGroups(menuItems));
     }
   }, [menuItems, currentPath]);
 
   const toggleGroup = (groupTitle: string) => {
     const newExpanded = new Set(expandedGroups);
     if (newExpanded.has(groupTitle)) {
       newExpanded.delete(groupTitle);
     } else {
       newExpanded.add(groupTitle);
     }
     setExpandedGroups(newExpanded);
   };
 
   return (
     <>
       {/* Overlay for mobile */}
       {isOpen && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
           onClick={onClose}
         />
       )}
       
       {/* Sidebar */}
       <div className={cn(
         "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
         isOpen ? "translate-x-0" : "-translate-x-full"
       )}>
         {/* Brand */}
         <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1 flex-shrink-0">
           <div className="flex items-center justify-between">
             <SozuLogo className="h-6" />
             <button
               onClick={onClose}
               className="lg:hidden p-1 rounded-md hover:bg-accent transition-colors"
             >
               <X className="h-5 w-5" />
             </button>
           </div>
           <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
             {isInmobiliariaRole ? "By Sozu" : "Admin Panel"}
           </p>
         </div>
 
         {/* Navigation - con scroll */}
         <div className="flex-1 overflow-hidden">
           <ScrollArea className="h-full">
           {isLoadingMenus ? (
             <div className="flex items-center justify-center py-8">
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
           ) : (
             <nav className="py-4 space-y-2 px-4">
               {menuItems.map((item, index) => (
                 <div key={index}>
                   {item.href && item.isPortal ? (
                     <Link
                       to={item.href}
                       className={cn(
                         "flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium border",
                         item.isRestrictedPortal
                           ? currentPath.startsWith("/" + item.href.split('/').slice(1, 3).join('/'))
                             ? "bg-blue-600 text-white border-blue-600"
                             : "bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-400 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50"
                           : currentPath.startsWith("/" + item.href.split('/').slice(1, 3).join('/'))
                             ? "bg-primary text-primary-foreground border-primary"
                             : "bg-accent/60 border-border hover:bg-accent hover:border-primary/40 text-foreground"
                       )}
                       onClick={onClose}
                     >
                       <div className="flex items-center space-x-3">
                         <item.icon className="h-5 w-5" />
                         <span>{item.title}</span>
                       </div>
                       <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                     </Link>
                   ) : item.href ? (
                     <Link
                       to={item.href}
                       className={cn(
                         "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                         currentPath === item.href
                           ? "bg-primary text-primary-foreground"
                           : "hover:bg-accent"
                       )}
                       onClick={onClose}
                     >
                       <item.icon className="h-5 w-5" />
                       <span>{item.title}</span>
                     </Link>
                   ) : (
                     <div className="space-y-1">
                       <button
                         onClick={() => toggleGroup(item.title)}
                         className={cn(
                           "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all border",
                           item.isSoloA
                             ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-400 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50"
                             : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                         )}
                       >
                         <div className="flex items-center space-x-3">
                           <item.icon className="h-5 w-5" />
                           <span>{item.title}</span>
                         </div>
                         {expandedGroups.has(item.title) ? (
                           <ChevronDown className="h-4 w-4 transition-transform" />
                         ) : (
                           <ChevronRight className="h-4 w-4 transition-transform" />
                         )}
                       </button>
                       {expandedGroups.has(item.title) && (
                         <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                           {item.children?.map((child, childIndex) => {
                             const isBlocked = isRouteBlocked(child.href);
                             if (isBlocked) {
                               return (
                                 <TooltipProvider key={childIndex} delayDuration={100}>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <div className="flex items-center justify-between pl-8 pr-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed">
                                         <div className="flex items-center space-x-3">
                                           <child.icon className="h-4 w-4" />
                                           <span>{child.title}</span>
                                         </div>
                                         <Lock className="h-3 w-3" />
                                       </div>
                                     </TooltipTrigger>
                                     <TooltipContent side="right" className="max-w-xs">
                                       <p className="font-medium">Sección bloqueada</p>
                                       <p className="text-xs text-muted-foreground mt-1">
                                         Completa la información en "Mi Información" para habilitar esta sección.
                                       </p>
                                     </TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               );
                             }
                             return (
                               <Link
                                 key={childIndex}
                                 to={child.href}
                                 className={cn(
                                   "flex items-center space-x-3 pl-8 pr-3 py-2 rounded-lg transition-colors text-sm",
                                   currentPath === child.href
                                     ? "bg-primary text-primary-foreground"
                                     : "hover:bg-accent"
                                 )}
                                 onClick={onClose}
                               >
                                 <child.icon className="h-4 w-4" />
                                 <span>{child.title}</span>
                               </Link>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               ))}
             </nav>
           )}
           </ScrollArea>
         </div>
 
         {/* Footer */}
         <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
           <div className="w-full flex items-center gap-3 px-2 py-2 rounded-md">
             <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
               {getInitials(profile?.nombre)}
             </div>
             <div className="flex-1 text-left min-w-0">
               <p className="text-[13px] font-medium text-foreground truncate">{profile?.nombre || "Usuario"}</p>
               <p className="text-[11px] text-muted-foreground truncate">{profile?.rol_nombre || "Sin rol"}</p>
             </div>
           </div>
           <button
             onClick={handleSignOut}
             className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
           >
             <LogOut className="size-4 shrink-0" />
             Cerrar sesión
           </button>
           <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
         </div>
       </div>
     </>
   );
 };
