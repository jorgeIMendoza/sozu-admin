import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  DollarSign,
  User,
  Receipt,
  Building2,
  Landmark,
  Upload,
  Send,
  Loader2,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";

export type EjecucionPagoExternoEntity = {
  folio: string;
  beneficiario_nombre: string;
  beneficiario_tipo: "Inmobiliaria" | "Broker" | "Aliado comercial" | "Agente externo";
  venta_ref: string;
  monto: number;
  clabe_destino: string;
  dias_desde_autorizacion: number;
  // Claves para persistir el pago en la fila real de `comisionistas`.
  id_cuenta_cobranza: number;
  email_usuario: string;
};

export function EjecucionPagoExternoContent({
  entity,
  onClose,
}: {
  entity: EjecucionPagoExternoEntity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [claveRastreo, setClaveRastreo] = useState("");
  const [fechaPago, setFechaPago] = useState(today);
  const [comprobante, setComprobante] = useState<File | null>(null);

  const puedeConfirmar =
    !!claveRastreo.trim() &&
    !!fechaPago &&
    !!comprobante &&
    !!entity.email_usuario &&
    !!entity.id_cuenta_cobranza;

  const ejecutar = useMutation({
    mutationFn: async () => {
      if (!comprobante) throw new Error("Falta el comprobante de pago.");
      if (!entity.email_usuario || !entity.id_cuenta_cobranza) {
        throw new Error("No se pudo identificar la comisión a pagar.");
      }
      const clave = claveRastreo.trim();

      // 1. Subir el comprobante (PDF) a Storage. Mismo bucket/carpeta que el
      //    flujo canónico de Pagar Comisiones (src/pages/admin/ComisionesExternas).
      //    La clave STP va en el nombre del archivo para dejarla trazable en la
      //    ruta del comprobante aunque `comisionistas` no tenga columna propia.
      const ext = comprobante.name.split(".").pop() || "pdf";
      const safeEmail = entity.email_usuario.replace(/[^a-zA-Z0-9]/g, "_");
      const safeClave = clave.replace(/[^a-zA-Z0-9]/g, "");
      const filePath = `evidencias-pago-comision/${safeEmail}_${entity.id_cuenta_cobranza}_${safeClave}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, comprobante);
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("documentos").getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;

      // 2. Marcar la comisión como pagada + evidencia + fecha de pago.
      //    Clave natural: (email_usuario, id_cuenta_cobranza) sobre filas activas.
      const { error: updateError } = await (supabase as any)
        .from("comisionistas")
        .update({
          pagada: true,
          url_evidencia_pago: publicUrl,
          fecha_pago_comision: new Date(fechaPago).toISOString(),
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("email_usuario", entity.email_usuario)
        .eq("id_cuenta_cobranza", entity.id_cuenta_cobranza)
        .eq("activo", true)
        .eq("pagada", false);
      if (updateError) throw updateError;

      return { publicUrl };
    },
    onSuccess: () => {
      // Refresca las vistas que dependen del estado de las comisiones para que
      // la fila salga de "por ejecutar" y aparezca como pagada en todos lados.
      queryClient.invalidateQueries({ queryKey: ["comisiones_externas_alta_direccion"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones-externas"] });
      queryClient.invalidateQueries({ queryKey: ["pagar-comisiones"] });
      toast({
        title: "Pago a externo ejecutado",
        description: `${entity.beneficiario_nombre} · ${fmtMxn(entity.monto)} — comprobante registrado y visible para todos.`,
      });
      onClose();
    },
    onError: (e: any) => {
      toast({
        title: "No se pudo ejecutar el pago",
        description: e?.message ?? "Error al registrar el pago.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Section title="Datos del pago">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio comisión" value={entity.folio} mono />
          <KV icon={User} label="Beneficiario" value={entity.beneficiario_nombre} />
          <KV
            icon={Building2}
            label="Tipo"
            value={<Badge variant="outline">{entity.beneficiario_tipo}</Badge>}
          />
          <KV icon={Receipt} label="Venta referenciada" value={entity.venta_ref} mono />
          <KV icon={DollarSign} label="Monto a pagar" value={fmtMxn(entity.monto)} />
          <KV icon={Landmark} label="CLABE destino" value={entity.clabe_destino} mono />
          <KV
            icon={Clock}
            label="Días desde autorización"
            value={`${entity.dias_desde_autorizacion} ${
              entity.dias_desde_autorizacion === 1 ? "día" : "días"
            }`}
          />
        </div>
      </Section>

      <Section title="Confirmar ejecución SPEI">
        <div className="space-y-3">
          <div>
            <Label htmlFor="clave-rastreo" className="text-xs">
              Clave de rastreo STP
            </Label>
            <Input
              id="clave-rastreo"
              value={claveRastreo}
              onChange={(e) => setClaveRastreo(e.target.value)}
              placeholder="Ej. 2026052500123456789"
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label htmlFor="fecha-pago" className="text-xs">
              Fecha de pago
            </Label>
            <Input
              id="fecha-pago"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="comprobante" className="text-xs">
              Comprobante (PDF)
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="comprobante"
                type="file"
                accept="application/pdf"
                onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              {comprobante && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                  <Upload className="inline h-3 w-3 mr-0.5" />
                  {comprobante.name}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!puedeConfirmar || ejecutar.isPending}
            onClick={() => ejecutar.mutate()}
          >
            {ejecutar.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Registrando pago…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Confirmar ejecución
              </>
            )}
          </Button>
        </div>
      </Section>

      <div className="border-t pt-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={ejecutar.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
