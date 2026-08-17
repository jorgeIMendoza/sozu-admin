
import { useState } from "react";
import { Eye, Grid3x3, List, Lock, MessageSquare, Search, Table2 } from "lucide-react";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { mxn, selectores } from "@/lib/portal-personal/selectores";
import type { EtapaNegocio } from "@/lib/portal-personal/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoVacio } from "@/components/admin/portal-personal/comunes/Estados";
import { cn } from "@/lib/utils";


const ETAPAS: Record<EtapaNegocio, { label: string; clase: string; lock?: boolean }> = {
  prospecto: { label: "Prospecto", clase: "bg-secondary text-gris" },
  oferta_enviada: { label: "Oferta enviada", clase: "bg-secondary text-negro" },
  apartado_pagado: {
    label: "Apartado pagado",
    clase: "bg-ambar-claro text-negro",
    lock: true,
  },
  contrato_firmado: { label: "Contrato firmado", clase: "bg-verde-claro text-verde-oscuro" },
  escriturado: { label: "Escriturado", clase: "bg-verde-claro text-verde-oscuro" },
  cierre_perdido: { label: "Cierre perdido", clase: "bg-rojo-claro text-rojo" },
};

export default function NegociosPage() {
  const modo = usePortal((s) => s.modo_presentacion);
  const referidos = usePortal((s) => s.referidos);
  const [q, setQ] = useState("");
  const [etapa, setEtapa] = useState("todas");
  const [vista, setVista] = useState<"tabla" | "lista" | "grid">("tabla");

  // SWAP POINT: supabase.negocios — solo negocios donde el colaborador participa
  const negocios = selectores.negociosDelColaborador();
  const nombreRef = (id: string) => referidos.find((r) => r.id === id);

  const lista = negocios.filter((n) => {
    const ref = nombreRef(n.referido_id);
    const texto = `${ref?.nombre ?? ""} ${ref?.correo ?? ""}`.toLowerCase();
    return texto.includes(q.toLowerCase()) && (etapa === "todas" || n.etapa === etapa);
  });

  const perdidosSinRazon = negocios.filter(
    (n) => n.etapa === "cierre_perdido" && !n.razon_cierre,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <p className="num eyebrow flex-1 text-gris">
          {negocios.length} negocios · 9 ofertas · {mxn(selectores.valorAbierto())} abiertos ·
          últimos 30 días
        </p>
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(
            [
              ["tabla", Table2],
              ["lista", List],
              ["grid", Grid3x3],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              aria-label={`Vista ${v}`}
              onClick={() => setVista(v)}
              className={cn(
                "rounded-md p-2",
                vista === v ? "bg-verde-claro text-verde-oscuro" : "text-gris",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar referido..."
            className="h-11 bg-background pl-9"
          />
        </div>
        <Select value={etapa} onValueChange={setEtapa}>
          <SelectTrigger className="h-11 w-[220px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las etapas (7)</SelectItem>
            {Object.entries(ETAPAS).map(([v, e]) => (
              <SelectItem key={v} value={v}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {perdidosSinRazon > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-ambar-borde bg-ambar-claro p-4 sm:flex-row sm:items-center">
          <MessageSquare className="size-4 shrink-0 text-ambar" />
          <p className="num flex-1 text-sm text-negro">
            {perdidosSinRazon} negocios cerrados sin razón registrada. Cuéntanos por qué no
            avanzaron.
          </p>
          <Button
            variant="outline"
            className="border-ambar bg-background text-negro"
            onClick={() => setEtapa("cierre_perdido")}
          >
            Ver cerrados
          </Button>
        </div>
      )}

      {lista.length === 0 ? (
        <EstadoVacio
          titulo="Sin negocios en esta vista"
          descripcion="Cuando tus referidos avancen, verás aquí su negocio y tu ganancia estimada."
        />
      ) : vista === "tabla" ? (
        <div className="card-sozu overflow-x-auto [scrollbar-width:auto]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  "Desarrollo · Unidad",
                  "Tipo",
                  "Referido",
                  "Etapa",
                  "Valor",
                  "Tu ganancia",
                  "",
                ].map((h) => (
                  <th key={h} className="eyebrow whitespace-nowrap px-4 py-3 text-gris">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((n) => {
                const dev = selectores.desarrolloPorId(n.desarrollo_id);
                const ref = nombreRef(n.referido_id);
                const etapaInfo = ETAPAS[n.etapa];
                return (
                  <tr key={n.id} className="border-b border-border align-top">
                    <td className="px-4 py-4">
                      <p className="font-bold text-negro">{dev?.nombre}</p>
                      <p className="num text-gris">{n.unidad_label}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-gris">
                        {n.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-negro">{modo ? "••••••" : ref?.nombre}</p>
                      <p className="max-w-[180px] truncate text-gris">
                        {modo ? "••••••" : ref?.correo}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          etapaInfo.clase,
                        )}
                      >
                        {etapaInfo.lock && <Lock className="size-3" />}
                        {etapaInfo.label}
                      </span>
                    </td>
                    <td className="num px-4 py-4 font-semibold text-negro">{mxn(n.valor)}</td>
                    <td className="num px-4 py-4">
                      <p className="font-bold text-verde">
                        {modo ? "••••••" : n.ganancia_estimada > 0 ? mxn(n.ganancia_estimada) : "—"}
                      </p>
                      {n.ganancia_estimada > 0 && (
                        <p className="text-xs text-gris">Cobro estimado {n.cobro_estimado}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Eye className="size-4 text-gris" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn("grid gap-4", vista === "grid" && "md:grid-cols-2 xl:grid-cols-3")}>
          {lista.map((n) => {
            const dev = selectores.desarrolloPorId(n.desarrollo_id);
            const ref = nombreRef(n.referido_id);
            const etapaInfo = ETAPAS[n.etapa];
            return (
              <div key={n.id} className="card-sozu p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-negro">{dev?.nombre}</p>
                    <p className="num text-sm text-gris">{n.unidad_label}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      etapaInfo.clase,
                    )}
                  >
                    {etapaInfo.lock && <Lock className="size-3" />}
                    {etapaInfo.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-negro">{modo ? "••••••" : ref?.nombre}</p>
                <p className="num mt-2 text-sm text-gris">Valor {mxn(n.valor)}</p>
                <p className="num text-sm font-bold text-verde">
                  {modo ? "••••••" : n.ganancia_estimada > 0 ? mxn(n.ganancia_estimada) : "—"}
                </p>
                {n.ganancia_estimada > 0 && (
                  <p className="num text-xs text-gris">Cobro estimado {n.cobro_estimado}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
