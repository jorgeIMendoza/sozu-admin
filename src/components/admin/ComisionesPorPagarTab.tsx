import { useState, useMemo, useEffect } from "react";
import { ENVIRONMENT } from "@/lib/config";
import { format, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Eye, FileText, Stamp, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { deriveEstatus, FILTRO_TODOS, type EstatusSeguimiento } from "@/utils/comisionesEstatus";

interface ComisionesPorPagarTabProps {
  comisionistasAgrupados: any[];
  cuentasAgrupadas: any[];
  loadingComisionistas: boolean;
  loadingCuentas: boolean;
  filtroGeneral: string;
  /** Filtros de la barra superior. `FILTRO_TODOS` = sin filtro. */
  filtroEstatus?: string;
  filtroProyecto?: string;
  filtroTipo?: string;
  formatCurrency: (value: number) => string;
  /** @deprecated Pagar Comisiones es ahora vista de seguimiento — la
   *  ejecución del pago vive en la Bandeja de Ejecución del Portal de
   *  Administración. Los props quedan por compatibilidad pero no se usan. */
  openPagarDialog?: (email: string, idCuenta: number) => void;
  /** @deprecated ver `openPagarDialog`. */
  openPagarTodasDialog?: (type: 'comisionista' | 'cuenta', data: any) => void;
}

function EstatusBadge({ estatus }: { estatus: EstatusSeguimiento }) {
  const Icon = estatus.icon;
  const cls =
    estatus.tone === "emerald"
      ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
      : estatus.tone === "amber"
        ? "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
        : estatus.tone === "red"
          ? "border-red-400 text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300"
          : estatus.tone === "blue"
            ? "border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300"
            : "border-muted-foreground/40 text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap gap-1", cls)}>
      <Icon className="h-3 w-3" />
      {estatus.label}
    </Badge>
  );
}

export default function ComisionesPorPagarTab({
  comisionistasAgrupados,
  cuentasAgrupadas,
  loadingComisionistas,
  loadingCuentas,
  filtroGeneral,
  filtroEstatus = FILTRO_TODOS,
  filtroProyecto = FILTRO_TODOS,
  filtroTipo = FILTRO_TODOS,
  formatCurrency,
}: ComisionesPorPagarTabProps) {
  // Permisos eliminados: el componente ya no ejecuta acciones de pago,
  // sólo muestra seguimiento.
  const { canUpdate, isSuperAdmin } = usePagePermissions('/admin/pagar-comisiones');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [currentPageComisionistas, setCurrentPageComisionistas] = useState(1);
  const [currentPageCuentas, setCurrentPageCuentas] = useState(1);
  const [timbrarDialog, setTimbrarDialog] = useState<{ idCuenta: number; idDocumento: number } | null>(null);
  const [isTimbrarLoading, setIsTimbrarLoading] = useState(false);
  const itemsPerPage = 50;

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleTimbrar = async () => {
    if (!timbrarDialog) return;
    setIsTimbrarLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('timbrar-factura-comision-sozu', {
        body: { id_cuenta_cobranza: timbrarDialog.idCuenta, id_documento: timbrarDialog.idDocumento, environment: ENVIRONMENT },
      });
      if (error) throw error;
      toast({ title: 'Factura timbrada', description: 'La factura de comisión ha sido timbrada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['pagar-comisiones'] });
    } catch (err) {
      console.error('Error timbrando factura:', err);
      toast({ title: 'Error', description: 'No se pudo timbrar la factura', variant: 'destructive' });
    } finally {
      setIsTimbrarLoading(false);
      setTimbrarDialog(null);
    }
  };

  const renderFacturaComisionSozu = (facturaComisionSozu: any, idCuenta: number) => {
    if (!facturaComisionSozu) return <span className="text-xs text-muted-foreground">-</span>;
    if (facturaComisionSozu.es_draft) {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Draft</Badge>
          {(canUpdate || isSuperAdmin) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                setTimbrarDialog({ idCuenta, idDocumento: facturaComisionSozu.id });
              }}
            >
              <Stamp className="h-3.5 w-3.5 mr-1" />
              Timbrar
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Timbrada</Badge>
        {facturaComisionSozu.url && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); window.open(facturaComisionSozu.url, '_blank'); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };
  // La vista ahora es de SEGUIMIENTO: muestra todas las comisiones pendientes
  // (no sólo las "listas para pagar"), incluyendo las que están en validación
  // por Alta Dirección, para que el equipo de Admin Panel pueda ver el cambio
  // de estatus. La ejecución del pago vive en la Bandeja de Ejecución del
  // Portal de Administración — aquí se eliminó el filtro previo de fecha de
  // enganche y los CTAs de acción.
  // Predicado de proyecto/tipo a nivel de cuenta (compartido por ambas vistas).
  const matchProyectoTipo = (c: any) =>
    (filtroProyecto === FILTRO_TODOS || c.proyecto === filtroProyecto) &&
    (filtroTipo === FILTRO_TODOS || c.tipo === filtroTipo);

  const comisionistasPendientes = useMemo(() => {
    return comisionistasAgrupados?.map((com: any) => {
      // Sólo cuentas pendientes que además pasen los filtros de estatus,
      // proyecto y tipo. El estatus se deriva por cuenta (usando el esExterno
      // del comisionista) para coincidir con el badge mostrado.
      const cuentasPendientes = com.cuentas.filter((c: any) =>
        !c.pagada &&
        matchProyectoTipo(c) &&
        (filtroEstatus === FILTRO_TODOS ||
          deriveEstatus({ ...c, esExterno: com.esExterno }).label === filtroEstatus)
      );
      const cuentasPagadas = com.cuentas.filter((c: any) => c.pagada);
      const montoTotal = com.cuentas.reduce((sum: number, c: any) => sum + c.montoComision, 0);
      const montoPendiente = cuentasPendientes.reduce((sum: number, c: any) => sum + c.montoComision, 0);
      const montoPagado = cuentasPagadas.reduce((sum: number, c: any) => sum + c.montoComision, 0);
      return {
        ...com,
        cuentas: cuentasPendientes,
        montoTotal,
        montoPendiente,
        montoPagado,
      };
    }).filter((com: any) => com.cuentas.length > 0) || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comisionistasAgrupados, filtroEstatus, filtroProyecto, filtroTipo]);

  const cuentasPendientes = useMemo(() => {
    return cuentasAgrupadas
      ?.filter((cuenta: any) => matchProyectoTipo(cuenta))
      .map((cuenta: any) => {
        const comisionistasPendientes = cuenta.comisionistas.filter((c: any) =>
          !c.pagada &&
          (filtroEstatus === FILTRO_TODOS || deriveEstatus(c).label === filtroEstatus)
        );
        const comisionistasPagados = cuenta.comisionistas.filter((c: any) => c.pagada);
        const montoTotal = cuenta.comisionistas.reduce((sum: number, c: any) => sum + c.montoComision, 0);
        const montoPendiente = comisionistasPendientes.reduce((sum: number, c: any) => sum + c.montoComision, 0);
        const montoPagado = comisionistasPagados.reduce((sum: number, c: any) => sum + c.montoComision, 0);
        return {
          ...cuenta,
          comisionistas: comisionistasPendientes,
          montoTotal,
          montoTotalComision: montoPendiente,
          montoPendiente,
          montoPagado,
        };
      }).filter((cuenta: any) => cuenta.comisionistas.length > 0) || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentasAgrupadas, filtroEstatus, filtroProyecto, filtroTipo]);

  // Al cambiar cualquier filtro, volver a la primera página para no quedar en
  // una página vacía tras reducir los resultados.
  useEffect(() => {
    setCurrentPageComisionistas(1);
    setCurrentPageCuentas(1);
  }, [filtroGeneral, filtroEstatus, filtroProyecto, filtroTipo]);

  const comisionistasFiltrados = comisionistasPendientes.filter((com: any) =>
    com.email.toLowerCase().includes(filtroGeneral.toLowerCase()) ||
    com.nombre.toLowerCase().includes(filtroGeneral.toLowerCase())
  );

  const cuentasFiltradas = cuentasPendientes.filter((cuenta: any) =>
    cuenta.numeroCuenta.toLowerCase().includes(filtroGeneral.toLowerCase()) ||
    cuenta.proyecto.toLowerCase().includes(filtroGeneral.toLowerCase())
  );

  const totalPagesComisionistas = Math.ceil(comisionistasFiltrados.length / itemsPerPage);
  const totalPagesCuentas = Math.ceil(cuentasFiltradas.length / itemsPerPage);

  const paginatedComisionistas = useMemo(() => {
    const startIndex = (currentPageComisionistas - 1) * itemsPerPage;
    return comisionistasFiltrados.slice(startIndex, startIndex + itemsPerPage);
  }, [comisionistasFiltrados, currentPageComisionistas, itemsPerPage]);

  const paginatedCuentas = useMemo(() => {
    const startIndex = (currentPageCuentas - 1) * itemsPerPage;
    return cuentasFiltradas.slice(startIndex, startIndex + itemsPerPage);
  }, [cuentasFiltradas, currentPageCuentas, itemsPerPage]);

  const renderPaginationItems = (
    totalPages: number,
    currentPage: number,
    setCurrentPage: (page: number) => void
  ) => {
    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationEllipsis key="ellipsis-start" />);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            isActive={currentPage === i}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationEllipsis key="ellipsis-end" />);
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <><Tabs defaultValue="por-comisionista" className="space-y-4">
      <TabsList>
        <TabsTrigger value="por-comisionista">Agrupada por Comisionista</TabsTrigger>
        <TabsTrigger value="por-cuenta">Agrupada por Cuenta de Cobranza</TabsTrigger>
      </TabsList>

      <TabsContent value="por-comisionista" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Comisiones Pendientes por Comisionista</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingComisionistas ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : comisionistasFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay comisiones pendientes por pagar
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto por Pagar</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Monto Pendiente</TableHead>
                    <TableHead>Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedComisionistas.map((com: any) => {
                    // Estatus consolidado del comisionista: si todas sus
                    // cuentas pendientes están en el mismo estado AD, usamos
                    // ese; si hay mezcla, mostramos "Mixto" — el detalle por
                    // cuenta sigue siendo accesible expandiendo la fila.
                    const estatusList = com.cuentas.map((c: any) =>
                      deriveEstatus({ ...c, esExterno: com.esExterno }).label,
                    );
                    const allEqual = estatusList.length > 0 && estatusList.every((s: string) => s === estatusList[0]);
                    const estatusGrupo = allEqual
                      ? deriveEstatus({ ...com.cuentas[0], esExterno: com.esExterno })
                      : { label: `Mixto (${new Set(estatusList).size})`, tone: "gray" as const, icon: Info };
                    return (
                    <>
                      <TableRow
                        key={com.email}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleItem(com.email)}
                      >
                        <TableCell>
                          {expandedItems.has(com.email) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {com.nombre}
                            {com.esInmobiliaria && (
                              <Badge variant="secondary" className="text-xs">Inmobiliaria</Badge>
                            )}
                            {com.esExterno && !com.esInmobiliaria && (
                              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400">Externo</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{com.email}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(com.montoTotal)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(com.montoPagado)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600">
                          {formatCurrency(com.montoPendiente)}
                        </TableCell>
                        <TableCell>
                          <EstatusBadge estatus={estatusGrupo} />
                        </TableCell>
                      </TableRow>
                      {expandedItems.has(com.email) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Cuenta</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Proyecto</TableHead>
                                    <TableHead>Edificio</TableHead>
                                    <TableHead>Modelo</TableHead>
                                    <TableHead>Depto</TableHead>
                                    <TableHead>Fecha Pago Enganche</TableHead>
                                    <TableHead className="text-right">Precio Final</TableHead>
                                    <TableHead className="text-right">Comisión</TableHead>
                                    {com.esExterno && <TableHead>Factura</TableHead>}
                                    <TableHead>Fact. Comisión Sozu</TableHead>
                                    <TableHead>Estatus</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {com.cuentas.map((cuenta: any) => {
                                    const estatusCuenta = deriveEstatus({ ...cuenta, esExterno: com.esExterno });
                                    return (
                                    <TableRow key={cuenta.idCuenta}>
                                      <TableCell>{cuenta.numeroCuenta}</TableCell>
                                      <TableCell>{cuenta.tipo}</TableCell>
                                      <TableCell>{cuenta.proyecto}</TableCell>
                                      <TableCell>{cuenta.edificio}</TableCell>
                                      <TableCell>{cuenta.modelo}</TableCell>
                                      <TableCell>{cuenta.numeroDepartamento}</TableCell>
                                      <TableCell>
                                        {cuenta.fechaPagoEnganche
                                          ? format(parseISO(cuenta.fechaPagoEnganche), 'dd/MM/yyyy')
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(cuenta.precioFinal)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(cuenta.montoComision)}
                                        <span className="text-muted-foreground text-xs ml-1">
                                          ({Number(cuenta.porcentajeComision).toFixed(4)}%)
                                        </span>
                                      </TableCell>
                                      {com.esExterno && (
                                        <TableCell>
                                          {cuenta.urlFacturaExterna ? (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => window.open(cuenta.urlFacturaExterna, '_blank')}
                                            >
                                              <FileText className="h-4 w-4 mr-1" />
                                              Ver Factura
                                            </Button>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">Sin factura</span>
                                          )}
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        {renderFacturaComisionSozu(cuenta.facturaComisionSozu, cuenta.idCuenta)}
                                      </TableCell>
                                      <TableCell>
                                        <EstatusBadge estatus={estatusCuenta} />
                                      </TableCell>
                                    </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {totalPagesComisionistas > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPageComisionistas - 1) * itemsPerPage) + 1} - {Math.min(currentPageComisionistas * itemsPerPage, comisionistasFiltrados.length)} de {comisionistasFiltrados.length} comisionistas
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPageComisionistas(Math.max(1, currentPageComisionistas - 1))}
                        className={currentPageComisionistas === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {renderPaginationItems(totalPagesComisionistas, currentPageComisionistas, setCurrentPageComisionistas)}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPageComisionistas(Math.min(totalPagesComisionistas, currentPageComisionistas + 1))}
                        className={currentPageComisionistas === totalPagesComisionistas ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="por-cuenta" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Comisiones Pendientes por Cuenta de Cobranza</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCuentas ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : cuentasFiltradas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay comisiones pendientes por pagar
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Edificio</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Depto</TableHead>
                    <TableHead className="text-right">Precio Final</TableHead>
                    <TableHead className="text-right">Monto por Pagar</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Monto Pendiente</TableHead>
                    <TableHead>Fact. Comisión Sozu</TableHead>
                    <TableHead>Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCuentas.map((cuenta: any) => {
                    // Estatus consolidado de la cuenta: mismo enfoque que
                    // en la pestaña por comisionista — si todos los
                    // comisionistas pendientes tienen el mismo estatus, lo
                    // usamos; si hay mezcla, mostramos "Mixto".
                    const labels = cuenta.comisionistas.map((c: any) =>
                      deriveEstatus(c).label,
                    );
                    const allSame = labels.length > 0 && labels.every((l: string) => l === labels[0]);
                    const estatusGrupo = allSame
                      ? deriveEstatus(cuenta.comisionistas[0])
                      : { label: `Mixto (${new Set(labels).size})`, tone: "gray" as const, icon: Info };
                    return (
                    <>
                      <TableRow
                        key={cuenta.idCuenta}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleItem(`cuenta-${cuenta.idCuenta}`)}
                      >
                        <TableCell>
                          {expandedItems.has(`cuenta-${cuenta.idCuenta}`) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{cuenta.numeroCuenta}</TableCell>
                        <TableCell>{cuenta.tipo}</TableCell>
                        <TableCell>{cuenta.proyecto}</TableCell>
                        <TableCell>{cuenta.edificio}</TableCell>
                        <TableCell>{cuenta.modelo}</TableCell>
                        <TableCell>{cuenta.numeroDepartamento}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cuenta.precioFinal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cuenta.montoTotal)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(cuenta.montoPagado)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600">
                          {formatCurrency(cuenta.montoPendiente)}
                        </TableCell>
                        <TableCell>
                          {renderFacturaComisionSozu(cuenta.facturaComisionSozu, cuenta.idCuenta)}
                        </TableCell>
                        <TableCell>
                          <EstatusBadge estatus={estatusGrupo} />
                        </TableCell>
                      </TableRow>
                      {expandedItems.has(`cuenta-${cuenta.idCuenta}`) && (
                        <TableRow>
                          <TableCell colSpan={13} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Porcentaje</TableHead>
                                    <TableHead className="text-right">Monto Comisión</TableHead>
                                    <TableHead>Factura</TableHead>
                                    <TableHead>Estatus</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cuenta.comisionistas.map((comisionista: any) => {
                                    const estatusCom = deriveEstatus(comisionista);
                                    return (
                                    <TableRow key={comisionista.email}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {comisionista.nombre}
                                          {comisionista.esInmobiliaria && (
                                            <Badge variant="secondary" className="text-xs">Inmobiliaria</Badge>
                                          )}
                                          {comisionista.esExterno && !comisionista.esInmobiliaria && (
                                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400">Externo</Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>{comisionista.email}</TableCell>
                                      <TableCell className="text-right">{Number(comisionista.porcentajeComision).toFixed(4)}%</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(comisionista.montoComision)}
                                      </TableCell>
                                      <TableCell>
                                        {comisionista.esExterno && comisionista.urlFacturaExterna ? (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => window.open(comisionista.urlFacturaExterna, '_blank')}
                                          >
                                            <FileText className="h-4 w-4 mr-1" />
                                            Ver
                                          </Button>
                                        ) : comisionista.esExterno ? (
                                          <span className="text-muted-foreground text-xs">Sin factura</span>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <EstatusBadge estatus={estatusCom} />
                                      </TableCell>
                                    </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {totalPagesCuentas > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPageCuentas - 1) * itemsPerPage) + 1} - {Math.min(currentPageCuentas * itemsPerPage, cuentasFiltradas.length)} de {cuentasFiltradas.length} cuentas
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPageCuentas(Math.max(1, currentPageCuentas - 1))}
                        className={currentPageCuentas === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {renderPaginationItems(totalPagesCuentas, currentPageCuentas, setCurrentPageCuentas)}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPageCuentas(Math.min(totalPagesCuentas, currentPageCuentas + 1))}
                        className={currentPageCuentas === totalPagesCuentas ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Timbrar Confirmation Dialog */}
    <Dialog open={!!timbrarDialog} onOpenChange={() => setTimbrarDialog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Timbrado</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ¿Está seguro de que desea timbrar esta factura de comisión? Esta acción generará una factura definitiva y no se puede deshacer.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTimbrarDialog(null)}>Cancelar</Button>
          <Button onClick={handleTimbrar} disabled={isTimbrarLoading}>
            {isTimbrarLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Timbrando...</> : <><Stamp className="h-4 w-4 mr-1" />Timbrar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
