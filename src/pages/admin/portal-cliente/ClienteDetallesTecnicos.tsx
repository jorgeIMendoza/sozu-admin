import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Ruler, Eye, Download, Loader2 } from "lucide-react";
import { useClientePropiedadDetalle } from "@/hooks/useClientePropiedadDetalle";

const ClienteDetallesTecnicos = () => {
  const { cuentaId } = useParams<{ cuentaId: string }>();
  const navigate = useNavigate();
  const { data: prop, isLoading } = useClientePropiedadDetalle(cuentaId ? Number(cuentaId) : null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="max-w-lg mx-auto px-5 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Regresar
        </button>
        <p className="text-muted-foreground">No se encontró la propiedad.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto lg:max-w-2xl pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-5 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-foreground font-medium">
          <ArrowLeft className="w-4 h-4" />
          <div>
            <p className="font-semibold text-sm leading-tight">{prop.proyecto}</p>
            <p className="text-xs text-muted-foreground">Unidad {prop.unidad}</p>
          </div>
        </button>
        <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[hsl(var(--inmob-green))]/15 text-[hsl(var(--inmob-green))]">
          • Anexos técnicos
        </span>
      </div>

      <div className="mx-5 mt-5 space-y-6">
        <div>
          <h2 className="font-bold text-lg text-foreground">Anexos y detalles técnicos</h2>
          <p className="text-xs text-[hsl(var(--inmob-green))] font-medium mt-1">Ficha técnica oficial del inmueble</p>
        </div>

        {/* Plano de referencia (hardcoded) */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 bg-muted/30 flex items-center justify-center min-h-[200px]">
            <div className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground">
              {/* Simplified floor plan representation */}
              <div className="col-start-3 col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">12</span>
                <br />72.74 m²
              </div>
              <div className="col-start-4 col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">11</span>
                <br />77.54 m²
              </div>
              <div className="col-start-3 col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">13</span>
                <br />72.74 m²
              </div>
              <div className="col-start-4 col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">10</span>
                <br />77.12 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">3</span>
                <br />82.95 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">2</span>
                <br />82.01 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">1</span>
                <br />107.81 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">9</span>
                <br />77.13 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">4</span>
                <br />70.64 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">5</span>
                <br />73.96 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">6</span>
                <br />73.38 m²
              </div>
              <div className="col-span-1 border border-border rounded p-2 text-center bg-card">
                <span className="font-bold text-foreground text-xs">7</span>
                <br />40.51 m²
              </div>
            </div>
          </div>
          <div className="px-4 py-3 text-center border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">D{prop.unidad}</span> PLANO DE REFERENCIA
            </p>
          </div>
        </div>

        {/* Plano de ubicación */}
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3">Plano de ubicación</h3>
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Nivel</p>
                <p className="text-sm font-semibold text-foreground">Nivel {prop.unidad?.charAt(0) || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Modelo</p>
                <p className="text-sm font-semibold text-foreground">{prop.edificio || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Área total</p>
              <p className="text-sm font-semibold text-foreground">{prop.m2Total > 0 ? `${prop.m2Total.toFixed(1)} m²` : "—"}</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
                <Eye className="w-4 h-4" />
                Ver plano
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Plano arquitectónico (hardcoded placeholder) */}
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3">Plano arquitectónico</h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-4 bg-muted/20 flex flex-col items-center justify-center min-h-[250px]">
              <div className="border-2 border-dashed border-border rounded-xl p-8 w-full flex flex-col items-center justify-center gap-3">
                <MapPin className="w-10 h-10 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Plano arquitectónico del modelo
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {prop.edificio || "Modelo"} — Departamento {prop.unidad} — {prop.m2Total > 0 ? `${prop.m2Total.toFixed(1)} m²` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rendimiento de inversión */}
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3">Rendimiento de inversión</h3>
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Precio de compra</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {prop.precioFinal > 0 ? `$${prop.precioFinal.toLocaleString("es-MX")}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Precio/m² compra</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {prop.precioM2Compra > 0 ? `$${Math.round(prop.precioM2Compra).toLocaleString("es-MX")}/m²` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Precio/m² actual</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {prop.precioM2Actual > 0 ? `$${Math.round(prop.precioM2Actual).toLocaleString("es-MX")}/m²` : "—"}
              </span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Plusvalía</span>
              <span className={`text-sm font-bold tabular-nums ${prop.appreciationPercent >= 0 ? "text-[hsl(var(--inmob-green))]" : "text-destructive"}`}>
                {prop.appreciationPercent >= 0 ? "+" : ""}{prop.appreciationPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClienteDetallesTecnicos;
