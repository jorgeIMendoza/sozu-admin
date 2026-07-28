import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";

/**
 * Aprueba la comisión de un comisionista EXTERNO desde el Portal Administración
 * (Bandeja de Ejecución). Replica la acción "Aprobar" del Admin Panel
 * (`ComisionesExternas.tsx`): marca `comisionistas.aprobada = true` por la clave
 * natural (email_usuario, id_cuenta_cobranza) y notifica al externo para que
 * pueda generar y adjuntar su factura en plataforma.
 */

export type AprobarComisionExternaInput = {
  email: string;
  idCuenta: number;
  /** Solo para el texto de la notificación. */
  montoComision?: number;
  nombreComisionista?: string;
  proyectoNombre?: string;
  numeroDepartamento?: string;
};

export function useAprobarComisionExterna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AprobarComisionExternaInput) => {
      if (!input.email || !input.idCuenta) {
        throw new Error("No se pudo identificar la comisión a aprobar.");
      }
      const { error } = await (supabase as any)
        .from("comisionistas")
        .update({ aprobada: true, fecha_actualizacion: new Date().toISOString() })
        .eq("email_usuario", input.email)
        .eq("id_cuenta_cobranza", input.idCuenta)
        .eq("activo", true);
      if (error) throw error;
      return input;
    },
    onSuccess: async (data) => {
      // Refresca las vistas que dependen del estado de las comisiones externas.
      queryClient.invalidateQueries({ queryKey: ["comisiones_externas_alta_direccion"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones-externas"] });
      queryClient.invalidateQueries({ queryKey: ["pagar-comisiones"] });

      // Notificación al externo — best-effort, misma plantilla que el Admin Panel.
      try {
        const montoFormateado = new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
        }).format(data.montoComision || 0);
        const deptoLabel =
          data.proyectoNombre && data.numeroDepartamento
            ? `${data.proyectoNombre} ${data.numeroDepartamento}`
            : `Cuenta ${formatCuentaCobranzaId(data.idCuenta)}`;

        const { data: adminsProyecto } = await supabase
          .from("usuarios")
          .select("email")
          .eq("rol_id", 2)
          .eq("activo", true);
        const ccEmails = (adminsProyecto || []).map((a: any) => a.email).join(",") || "";

        await supabase.functions.invoke("enviar-notificacion", {
          body: {
            tipo: "email",
            from: "Notificaciones Sozu <notificaciones@sozu.com>",
            email: data.email,
            cc: ccEmails,
            asunto: "Comisión de venta aprobada",
            mensaje: {
              nombre: data.nombreComisionista || data.email,
              asunto: "Comisión de venta aprobada",
              texto: `La comisión de venta para el departamento ${deptoLabel} ha sido aprobada, el monto es ${montoFormateado} + IVA, favor de generar y adjuntar factura en plataforma.`,
            },
            templateId: 36978552,
          },
        });
      } catch (notifError) {
        console.error("[useAprobarComisionExterna] Error enviando notificación:", notifError);
      }
    },
  });
}
