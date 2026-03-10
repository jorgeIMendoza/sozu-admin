import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type ActividadUrgencia = "green" | "orange" | "red";
export type ActividadTipo = "pago" | "mantenimiento" | "escrituracion" | "entrega";

export interface ActividadItem {
  id: string;
  tipo: ActividadTipo;
  proyecto: string;
  unidad: string;
  concepto: string;
  monto: number | null;
  fechaPago: string | null;
  diasRestantes: number | null;
  urgencia: ActividadUrgencia;
  mensaje: string;
}

function calcularUrgencia(diasRestantes: number): ActividadUrgencia {
  if (diasRestantes <= 5) return "red";
  if (diasRestantes <= 10) return "orange";
  return "green";
}

const URGENCIA_BORDER: Record<ActividadUrgencia, string> = {
  green: "border-l-[hsl(var(--inmob-green))]",
  orange: "border-l-amber-500",
  red: "border-l-destructive",
};

const URGENCIA_DOT: Record<ActividadUrgencia, string> = {
  green: "bg-[hsl(var(--inmob-green))]",
  orange: "bg-amber-500",
  red: "bg-destructive",
};

const URGENCIA_BADGE: Record<ActividadUrgencia, string> = {
  green: "bg-[hsl(var(--inmob-green))]/10 text-[hsl(var(--inmob-green))]",
  orange: "bg-amber-500/10 text-amber-500",
  red: "bg-destructive/10 text-destructive",
};

export { URGENCIA_BORDER, URGENCIA_DOT, URGENCIA_BADGE };

export function useClienteActividad(personaId: number | null | undefined) {
  return useQuery({
    queryKey: ["cliente-actividad", personaId],
    queryFn: async (): Promise<ActividadItem[]> => {
      if (!personaId) return [];

      const items: ActividadItem[] = [];
      const today = new Date();

      // 1. Get all ofertas for this persona
      const { data: ofertas } = await supabase
        .from("ofertas")
        .select("id, id_propiedad")
        .eq("id_persona_lead", personaId)
        .eq("activo", true);

      if (!ofertas || ofertas.length === 0) return [];

      const ofertaIds = ofertas.map((o) => o.id);
      const propiedadIds = [...new Set(ofertas.map((o) => o.id_propiedad))];

      // 2. Get cuentas_cobranza for these ofertas
      const { data: cuentas } = await supabase
        .from("cuentas_cobranza")
        .select("id, id_oferta, id_propiedad, id_cuenta_cobranza_padre, precio_final")
        .in("id_oferta", ofertaIds)
        .eq("activo", true);

      if (!cuentas || cuentas.length === 0) return [];

      // Main accounts (no parent = property purchase)
      const mainCuentas = cuentas.filter((c) => !c.id_cuenta_cobranza_padre);
      const mainCuentaIds = mainCuentas.map((c) => c.id);

      // Maintenance accounts (have parent)
      const mantoCuentas = cuentas.filter((c) => !!c.id_cuenta_cobranza_padre);
      const mantoCuentaIds = mantoCuentas.map((c) => c.id);

      // Also find maintenance accounts that are children of main cuentas
      const { data: mantoCuentasHijas } = await supabase
        .from("cuentas_cobranza")
        .select("id, id_cuenta_cobranza_padre")
        .in("id_cuenta_cobranza_padre", mainCuentaIds)
        .eq("activo", true);

      const allMantoCuentaIds = [
        ...mantoCuentaIds,
        ...(mantoCuentasHijas?.map((c) => c.id) || []),
      ];
      const uniqueMantoCuentaIds = [...new Set(allMantoCuentaIds)];

      // 3. Get property info with project name
      const allPropIds = [
        ...new Set([
          ...propiedadIds,
          ...mainCuentas.map((c) => c.id_propiedad).filter(Boolean) as number[],
        ]),
      ];

      const { data: propiedades } = await supabase
        .from("propiedades")
        .select(`
          id,
          numero_propiedad,
          id_estatus_disponibilidad,
          id_edificio_modelo,
          edificios_modelos!inner(
            id_edificio,
            edificios!inner(
              nombre,
              id_proyecto,
              proyectos!inner(nombre)
            )
          )
        `)
        .in("id", allPropIds);

      // Build property lookup
      const propMap = new Map<number, {
        numero: string;
        proyecto: string;
        edificio: string;
        estatus: number;
      }>();

      propiedades?.forEach((p: any) => {
        const em = p.edificios_modelos;
        const ed = em?.edificios;
        propMap.set(p.id, {
          numero: p.numero_propiedad,
          proyecto: ed?.proyectos?.nombre || "Proyecto",
          edificio: ed?.nombre || "",
          estatus: p.id_estatus_disponibilidad,
        });
      });

      // Helper: get prop info for a cuenta
      const getPropForCuenta = (cuentaId: number) => {
        const cuenta = mainCuentas.find((c) => c.id === cuentaId);
        if (!cuenta) return null;
        const propId = cuenta.id_propiedad;
        if (!propId) {
          // Try via oferta
          const oferta = ofertas.find((o) => o.id === cuenta.id_oferta);
          if (oferta) return propMap.get(oferta.id_propiedad) || null;
          return null;
        }
        return propMap.get(propId) || null;
      };

      // 4. Get upcoming unpaid acuerdos_pago for main cuentas (within 15 days)
      if (mainCuentaIds.length > 0) {
        const { data: acuerdosPago } = await supabase
          .from("acuerdos_pago")
          .select("id, id_cuenta_cobranza, id_concepto, monto, fecha_pago, orden, conceptos_pago!inner(nombre)")
          .in("id_cuenta_cobranza", mainCuentaIds)
          .eq("pago_completado", false)
          .eq("activo", true)
          .not("fecha_pago", "is", null)
          .order("fecha_pago", { ascending: true });

        acuerdosPago?.forEach((ap: any) => {
          const fechaPago = ap.fecha_pago ? parseISO(ap.fecha_pago) : null;
          if (!fechaPago) return;

          const dias = differenceInCalendarDays(fechaPago, today);
          // Show payments that are within 15 days or overdue
          if (dias > 15) return;

          const prop = getPropForCuenta(ap.id_cuenta_cobranza);
          const concepto = ap.conceptos_pago?.nombre || "Pago";
          const urgencia = dias <= 0 ? "red" : calcularUrgencia(dias);

          let mensaje: string;
          if (dias < 0) {
            mensaje = `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}`;
          } else if (dias === 0) {
            mensaje = "Vence hoy";
          } else {
            mensaje = `Faltan ${dias} día${dias !== 1 ? "s" : ""} para tu pago`;
          }

          items.push({
            id: `pago-${ap.id}`,
            tipo: "pago",
            proyecto: prop?.proyecto || "Proyecto",
            unidad: prop?.numero || "",
            concepto,
            monto: ap.monto,
            fechaPago: ap.fecha_pago,
            diasRestantes: dias,
            urgencia,
            mensaje,
          });
        });
      }

      // 5. Get upcoming maintenance payments
      if (uniqueMantoCuentaIds.length > 0) {
        const { data: acuerdosManto } = await supabase
          .from("acuerdos_pago")
          .select("id, id_cuenta_cobranza, monto, fecha_pago, conceptos_pago!inner(nombre)")
          .in("id_cuenta_cobranza", uniqueMantoCuentaIds)
          .eq("pago_completado", false)
          .eq("activo", true)
          .not("fecha_pago", "is", null)
          .order("fecha_pago", { ascending: true })
          .limit(10);

        // Find parent cuenta for maintenance accounts
        const mantoParentMap = new Map<number, number>();
        mantoCuentasHijas?.forEach((c) => {
          if (c.id_cuenta_cobranza_padre) {
            mantoParentMap.set(c.id, c.id_cuenta_cobranza_padre);
          }
        });
        mantoCuentas.forEach((c) => {
          if (c.id_cuenta_cobranza_padre) {
            mantoParentMap.set(c.id, c.id_cuenta_cobranza_padre);
          }
        });

        acuerdosManto?.forEach((ap: any) => {
          const fechaPago = ap.fecha_pago ? parseISO(ap.fecha_pago) : null;
          if (!fechaPago) return;

          const dias = differenceInCalendarDays(fechaPago, today);
          if (dias > 30) return; // Show maintenance up to 30 days

          // Find parent cuenta to get property info
          const parentId = mantoParentMap.get(ap.id_cuenta_cobranza);
          let prop: ReturnType<typeof getPropForCuenta> = null;
          if (parentId) {
            prop = getPropForCuenta(parentId);
          }

          items.push({
            id: `manto-${ap.id}`,
            tipo: "mantenimiento",
            proyecto: prop?.proyecto || "Proyecto",
            unidad: prop?.numero || "",
            concepto: "Mantenimiento",
            monto: ap.monto,
            fechaPago: ap.fecha_pago,
            diasRestantes: dias,
            urgencia: "green", // Always green for maintenance
            mensaje: dias < 0
              ? `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}`
              : dias === 0
              ? "Vence hoy"
              : `Fecha de pago: ${fechaPago.toLocaleDateString("es-MX")}`,
          });
        });
      }

      // 6. Check property status notifications
      propiedades?.forEach((p: any) => {
        const prop = propMap.get(p.id);
        if (!prop) return;

        // Pagada completamente (9) → Escrituración notification
        if (prop.estatus === 9) {
          items.push({
            id: `escrituracion-${p.id}`,
            tipo: "escrituracion",
            proyecto: prop.proyecto,
            unidad: prop.numero,
            concepto: "Escrituración",
            monto: null,
            fechaPago: null,
            diasRestantes: null,
            urgencia: "green",
            mensaje: "Tu unidad está lista para formalizarse ante notario",
          });
        }

        // Escrituración (7) → Entrega notification
        if (prop.estatus === 7) {
          items.push({
            id: `entrega-${p.id}`,
            tipo: "entrega",
            proyecto: prop.proyecto,
            unidad: prop.numero,
            concepto: "Entrega",
            monto: null,
            fechaPago: null,
            diasRestantes: null,
            urgencia: "green",
            mensaje: "Tu unidad está en proceso de escrituración, solo faltan los documentos de entrega",
          });
        }
      });

      // Sort: overdue first, then by days remaining (nearest first), then status items
      items.sort((a, b) => {
        if (a.diasRestantes === null && b.diasRestantes === null) return 0;
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
      });

      return items;
    },
    enabled: !!personaId,
    staleTime: 5 * 60 * 1000,
  });
}
