import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, UserPlus, DollarSign, TrendingUp, Copy, CheckCircle2, Share2, Link as LinkIcon,
} from "lucide-react";
import {
  MOCK_EMBAJADORES, MOCK_REFERRALS, KPIS_GLOBALES,
} from "@/data/embajadores/mockData";
import {
  COMMISSION_STATUS_LABEL, mapStatusForEmbajador,
} from "@/types/embajadores";
import { toast } from "sonner";

const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);

// "Embajador activo" simulado
const SELF = MOCK_EMBAJADORES[0];
const myReferrals = MOCK_REFERRALS.filter((r) => r.embajadorId === SELF.id);

function KpiCard({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
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

// ========= Inicio =========
export function EmbajadorInicio() {
  const totalCom = myReferrals.reduce((s, r) => s + r.commissionAmount, 0);
  const pagada = myReferrals.filter(r => r.commissionStatus === "pagada").reduce((s,r)=>s+r.commissionAmount,0);

  const copyLink = () => {
    navigator.clipboard.writeText(SELF.referralLink);
    toast.success("Enlace de referido copiado");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Bienvenido</div>
            <h1 className="text-2xl font-bold">{SELF.fullName}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              Código: <span className="font-mono">{SELF.code}</span> · Comisión {SELF.commissionPct}%
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/admin/portal-embajador/registrar-referido">
                <UserPlus className="h-4 w-4 mr-2" /> Registrar referido
              </Link>
            </Button>
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" /> Copiar enlace
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Mis Referidos"      value={String(myReferrals.length)} icon={Users} />
        <KpiCard label="En Seguimiento"     value={String(myReferrals.filter(r => !["venta_cerrada","comision_generada","comision_pagada","descartado","duplicado"].includes(r.status)).length)} icon={TrendingUp} />
        <KpiCard label="Comisión Total"     value={fmtMxn(totalCom)} icon={DollarSign} />
        <KpiCard label="Comisión Pagada"    value={fmtMxn(pagada)}   icon={CheckCircle2} hint="YTD" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Mi enlace de referido</CardTitle>
          <CardDescription>Comparte este enlace; cualquier registro queda protegido por 60 días.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={SELF.referralLink} className="font-mono text-sm" />
            <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline"><Share2 className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimos referidos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Asesor</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myReferrals.slice(0, 5).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.clientName}</TableCell>
                  <TableCell><Badge variant="secondary">{mapStatusForEmbajador(r.status)}</Badge></TableCell>
                  <TableCell>{r.assignedAdvisorName ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtMxn(r.commissionAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ========= Mis Referidos =========
export function EmbajadorMisReferidos() {
  const [q, setQ] = useState("");
  const list = myReferrals.filter(r => r.clientName.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Mis Referidos</h1>
        <p className="text-muted-foreground text-sm">Seguimiento del pipeline de tus referidos.</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Interés</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Asesor</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.clientName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone}<br/>{r.email}</TableCell>
                  <TableCell className="capitalize">{r.interestType}</TableCell>
                  <TableCell className="text-sm">{r.productInterest ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{mapStatusForEmbajador(r.status)}</Badge></TableCell>
                  <TableCell>{r.assignedAdvisorName ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtMxn(r.commissionAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ========= Registrar Referido =========
export function EmbajadorRegistrarReferido() {
  const [form, setForm] = useState({
    clientName: "", phone: "", email: "", interestType: "vivir",
    productInterest: "", comments: "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Referido registrado. Pronto un asesor lo contactará.");
    setForm({ clientName: "", phone: "", email: "", interestType: "vivir", productInterest: "", comments: "" });
  };
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Registrar Referido</h1>
        <p className="text-muted-foreground text-sm">El sistema validará duplicados automáticamente.</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre completo *</Label>
                <Input required value={form.clientName} onChange={(e)=>setForm(f=>({...f, clientName:e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono *</Label>
                <Input required value={form.phone} onChange={(e)=>setForm(f=>({...f, phone:e.target.value}))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" required value={form.email} onChange={(e)=>setForm(f=>({...f, email:e.target.value}))} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo de interés</Label>
                <Select value={form.interestType} onValueChange={(v)=>setForm(f=>({...f, interestType:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vivir">Para vivir</SelectItem>
                    <SelectItem value="inversion">Inversión</SelectItem>
                    <SelectItem value="patrimonial">Patrimonial</SelectItem>
                    <SelectItem value="indefinido">Indefinido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Producto de interés</Label>
                <Input value={form.productInterest} onChange={(e)=>setForm(f=>({...f, productInterest:e.target.value}))} placeholder="Depto 2 rec — Polanco" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comentarios</Label>
              <Textarea rows={3} value={form.comments} onChange={(e)=>setForm(f=>({...f, comments:e.target.value}))} />
            </div>
            <div className="flex justify-end">
              <Button type="submit"><UserPlus className="h-4 w-4 mr-2" /> Registrar referido</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ========= Comisiones =========
export function EmbajadorComisiones() {
  const total     = myReferrals.reduce((s,r)=>s+r.commissionAmount,0);
  const pagada    = myReferrals.filter(r=>r.commissionStatus==="pagada").reduce((s,r)=>s+r.commissionAmount,0);
  const autorizada= myReferrals.filter(r=>r.commissionStatus==="autorizada").reduce((s,r)=>s+r.commissionAmount,0);
  const potencial = myReferrals.filter(r=>r.commissionStatus==="potencial").reduce((s,r)=>s+r.commissionAmount,0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Comisiones</h1>
        <p className="text-muted-foreground text-sm">Estado financiero de tus referidos.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total"      value={fmtMxn(total)}      icon={DollarSign} />
        <KpiCard label="Potencial"  value={fmtMxn(potencial)}  icon={TrendingUp} />
        <KpiCard label="Autorizada" value={fmtMxn(autorizada)} icon={CheckCircle2} />
        <KpiCard label="Pagada"     value={fmtMxn(pagada)}     icon={CheckCircle2} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referido</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myReferrals.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.clientName}</TableCell>
                  <TableCell><Badge variant="secondary">{COMMISSION_STATUS_LABEL[r.commissionStatus]}</Badge></TableCell>
                  <TableCell>{r.saleAmount ? fmtMxn(r.saleAmount) : "—"}</TableCell>
                  <TableCell>{r.paymentDate ? new Date(r.paymentDate).toLocaleDateString("es-MX") : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMxn(r.commissionAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ========= Perfil =========
export function EmbajadorPerfil() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm">Información de tu programa de embajador.</p>
      </div>
      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos personales</TabsTrigger>
          <TabsTrigger value="programa">Programa</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="datos">
          <Card><CardContent className="p-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Nombre completo</Label><Input defaultValue={SELF.fullName} /></div>
            <div className="space-y-1"><Label>Empresa</Label><Input defaultValue={SELF.company ?? ""} /></div>
            <div className="space-y-1"><Label>Teléfono</Label><Input defaultValue={SELF.phone} /></div>
            <div className="space-y-1"><Label>Email</Label><Input defaultValue={SELF.email} /></div>
            <div className="sm:col-span-2 flex justify-end"><Button>Guardar cambios</Button></div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="programa">
          <Card><CardContent className="p-6 space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Código</span><span className="font-mono">{SELF.code}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><Badge>{SELF.type}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Comisión</span><span className="font-medium">{SELF.commissionPct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Activación de comisión</span><span className="capitalize">{SELF.commissionTrigger}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary">{SELF.status}</Badge></div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="docs">
          <Card><CardContent className="p-6 space-y-3 text-sm">
            {["Convenio firmado", "Identificación oficial", "Constancia fiscal", "Datos bancarios"].map(d => (
              <div key={d} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span>{d}</span>
                <Badge variant="outline">Pendiente</Badge>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}