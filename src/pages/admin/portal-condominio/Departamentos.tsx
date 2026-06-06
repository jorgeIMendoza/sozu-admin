import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Eye, MoreHorizontal, FileText, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Departamentos() {
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const unidades = data?.unidades ?? [];

  const filtered = useMemo(
    () =>
      unidades.filter((u) => {
        const q = search.toLowerCase();
        const ms =
          !search ||
          u.numero.toLowerCase().includes(q) ||
          u.folio_mant.toLowerCase().includes(q) ||
          u.propietario.toLowerCase().includes(q) ||
          u.residente.toLowerCase().includes(q) ||
          u.clabe.toLowerCase().includes(q);
        const mo = !overdueOnly || u.saldo_balance > 0;
        return ms && mo;
      }),
    [unidades, search, overdueOnly],
  );

  // Stubs visuales para los CTAs de acción — se conectarán a edge functions
  // (descarga de estado de cuenta) y a un diálogo (asignar residente) más
  // adelante. Hoy registran intención vía toast.
  const handleDescargarEstadoCuenta = (folio: string) => {
    toast({
      title: "Estado de cuenta",
      description: `Solicitud de generación enviada para ${folio}. (Stub: pendiente de conectar Edge Function generar-estado-cuenta.)`,
    });
  };
  const handleAsignarResidente = (folio: string) => {
    toast({
      title: "Asignar residente",
      description: `Diálogo de asignación de residente pendiente — ${folio}.`,
    });
  };

  return (
    <div>
      <PageHeader
        title="Departamentos"
        subtitle={`${filtered.length} de ${unidades.length} unidades`}
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por propiedad, folio, propietario, residente o CLABE…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground px-3">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />{" "}
          Solo con saldo pendiente
        </label>
      </div>

      {isLoading || error ? (
        <EstadoVista isLoading={isLoading} error={error} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">Propiedad</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">ID Cuenta Mant.</th>
                <th className="px-3 py-2 text-left">Propietarios</th>
                <th className="px-3 py-2 text-left">Residente</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">CLABE STP</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Pago acumulado</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Total Pagado</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Saldo</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Próx. pago</th>
                <th className="px-3 py-2 text-left">Complementos</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 100).map((u) => {
                const balance = u.saldo_balance;
                const balanceLabel =
                  balance > 0
                    ? `Pendiente · ${formatMXN(balance)}`
                    : balance < 0
                      ? `A favor · ${formatMXN(Math.abs(balance))}`
                      : "—";
                const balanceCls =
                  balance > 0
                    ? "text-destructive font-medium"
                    : balance < 0
                      ? "text-emerald-700 dark:text-emerald-300 font-medium"
                      : "text-muted-foreground";
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      #{u.numero}
                      <p className="text-[11px] text-muted-foreground font-normal">{u.tipo}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{u.folio_mant}</td>
                    <td className="px-3 py-2">
                      <p className="truncate max-w-[200px]">{u.propietario}</p>
                    </td>
                    <td className="px-3 py-2">
                      {u.residente === "—" ? (
                        <span className="text-muted-foreground/60 text-xs">Sin asignar</span>
                      ) : (
                        <p className="truncate max-w-[200px]">{u.residente}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {u.clabe || <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatMXN(u.pago_acumulado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMXN(u.total_pagado)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", balanceCls)}>{balanceLabel}</td>
                    <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                      {u.proxima_fecha_pago || <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {u.complementos.length === 0 ? (
                        <span className="text-muted-foreground/60 text-xs">—</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px]" title={u.complementos.join(", ")}>
                          {u.complementos.length} {u.complementos.length === 1 ? "complemento" : "complementos"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-[11px]"
                          onClick={() =>
                            navigate(`/admin/portal-condominio/departamentos/${u.numero}`)
                          }
                          aria-label={`Ver detalle ${u.numero}`}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalle
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="Más acciones"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-[12px]">
                            <DropdownMenuItem onClick={() => handleDescargarEstadoCuenta(u.folio_mant)}>
                              <FileText className="h-3.5 w-3.5 mr-2" />
                              Descargar Estado de Cuenta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleAsignarResidente(u.folio_mant)}>
                              <UserPlus className="h-3.5 w-3.5 mr-2" />
                              Asignar residente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    Sin unidades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
              Mostrando primeras 100 de {filtered.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
