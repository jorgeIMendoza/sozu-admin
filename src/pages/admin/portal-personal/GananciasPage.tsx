import { useMemo, useState } from "react";
import { Banknote, Info, Loader2, Search, Wallet } from "lucide-react";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { mxn } from "@/lib/portal-personal/selectores";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";
import {
  useComisionesPorEmail,
  type ComisionPorEmailRow,
} from "@/hooks/useComisionesPorEmail";
import {
  comisionEstatus,
  COMISION_ESTATUS_LABEL,
  type ComisionEstatus,
} from "@/components/admin/comisiones/ComisionesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoVacio } from "@/components/admin/portal-personal/comunes/Estados";
import { cn } from "@/lib/utils";

/**
 * Mis ganancias — historial REAL de comisiones de la persona.
 *
 * Fuente: `comisionistas` filtrada por `email_usuario` (server-side), con el mismo
 * waterfall cuenta → oferta → propiedad → modelo/proyecto que usa el Portal Agente
 * (`useComisionesPorEmail`). Es el renglón de esta persona dentro de las Comisiones
 * Internas de Alta Dirección: mismos porcentajes, mismos montos, mismo estatus.
 *
 * El monto es `precio_final × porcentaje_comision / 100`, la misma fórmula que
 * `useComisionesInternas`.
 *
 * INVARIANTE de privacidad: solo el renglón de la persona. Nunca la comisión total
 * de la cuenta ni el renglón de otro comisionista.
 */

/** Paleta del portal para el estatus de pago (mismas etiquetas que el resto del sistema). */
const ESTATUS_CLS: Record<ComisionEstatus, string> = {
  pagada: "bg-verde text-background",
  aprobado: "bg-verde-claro text-verde-oscuro",
  en_revision: "bg-ambar-claro text-negro",
  pendiente: "bg-secondary text-gris",
};

const ORDEN_ESTATUS: ComisionEstatus[] = ["pagada", "aprobado", "en_revision", "pendiente"];

const pct = (v: number) =>
  `${v.toLocaleString("es-MX", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function GananciasPage() {
  const modo = usePortal((s) => s.modo_presentacion);
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const email = ((isImpersonating ? impersonatedUser?.email : profile?.email) ?? "").trim();

  const { comisiones, isLoading } = useComisionesPorEmail(email || null);

  const [q, setQ] = useState("");
  const [estatus, setEstatus] = useState<"todos" | ComisionEstatus>("todos");
  const [detalle, setDetalle] = useState<ComisionPorEmailRow | null>(null);

  const oculto = (v: string) => (modo ? "••••••" : v);

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return comisiones
      .filter((c) => {
        if (estatus !== "todos" && comisionEstatus(c.detailed_status) !== estatus) return false;
        if (!t) return true;
        const texto = `${c.cuenta_cobranza_label} ${c.tipo ?? ""} ${c.proyecto ?? ""} ${c.modelo ?? ""} ${c.propiedad ?? ""} ${c.productoNombre ?? ""}`;
        return texto.toLowerCase().includes(t);
      })
      // Lo cobrado primero por antigüedad de pago; el resto por monto.
      .sort((a, b) => b.monto_comision - a.monto_comision);
  }, [comisiones, q, estatus]);

  const totales = useMemo(() => {
    let cobrado = 0;
    let porCobrar = 0;
    for (const c of comisiones) {
      if (c.pagada) cobrado += c.monto_comision;
      else porCobrar += c.monto_comision;
    }
    return { cobrado, porCobrar, total: cobrado + porCobrar };
  }, [comisiones]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          icono={Banknote}
          etiqueta="Ya cobrado"
          valor={oculto(mxn(totales.cobrado, 2))}
          nota={`${comisiones.filter((c) => c.pagada).length} comisiones dispersadas`}
          tono="verde"
        />
        <Kpi
          icono={Wallet}
          etiqueta="Por cobrar"
          valor={oculto(mxn(totales.porCobrar, 2))}
          nota={`${comisiones.filter((c) => !c.pagada).length} en proceso`}
          tono="negro"
        />
        <Kpi
          icono={Info}
          etiqueta="Total histórico"
          valor={oculto(mxn(totales.total, 2))}
          nota={`${comisiones.length} comisiones en total`}
          tono="negro"
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gris" />
        <p className="text-sm text-negro">
          Este es <strong>tu renglón</strong> de cada comisión: el porcentaje que se dispersó a tu
          nombre y su monto. No incluye la comisión total de la venta ni la de otros
          comisionistas. Los comprobantes fiscales llegan por los canales oficiales de Nómina y
          Contabilidad.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cuenta, proyecto, modelo o departamento..."
            className="h-11 bg-background pl-9"
          />
        </div>
        <Select value={estatus} onValueChange={(v) => setEstatus(v as typeof estatus)}>
          <SelectTrigger className="h-11 w-[200px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estatus</SelectItem>
            {ORDEN_ESTATUS.map((e) => (
              <SelectItem key={e} value={e}>
                {COMISION_ESTATUS_LABEL[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-10 text-sm text-gris">
          <Loader2 className="size-4 animate-spin" />
          Cargando tus comisiones...
        </div>
      ) : comisiones.length === 0 ? (
        <EstadoVacio
          icono={Banknote}
          titulo="Aún no tienes comisiones registradas"
          descripcion="Aquí aparecerá cada venta en la que participaste como comisionista interno, con el porcentaje y el monto que se dispersó a tu nombre."
        />
      ) : filas.length === 0 ? (
        <EstadoVacio
          icono={Search}
          titulo="Sin resultados"
          descripcion="Ninguna comisión coincide con la búsqueda o el estatus seleccionado."
        />
      ) : (
        <div className="card-sozu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/60">
                <tr>
                  <Th>ID Cuenta</Th>
                  <Th>Tipo</Th>
                  <Th>Proyecto</Th>
                  <Th>Modelo</Th>
                  <Th>No. Departamento</Th>
                  <Th alineado="derecha">Precio final de venta</Th>
                  <Th alineado="derecha">% comisión</Th>
                  <Th alineado="derecha">Monto comisión</Th>
                  <Th>Estatus Pago</Th>
                  <Th alineado="centro">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c, i) => {
                  const e = comisionEstatus(c.detailed_status);
                  return (
                    <tr
                      key={`${c.id_cuenta_cobranza}-${i}`}
                      className="border-b border-border last:border-0 hover:bg-secondary/40"
                    >
                      <Td>
                        <span className="num font-semibold text-negro">{c.cuenta_cobranza_label}</span>
                      </Td>
                      <Td>{c.tipo ?? "—"}</Td>
                      <Td>{c.proyecto || "—"}</Td>
                      <Td>{c.modelo || "—"}</Td>
                      <Td>
                        <span className="num">
                          {c.propiedad || c.productoNombre || "—"}
                        </span>
                      </Td>
                      <Td alineado="derecha">
                        <span className="num">{oculto(mxn(c.precio_final, 2))}</span>
                      </Td>
                      <Td alineado="derecha">
                        <span className="num">{pct(c.porcentaje_comision)}</span>
                      </Td>
                      <Td alineado="derecha">
                        <span className="num font-bold text-verde">
                          {oculto(mxn(c.monto_comision, 2))}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                            ESTATUS_CLS[e],
                          )}
                        >
                          {COMISION_ESTATUS_LABEL[e]}
                        </span>
                      </Td>
                      <Td alineado="centro">
                        <Button variant="outline" size="sm" onClick={() => setDetalle(c)}>
                          Ver detalle
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
            <p className="text-xs text-gris">
              {filas.length} de {comisiones.length} comisiones
            </p>
            <p className="num text-sm font-bold text-negro">
              Suma mostrada:{" "}
              <span className="text-verde">
                {oculto(mxn(filas.reduce((a, c) => a + c.monto_comision, 0), 2))}
              </span>
            </p>
          </div>
        </div>
      )}

      <Dialog open={!!detalle} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Comisión · {detalle?.cuenta_cobranza_label}
            </DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4">
              <div className="rounded-xl bg-verde-claro p-4">
                <p className="eyebrow text-gris">Monto dispersado a tu nombre</p>
                <p className="num mt-1 text-3xl font-bold text-verde">
                  {oculto(mxn(detalle.monto_comision, 2))}
                </p>
                <p className="num mt-1 text-xs text-gris">
                  {pct(detalle.porcentaje_comision)} sobre {oculto(mxn(detalle.precio_final, 2))}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Dato label="Tipo de cuenta" valor={detalle.tipo ?? "—"} />
                <Dato label="Proyecto" valor={detalle.proyecto || "—"} />
                <Dato label="Modelo" valor={detalle.modelo || "—"} />
                <Dato
                  label="No. Departamento"
                  valor={String(detalle.propiedad || detalle.productoNombre || "—")}
                />
                <Dato
                  label="Precio final de venta"
                  valor={oculto(mxn(detalle.precio_final, 2))}
                />
                <Dato
                  label="Estatus de pago"
                  valor={COMISION_ESTATUS_LABEL[comisionEstatus(detalle.detailed_status)]}
                />
                <Dato label="Fecha de pago" valor={detalle.pagada ? fecha(detalle.fecha_pago) : "—"} />
                <Dato label="Aprobada" valor={detalle.aprobada ? "Sí" : "No"} />
              </div>

              {detalle.clientes.length > 0 && (
                <div>
                  <p className="eyebrow text-gris">Cliente(s) de la cuenta</p>
                  <ul className="mt-2 space-y-1">
                    {detalle.clientes.map((cl, i) => (
                      <li key={`${cl.email}-${i}`} className="text-sm text-negro">
                        {oculto(cl.nombre || cl.email || "Sin nombre")}
                        {cl.porcentaje ? (
                          <span className="num text-gris"> · {cl.porcentaje}% copropiedad</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(detalle.url_evidencia_pago || detalle.factura_url) && (
                <div className="flex flex-wrap gap-2">
                  {detalle.url_evidencia_pago && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={detalle.url_evidencia_pago} target="_blank" rel="noreferrer">
                        Ver comprobante de pago
                      </a>
                    </Button>
                  )}
                  {detalle.factura_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={detalle.factura_url} target="_blank" rel="noreferrer">
                        Ver factura
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icono: Icono,
  etiqueta,
  valor,
  nota,
  tono,
}: {
  icono: typeof Banknote;
  etiqueta: string;
  valor: string;
  nota: string;
  tono: "verde" | "negro";
}) {
  return (
    <div className="card-sozu p-5">
      <div className="flex items-center gap-2">
        <Icono className="size-4 text-gris" />
        <p className="eyebrow text-gris">{etiqueta}</p>
      </div>
      <p className={cn("num mt-2 text-3xl font-bold", tono === "verde" ? "text-verde" : "text-negro")}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-gris">{nota}</p>
    </div>
  );
}

function Th({
  children,
  alineado = "izquierda",
}: {
  children: React.ReactNode;
  alineado?: "izquierda" | "derecha" | "centro";
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-gris",
        alineado === "derecha" && "text-right",
        alineado === "centro" && "text-center",
        alineado === "izquierda" && "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  alineado = "izquierda",
}: {
  children: React.ReactNode;
  alineado?: "izquierda" | "derecha" | "centro";
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 text-negro",
        alineado === "derecha" && "text-right",
        alineado === "centro" && "text-center",
      )}
    >
      {children}
    </td>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="eyebrow text-gris">{label}</p>
      <p className="num mt-1 font-semibold text-negro">{valor}</p>
    </div>
  );
}
