import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// Estatus permitidos para el cambio masivo. Deliberadamente solo estos dos:
// mover una propiedad a Apartada/Vendida/etc. dispara cobranza y no se hace en lote.
const ESTATUS_INVENTARIO = 1;
const ESTATUS_DISPONIBLE = 2;

export interface PropiedadBulk {
  id: number;
  numero_propiedad: string;
  id_estatus_disponibilidad: number;
  precio_lista: number;
  monto_apartado: number | null;
  id_tipo_transaccion: number | null;
}

interface TipoTransaccionOption {
  id: number;
  nombre: string;
}

interface BulkUpdatePropiedadesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Devuelve todas las propiedades que coinciden con los filtros activos de la vista. */
  cargarPropiedades: () => Promise<PropiedadBulk[]>;
  tiposTransaccion: TipoTransaccionOption[];
  /** Descripción legible de los filtros activos, para el encabezado y la confirmación. */
  filtrosActivos: string[];
  onUpdated: () => void;
}

type ModoPrecio = "fijo" | "ajuste";
type TipoAjuste = "monto" | "porcentaje";
type DireccionAjuste = "aumento" | "reduccion";

const CHUNK_SIZE = 150;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const formatMoneda = (valor: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor);

export function BulkUpdatePropiedadesDialog({
  open,
  onOpenChange,
  cargarPropiedades,
  tiposTransaccion,
  filtrosActivos,
  onUpdated,
}: BulkUpdatePropiedadesDialogProps) {
  const { toast } = useToast();

  const [propiedades, setPropiedades] = useState<PropiedadBulk[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [paso, setPaso] = useState<"form" | "confirmacion">("form");
  const [guardando, setGuardando] = useState(false);

  // Cambio de estatus
  const [cambiarEstatus, setCambiarEstatus] = useState(false);
  const [estatusDestino, setEstatusDestino] = useState<string>(String(ESTATUS_DISPONIBLE));

  // Precio de lista
  const [cambiarPrecio, setCambiarPrecio] = useState(false);
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>("fijo");
  const [precioFijoCents, setPrecioFijoCents] = useState(0);
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>("monto");
  const [direccionAjuste, setDireccionAjuste] = useState<DireccionAjuste>("aumento");
  const [ajusteMontoCents, setAjusteMontoCents] = useState(0);
  const [ajustePorcentaje, setAjustePorcentaje] = useState("");

  // Monto de apartado
  const [cambiarApartado, setCambiarApartado] = useState(false);
  const [apartadoCents, setApartadoCents] = useState(0);

  // Tipo de transacción
  const [cambiarTipoTransaccion, setCambiarTipoTransaccion] = useState(false);
  const [tipoTransaccionId, setTipoTransaccionId] = useState<string>("");

  const resetForm = () => {
    setPaso("form");
    setCambiarEstatus(false);
    setEstatusDestino(String(ESTATUS_DISPONIBLE));
    setCambiarPrecio(false);
    setModoPrecio("fijo");
    setPrecioFijoCents(0);
    setTipoAjuste("monto");
    setDireccionAjuste("aumento");
    setAjusteMontoCents(0);
    setAjustePorcentaje("");
    setCambiarApartado(false);
    setApartadoCents(0);
    setCambiarTipoTransaccion(false);
    setTipoTransaccionId("");
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    setErrorCarga(null);
    setCargando(true);
    cargarPropiedades()
      .then((rows) => setPropiedades(rows))
      .catch((error) => {
        console.error("Error cargando propiedades para actualización masiva:", error);
        setErrorCarga("No se pudieron cargar las propiedades del filtro actual.");
        setPropiedades([]);
      })
      .finally(() => setCargando(false));
    // cargarPropiedades cambia en cada render del padre; el disparador real es `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const estatusOrigen = estatusDestino === String(ESTATUS_DISPONIBLE) ? ESTATUS_INVENTARIO : ESTATUS_DISPONIBLE;

  const disponibles = useMemo(
    () => propiedades.filter((p) => p.id_estatus_disponibilidad === ESTATUS_DISPONIBLE),
    [propiedades]
  );

  const afectadasEstatus = useMemo(
    () => propiedades.filter((p) => p.id_estatus_disponibilidad === estatusOrigen),
    [propiedades, estatusOrigen]
  );

  const porcentajeNumerico = parseFloat(ajustePorcentaje.replace(",", "."));

  const calcularNuevoPrecio = (precioActual: number): number => {
    if (modoPrecio === "fijo") return precioFijoCents / 100;
    const signo = direccionAjuste === "aumento" ? 1 : -1;
    if (tipoAjuste === "monto") {
      return Math.round((precioActual + signo * (ajusteMontoCents / 100)) * 100) / 100;
    }
    const pct = isNaN(porcentajeNumerico) ? 0 : porcentajeNumerico;
    return Math.round(precioActual * (1 + (signo * pct) / 100) * 100) / 100;
  };

  const nuevosPrecios = useMemo(() => {
    if (!cambiarPrecio) return [];
    return disponibles.map((p) => ({ propiedad: p, nuevoPrecio: calcularNuevoPrecio(p.precio_lista || 0) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cambiarPrecio, disponibles, modoPrecio, precioFijoCents, tipoAjuste, direccionAjuste, ajusteMontoCents, ajustePorcentaje]);

  const preciosInvalidos = nuevosPrecios.filter((n) => !(n.nuevoPrecio > 0));

  const precioConfigurado =
    !cambiarPrecio ||
    (modoPrecio === "fijo"
      ? precioFijoCents > 0
      : tipoAjuste === "monto"
        ? ajusteMontoCents > 0
        : !isNaN(porcentajeNumerico) && porcentajeNumerico > 0);

  const hayAlgunCambio = cambiarEstatus || cambiarPrecio || cambiarApartado || cambiarTipoTransaccion;

  const formValido =
    hayAlgunCambio &&
    propiedades.length > 0 &&
    precioConfigurado &&
    preciosInvalidos.length === 0 &&
    (!cambiarTipoTransaccion || tipoTransaccionId !== "") &&
    (!cambiarApartado || apartadoCents > 0) &&
    (!cambiarEstatus || afectadasEstatus.length > 0);

  const tipoTransaccionNombre = tiposTransaccion.find((t) => String(t.id) === tipoTransaccionId)?.nombre ?? "";

  const descripcionAjuste = () => {
    if (modoPrecio === "fijo") return `Precio fijo de ${formatMoneda(precioFijoCents / 100)}`;
    const verbo = direccionAjuste === "aumento" ? "Aumento" : "Reducción";
    return tipoAjuste === "monto"
      ? `${verbo} de ${formatMoneda(ajusteMontoCents / 100)} sobre el precio actual`
      : `${verbo} de ${isNaN(porcentajeNumerico) ? 0 : porcentajeNumerico}% sobre el precio actual`;
  };

  const aplicarCambios = async () => {
    setGuardando(true);
    try {
      // 1. Estatus (solo Inventario <-> Disponible)
      if (cambiarEstatus && afectadasEstatus.length > 0) {
        for (const ids of chunk(afectadasEstatus.map((p) => p.id), CHUNK_SIZE)) {
          const { error } = await supabase
            .from("propiedades")
            .update({ id_estatus_disponibilidad: Number(estatusDestino) })
            .in("id", ids);
          if (error) throw error;
        }
      }

      // 2. Precio de lista (solo propiedades que estaban en Disponible)
      if (cambiarPrecio && nuevosPrecios.length > 0) {
        if (modoPrecio === "fijo") {
          for (const ids of chunk(nuevosPrecios.map((n) => n.propiedad.id), CHUNK_SIZE)) {
            const { error } = await supabase
              .from("propiedades")
              .update({ precio_lista: precioFijoCents / 100 })
              .in("id", ids);
            if (error) throw error;
          }
        } else {
          // Cada propiedad recibe un precio distinto: se actualizan de a lotes de 20 en paralelo.
          for (const lote of chunk(nuevosPrecios, 20)) {
            const resultados = await Promise.all(
              lote.map(({ propiedad, nuevoPrecio }) =>
                supabase.from("propiedades").update({ precio_lista: nuevoPrecio }).eq("id", propiedad.id)
              )
            );
            const fallo = resultados.find((r) => r.error);
            if (fallo?.error) throw fallo.error;
          }
        }
      }

      // 3. Monto de apartado (solo propiedades en Disponible)
      if (cambiarApartado && disponibles.length > 0) {
        for (const ids of chunk(disponibles.map((p) => p.id), CHUNK_SIZE)) {
          const { error } = await supabase
            .from("propiedades")
            .update({ monto_apartado: apartadoCents / 100 })
            .in("id", ids);
          if (error) throw error;
        }
      }

      // 4. Tipo de transacción (todas las propiedades del filtro)
      if (cambiarTipoTransaccion && tipoTransaccionId) {
        for (const ids of chunk(propiedades.map((p) => p.id), CHUNK_SIZE)) {
          const { error } = await supabase
            .from("propiedades")
            .update({ id_tipo_transaccion: Number(tipoTransaccionId) })
            .in("id", ids);
          if (error) throw error;
        }
      }

      toast({
        title: "Actualización masiva aplicada",
        description: `Se actualizaron las propiedades que coinciden con los filtros activos.`,
      });
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error en actualización masiva:", error);
      toast({
        title: "Error",
        description: (error as Error)?.message || "No se pudo completar la actualización masiva.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const resumen: { titulo: string; detalle: string; afectadas: number }[] = [];
  if (cambiarEstatus) {
    resumen.push({
      titulo: "Estatus de propiedad",
      detalle: `${estatusOrigen === ESTATUS_INVENTARIO ? "Inventario" : "Disponible"} → ${
        Number(estatusDestino) === ESTATUS_DISPONIBLE ? "Disponible" : "Inventario"
      }`,
      afectadas: afectadasEstatus.length,
    });
  }
  if (cambiarPrecio) {
    resumen.push({
      titulo: "Precio de lista",
      detalle: descripcionAjuste(),
      afectadas: nuevosPrecios.length,
    });
  }
  if (cambiarApartado) {
    resumen.push({
      titulo: "Monto de apartado",
      detalle: formatMoneda(apartadoCents / 100),
      afectadas: disponibles.length,
    });
  }
  if (cambiarTipoTransaccion) {
    resumen.push({
      titulo: "Tipo de transacción",
      detalle: tipoTransaccionNombre,
      afectadas: propiedades.length,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {paso === "form" ? "Actualización masiva de propiedades" : "Confirmar actualización masiva"}
          </DialogTitle>
          <DialogDescription>
            Los cambios se aplicarán a <strong>todas las propiedades que coinciden con los filtros activos</strong>{" "}
            (las que se muestran en la lista), no solo a las visibles en esta página.
          </DialogDescription>
        </DialogHeader>

        {filtrosActivos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filtrosActivos.map((filtro) => (
              <Badge key={filtro} variant="secondary" className="text-xs">
                {filtro}
              </Badge>
            ))}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando propiedades del filtro...
          </div>
        ) : errorCarga ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        ) : paso === "form" ? (
          <div className="space-y-5">
            <Alert>
              <AlertTitle>{propiedades.length} propiedades coinciden con el filtro</AlertTitle>
              <AlertDescription>
                {disponibles.length} en estatus Disponible. El precio de lista y el monto de apartado solo se aplican a
                esas.
              </AlertDescription>
            </Alert>

            {/* Estatus */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-estatus"
                  checked={cambiarEstatus}
                  onCheckedChange={(v) => setCambiarEstatus(v === true)}
                />
                <Label htmlFor="bulk-estatus" className="font-medium cursor-pointer">
                  Cambiar estatus de propiedad
                </Label>
              </div>
              {cambiarEstatus && (
                <div className="pl-6 space-y-2">
                  <RadioGroup value={estatusDestino} onValueChange={setEstatusDestino} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={String(ESTATUS_DISPONIBLE)} id="bulk-estatus-disponible" />
                      <Label htmlFor="bulk-estatus-disponible" className="font-normal cursor-pointer">
                        Inventario → Disponible
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={String(ESTATUS_INVENTARIO)} id="bulk-estatus-inventario" />
                      <Label htmlFor="bulk-estatus-inventario" className="font-normal cursor-pointer">
                        Disponible → Inventario
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Solo se permite entre Inventario y Disponible. Afecta a {afectadasEstatus.length} propiedades.
                  </p>
                </div>
              )}
            </div>

            {/* Precio de lista */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-precio"
                  checked={cambiarPrecio}
                  onCheckedChange={(v) => setCambiarPrecio(v === true)}
                />
                <Label htmlFor="bulk-precio" className="font-medium cursor-pointer">
                  Actualizar precio de lista
                </Label>
                <span className="text-xs text-muted-foreground">(solo estatus Disponible)</span>
              </div>
              {cambiarPrecio && (
                <div className="pl-6 space-y-3">
                  <RadioGroup value={modoPrecio} onValueChange={(v) => setModoPrecio(v as ModoPrecio)} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fijo" id="bulk-precio-fijo" />
                      <Label htmlFor="bulk-precio-fijo" className="font-normal cursor-pointer">
                        Monto fijo
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ajuste" id="bulk-precio-ajuste" />
                      <Label htmlFor="bulk-precio-ajuste" className="font-normal cursor-pointer">
                        Aumento / reducción
                      </Label>
                    </div>
                  </RadioGroup>

                  {modoPrecio === "fijo" ? (
                    <div className="space-y-1">
                      <Label htmlFor="bulk-precio-valor">Nuevo precio de lista</Label>
                      <CurrencyInput id="bulk-precio-valor" value={precioFijoCents} onChange={setPrecioFijoCents} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <RadioGroup
                        value={direccionAjuste}
                        onValueChange={(v) => setDireccionAjuste(v as DireccionAjuste)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="aumento" id="bulk-ajuste-aumento" />
                          <Label htmlFor="bulk-ajuste-aumento" className="font-normal cursor-pointer">
                            Aumento
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="reduccion" id="bulk-ajuste-reduccion" />
                          <Label htmlFor="bulk-ajuste-reduccion" className="font-normal cursor-pointer">
                            Reducción
                          </Label>
                        </div>
                      </RadioGroup>
                      <RadioGroup
                        value={tipoAjuste}
                        onValueChange={(v) => setTipoAjuste(v as TipoAjuste)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="monto" id="bulk-ajuste-monto" />
                          <Label htmlFor="bulk-ajuste-monto" className="font-normal cursor-pointer">
                            Monto fijo
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="porcentaje" id="bulk-ajuste-porcentaje" />
                          <Label htmlFor="bulk-ajuste-porcentaje" className="font-normal cursor-pointer">
                            Porcentaje
                          </Label>
                        </div>
                      </RadioGroup>
                      {tipoAjuste === "monto" ? (
                        <div className="space-y-1">
                          <Label htmlFor="bulk-ajuste-monto-valor">Monto del ajuste</Label>
                          <CurrencyInput
                            id="bulk-ajuste-monto-valor"
                            value={ajusteMontoCents}
                            onChange={setAjusteMontoCents}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label htmlFor="bulk-ajuste-pct-valor">Porcentaje del ajuste (%)</Label>
                          <Input
                            id="bulk-ajuste-pct-valor"
                            type="number"
                            min="0"
                            step="0.01"
                            value={ajustePorcentaje}
                            onChange={(e) => setAjustePorcentaje(e.target.value)}
                            placeholder="Ej: 5"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {preciosInvalidos.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        El ajuste deja {preciosInvalidos.length} propiedades con precio menor o igual a $0. Corrige el
                        monto o porcentaje.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>

            {/* Monto de apartado */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-apartado"
                  checked={cambiarApartado}
                  onCheckedChange={(v) => setCambiarApartado(v === true)}
                />
                <Label htmlFor="bulk-apartado" className="font-medium cursor-pointer">
                  Actualizar monto de apartado
                </Label>
                <span className="text-xs text-muted-foreground">(solo estatus Disponible)</span>
              </div>
              {cambiarApartado && (
                <div className="pl-6 space-y-1">
                  <Label htmlFor="bulk-apartado-valor">Nuevo monto de apartado</Label>
                  <CurrencyInput id="bulk-apartado-valor" value={apartadoCents} onChange={setApartadoCents} />
                  <p className="text-xs text-muted-foreground">Afecta a {disponibles.length} propiedades.</p>
                </div>
              )}
            </div>

            {/* Tipo de transacción */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-tipo-transaccion"
                  checked={cambiarTipoTransaccion}
                  onCheckedChange={(v) => setCambiarTipoTransaccion(v === true)}
                />
                <Label htmlFor="bulk-tipo-transaccion" className="font-medium cursor-pointer">
                  Cambiar tipo de transacción
                </Label>
              </div>
              {cambiarTipoTransaccion && (
                <div className="pl-6 space-y-1">
                  <Label htmlFor="bulk-tipo-transaccion-valor">Tipo de transacción</Label>
                  <Select value={tipoTransaccionId} onValueChange={setTipoTransaccionId}>
                    <SelectTrigger id="bulk-tipo-transaccion-valor">
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposTransaccion.map((tipo) => (
                        <SelectItem key={tipo.id} value={String(tipo.id)}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Afecta a {propiedades.length} propiedades.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Revisa antes de aplicar</AlertTitle>
              <AlertDescription>
                Se modificarán propiedades del filtro actual ({propiedades.length} coincidencias). Esta acción no se
                deshace automáticamente.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border divide-y">
              {resumen.map((item) => (
                <div key={item.titulo} className="p-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{item.titulo}</p>
                    <p className="text-sm text-muted-foreground">{item.detalle}</p>
                  </div>
                  <Badge variant={item.afectadas > 0 ? "default" : "secondary"} className="shrink-0">
                    {item.afectadas} propiedades
                  </Badge>
                </div>
              ))}
            </div>

            {cambiarPrecio && nuevosPrecios.length > 0 && modoPrecio === "ajuste" && (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">Ejemplo del ajuste</p>
                <p className="text-muted-foreground">
                  Propiedad {nuevosPrecios[0].propiedad.numero_propiedad}:{" "}
                  {formatMoneda(nuevosPrecios[0].propiedad.precio_lista || 0)} →{" "}
                  {formatMoneda(nuevosPrecios[0].nuevoPrecio)}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {paso === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!formValido || cargando} onClick={() => setPaso("confirmacion")}>
                Revisar cambios
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPaso("form")} disabled={guardando}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <Button onClick={aplicarCambios} disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar y aplicar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
