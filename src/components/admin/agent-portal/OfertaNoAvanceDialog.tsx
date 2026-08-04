import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ModalFormHeader,
  MODAL_BODY_CLS,
  MODAL_FOOTER_CLS,
  FieldLabel,
} from "@/components/ui/modal-form";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useMotivosNoAvance,
  useGuardarNoAvance,
  type MotivoNoAvance,
} from "@/hooks/useMotivosNoAvance";

const MODAL_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

interface OfertaNoAvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Oferta expirada sobre la que se captura la razón. */
  oferta: any;
  /** Email que queda como autor del registro. */
  registradoPor?: string | null;
  /** Sin permiso de actualizar el pipeline, el modal queda en solo lectura. */
  canUpdate?: boolean;
}

/**
 * Captura de la razón por la que una oferta expirada no avanzó de etapa.
 *
 * Se abre desde el CTA de las tarjetas expiradas del Pipeline y desde el detalle
 * de la oferta. Si ya había una razón registrada, el modal entra en modo
 * corrección con el motivo y el comentario precargados.
 */
export function OfertaNoAvanceDialog({
  open,
  onOpenChange,
  oferta,
  registradoPor,
  canUpdate = true,
}: OfertaNoAvanceDialogProps) {
  const { data: catalogo, isLoading: loadingCatalogo } = useMotivosNoAvance(open);
  const guardar = useGuardarNoAvance();

  const motivos = useMemo<MotivoNoAvance[]>(() => catalogo?.motivos ?? [], [catalogo]);
  const disponible = catalogo?.disponible ?? false;

  const registro = oferta?.no_avance ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  // Precargar lo ya registrado cada vez que se abre.
  useEffect(() => {
    if (!open) return;
    setSelectedId(registro?.id_motivo ?? null);
    setComentario(registro?.comentario ?? "");
  }, [open, registro?.id_motivo, registro?.comentario]);

  const selected = useMemo<MotivoNoAvance | undefined>(
    () => motivos.find((m) => m.id === selectedId),
    [motivos, selectedId],
  );

  const comentarioRequerido = !!selected?.requiere_comentario;
  const faltaComentario = comentarioRequerido && !comentario.trim();
  const puedeGuardar = disponible && canUpdate && !!selectedId && !faltaComentario && !guardar.isPending;

  const ofertaLabel = oferta?.is_producto
    ? `OP-${String(oferta?.id ?? "").padStart(6, "0")}`
    : `O-${String(oferta?.id ?? "").padStart(6, "0")}`;

  const handleGuardar = () => {
    if (!puedeGuardar || !selectedId) return;
    guardar.mutate(
      {
        idOferta: oferta.id,
        idMotivo: selectedId,
        comentario,
        registradoPor,
      },
      {
        onSuccess: () => {
          toast.success(registro ? "Razón actualizada" : "Gracias, registramos la razón");
          onOpenChange(false);
        },
        onError: (err: any) => {
          console.error("Error guardando el motivo de no avance:", err);
          toast.error("No se pudo guardar la razón. Inténtalo de nuevo.");
        },
      },
    );
  };

  if (!oferta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="light mx-auto max-h-[90vh] max-w-[480px] gap-0 overflow-hidden rounded-md p-0"
        style={{ fontFamily: MODAL_FONT }}
      >
        <ModalFormHeader
          title="¿Por qué no avanzó esta oferta?"
          subtitle={
            <>
              {ofertaLabel} · {oferta.lead_nombre}
              {oferta.propiedad_nombre ? ` · ${oferta.propiedad_nombre}` : ""}
            </>
          }
        />

        <div className={cn(MODAL_BODY_CLS, "max-h-[calc(90vh-13rem)]")}>
          {!disponible && !loadingCatalogo && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs font-medium text-amber-800">
                El catálogo de razones aún no está habilitado en este ambiente. Puedes revisar las
                opciones, pero el guardado se activa cuando el administrador ejecute la
                configuración pendiente.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Tu respuesta nos ayuda a entender dónde se cae el pipeline y a mejorar precios,
            esquemas de pago y producto. Elige la razón principal.
          </p>

          {loadingCatalogo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {motivos.map((m) => {
                const isSelected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!canUpdate}
                    onClick={() => setSelectedId((prev) => (prev === m.id ? null : m.id))}
                    className={cn(
                      "w-full rounded-md border-2 px-3 py-2 text-left transition-all",
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60"
                        : "border-border hover:border-muted-foreground/30",
                      !canUpdate && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span className="text-sm font-semibold text-foreground">{m.nombre}</span>
                      {!m.es_recuperable && (
                        <Badge className="ml-auto shrink-0 border-0 bg-red-100 text-xs text-red-700">
                          Definitiva
                        </Badge>
                      )}
                    </div>
                    {m.descripcion && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.descripcion}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <FieldLabel
              required={comentarioRequerido}
              hint={comentarioRequerido ? undefined : "(opcional)"}
            >
              Detalle
            </FieldLabel>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              disabled={!canUpdate}
              rows={3}
              maxLength={500}
              placeholder="Cuéntanos qué pasó: qué pedía el prospecto, con qué comparó, qué le faltó…"
              className="resize-none text-sm"
            />
            {faltaComentario && (
              <p className="mt-1 text-xs text-destructive">
                Este motivo requiere que escribas el detalle.
              </p>
            )}
          </div>

          {registro?.fecha_registro && (
            <p className="text-xs text-muted-foreground">
              Registrada por {registro.registrado_por || "un usuario"} el{" "}
              {new Date(registro.fecha_registro).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              .
            </p>
          )}
        </div>

        <div className={cn(MODAL_FOOTER_CLS, "items-center bg-background")}>
          {!canUpdate && (
            <p className="mr-auto text-xs text-muted-foreground">
              No tienes permiso para editar el pipeline.
            </p>
          )}
          <Button variant="cancel" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button variant="primary-outline" onClick={handleGuardar} disabled={!puedeGuardar}>
            {guardar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {registro ? "Actualizar razón" : "Guardar razón"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
