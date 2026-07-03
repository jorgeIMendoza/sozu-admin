import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Store, Building2, Warehouse, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/admin/StatCard";
import { supabase } from "@/integrations/supabase/client";

type TipoTab = "todos" | "11" | "12" | "13" | "14";
type EstadoFiltro = "activos" | "inactivos" | "todos";

const TABS: { value: TipoTab; label: string; icon: typeof Store }[] = [
  { value: "todos", label: "Todos", icon: Store },
  { value: "11", label: "Locales comerciales", icon: Store },
  { value: "12", label: "Oficinas", icon: Building2 },
  { value: "13", label: "Bodegas comerciales", icon: Warehouse },
  { value: "14", label: "Terrenos", icon: MapPin },
];

const formatMoney = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(n));

export default function ActivosComerciales() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TipoTab>("todos");
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("activos");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activos-comerciales", tab, estado],
    queryFn: async () => {
      let q = supabase
        .from("propiedades")
        .select(`
          id, numero_propiedad, id_tipo_propiedad, m2_interiores, m2_exteriores,
          precio_lista, id_estatus_disponibilidad, activo, es_aprobado,
          tipos_propiedad:id_tipo_propiedad ( nombre ),
          estatus_disponibilidad:id_estatus_disponibilidad ( nombre ),
          propiedades_activo_comercial ( codigo_interno, ubicacion_ciudad, ubicacion_direccion )
        `)
        .gt("id_tipo_propiedad", 10)
        .order("id", { ascending: false })
        .limit(500);

      if (tab !== "todos") q = q.eq("id_tipo_propiedad", Number(tab));
      if (estado === "activos") q = q.eq("activo", true);
      else if (estado === "inactivos") q = q.eq("activo", false);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) => {
      const ac = r.propiedades_activo_comercial ?? {};
      return (
        String(r.numero_propiedad ?? "").toLowerCase().includes(s) ||
        String(r.id).includes(s) ||
        String(ac.codigo_interno ?? "").toLowerCase().includes(s) ||
        String(ac.ubicacion_ciudad ?? "").toLowerCase().includes(s) ||
        String(ac.ubicacion_direccion ?? "").toLowerCase().includes(s) ||
        String(r.tipos_propiedad?.nombre ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const disponibles = rows.filter((r: any) => r.id_estatus_disponibilidad === 2).length;
    const vendidas = rows.filter((r: any) => [5, 7, 8, 9].includes(r.id_estatus_disponibilidad)).length;
    const valor = rows.reduce((a: number, r: any) => a + Number(r.precio_lista || 0), 0);
    return { total, disponibles, vendidas, valor };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Activos Comerciales</h1>
          <p className="text-sm text-muted-foreground">
            Locales, oficinas, bodegas comerciales y terrenos.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/activos-comerciales/nuevo")}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo activo
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total activos" value={kpis.total} icon={Store} />
        <StatCard title="Disponibles" value={kpis.disponibles} icon={Building2} iconColor="text-green-600" />
        <StatCard title="Vendidas / En proceso" value={kpis.vendidas} icon={Warehouse} iconColor="text-blue-600" />
        <StatCard title="Valor de lista" value={formatMoney(kpis.valor)} icon={MapPin} iconColor="text-amber-600" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TipoTab)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, número, ciudad o dirección…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="inactivos">Inactivos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando activos…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No hay activos comerciales registrados.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-right">m² interior</TableHead>
                    <TableHead className="text-right">m² exterior</TableHead>
                    <TableHead className="text-right">Precio de lista</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Aprobación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${r.activo ? "" : "opacity-60"}`}
                      onClick={() => navigate(`/admin/activos-comerciales/${r.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>{r.numero_propiedad ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.propiedades_activo_comercial?.codigo_interno ?? "-"}</TableCell>
                      <TableCell>{r.tipos_propiedad?.nombre ?? "-"}</TableCell>
                      <TableCell>{r.propiedades_activo_comercial?.ubicacion_ciudad ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.m2_interiores ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.m2_exteriores ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.precio_lista)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.estatus_disponibilidad?.nombre ?? "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.activo ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.es_aprobado ? (
                          <Badge className="bg-green-600 hover:bg-green-600">Aprobado</Badge>
                        ) : (
                          <Badge variant="outline">Borrador</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}