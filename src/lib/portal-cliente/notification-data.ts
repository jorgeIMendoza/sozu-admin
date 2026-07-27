// ── Notification Center: tipos, fetch desde BD y mutaciones ──

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";

// ── Types ──

export type NotificationType = "urgent" | "actionable" | "informative" | "success";

export type NotificationCategory =
  | "payments" | "documents" | "maintenance"
  | "construction" | "resale" | "delivery";

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  actionLabel: string;
  actionUrl: string;
  propertyId?: string;
  read?: boolean;
  dismissed?: boolean;
}

// ── DB → TS mappers ──

const DB_TIPO_MAP: Record<string, NotificationType> = {
  urgente: "urgent",
  accionable: "actionable",
  informativa: "informative",
  exito: "success",
};

const DB_CATEGORIA_MAP: Record<string, NotificationCategory> = {
  pagos: "payments",
  documentos: "documents",
  mantenimiento: "maintenance",
  construccion: "construction",
  reventa: "resale",
  entrega: "delivery",
};

interface NotifRow {
  id: number;
  id_cuenta_cobranza: number | null;
  tipo: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  url_accion: string | null;
  etiqueta_accion: string | null;
  leida: boolean;
  descartada: boolean;
  fecha_creacion: string;
}

function normalizeActionUrl(url: string | null): string {
  if (!url || url === "/") return "/admin/portal-cliente/inicio";
  if (url.startsWith("/admin/")) return url;
  if (url.startsWith("/")) return `/admin/portal-cliente${url}`;
  return url;
}

function mapRow(row: NotifRow): Notification {
  return {
    id: String(row.id),
    type: DB_TIPO_MAP[row.tipo] ?? "informative",
    category: DB_CATEGORIA_MAP[row.categoria] ?? "delivery",
    title: row.titulo,
    description: row.descripcion,
    createdAt: row.fecha_creacion,
    actionLabel: row.etiqueta_accion ?? "Ver",
    actionUrl: normalizeActionUrl(row.url_accion),
    propertyId: row.id_cuenta_cobranza ? String(row.id_cuenta_cobranza) : undefined,
    read: row.leida,
    dismissed: row.descartada,
  };
}

// ── Resolve effective client email ──

function useClientEmail(): string | null {
  const { profile } = useAuth();
  const { impersonatedClienteEmail, isImpersonating } = useClienteImpersonation();
  if (isImpersonating && impersonatedClienteEmail) return impersonatedClienteEmail;
  return profile?.email ?? null;
}

// ── Hooks ──

export function useNotifications(): Notification[] {
  const email = useClientEmail();
  const { data = [] } = useQuery({
    queryKey: ["notifications", email],
    queryFn: async (): Promise<Notification[]> => {
      if (!email) return [];
      const { data, error } = await (supabase as any)
        .from("notificaciones_cliente")
        .select(
          "id, id_cuenta_cobranza, tipo, categoria, titulo, descripcion, url_accion, etiqueta_accion, leida, descartada, fecha_creacion",
        )
        .eq("email_cliente", email)
        .eq("descartada", false)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false })
        .limit(50);
      // Table not yet created in DB - return empty silently
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) return [];
      if (error) throw error;

      const PRIORITY: Record<NotificationType, number> = {
        urgent: 0, actionable: 1, informative: 2, success: 3,
      };

      return ((data ?? []) as NotifRow[])
        .map(mapRow)
        .sort((a, b) => {
          const p = PRIORITY[a.type] - PRIORITY[b.type];
          if (p !== 0) return p;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    },
    enabled: !!email,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data;
}

export function useUnreadCount(): number {
  return useNotifications().filter((n) => !n.read).length;
}

export function useUnreadCountsByNavTab(): Record<string, number> {
  const notifications = useNotifications();
  const counts: Record<string, number> = { home: 0, property: 0, profile: 0, documents: 0 };
  for (const n of notifications) {
    if (n.read) continue;
    counts[getNavTabForUrl(n.actionUrl)] += 1;
  }
  return counts;
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  const email = useClientEmail();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notificaciones_cliente")
        .update({ leida: true, fecha_lectura: new Date().toISOString() })
        .eq("id", Number(id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", email] }),
  });
}

export function useMarkAsUnread() {
  const qc = useQueryClient();
  const email = useClientEmail();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notificaciones_cliente")
        .update({ leida: false, fecha_lectura: null })
        .eq("id", Number(id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", email] }),
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  const email = useClientEmail();
  return useMutation({
    mutationFn: async () => {
      if (!email) return;
      const { error } = await (supabase as any)
        .from("notificaciones_cliente")
        .update({ leida: true, fecha_lectura: new Date().toISOString() })
        .eq("email_cliente", email)
        .eq("leida", false)
        .eq("activo", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", email] }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  const email = useClientEmail();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notificaciones_cliente")
        .update({ descartada: true, fecha_descarte: new Date().toISOString() })
        .eq("id", Number(id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", email] }),
  });
}

// ── Pure helpers ──

export function getNavTabForUrl(url: string): "home" | "property" | "profile" | "documents" {
  if (url.startsWith("/documentos")) return "documents";
  if (url.startsWith("/propiedades")) return "property";
  if (url === "/perfil") return "profile";
  return "home";
}

export function getTypeInfo(type: NotificationType): { className: string; iconBg: string } {
  switch (type) {
    case "urgent":
      return { className: "text-destructive", iconBg: "bg-destructive/15 text-destructive" };
    case "actionable":
      return { className: "text-warning", iconBg: "bg-warning/15 text-warning" };
    case "informative":
      return { className: "text-primary", iconBg: "bg-primary/15 text-primary" };
    case "success":
      return { className: "text-success", iconBg: "bg-success/15 text-success" };
  }
}

export function getCategoryIcon(category: NotificationCategory): string {
  switch (category) {
    case "payments": return "CreditCard";
    case "documents": return "FileText";
    case "maintenance": return "Wrench";
    case "construction": return "HardHat";
    case "resale": return "TrendingUp";
    case "delivery": return "PackageCheck";
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
