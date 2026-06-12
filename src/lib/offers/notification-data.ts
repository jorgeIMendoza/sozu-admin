// ── Notification Center: tipos, derivación y estado de lectura ──
// Las notificaciones se derivan en runtime de los stores subyacentes.
// Solo persistimos estado de lectura/dismissal por id.

import { create } from "zustand";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { mockPortfolio } from "@/lib/offers/mock-data";
import { getMaintenanceAccount, getAccountStatus, useMaintenanceStore } from "@/lib/offers/maintenance-data";
import { getAllDocuments, useDocumentStore } from "@/lib/offers/document-data";
import { getConstructionProgress } from "@/lib/offers/construction-progress-data";
import { usePostDeliveryStore, computeWarrantyDates } from "@/lib/offers/post-delivery-data";

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

interface NotificationReadState {
  readAt: Record<string, string>;
  dismissedAt: Record<string, string>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

export const useNotificationReadStore = create<NotificationReadState>((set, get) => ({
  readAt: {},
  dismissedAt: {},
  markAsRead: (id) => {
    if (get().readAt[id]) return;
    set({ readAt: { ...get().readAt, [id]: new Date().toISOString() } });
  },
  markAllAsRead: () => {
    const now = new Date().toISOString();
    const next = { ...get().readAt };
    for (const n of getAllNotifications()) {
      if (!next[n.id]) next[n.id] = now;
    }
    set({ readAt: next });
  },
  dismiss: (id) => {
    if (get().dismissedAt[id]) return;
    set({ dismissedAt: { ...get().dismissedAt, [id]: new Date().toISOString() } });
  },
  reset: () => set({ readAt: {}, dismissedAt: {} }),
}));

export function getAllNotifications(): Notification[] {
  const notifications: Notification[] = [];

  for (const inv of mockPortfolio) {
    notifications.push(...buildMaintenanceNotifications(inv));
    notifications.push(...buildConstructionNotifications(inv));
  }
  notifications.push(...buildDocumentNotifications());
  notifications.push(...buildWarrantyNotifications());
  notifications.push(...buildIncidentNotifications());

  const { readAt, dismissedAt } = useNotificationReadStore.getState();
  for (const n of notifications) {
    n.read = !!readAt[n.id];
    n.dismissed = !!dismissedAt[n.id];
  }

  const PRIORITY: Record<NotificationType, number> = {
    urgent: 0, actionable: 1, informative: 2, success: 3,
  };

  return notifications
    .filter((n) => !n.dismissed)
    .sort((a, b) => {
      const p = PRIORITY[a.type] - PRIORITY[b.type];
      if (p !== 0) return p;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}


function buildMaintenanceNotifications(inv: InvestmentProperty): Notification[] {
  const out: Notification[] = [];
  const account = getMaintenanceAccount(inv.property.id);
  if (!account) return out;
  const status = getAccountStatus(account);

  if (status.status === "vencido") {
    out.push({
      id: `mant-overdue-${inv.property.id}`,
      type: "urgent", category: "maintenance",
      title: "Mantenimiento vencido",
      description: `${inv.property.projectName} ${inv.property.unitNumber} · ${status.description}`,
      createdAt: new Date().toISOString(),
      actionLabel: "Pagar mantenimiento",
      actionUrl: `/propiedades/${inv.property.id}`,
      propertyId: inv.property.id,
    });
  } else if (status.status === "pendiente") {
    out.push({
      id: `mant-pending-${inv.property.id}`,
      type: "actionable", category: "maintenance",
      title: "Mantenimiento pendiente",
      description: `${inv.property.projectName} ${inv.property.unitNumber} · ${status.description}`,
      createdAt: new Date().toISOString(),
      actionLabel: "Ver detalle",
      actionUrl: `/propiedades/${inv.property.id}`,
      propertyId: inv.property.id,
    });
  }

  return out;
}


function buildConstructionNotifications(inv: InvestmentProperty): Notification[] {
  const out: Notification[] = [];
  const construction = getConstructionProgress(inv.property.id);
  if (!construction || !construction.notificationsEnabled) return out;
  const latestUpdate = construction.updates[0];
  if (!latestUpdate) return out;
  const updateDate = parseDateEs(latestUpdate.date);
  if (!updateDate) return out;
  const daysSince = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 14) return out;

  out.push({
    id: `constr-${inv.property.id}-${latestUpdate.id}`,
    type: "informative", category: "construction",
    title: `Nuevo avance: ${latestUpdate.stage}`,
    description: `${inv.property.projectName} ${inv.property.unitNumber} · ${construction.globalProgress}% completado`,
    createdAt: updateDate.toISOString(),
    actionLabel: "Ver avance",
    actionUrl: `/propiedades/${inv.property.id}`,
    propertyId: inv.property.id,
  });
  return out;
}

function buildDocumentNotifications(): Notification[] {
  const out: Notification[] = [];
  const docs = getAllDocuments();
  const portfolioById: Record<string, InvestmentProperty> = {};
  mockPortfolio.forEach((p) => { portfolioById[p.property.id] = p; });

  for (const doc of docs) {
    const inv = portfolioById[doc.propertyId];
    const propertyLabel = inv ? `${inv.property.projectName} ${inv.property.unitNumber}` : doc.propertyId;

    if (doc.status === "rechazado") {
      out.push({
        id: `doc-rejected-${doc.id}`,
        type: "urgent", category: "documents",
        title: `Documento rechazado: ${doc.name}`,
        description: `${propertyLabel} · ${doc.rejectionReason?.slice(0, 80) ?? "Re-subir documento"}`,
        createdAt: doc.rejectedAt ?? new Date().toISOString(),
        actionLabel: "Subir nueva versión",
        actionUrl: `/documentos?propiedad=${doc.propertyId}&estado=rechazado`,
        propertyId: doc.propertyId,
      });
    } else if (doc.status === "pendiente") {
      out.push({
        id: `doc-pending-${doc.id}`,
        type: "actionable", category: "documents",
        title: `Documento pendiente: ${doc.name}`,
        description: `${propertyLabel} · ${doc.description?.slice(0, 80) ?? "Subir documento"}`,
        createdAt: new Date().toISOString(),
        actionLabel: "Subir documento",
        actionUrl: `/documentos?propiedad=${doc.propertyId}&estado=pendiente`,
        propertyId: doc.propertyId,
      });
    } else if (doc.status === "validado" && doc.validatedAt) {
      const validatedAt = new Date(doc.validatedAt);
      const daysSince = (Date.now() - validatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 7) {
        out.push({
          id: `doc-validated-${doc.id}`,
          type: "success", category: "documents",
          title: `Documento validado: ${doc.name}`,
          description: `${propertyLabel}`,
          createdAt: doc.validatedAt,
          actionLabel: "Ver",
          actionUrl: `/documentos?propiedad=${doc.propertyId}`,
          propertyId: doc.propertyId,
        });
      }
    }
  }
  return out;
}

function parseDateEs(dateStr: string): Date | null {
  const months: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };
  const match = dateStr.toLowerCase().match(/(\d+)\s+(\w+)\s+(\d+)/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = months[match[2]];
  const year = parseInt(match[3], 10);
  if (month === undefined) return null;
  return new Date(year, month, day);
}

export function markAsRead(id: string): void {
  useNotificationReadStore.getState().markAsRead(id);
}

export function markAllAsRead(): void {
  useNotificationReadStore.getState().markAllAsRead();
}

export function dismiss(id: string): void {
  useNotificationReadStore.getState().dismiss(id);
}

export function getUnreadCount(): number {
  return getAllNotifications().filter((n) => !n.read).length;
}

// ── Hooks reactivos ──
// Re-render cuando cambian flags de lectura/dismissal o stores subyacentes.

export function useNotifications(): Notification[] {
  const readAt = useNotificationReadStore((s) => s.readAt);
  const dismissedAt = useNotificationReadStore((s) => s.dismissedAt);
  const documents = useDocumentStore((s) => s.documents);
  const accounts = useMaintenanceStore((s) => s.accounts);
  const incidents = usePostDeliveryStore((s) => s.incidents);
  const warranties = usePostDeliveryStore((s) => s.warranties);
  void readAt; void dismissedAt; void documents; void accounts; void incidents; void warranties;
  return getAllNotifications();
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

export function getNavTabForUrl(url: string): "home" | "property" | "profile" | "documents" {
  if (url.startsWith("/documentos")) return "documents";
  if (url.startsWith("/propiedades")) return "property";
  if (url === "/perfil") return "profile";
  return "home";
}

export function getUnreadCountsByNavTab(): Record<string, number> {
  const counts: Record<string, number> = { home: 0, property: 0, profile: 0, documents: 0 };
  for (const n of getAllNotifications()) {
    if (n.read) continue;
    counts[getNavTabForUrl(n.actionUrl)] += 1;
  }
  return counts;
}

export function getTypeInfo(type: NotificationType): { className: string; iconBg: string } {
  switch (type) {
    case "urgent": return { className: "text-destructive", iconBg: "bg-destructive/15 text-destructive" };
    case "actionable": return { className: "text-warning", iconBg: "bg-warning/15 text-warning" };
    case "informative": return { className: "text-primary", iconBg: "bg-primary/15 text-primary" };
    case "success": return { className: "text-success", iconBg: "bg-success/15 text-success" };
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

// ── Post-entrega: garantía + incidencias ──

function buildWarrantyNotifications(): Notification[] {
  const out: Notification[] = [];
  const warranties = usePostDeliveryStore.getState().warranties;
  const portfolioById: Record<string, InvestmentProperty> = {};
  mockPortfolio.forEach((p) => { portfolioById[p.property.id] = p; });

  for (const w of warranties) {
    const { status, monthsRemaining, daysRemaining } = computeWarrantyDates(w);
    const inv = portfolioById[w.propertyId];
    if (!inv) continue;
    const propertyLabel = `${inv.property.projectName} ${inv.property.unitNumber}`;

    if (status === "proxima_expiracion") {
      const remainingLabel =
        daysRemaining < 30
          ? `Expira en ${Math.ceil(daysRemaining)} día${Math.ceil(daysRemaining) === 1 ? "" : "s"}`
          : `Expira en ${Math.ceil(monthsRemaining)} mes${Math.ceil(monthsRemaining) === 1 ? "" : "es"}`;
      out.push({
        id: `warranty-expiring-${w.id}`,
        type: "actionable",
        category: "delivery",
        title: "Tu garantía de vicios ocultos está por expirar",
        description: `${propertyLabel} · ${remainingLabel}`,
        createdAt: new Date().toISOString(),
        actionLabel: "Revisar",
        actionUrl: `/propiedades/${w.propertyId}`,
        propertyId: w.propertyId,
      });
    }
  }
  return out;
}

function buildIncidentNotifications(): Notification[] {
  const out: Notification[] = [];
  const incidents = usePostDeliveryStore.getState().incidents;
  const portfolioById: Record<string, InvestmentProperty> = {};
  mockPortfolio.forEach((p) => { portfolioById[p.property.id] = p; });

  for (const inc of incidents) {
    const inv = portfolioById[inc.propertyId];
    if (!inv) continue;
    const propertyLabel = `${inv.property.projectName} ${inv.property.unitNumber}`;

    if (inc.status === "en_revision") {
      out.push({
        id: `incident-progress-${inc.id}`,
        type: "informative",
        category: "delivery",
        title: `Incidencia en revisión: ${inc.title}`,
        description: `${propertyLabel} · El técnico está evaluando`,
        createdAt: inc.lastUpdatedAt,
        actionLabel: "Ver seguimiento",
        actionUrl: `/propiedades/${inc.propertyId}`,
        propertyId: inc.propertyId,
      });
    } else if (inc.status === "resuelto") {
      out.push({
        id: `incident-resolved-${inc.id}`,
        type: "actionable",
        category: "delivery",
        title: `Incidencia resuelta: ${inc.title}`,
        description: `${propertyLabel} · Confirma la resolución`,
        createdAt: inc.lastUpdatedAt,
        actionLabel: "Confirmar",
        actionUrl: `/propiedades/${inc.propertyId}`,
        propertyId: inc.propertyId,
      });
    }
  }
  return out;
}
