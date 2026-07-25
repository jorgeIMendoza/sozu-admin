import { useAuth } from "@/contexts/AuthContext";

/**
 * Whitelist estática de aprobadores del flujo de venta (oferta digital → pago).
 *
 * Solo estos usuarios ven el botón "Continuar con el pago" y el flujo de
 * compra/pago mientras el flujo está en fase de aprobación interna. El pago es
 * por transferencia SPEI (sin Stripe). Cuando el flujo se libere a producción
 * para todos, sustituir este gate por un permiso de rol/submenu.
 */
export const SALES_FLOW_WHITELIST: readonly string[] = [
  "joseramon.escobar@sozu.com", // Ramón Escobar (Super Admin)
  "ramon.escobar@sozu.com",     // Ramón Escobar (cuenta alterna)
  "rodrigo.terveen@sozu.com",   // Rodrigo Ter Veen
  "jorge.mendoza@sozu.com",     // Jorge Mendoza
  "eduardo.araujo@sozu.com",    // Eduardo Araujo
  "keity.galindo@sozu.com",     // Keity Enid Galindo
  "abel.salazar@sozu.com",      // Abel Salazar
  "manuel.nava@sozu.com",       // Manuel Nava
];

const normalize = (email?: string | null) => (email ?? "").trim().toLowerCase();

/** true si el email pertenece a un aprobador del flujo de venta. */
export const isSalesFlowApprover = (email?: string | null): boolean =>
  SALES_FLOW_WHITELIST.includes(normalize(email));

/**
 * true si el usuario en sesión puede ver el botón/flujo de pago de la oferta
 * digital. Anónimos (sin sesión) devuelven false.
 */
export const useCanSeeSalesFlow = (): boolean => {
  const { user, profile } = useAuth();
  return isSalesFlowApprover(profile?.email ?? user?.email);
};
