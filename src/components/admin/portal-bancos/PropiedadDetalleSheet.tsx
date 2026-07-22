/**
 * Detalle de la PROPIEDAD que adquiere el cliente de una solicitud del Portal
 * Bancos (Sheet). Autocontenido dado el id de la cuenta de cobranza:
 *   - datos básicos (Proyecto, Modelo, No. Depto, Tipo, Metraje);
 *   - Estacionamientos y Bodegas con modal de detalle (vía usePropiedadSolicitudBancos);
 *   - Nivel en el edificio, Ubicación en el nivel y Distribución reutilizando
 *     `FichaTecnicaSection` (alimentado por `useClientePropiedadDetalle`);
 *   - Ficha técnica del proyecto (documento tipo 49), si existe.
 *
 * Degrada sin romper si la BD no resuelve la propiedad (RLS / datos faltantes).
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Car, Warehouse, Loader2, FileText } from "lucide-react";
import { useClientePropiedadDetalle } from "@/hooks/useClientePropiedadDetalle";
import FichaTecnicaSection from "@/components/admin/portal-cliente/investor/FichaTecnicaSection";
import {
  usePropiedadSolicitudBancos,
  type EstacionamientoSolicitud,
  type BodegaSolicitud,
} from "@/hooks/usePortalBancos/usePropiedadSolicitudBancos";

const fmtMxn2 = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtM2 = (v: number) => `${(v || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} m²`;
const fmtDate = (v: string | null) =>
  v ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v)) : "—";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export function PropiedadDetalleSheet({
  open,
  onOpenChange,
  idCuentaCobranza,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuentaCobranza: number;
}) {
  const { data: prop, isLoading } = usePropiedadSolicitudBancos(open ? idCuentaCobranza : null);
  const { data: propDetalle } = useClientePropiedadDetalle(open ? idCuentaCobranza : null);
  const [verEstac, setVerEstac] = useState(false);
  const [verBodegas, setVerBodegas] = useState(false);

  const numeroProp = prop?.numeroPropiedad ?? "—";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Propiedad
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="mt-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando propiedad…
            </div>
          ) : !prop ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No se encontró la información de la propiedad para esta solicitud.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              {/* Datos básicos */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Proyecto" value={prop.proyecto || "—"} />
                <Field label="Modelo" value={prop.modelo || "—"} />
                <Field label="No. Depto" value={numeroProp} />
                <Field label="Tipo" value={prop.tipo || "—"} />
                <Field label="Metraje" value={fmtM2(prop.m2Total)} />
                {prop.edificio && <Field label="Edificio" value={prop.edificio} />}
              </div>
              {(prop.m2Interiores > 0 || prop.m2Exteriores > 0) && (
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Interiores {fmtM2(prop.m2Interiores)} · Exteriores {fmtM2(prop.m2Exteriores)}
                </p>
              )}

              {/* Estacionamientos / Bodegas */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="justify-start h-9"
                  disabled={prop.estacionamientos.length === 0}
                  onClick={() => setVerEstac(true)}
                >
                  <Car className="h-4 w-4 mr-2" />
                  Estacionamientos ({prop.estacionamientos.length})
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-9"
                  disabled={prop.bodegas.length === 0}
                  onClick={() => setVerBodegas(true)}
                >
                  <Warehouse className="h-4 w-4 mr-2" />
                  Bodegas ({prop.bodegas.length})
                </Button>
              </div>

              {/* Ficha técnica del proyecto (documento) */}
              {prop.fichaTecnicaUrl && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-9"
                  onClick={() => window.open(prop.fichaTecnicaUrl!, "_blank")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver ficha técnica del proyecto
                </Button>
              )}

              {/* Nivel en el edificio · Ubicación en el nivel · Distribución */}
              {propDetalle && <FichaTecnicaSection propDetalle={propDetalle} />}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {prop && (
        <EstacionamientosModal
          open={verEstac}
          onOpenChange={setVerEstac}
          numeroPropiedad={numeroProp}
          estacionamientos={prop.estacionamientos}
        />
      )}
      {prop && (
        <BodegasModal
          open={verBodegas}
          onOpenChange={setVerBodegas}
          numeroPropiedad={numeroProp}
          bodegas={prop.bodegas}
        />
      )}
    </>
  );
}

function EstacionamientosModal({
  open,
  onOpenChange,
  numeroPropiedad,
  estacionamientos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numeroPropiedad: string;
  estacionamientos: EstacionamientoSolicitud[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Estacionamientos · Propiedad {numeroPropiedad}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium text-right">M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio por M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {estacionamientos.length ? (
                estacionamientos.map((est) => (
                  <tr key={est.id} className="border-t border-border/60 text-[13px]">
                    <td className="px-4 py-2 font-medium">
                      {est.nombre}
                      {est.cuentaLabel && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{est.cuentaLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{est.tipo}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtM2(est.m2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{est.precioM2 != null ? fmtMxn2(est.precioM2) : fmtMxn2(0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {fmtMxn2(est.precioFinal)}
                      {est.esIncluido && <span className="ml-2 text-[11px] font-normal italic text-muted-foreground">(incluido con el depa)</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{est.ubicacion || "N/A"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin estacionamientos ligados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BodegasModal({
  open,
  onOpenChange,
  numeroPropiedad,
  bodegas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numeroPropiedad: string;
  bodegas: BodegaSolicitud[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" /> Bodegas · Propiedad {numeroPropiedad}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium text-right">M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio por M²</th>
                <th className="px-4 py-2 font-medium text-right">Precio Final</th>
                <th className="px-4 py-2 font-medium text-right">Total Pagado</th>
                <th className="px-4 py-2 font-medium text-right">Saldo Pendiente</th>
                <th className="px-4 py-2 font-medium">Fecha compra</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {bodegas.length ? (
                bodegas.map((bodega) => (
                  <tr key={bodega.id} className="border-t border-border/60 text-[13px]">
                    <td className="px-4 py-2 font-medium">
                      {bodega.nombre}
                      {bodega.cuentaLabel && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{bodega.cuentaLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtM2(bodega.m2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{bodega.precioM2 != null ? fmtMxn2(bodega.precioM2) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{bodega.tieneCuenta ? fmtMxn2(bodega.precioFinal) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{bodega.tieneCuenta ? fmtMxn2(bodega.totalPagado) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-600">{bodega.tieneCuenta ? fmtMxn2(bodega.saldoPendiente) : "—"}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(bodega.fechaCompra)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{bodega.ubicacion || "N/A"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">Sin bodegas ligadas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PropiedadDetalleSheet;
