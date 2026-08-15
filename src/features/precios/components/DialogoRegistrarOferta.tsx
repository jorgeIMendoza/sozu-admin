import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMotorStore } from "../stores/motorStore";
import { useOfertasStore } from "../stores/ofertasStore";
import { ACTOR_ACTUAL, registrarEvento } from "../services/auditoria";
import { formatoMoneda, formatoFechaCorta } from "../lib/formato";

export interface DatosOfertaPropuesta {
  id_proyecto: string;
  id_propiedad: string;
  etiqueta_unidad: string;
  precio_ofertado: number;
  id_esquema: string;
  nombre_esquema: string;
  descuento_adicional: number;
}

export function DialogoRegistrarOferta({
  abierto,
  onOpenChange,
  propuesta,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  propuesta: DatosOfertaPropuesta | null;
}) {
  const motor = useMotorStore((s) => s.motoresPorProyecto[s.idProyectoActivo]!);
  const registrar = useOfertasStore((s) => s.registrar);

  const [dias, setDias] = useState<number>(motor.vigencia_oferta_dias);
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");

  if (!propuesta) return null;

  const diasValidos = Number.isFinite(dias) && dias >= 1 && dias <= 90;
  const vence = new Date();
  vence.setDate(vence.getDate() + (diasValidos ? dias : 0));

  const puedeRegistrar = diasValidos && referencia.trim().length >= 3;

  const confirmar = () => {
    if (!puedeRegistrar) return;
    const oferta = registrar({
      id_proyecto: propuesta.id_proyecto,
      id_propiedad: propuesta.id_propiedad,
      precio_ofertado: propuesta.precio_ofertado,
      id_esquema: propuesta.id_esquema,
      nombre_esquema: propuesta.nombre_esquema,
      descuento_adicional: propuesta.descuento_adicional,
      vigencia_dias: dias,
      referencia_cliente: referencia.trim(),
      notas: notas.trim(),
      emitida_por: ACTOR_ACTUAL,
    });
    registrarEvento({
      id_proyecto: propuesta.id_proyecto,
      tipo: "oferta.registrada",
      entidad: {
        tipo: "oferta",
        id: oferta.id_oferta,
        etiqueta: `Unidad ${propuesta.etiqueta_unidad}`,
      },
      antes: null,
      despues: {
        precio_ofertado: oferta.precio_ofertado,
        esquema: oferta.nombre_esquema,
        descuento_adicional: oferta.descuento_adicional,
        vigencia_dias: oferta.vigencia_dias,
        vence_en: oferta.vence_en,
        referencia_cliente: oferta.referencia_cliente,
      },
      impacto_pesos: null,
    });
    onOpenChange(false);
    setReferencia("");
    setNotas("");
    toast.success(
      `Oferta registrada para la unidad ${propuesta.etiqueta_unidad}. Vence el ${formatoFechaCorta(oferta.vence_en)}.`,
      {
        action: {
          label: "Ver en Ofertas vigentes",
          onClick: () => {
            // La navegación real la resuelve el Link del toast en pantallas donde aplica.
          },
        },
      },
    );
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar oferta vigente</DialogTitle>
          <DialogDescription>
            Mientras la oferta esté vigente, el precio de la unidad queda bloqueado para
            reprecio. El artículo 7 de la Ley Federal de Protección al Consumidor obliga a
            respetar el precio ofertado durante su vigencia.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Unidad</dt>
            <dd className="text-foreground tabular-nums">{propuesta.etiqueta_unidad}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Esquema</dt>
            <dd className="text-foreground">{propuesta.nombre_esquema}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Precio ofertado</dt>
            <dd className="text-foreground tabular-nums">
              {formatoMoneda(propuesta.precio_ofertado)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Descuento adicional</dt>
            <dd className="text-foreground tabular-nums">
              {propuesta.descuento_adicional.toFixed(2)}%
            </dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dias-vigencia">Vigencia en días</Label>
            <Input
              id="dias-vigencia"
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              Vence el {formatoFechaCorta(vence.toISOString())}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referencia-cliente">Referencia</Label>
            <Input
              id="referencia-cliente"
              placeholder="Folio de cotización"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usa un folio o identificador interno. No captures nombre, teléfono ni otros
              datos personales del cliente en este campo.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notas-oferta">Notas (opcional)</Label>
          <Textarea
            id="notas-oferta"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Al registrar la oferta, la unidad queda bloqueada para reprecio hasta su
            vencimiento o hasta que la canceles con un motivo documentado. Puedes dar
            seguimiento a esta oferta en{" "}
            <Link
              to="/inventarios/precios/auditoria/ofertas"
              className="text-primary hover:underline"
            >
              Ofertas vigentes
            </Link>
            .
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!puedeRegistrar} onClick={confirmar}>
            Registrar oferta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
