import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";
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
  const [portalesExpanded, setPortalesExpanded] = useState(false);
 
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
             <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
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
             <nav className="px-3 py-2 space-y-0.5">
               {(() => {
                 const coreItems = menuItems.filter(item => !item.isPortal);
                 const portalItems = menuItems
                   .filter(item => item.isPortal)
                   .sort((a, b) => a.title.localeCompare(b.title, 'es'));

                 const renderPortalLink = (item: DynamicMenuItem, index: number) => {
                   const portalActive = item.href ? currentPath.startsWith("/" + item.href.split('/').slice(1, 3).join('/')) : false;
                   return (
                     <div key={`portal-${index}`}>
                       <Link
                         to={item.href!}
                         className={cn(
                           "group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150",
                           portalActive
                             ? "bg-primary/[0.06] text-primary"
                             : item.isRestrictedPortal
                               ? "text-blue-600/80 dark:text-blue-400/80 hover:bg-blue-500/[0.06] hover:text-blue-600 dark:hover:text-blue-400"
                               : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                         )}
                         onClick={onClose}
                       >
                         <span className={cn(
                           "absolute left-0 top-0 bottom-0 w-[2px] rounded-r transition-opacity duration-150",
                           item.isRestrictedPortal ? "bg-blue-500" : "bg-primary",
                           portalActive ? "opacity-100" : "opacity-0"
                         )} />
                         <item.icon className={cn(
                           "size-4 shrink-0",
                           portalActive ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                         )} />
                         <span className="flex-1 leading-snug">{item.title}</span>
                         <ExternalLink className="size-3 shrink-0 opacity-40 self-start mt-[3px]" />
                       </Link>
                     </div>
                   );
                 };

                 return (
                   <>
                     {/* Portal section — collapsible, shown first */}
                     {portalItems.length > 0 && (
                       <div className="pb-1">
                         <button
                           onClick={() => setPortalesExpanded(prev => !prev)}
                           className="group w-full flex items-center gap-2 pl-4 pr-3 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150"
                         >
                           <span className="flex-1 text-left text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/80">
                             Portales
                           </span>
                           <ChevronDown className={cn(
                             "size-4 shrink-0 text-foreground/70 transition-transform duration-200",
                             portalesExpanded ? "rotate-180" : ""
                           )} />
                         </button>
                         {portalesExpanded && (
                           <div className="mt-0.5 space-y-0.5">
                             {portalItems.map((item, index) => renderPortalLink(item, index))}
                           </div>
                         )}
                       </div>
                     )}

                     {/* Divider */}
                     {portalItems.length > 0 && coreItems.length > 0 && (
                       <div className="my-1 mx-1 h-px bg-border-soft" />
                     )}

                     {coreItems.map((item, index) => (
                       <div key={index}>
                         {item.href ? (
                           <Link
                             to={item.href}
                             className={cn(
                               "group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150",
                               currentPath === item.href
                                 ? "bg-primary/[0.06] text-primary"
                                 : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                             )}
                             onClick={onClose}
                           >
                             <span className={cn(
                               "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                               currentPath === item.href ? "opacity-100" : "opacity-0"
                             )} />
                             <item.icon className={cn(
                               "size-4 shrink-0",
                               currentPath === item.href ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                             )} />
                             <span className="flex-1 min-w-0 truncate">{item.title}</span>
                           </Link>
                         ) : (
                           <div className="space-y-0.5">
                             <button
                               onClick={() => toggleGroup(item.title)}
                               className={cn(
                                 "group w-full flex items-center gap-3 pl-4 pr-3 py-2 text-[13px] font-medium rounded-md transition-colors duration-150",
                                 item.isSoloA
                                   ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-400 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                   : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                               )}
                             >
                               <item.icon className="size-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-150" />
                               <span className="flex-1 min-w-0 text-left truncate">{item.title}</span>
                               {expandedGroups.has(item.title) ? (
                                 <ChevronDown className="size-3.5 shrink-0 opacity-80" />
                               ) : (
                                 <ChevronRight className="size-3.5 shrink-0 opacity-80" />
                               )}
                             </button>
                             {expandedGroups.has(item.title) && (
                               <div className="ml-4 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                                 {item.children?.map((child, childIndex) => {
                                   const isBlocked = isRouteBlocked(child.href);
                                   if (isBlocked) {
                                     return (
                                       <TooltipProvider key={childIndex} delayDuration={100}>
                                         <Tooltip>
                                           <TooltipTrigger asChild>
                                             <div className="flex items-center justify-between pl-4 pr-3 py-2 rounded-md text-[13px] font-medium text-muted-foreground/50 cursor-not-allowed">
                                               <div className="flex items-center gap-3">
                                                 <child.icon className="size-4 shrink-0" />
                                                 <span className="min-w-0 truncate">{child.title}</span>
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
                                         "group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150",
                                         currentPath === child.href
                                           ? "bg-primary/[0.06] text-primary"
                                           : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                       )}
                                       onClick={onClose}
                                     >
                                       <span className={cn(
                                         "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                                         currentPath === child.href ? "opacity-100" : "opacity-0"
                                       )} />
                                       <child.icon className={cn(
                                         "size-4 shrink-0",
                                         currentPath === child.href ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                                       )} />
                                       <span className="flex-1 min-w-0 truncate">{child.title}</span>
                                     </Link>
                                   );
                                 })}
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     ))}
                   </>
                 );
               })()}
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
