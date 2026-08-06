import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { activityLoggerService } from "@/services/activityLoggerService";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { clearCollectionFilters } from "@/lib/portal-cobranza/collection-inbox-store";
import { vieneDeFlujoConfirmacion } from "@/lib/emailConfirmacion";

interface UserProfile {
  email: string;
  nombre: string;
  rol_id: number;
  rol_nombre: string;
  debe_cambiar_password: boolean;
  id_persona: number | null;
  activo: boolean;
  ver_todos_prospectos_compradores: boolean;
  ver_filtros_avanzados_eliminados: boolean;
  id_notario: number | null;
  notaria_nombre: string | null;
  id_banco: number | null;
  banco_nombre: string | null;
  id_perfil_juridico: number | null;
  puede_impersonar: boolean;
  administrar_app_clientes: boolean;
  foto_perfil_url: string | null;
  frase_perfil: string | null;
  /** usuarios.email_confirmado — si el correo ya fue verificado. */
  email_confirmado: boolean;
  /** roles.requiere_confirmacion_email — true solo en roles de portal/externos. */
  requiere_confirmacion_email: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  /** True mientras get_current_user_profile está en vuelo (incluye reintentos). */
  isProfileLoading: boolean;
  mustChangePassword: boolean;
  permissionVersion: number; // Incremented when permissions change
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  triggerPermissionRefresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Inactivity timeout: 5 minutes
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [permissionVersion, setPermissionVersion] = useState(0);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchProfile = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout")), 15000)
      );
      const fetchPromise = supabase.rpc("get_current_user_profile");
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
        return;
      }

      if (data && data.length > 0) {
        const row = data[0] as Partial<UserProfile>;
        // La RPC nueva devuelve email_confirmado / requiere_confirmacion_email.
        // Mientras la migración no esté desplegada esas columnas llegan undefined:
        // los defaults tolerantes (confirmado / no requiere confirmación) evitan
        // que el gate bloquee a nadie contra una BD vieja.
        const base: UserProfile = {
          ...(row as UserProfile),
          email_confirmado: row.email_confirmado ?? true,
          requiere_confirmacion_email: row.requiere_confirmacion_email ?? false,
        };

        // Reparación de la divergencia auth.users.email_confirmed_at (no nulo)
        // vs usuarios.email_confirmado (false). `mark_email_confirmed` sube la
        // bandera y sigue haciendo falta para los usuarios migrados en masa, que
        // llegan confirmados en Auth pero con la columna en false.
        //
        // Se ejecuta DESPUÉS de leer el perfil y solo en los casos en que no
        // anula el gate de EmailNoConfirmado. Antes corría siempre y dos líneas
        // antes del SELECT: borraba la única divergencia que el gate podía
        // detectar, así que la pantalla nunca se pintaba.
        //   · rol interno (requiere_confirmacion_email = false): la bandera es
        //     puro dato heredado, no hay gate que proteger → se repara.
        //   · rol de portal que ACABA de confirmar por enlace en esta pestaña:
        //     la confirmación es real y la columna aún no se propagó → se repara.
        //   · rol de portal sin rastro de confirmación: NO se toca. Si la bandera
        //     está en false ahí es señal legítima y el gate debe verla.
        const puedeRepararBandera =
          !base.email_confirmado &&
          (!base.requiere_confirmacion_email || vieneDeFlujoConfirmacion(base.email));
        if (puedeRepararBandera) {
          try {
            await supabase.rpc("mark_email_confirmed");
          } catch (e) {
            console.error("Error marking email confirmed:", e);
          }
        }

        // La RPC get_current_user_profile no devuelve la foto/frase de perfil;
        // se traen por separado desde usuarios para el avatar del header.
        let foto_perfil_url: string | null = null;
        let frase_perfil: string | null = null;
        let email_confirmado = base.email_confirmado;
        try {
          const { data: u } = await (supabase as any)
            .from("usuarios")
            .select("foto_perfil_url, frase_perfil, email_confirmado")
            .eq("email", base.email)
            .maybeSingle();
          foto_perfil_url = u?.foto_perfil_url ?? null;
          frase_perfil = u?.frase_perfil ?? null;
          // Releer la bandera aquí evita un round-trip extra: dice si la
          // reparación realmente prosperó (la RPC no hace nada cuando Auth
          // tampoco tiene el correo confirmado).
          if (puedeRepararBandera && typeof u?.email_confirmado === "boolean") {
            email_confirmado = u.email_confirmado;
          }
        } catch (e) {
          console.error("Error fetching perfil foto:", e);
        }
        setProfile({ ...base, email_confirmado, foto_perfil_url, frase_perfil });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error in fetchProfile:", err);
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const triggerPermissionRefresh = useCallback(() => {
    setPermissionVersion((v) => v + 1);
  }, []);

  const handleForceLogout = useCallback(async () => {
    // Clean up realtime channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    // Force reload to ensure clean state
    window.location.href = "/auth/login";
  }, []);

  // Visibility change: refresh permissions when tab becomes visible (throttled 30s)
  const lastVisibilityRefreshRef = useRef<number>(0);
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user && profile) {
        const now = Date.now();
        if (now - lastVisibilityRefreshRef.current > 30000) {
          lastVisibilityRefreshRef.current = now;
          triggerPermissionRefresh();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, profile, triggerPermissionRefresh]);

  // Set up realtime subscriptions for permission changes
  useEffect(() => {
    if (!user || !profile) return;

    const userEmail = user.email;
    const rolId = profile.rol_id;

    // Clean up existing channel if any
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create a single channel for all permission-related subscriptions
    const channel = supabase.channel("auth-permission-updates");

    // 1. Subscribe to user status changes (activo field)
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "usuarios",
        filter: `email=eq.${userEmail}`,
      },
      (payload) => {
        const newRecord = payload.new as { activo?: boolean; rol_id?: number };

        // If user was deactivated, force logout
        if (newRecord.activo === false) {
          console.log("User deactivated, forcing logout");
          handleForceLogout();
          return;
        }

        // If role changed, refresh profile and permissions
        if (newRecord.rol_id !== rolId) {
          console.log("User role changed, refreshing permissions");
          fetchProfile();
          triggerPermissionRefresh();
        }
      },
    );

    // 2. Subscribe to role permission changes (submenus_permisos)
    channel.on(
      "postgres_changes",
      {
        event: "*", // INSERT, UPDATE, DELETE
        schema: "public",
        table: "submenus_permisos",
        filter: `rol_id=eq.${rolId}`,
      },
      () => {
        console.log("Role permissions changed, refreshing");
        triggerPermissionRefresh();
      },
    );

    // 3. Subscribe to role configuration changes
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "roles",
        filter: `id=eq.${rolId}`,
      },
      () => {
        console.log("Role configuration changed, refreshing");
        fetchProfile();
        triggerPermissionRefresh();
      },
    );

    // 4. Subscribe to project access changes for this user
    if (userEmail) {
      channel.on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "proyectos_acceso",
          filter: `usuario_id=eq.${userEmail}`,
        },
        () => {
          console.log("Project access changed, refreshing");
          triggerPermissionRefresh();
        },
      );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Real-time permission subscriptions active");
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [user, profile?.rol_id, profile?.email, fetchProfile, triggerPermissionRefresh, handleForceLogout]);

  useEffect(() => {
    let isMounted = true;
    let profileFetchPromise: Promise<void> | null = null;
    let currentUserId: string | null = null;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      // Si es solo un refresh de token y el usuario es el mismo, solo actualizar sesión
      // Esto evita re-cargar el perfil innecesariamente al cambiar de pestaña
      if (event === "TOKEN_REFRESHED" && currentUserId && newSession?.user?.id === currentUserId) {
        setSession(newSession);
        return; // No disparar re-carga de perfil
      }

      currentUserId = newSession?.user?.id ?? null;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Defer profile fetch to avoid Supabase deadlock
        profileFetchPromise = fetchProfile().finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      currentUserId = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile().finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Registrar intento fallido
        activityLoggerService.registrarInicioSesion(email, "error", error.message);
        return { error };
      }

      // Registrar inicio de sesión exitoso
      activityLoggerService.registrarInicioSesion(email, "exito");

      // fetchProfile decide si toca reparar usuarios.email_confirmado
      // (ver el bloque `puedeRepararBandera`); no hay que llamarlo aquí.

      return { error: null };
    } catch (err) {
      activityLoggerService.registrarInicioSesion(email, "error", (err as Error).message);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    const userEmail = profile?.email || user?.email || "desconocido";
    activityLoggerService.registrarCierreSesion(userEmail);

    // Clean up realtime channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    await supabase.auth.signOut();
    clearCollectionFilters(); // collection filters must not survive a user switch
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Handle inactivity logout
  const handleInactivityTimeout = useCallback(async () => {
    console.log("Session expired due to inactivity");
    try {
      // Clean up realtime channel
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error during inactivity signOut:", err);
    }
    clearCollectionFilters();
    // Siempre redirigir, sin importar si signOut falló
    window.location.href = "/auth/login?reason=inactivity";
  }, []);

  // Auto-logout after inactivity - only active when user is logged in
  useInactivityTimeout({
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    onTimeout: handleInactivityTimeout,
    enabled: !!user && !isLoading,
  });

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error };
      }

      // Mark password as changed in usuarios table
      await supabase.rpc("mark_password_changed");

      // Refresh profile to get updated debe_cambiar_password
      await fetchProfile();

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isProfileLoading,
    mustChangePassword: profile?.debe_cambiar_password ?? false,
    permissionVersion,
    signIn,
    signOut,
    updatePassword,
    refreshProfile,
    triggerPermissionRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
