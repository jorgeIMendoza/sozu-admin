
import { useState } from "react";
import {
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  Clock,
  FileCheck2,
  Info,
  Search,
} from "lucide-react";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { mxn, selectores } from "@/lib/portal-personal/selectores";
import type { EstatusGanancia, Ganancia } from "@/lib/portal-personal/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoVacio } from "@/components/admin/portal-personal/comunes/Estados";
import { cn } from "@/lib/utils";


const PASOS: { key: EstatusGanancia; label: string; icono: typeof Clock }[] = [
  { key: "devengado", label: "Generado", icono: FileCheck2 },
  { key: "en_revision", label: "En revisión", icono: Search },
  { key: "aprobado", label: "Aprobado", icono: CheckCircle2 },
  { key: "programado", label: "Programado", icono: Clock },
  { key: "depositado", label: "Depositado", icono: Banknote },
];

const ETIQUETA: Record<EstatusGanancia, { l: string; c: string }> = {
  devengado: { l: "Generado", c: "bg-secondary text-gris" },
  en_revision: { l: "En revisión", c: "bg-ambar-claro text-negro" },
  aprobado: { l: "Aprobado", c: "bg-verde-claro text-verde-oscuro" },
  programado: { l: "Programado", c: "bg-verde-claro text-verde-oscuro" },
  depositado: { l: "Depositado", c: "bg-verde text-background" },
};

export default function GananciasPage() {
  const modo = usePortal((s) => s.modo_presentacion);
  const usuario = usePortal((s) => s.usuario);
  const referidos = usePortal((s) => s.referidos);
  const [q, setQ] = useState("");
  const [estatus, setEstatus] = useState("todos");
  const [detalle, setDetalle] = useState<Ganancia | null>(null);

  // SWAP POINT: supabase.ganancias
  const ganancias = selectores.gananciasDelColaborador();
  const lista = ganancias.filter((g) => {
    const ref = referidos.find((r) => r.id === g.referido_id);
    const dev = selectores.desarrolloPorId(g.desarrollo_id);
    const texto = `${g.folio} ${ref?.nombre ?? ""} ${dev?.nombre ?? ""} ${g.unidad_label}`.toLowerCase();
    return texto.includes(q.toLowerCase()) && (estatus === "todos" || g.estatus === estatus);
  });

  const oculto = (v: string) => (modo ? "••••••" : v);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sozu p-5">
          <p className="eyebrow text-gris">Ya cobrado</p>
          <p className="num mt-2 text-3xl font-bold text-verde">
            {oculto(mxn(selectores.yaCobrado()))}
          </p>
          <p className="mt-1 text-xs text-gris">Depositado en tu cuenta</p>
        </div>
        <div className="card-sozu p-5">
          <p className="eyebrow text-gris">Por cobrar</p>
          <p className="num mt-2 text-3xl font-bold text-negro">
            {oculto(mxn(selectores.porCobrar()))}
          </p>
          <p className="mt-1 text-xs text-gris">Aprobado o en revisión</p>
        </div>
        <div className="card-sozu p-5">
          <p className="eyebrow text-gris">Cuenta de depósito</p>
          <p className="num mt-2 text-sm font-bold text-negro">
            {modo ? "•••• ••••" : `${usuario.banco} ····${usuario.clabe.slice(-4)}`}
          </p>
          <p className="mt-1 text-xs text-gris">
            {usuario.cuenta_bancaria_confirmada ? "Confirmada" : "Pendiente de confirmar"}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gris" />
        <p className="text-sm text-negro">
          Te mostramos <strong>lo que recibes en tu cuenta</strong>. El detalle de cálculo y
          comprobantes fiscales llega por los canales oficiales de Nómina y Contabilidad.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por folio, referido o unidad..."
            className="h-11 bg-background pl-9"
          />
        </div>
        <Select value={estatus} onValueChange={setEstatus}>
          <SelectTrigger className="h-11 w-[200px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estatus</SelectItem>
            {PASOS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {ETIQUETA[p.key].l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11">
          <ArrowDownToLine className="size-4" />
          Descargar estado de cuenta
        </Button>
      </div>

      {lista.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay ganancias registradas"
          descripcion="Cuando un negocio con tu referido llegue a la etapa de pago, aparecerá aquí."
        />
      ) : (
        <div className="card-sozu overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Folio", "Desarrollo · Unidad", "Referido", "Estatus", "Fecha", "Recibes", ""].map(
                  (h) => (
                    <th key={h} className="eyebrow whitespace-nowrap px-4 py-3 text-gris">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((g) => {
                const dev = selectores.desarrolloPorId(g.desarrollo_id);
                const ref = referidos.find((r) => r.id === g.referido_id);
                return (
                  <tr key={g.id} className="border-b border-border">
                    <td className="num px-4 py-4 font-semibold text-negro">{g.folio}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-negro">{dev?.nombre}</p>
                      <p className="num text-gris">{g.unidad_label}</p>
                    </td>
                    <td className="px-4 py-4 text-negro">{oculto(ref?.nombre ?? "—")}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          ETIQUETA[g.estatus].c,
                        )}
                      >
                        {ETIQUETA[g.estatus].l}
                      </span>
                    </td>
                    <td className="num px-4 py-4 text-gris">{g.fecha_pago}</td>
                    <td className="num px-4 py-4 text-base font-bold text-verde">
                      {oculto(mxn(g.neto))}
                    </td>
                    <td className="px-4 py-4">
                      <Button variant="ghost" size="sm" onClick={() => setDetalle(g)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={detalle !== null} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-w-xl">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>Pago {detalle.folio}</DialogTitle>
              </DialogHeader>

              <div className="rounded-xl bg-verde-claro p-5 text-center">
                <p className="eyebrow text-verde-oscuro">Recibes en tu cuenta</p>
                <p className="num mt-1 text-4xl font-bold text-verde-oscuro">
                  {oculto(mxn(detalle.neto))}
                </p>
                <p className="num mt-1 text-xs text-verde-oscuro">{detalle.fecha_pago}</p>
              </div>

              <ol className="mt-4 space-y-3">
                {PASOS.map((p, i) => {
                  const idx = PASOS.findIndex((x) => x.key === detalle.estatus);
                  const alcanzado = i <= idx;
                  const Icon = p.icono;
                  return (
                    <li key={p.key} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border",
                          alcanzado
                            ? "border-verde bg-verde-claro text-verde-oscuro"
                            : "border-border bg-secondary text-gris",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          alcanzado ? "text-negro" : "text-gris",
                        )}
                      >
                        {p.label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 space-y-2 rounded-xl bg-secondary p-4 text-sm">
                <Dato label="Desarrollo" valor={selectores.desarrolloPorId(detalle.desarrollo_id)?.nombre ?? "—"} />
                <Dato label="Unidad" valor={detalle.unidad_label} />
                <Dato
                  label="Referido"
                  valor={oculto(
                    referidos.find((r) => r.id === detalle.referido_id)?.nombre ?? "—",
                  )}
                />
                <Dato label="Compradores en la operación" valor={String(detalle.compradores)} />
                <Dato label="Cuenta de depósito" valor={modo ? "••••" : `····${usuario.clabe.slice(-4)}`} />
              </div>

              <p className="mt-3 text-xs text-gris">
                El depósito se concilia contra el comprobante bancario. Si la fecha cambia, te
                avisamos en esta misma pantalla.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gris">{label}</span>
      <span className="num font-semibold text-negro">{valor}</span>
    </div>
  );
}
