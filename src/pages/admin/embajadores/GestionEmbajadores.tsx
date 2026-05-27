import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Users, UserPlus, TrendingUp, DollarSign, CheckCircle2, FileDown, Search,
} from "lucide-react";
import { MOCK_EMBAJADORES, MOCK_REFERRALS, KPIS_GLOBALES } from "@/data/embajadores/mockData";
import {
  EMBAJADOR_TYPE_LABEL, REFERRAL_STATUS_LABEL, COMMISSION_STATUS_LABEL,
} from "@/types/embajadores";
import { toast } from "sonner";

const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function GestionEmbajadores() {
  const [q, setQ] = useState("");
  const embajadores = MOCK_EMBAJADORES.filter(e =>
    e.fullName.toLowerCase().includes(q.toLowerCase()) || e.code.toLowerCase().includes(q.toLowerCase())
  );
  const referidos = MOCK_REFERRALS;

  const ranking = MOCK_EMBAJADORES.map(e => {
    const refs = MOCK_REFERRALS.filter(r => r.embajadorId === e.id);
    const ventas = refs.filter(r => r.saleAmount).reduce((s,r)=>s+(r.saleAmount ?? 0),0);
    const comGen = refs.filter(r => ["generada","autorizada","pagada"].includes(r.commissionStatus)).reduce((s,r)=>s+r.commissionAmount,0);
    const comPag = refs.filter(r => r.commissionStatus === "pagada").reduce((s,r)=>s+r.commissionAmount,0);
    const cerrados = refs.filter(r => ["venta_cerrada","comision_generada","comision_pagada"].includes(r.status)).length;
    return { e, total: refs.length, cerrados, ventas, comGen, comPag, conv: refs.length ? Math.round(cerrados*100/refs.length) : 0 };
  }).sort((a,b) => b.comGen - a.comGen);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administración de Embajadores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra el programa de referidos premium. Los embajadores únicamente refieren clientes, no participan en la venta.
          </p>
        </div>
        <Button><UserPlus className="h-4 w-4 mr-2" /> Nuevo embajador</Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="embajadores">Embajadores</TabsTrigger>
          <TabsTrigger value="referidos">Referidos</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Embajadores activos" value={String(KPIS_GLOBALES.embajadoresActivos)} icon={Users} />
            <Kpi label="Referidos totales"   value={String(KPIS_GLOBALES.referidosTotales)}   icon={UserPlus} />
            <Kpi label="Referidos cerrados"  value={String(KPIS_GLOBALES.referidosCerrados)}  icon={CheckCircle2} hint={`${Math.round(KPIS_GLOBALES.referidosCerrados*100/Math.max(1,KPIS_GLOBALES.referidosTotales))}% conversión`} />
            <Kpi label="Comisión pagada YTD" value={fmtMxn(KPIS_GLOBALES.comisionPagada)}     icon={DollarSign} />
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Ranking de embajadores</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Embajador</TableHead>
                    <TableHead className="text-right">Referidos</TableHead>
                    <TableHead className="text-right">Cerrados</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Com. generada</TableHead>
                    <TableHead className="text-right">Com. pagada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.e.id}>
                      <TableCell className="font-mono text-xs">#{i+1}</TableCell>
                      <TableCell className="font-medium">{r.e.fullName}<div className="text-xs text-muted-foreground font-mono">{r.e.code}</div></TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.cerrados}</TableCell>
                      <TableCell className="text-right">{r.conv}%</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.ventas)}</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.comGen)}</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.comPag)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMBAJADORES */}
        <TabsContent value="embajadores" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Activación</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embajadores.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.code}</TableCell>
                      <TableCell className="font-medium">{e.fullName}<div className="text-xs text-muted-foreground">{e.company ?? ""}</div></TableCell>
                      <TableCell>{EMBAJADOR_TYPE_LABEL[e.type]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.phone}<br/>{e.email}</TableCell>
                      <TableCell>{e.commissionPct}%</TableCell>
                      <TableCell className="capitalize">{e.commissionTrigger}</TableCell>
                      <TableCell><Badge variant={e.status === "activo" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost">Ver</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REFERIDOS */}
        <TabsContent value="referidos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Embajador</TableHead>
                    <TableHead>Interés</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referidos.map(r => {
                    const e = MOCK_EMBAJADORES.find(x => x.id === r.embajadorId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.clientName}<div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                        <TableCell>{e?.fullName ?? r.embajadorId}</TableCell>
                        <TableCell className="capitalize">{r.interestType}</TableCell>
                        <TableCell><Badge variant="secondary">{REFERRAL_STATUS_LABEL[r.status]}</Badge></TableCell>
                        <TableCell>{r.assignedAdvisorName ?? "—"}</TableCell>
                        <TableCell className="text-sm">{new Date(r.registeredAt).toLocaleDateString("es-MX")}</TableCell>
                        <TableCell className="text-right">{r.saleAmount ? fmtMxn(r.saleAmount) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMISIONES */}
        <TabsContent value="comisiones">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referido</TableHead>
                    <TableHead>Embajador</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referidos.filter(r => r.commissionAmount > 0).map(r => {
                    const e = MOCK_EMBAJADORES.find(x => x.id === r.embajadorId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.clientName}</TableCell>
                        <TableCell>{e?.fullName ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{COMMISSION_STATUS_LABEL[r.commissionStatus]}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmtMxn(r.commissionAmount)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {r.commissionStatus === "generada" && <Button size="sm" onClick={() => toast.success("Comisión autorizada")}>Autorizar</Button>}
                          {r.commissionStatus === "autorizada" && <Button size="sm" variant="outline" onClick={() => toast.success("Marcada como pagada")}>Marcar pagada</Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTES */}
        <TabsContent value="reportes" className="space-y-4">
          <div className="flex justify-end"><Button variant="outline" onClick={() => toast.success("CSV generado")}><FileDown className="h-4 w-4 mr-2" /> Exportar CSV</Button></div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Embajador</TableHead>
                    <TableHead className="text-right">Referidos</TableHead>
                    <TableHead className="text-right">Cerrados</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Com. generada</TableHead>
                    <TableHead className="text-right">Com. pagada</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map(r => (
                    <TableRow key={r.e.id}>
                      <TableCell className="font-medium">{r.e.fullName}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.cerrados}</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.ventas)}</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.comGen)}</TableCell>
                      <TableCell className="text-right">{fmtMxn(r.comPag)}</TableCell>
                      <TableCell className="text-right">{r.conv}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}