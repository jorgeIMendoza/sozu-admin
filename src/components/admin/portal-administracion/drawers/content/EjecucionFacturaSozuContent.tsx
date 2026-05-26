import { useState } from "react";
import {
  Calendar,
  DollarSign,
  Home,
  User,
  Receipt,
  Building2,
  Landmark,
  Tag,
  FileText,
  Loader2,
} from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Section, KV } from "./_shared";
import {
  type FacturaComisionSozuPorGenerar,
  useGenerarFacturaComisionSozu,
} from "@/hooks/useFacturasComisionSozuPorGenerar";

export function EjecucionFacturaSozuContent({
  entity,
  onClose,
}: {
  entity: FacturaComisionSozuPorGenerar;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const generar = useGenerarFacturaComisionSozu();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notas, setNotas] = useState("");

  const subtotal = (entity.precio_final * entity.porcentaje_comision_venta) / 100;
  const iva = entity.iva_incluido ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const handleConfirm = async () => {
    try {
      const data = await generar.mutateAsync(entity.id_cuenta_cobranza);
      if (data?.not_applicable) {
        toast({
          title: "No aplica",
          description: data.message || "La cuenta no requiere factura SOZU.",
        });
      } else if (data?.already_exists) {
        toast({
          title: "Ya existe",
          description: data.message || "La factura ya fue generada previamente.",
        });
      } else {
        toast({
          title: "CFDI generado",
          description: `Factura draft generada para ${entity.folio_cuenta}.`,
        });
      }
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al generar CFDI";
      toast({
        title: "Error al generar",
        description: message,
        variant: "destructive",
      });
      // El drawer permanece abierto para reintentar.
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Sección 1: Datos de la operación ─── */}
      <Section title="Datos de la operación">
        <div className="grid grid-cols-2 gap-3">
          <KV
            icon={Home}
            label="Propiedad"
            value={[
              entity.proyecto_nombre || "—",
              entity.modelo_nombre || "—",
              entity.numero_departamento ? `Depto ${entity.numero_departamento}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <KV
            icon={Tag}
            label="Tipo de operación"
            value={<Badge variant="outline">{entity.tipo}</Badge>}
          />
          <KV icon={Tag} label="Producto" value={entity.producto_nombre || "—"} />
          <KV icon={Building2} label="Entidad dueña" value={entity.entidad_duena || "—"} />
          <KV icon={User} label="Cliente" value={entity.cliente_nombre || "—"} />
          <KV icon={Calendar} label="Fecha de venta" value={entity.fecha_compra || "—"} />
        </div>
      </Section>

      {/* ─── Sección 2: Cálculo de comisión ─── */}
      <Section title="Cálculo de comisión">
        <div className="rounded-md border border-border bg-card divide-y">
          <RowKV label="Precio final" value={fmtMxn(entity.precio_final)} />
          <RowKV
            label="% Comisión SOZU"
            value={`${entity.porcentaje_comision_venta.toFixed(2)}%`}
          />
          <RowKV label="Subtotal comisión" value={fmtMxn(subtotal)} />
          {entity.iva_incluido && <RowKV label="IVA (16%)" value={fmtMxn(iva)} />}
          <RowKV
            label={entity.iva_incluido ? "Total a facturar (IVA incluido)" : "Total a facturar"}
            value={fmtMxn(total)}
            emphasis
          />
        </div>
      </Section>

      {/* ─── Sección 3: Datos fiscales ─── */}
      <Section title="Datos fiscales">
        <div className="grid grid-cols-2 gap-3">
          <KV
            icon={Receipt}
            label="RFC receptor"
            value={entity.cliente_rfc || "Heredado de entidad dueña"}
            mono
          />
          <KV
            icon={Building2}
            label="Razón social"
            value={entity.entidad_duena || "—"}
          />
          <KV icon={FileText} label="Uso de CFDI" value="G03 · Gastos en general" />
          <KV icon={FileText} label="Forma de pago" value="03 · Transferencia electrónica" />
          <KV
            icon={FileText}
            label="Método de pago"
            value={entity.iva_incluido ? "PUE · Pago en una exhibición" : "PPD · Pago en parcialidades"}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          Los datos fiscales finales los completa la edge function al timbrar
          contra el catálogo SAT y la configuración del receptor.
        </p>
      </Section>

      {/* ─── Sección 4: STP ─── */}
      <Section title="Cuenta STP de comisión">
        <KV
          icon={Landmark}
          label="CLABE destino"
          value={entity.cuenta_stp_comisiones || "Sin CLABE registrada"}
          mono
        />
      </Section>

      {/* ─── Notas (opcional) ─── */}
      <Section title="Notas (opcional)">
        <Label htmlFor="notas-cfdi" className="sr-only">
          Notas
        </Label>
        <Textarea
          id="notas-cfdi"
          placeholder="Observaciones internas sobre esta generación…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="min-h-[60px] text-sm"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Las notas se guardan en la bitácora de actividad junto con la acción.
        </p>
      </Section>

      {/* ─── Footer de acción ─── */}
      <div className="border-t pt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={generar.isPending}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={generar.isPending}
        >
          {generar.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Generando CFDI…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {entity.es_regenerar ? "Regenerar CFDI" : "Generar CFDI"}
            </>
          )}
        </Button>
      </div>

      {/* ─── Modal de confirmación ─── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar generación de CFDI</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas la generación del CFDI por{" "}
              <strong className="text-foreground">{fmtMxn(total)}</strong> a{" "}
              <strong className="text-foreground">{entity.entidad_duena || "la entidad dueña"}</strong>?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Folio cuenta: {entity.folio_cuenta} ·{" "}
                {entity.proyecto_nombre} {entity.numero_departamento ? `· Depto ${entity.numero_departamento}` : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={generar.isPending}
            >
              {generar.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generando…
                </>
              ) : (
                "Sí, generar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowKV({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis
            ? "text-sm font-bold tabular-nums text-foreground"
            : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
