/**
 * Sistema de tracking de uso de portales — Fase 2.
 *
 * Provee un context que:
 *   1. Registra una sesión en `portal_sesiones` cuando el Layout del portal
 *      monta (RPC `register_portal_session`).
 *   2. Emite un evento `page_view` por cada cambio de ruta, resolviendo
 *      automáticamente `id_menu`/`id_submenu` a partir del catálogo
 *      `menus`/`submenus` (lookup por `vista_front_end`).
 *   3. Refresca la sesión periódicamente (`touch_portal_session` cada 60s)
 *      y la cierra al desmontar o `beforeunload`.
 *   4. Escucha clicks globales con `[data-cta]` en cualquier descendiente
 *      del Layout y los emite como `cta_click`. Esto deja preparada la
 *      Fase 3 (sólo hay que poner `data-cta="<nombre>"` en los botones).
 *   5. Expone un hook `usePortalTracking()` para emitir eventos custom
 *      desde cualquier componente.
 *
 * Las RPCs están definidas en
 *   `Ejecuciones_manuales/mediciones_uso_portales_fase1.md`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Valores aceptados por `portal_sesiones.portal` (CHECK constraint).
 * Si se agrega un portal nuevo, primero hay que extender la constraint
 * en BD y luego ampliar este union.
 */
export type PortalName =
  | "admin"
  | "clientes"
  | "agentes"
  | "inmobiliarias"
  | "embajadores"
  | "cobranza"
  | "escrituracion"
  | "alta-direccion"
  | "juridico"
  | "notaria"
  | "crm"
  | "condominio"
  | "bancos";

export type EventoPortalTipo =
  | "page_view"
  | "menu_click"
  | "submenu_click"
  | "cta_click";

interface EventoPayload {
  tipo: EventoPortalTipo;
  cta_nombre?: string | null;
  id_menu?: number | null;
  id_submenu?: number | null;
  ruta?: string | null;
  metadatos?: Record<string, unknown> | null;
}

interface PortalTrackingContextValue {
  portal: PortalName;
  sessionId: string | null;
  /** Emite un evento ad-hoc. `id_menu` / `id_submenu` se resuelven solos
   *  si la ruta actual matchea con un submenú registrado. */
  emit: (evento: EventoPayload) => void;
}

const PortalTrackingContext = createContext<PortalTrackingContextValue | null>(null);

const HEARTBEAT_MS = 60_000; // 60s

/**
 * user_agent a reportar en `portal_sesiones`. Cuando la app corre dentro del
 * wrapper nativo (Despia), el UA del WebView es indistinguible de Safari/Chrome
 * móvil — se antepone el marcador `SozuClienteApp/1.0` que las RPCs de
 * mediciones ya reconocen, conservando el UA original para clasificar
 * SO/marca del dispositivo.
 */
function buildTrackedUserAgent(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent ?? "";
  const isNativeApp =
    typeof window !== "undefined" &&
    (window.Despia !== undefined || ua.includes("Despia"));
  if (!isNativeApp) return ua || null;
  const platform = window.Despia?.getPlatform?.() ?? null;
  return `SozuClienteApp/1.0${platform ? ` (${platform})` : ""} ${ua}`.trim();
}

/** Una entrada del catálogo de submenús cargada una sola vez por sesión. */
interface SubmenuLookupRow {
  id_menu: number;
  id_submenu: number;
  vista_front_end: string;
}

/** Busca el submenú que mejor matchea con `pathname`:
 *  - match exacto preferido
 *  - si no, el prefijo más largo (e.g. `/admin/portal-cliente/cargos/123`
 *    matchea `/admin/portal-cliente/cargos`).
 *  Devuelve `null` si ninguno aplica. */
function resolveSubmenu(
  pathname: string,
  catalogo: SubmenuLookupRow[],
): SubmenuLookupRow | null {
  const exact = catalogo.find((s) => s.vista_front_end === pathname);
  if (exact) return exact;
  let best: SubmenuLookupRow | null = null;
  for (const s of catalogo) {
    if (!s.vista_front_end) continue;
    if (pathname.startsWith(s.vista_front_end + "/")) {
      if (!best || s.vista_front_end.length > best.vista_front_end.length) {
        best = s;
      }
    }
  }
  return best;
}

export function PortalTrackingProvider({
  portal,
  children,
}: {
  portal: PortalName;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const lastEmittedPathRef = useRef<string | null>(null);

  // Catálogo menus/submenus — lookup ruta → ids. Cargado UNA vez por
  // sesión del usuario; staleTime infinito porque cambia muy rara vez.
  const { data: catalogo = [] } = useQuery<SubmenuLookupRow[]>({
    queryKey: ["portal-tracking-submenus"],
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("submenus")
        .select("id, menu_id, vista_front_end")
        .eq("activo", true);
      if (error) throw error;
      return ((data ?? []) as Array<{ id: number; menu_id: number; vista_front_end: string | null }>)
        .filter((r) => !!r.vista_front_end)
        .map((r) => ({
          id_menu: r.menu_id,
          id_submenu: r.id,
          vista_front_end: r.vista_front_end as string,
        }));
    },
  });

  /**
   * Emit core — llama a `registrar_evento_portal`. Acepta NULLs y
   * resuelve `id_menu`/`id_submenu` desde la ruta actual si no se pasan.
   * No-op si no hay sesión registrada todavía.
   */
  const emit = useCallback(
    (evento: EventoPayload) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const ruta = evento.ruta ?? location.pathname;
      let idMenu = evento.id_menu ?? null;
      let idSubmenu = evento.id_submenu ?? null;
      if (idMenu == null && idSubmenu == null) {
        const match = resolveSubmenu(ruta, catalogo);
        if (match) {
          idMenu = match.id_menu;
          idSubmenu = match.id_submenu;
        }
      }
      void (supabase as any).rpc("registrar_evento_portal", {
        p_session_id: sessionId,
        p_portal: portal,
        p_tipo_evento: evento.tipo,
        p_id_menu: idMenu,
        p_id_submenu: idSubmenu,
        p_cta_nombre: evento.cta_nombre ?? null,
        p_ruta: ruta,
        p_metadatos: (evento.metadatos as any) ?? null,
      });
    },
    [portal, catalogo, location.pathname],
  );

  // ── 1) Registrar sesión al montar (idempotente con heartbeat 30 min)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const userAgent = buildTrackedUserAgent();
      const { data, error } = await (supabase as any).rpc("register_portal_session", {
        p_portal: portal,
        p_user_agent: userAgent,
      });
      if (cancelled) return;
      if (error) {
        // Modo silencioso — no debe romper la UX si tracking falla.
        // eslint-disable-next-line no-console
        console.warn("[tracking] register_portal_session falló:", error);
        return;
      }
      sessionIdRef.current = (data as string) ?? null;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, portal]);

  // ── 2) page_view al cambiar de ruta (sin duplicar refrescos consecutivos)
  useEffect(() => {
    if (!sessionIdRef.current) return;
    if (lastEmittedPathRef.current === location.pathname) return;
    lastEmittedPathRef.current = location.pathname;
    emit({ tipo: "page_view" });
  }, [location.pathname, emit]);

  // ── 3) Heartbeat: refresca ultima_actividad cada 60s mientras el portal
  //       esté abierto. Crítico para distinguir "online" de "tab idle".
  useEffect(() => {
    const interval = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      void (supabase as any).rpc("touch_portal_session", { p_session_id: sid });
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  // ── 4) Cerrar sesión al desmontar / cerrar pestaña
  useEffect(() => {
    const closeSession = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      // fire-and-forget — supabase-js rpc usa fetch sin keepalive; en
      // tab-close se podría perder. El cutoff de 15 min en
      // `usuarios_online_por_portal` cubre el caso límite.
      void (supabase as any).rpc("close_portal_session", { p_session_id: sid });
    };
    const onBeforeUnload = () => closeSession();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      closeSession();
    };
  }, []);

  // ── 5) Listener global de clicks con [data-cta] — auto-instrumenta CTAs
  //       cuando se agregue el atributo en los botones (Fase 3).
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const ctaEl = target.closest("[data-cta]") as HTMLElement | null;
      if (!ctaEl) return;
      const cta = ctaEl.getAttribute("data-cta");
      if (!cta) return;
      emit({ tipo: "cta_click", cta_nombre: cta });
    };
    document.addEventListener("click", onDocClick, { capture: true });
    return () => document.removeEventListener("click", onDocClick, { capture: true });
  }, [emit]);

  const value = useMemo<PortalTrackingContextValue>(
    () => ({
      portal,
      sessionId: sessionIdRef.current,
      emit,
    }),
    [portal, emit],
  );

  return (
    <PortalTrackingContext.Provider value={value}>
      {children}
    </PortalTrackingContext.Provider>
  );
}

/**
 * Hook consumidor — útil cuando se quiere emitir un evento custom
 * (ej. `cta_click` programático sin atributo `data-cta`). Devuelve
 * `null` si se llama fuera de un PortalTrackingProvider, en cuyo caso
 * el caller debe degradar silenciosamente.
 */
export function usePortalTracking() {
  return useContext(PortalTrackingContext);
}
