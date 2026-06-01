import { useEffect, useMemo, useState } from 'react';
import { useAmbassadors } from '@/store/AmbassadorsContext';
import {
  COMMISSION_STATUS_HELP,
  COMMISSION_STATUS_LABEL,
  DEFAULT_PAYMENT_DOCS,
  DOCUMENT_STATUS_LABEL,
  DocumentStatus,
  PROTECTION_STATUS_LABEL,
  REFERRAL_STATUS_LABEL,
  ReferralStatus,
  ambassadorVisibleAssignment,
  mapStatusForAmbassador,
  nextStepFor,
  protectionStatusFor,
} from '@/types/ambassadors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Plus, Sparkles, Info, Bell, FileText, ShieldCheck, Upload, CheckCircle2,
  Home, Users, Wallet, UserCircle2, Search, ChevronRight, CalendarDays, BadgeCheck,
  Phone, Mail, MessageCircle, UserCheck, ArrowRight, UserPlus, TrendingUp, Share2,
} from 'lucide-react';
import { ReferralFormDialog } from './AmbassadorsAdminTab';
import { ReferralPortalDrawer } from './ReferralPortalDrawer';
import { EmbajadorDocsCard } from './EmbajadorDocsCard';
import { EmbajadorComisionesSection, EmbajadorPagosSection } from './EmbajadorComisionesSections';
import { useEmbajadorDocumentos } from '@/hooks/useEmbajadorDocumentos';
import { useEmbajadorComisiones } from '@/hooks/useEmbajadorComisiones';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const dateShort = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-MX') : '—');

const commLabelForAmb = (s: string) => s === 'potencial' ? 'Sin comisión generada' : COMMISSION_STATUS_LABEL[s as keyof typeof COMMISSION_STATUS_LABEL];

type Section = 'home' | 'referrals' | 'commissions' | 'payments' | 'profile';

function KpiCard({
  label, value, sub, help, accent,
}: {
  label: string; value: string; sub?: string; help?: string; accent?: boolean;
}) {
  return (
    <Card className={cn('p-4', accent && 'border-primary/30 bg-primary/5')}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">{label}</div>
        {help && (
          <Tooltip>
            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">{help}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

const DOC_TONE: Record<DocumentStatus, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  en_revision: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  aprobado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  rechazado: 'bg-destructive/10 text-destructive border-destructive/30',
};

const PROT_TONE = {
  protegido: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  pendiente: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  duplicado_revision: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  no_valido: 'bg-destructive/10 text-destructive border-destructive/30',
} as const;

export default function AmbassadorsPortalTab() {
  const {
    ambassadors, referrals, notifications,
    setDocumentStatus, markAllRead, markNotificationRead,
  } = useAmbassadors();

  const [activeId, setActiveId] = useState(ambassadors[0]?.id ?? '');
  const [section, setSection] = useState<Section>('home');
  const [showForm, setShowForm] = useState(false);
  const [openRefId, setOpenRefId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all');

  const active = ambassadors.find((a) => a.id === activeId);

  const myRefs = useMemo(
    () => referrals.filter((r) => r.ambassadorId === activeId),
    [referrals, activeId],
  );
  const myNotifs = useMemo(
    () => notifications.filter((n) => n.ambassadorId === activeId),
    [notifications, activeId],
  );
  const unread = myNotifs.filter((n) => !n.read).length;

  const { pendingCount: pendingDocs } = useEmbajadorDocumentos(active?.idPersona);
  const { totals: comTotals } = useEmbajadorComisiones(active?.email);

  const stats = useMemo(() => {
    const total = myRefs.length;
    const activeR = myRefs.filter((r) =>
      ['validado', 'contactado', 'cita_agendada', 'cita_realizada', 'en_seguimiento'].includes(r.status),
    ).length;
    const sold = myRefs.filter((r) =>
      ['venta_cerrada', 'comision_generada', 'comision_pagada'].includes(r.status),
    ).length;
    const sum = (st: string) =>
      myRefs.filter((r) => r.commissionStatus === st).reduce((s, r) => s + r.commissionAmount, 0);
    return {
      total, active: activeR, sold,
      generated: sum('generada'), authorized: sum('autorizada'), paid: sum('pagada'),
    };
  }, [myRefs]);

  if (!active) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No hay embajadores registrados aún.</p>
      </Card>
    );
  }

  const filteredRefs = myRefs.filter((r) => {
    const matchesSearch = !search || r.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ─── Section: Inicio ───
  const HomeSection = (
    <div className="space-y-5">
      {/* ===== HERO BANNER ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-[hsl(50,30%,97%)] to-white" style={{ boxShadow: 'var(--shadow-lg)' }}>
        {/* Soft background blobs */}
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-primary/[0.03] blur-2xl pointer-events-none" />
        <div className="relative grid md:grid-cols-2 gap-6 p-6 sm:p-8 items-center">
          {/* Left column: copy */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[1.35rem] sm:text-[1.65rem] md:text-[1.85rem] font-bold leading-[1.2] tracking-tight text-foreground">
              <span className="text-primary font-extrabold">REFERIR</span> a tus <span className="text-primary font-extrabold">AMIGOS</span> y ganar de tus <span className="text-primary font-extrabold">RELACIONES</span> con SOZU es <span className="text-primary font-extrabold">POSIBLE</span>
            </h2>
            <p className="text-sm sm:text-[0.95rem] text-muted-foreground leading-relaxed max-w-md">
              Recomienda nuestros proyectos inmobiliarios y nosotros hacemos el resto.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 mt-1">
              <Button onClick={() => setShowForm(true)} size="lg" className="w-full sm:w-auto shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" /> Registrar nuevo referido
              </Button>
              <Button variant="outline" size="lg" onClick={() => setSection('profile')} className="w-full sm:w-auto">
                Ver cómo funciona <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground italic mt-1">
              Comparte oportunidades. Nosotros acompañamos el proceso comercial.
            </p>
          </div>
          {/* Right column: visual */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-56 h-56 flex items-center justify-center">
              {/* Background glow */}
              <div className="absolute inset-2 rounded-full bg-primary/[0.05] animate-pulse" />
              {/* Center hub */}
              <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-xl shadow-primary/20 ring-4 ring-white/90">
                <Users className="h-9 w-9 text-white" />
              </div>
              {/* Orbiting node top */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border border-primary/15 shadow-md flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              {/* Orbiting node bottom-right */}
              <div className="absolute bottom-5 right-3 w-10 h-10 rounded-full bg-white border border-primary/15 shadow-md flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              {/* Orbiting node bottom-left */}
              <div className="absolute bottom-5 left-3 w-10 h-10 rounded-full bg-white border border-primary/15 shadow-md flex items-center justify-center">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              {/* Connection lines */}
              <div className="absolute top-[3.2rem] left-1/2 w-px h-7 bg-gradient-to-b from-primary/25 to-transparent -translate-x-1/2" />
              <div className="absolute bottom-[4.2rem] right-[3.2rem] w-7 h-px bg-gradient-to-r from-primary/25 to-transparent rotate-[35deg] origin-left" />
              <div className="absolute bottom-[4.2rem] left-[3.2rem] w-7 h-px bg-gradient-to-l from-primary/25 to-transparent rotate-[-35deg] origin-right" />
              {/* Floating card */}
              <div className="absolute top-1/2 right-0 translate-x-2 -translate-y-1/2 bg-white rounded-lg border border-primary/10 shadow-lg p-2.5 w-28">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Tu red</div>
                <div className="text-sm font-bold text-primary mt-0.5">{stats.total} referidos</div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, stats.total * 10)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary uppercase tracking-[0.14em] font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Portal del Embajador
            </div>
            <h1 className="text-2xl font-semibold mt-2">Hola, {active.fullName.split(' ')[0]}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
              <span>Código: <code className="text-foreground font-mono">{active.code}</code></span>
              <span>·</span>
              <span>Comisión: <span className="text-foreground font-medium">{active.commissionPct}%{active.fixedAmount ? ` + ${fmt(active.fixedAmount)}` : ''}</span></span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                {active.status === 'activo' ? 'Verificado' : active.status}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Estoy viendo como…</div>
              <Select value={activeId} onValueChange={setActiveId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ambassadors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.fullName} ({a.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowForm(true)} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Registrar nuevo referido
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard label="Mis referidos" value={String(stats.total)} accent />
        <KpiCard label="En seguimiento" value={String(stats.active)} />
        <KpiCard label="Vendidos" value={String(stats.sold)} />
        <KpiCard label="Comisión generada" value={comTotals.generada ? fmt(comTotals.generada) : 'Sin generar'} help={COMMISSION_STATUS_HELP.generada} />
        <KpiCard label="Comisión autorizada" value={comTotals.autorizada ? fmt(comTotals.autorizada) : '—'} help={COMMISSION_STATUS_HELP.autorizada} />
        <KpiCard label="Comisión pagada" value={comTotals.pagada ? fmt(comTotals.pagada) : '—'} help={COMMISSION_STATUS_HELP.pagada} />
        <KpiCard label="Documentación" value={pendingDocs === 0 ? 'Al día' : `${pendingDocs} pend.`} sub={pendingDocs === 0 ? 'Todo en orden' : 'Revisa tu perfil'} />
      </div>

      {/* Resumen referidos recientes */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Tus últimos referidos</h3>
          <Button variant="ghost" size="sm" onClick={() => setSection('referrals')}>
            Ver todos <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        {myRefs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aún no has registrado referidos. Toca <strong>Registrar</strong> abajo para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {myRefs.slice(0, 4).map((r) => (
              <li
                key={r.id}
                onClick={() => setOpenRefId(r.id)}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.clientName}</div>
                  <div className="text-[11px] text-muted-foreground">{nextStepFor(r.status)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{mapStatusForAmbassador(r.status)}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  // ─── Section: Referidos ───
  const ReferralsSection = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar referido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estatus</SelectItem>
            {(Object.keys(REFERRAL_STATUS_LABEL) as ReferralStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{REFERRAL_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)} className="sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Registrar referido
        </Button>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {filteredRefs.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No hay referidos que coincidan con la búsqueda.
          </Card>
        )}
        {filteredRefs.map((r) => {
          const prot = protectionStatusFor(r);
          return (
            <Card key={r.id} className="p-4" onClick={() => setOpenRefId(r.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{r.clientName}</div>
                  <div className="text-[11px] text-muted-foreground">{dateShort(r.registeredAt)}</div>
                </div>
                <Badge variant="outline">{mapStatusForAmbassador(r.status)}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Próx: {r.nextStepOverride ?? nextStepFor(r.status)}
              </div>
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Asesor:</span>{' '}
                {r.assignedAdvisorName
                  ? <span className="font-medium">{r.assignedAdvisorName}</span>
                  : <span className="text-muted-foreground italic">Pendiente de asignación</span>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="outline" className={PROT_TONE[prot]}>{PROTECTION_STATUS_LABEL[prot]}</Badge>
                <Badge variant="outline">{commLabelForAmb(r.commissionStatus)}</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente referido</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Próximo paso</TableHead>
              <TableHead>Asesor asignado</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Protección</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRefs.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  No hay referidos que coincidan.
                </TableCell>
              </TableRow>
            )}
            {filteredRefs.map((r) => {
              const prot = protectionStatusFor(r);
              const next = r.nextStepOverride ?? nextStepFor(r.status);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.clientName}</TableCell>
                  <TableCell className="text-xs">{dateShort(r.registeredAt)}</TableCell>
                  <TableCell><Badge variant="outline">{mapStatusForAmbassador(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{next}</TableCell>
                  <TableCell className="text-xs">
                    {r.assignedAdvisorName
                      ? <div>
                          <div className="font-medium text-foreground">{r.assignedAdvisorName}</div>
                          {r.assignedAdvisorRole && <div className="text-muted-foreground">{r.assignedAdvisorRole}</div>}
                        </div>
                      : <span className="text-muted-foreground">Pendiente</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.assignedAdvisorPhone && (
                        <a href={`https://wa.me/${r.assignedAdvisorPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                           onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><MessageCircle className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                      {r.assignedAdvisorEmail && (
                        <a href={`mailto:${r.assignedAdvisorEmail}`} onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><Mail className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                      {!r.assignedAdvisorPhone && !r.assignedAdvisorEmail && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PROT_TONE[prot]}>{PROTECTION_STATUS_LABEL[prot]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{commLabelForAmb(r.commissionStatus)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setOpenRefId(r.id)}>Ver detalle</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

  // ─── Section: Comisiones ───
  const CommissionsSection = <EmbajadorComisionesSection email={active.email} />;

  // ─── Section: Pagos ───
  const PaymentsSection = <EmbajadorPagosSection email={active.email} idPersona={active.idPersona} />;

  // ─── Section: Perfil ───
  const ProfileSection = (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
            {active.fullName.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div className="font-semibold">{active.fullName}</div>
            <div className="text-xs text-muted-foreground">{active.email ?? '—'} · {active.phone ?? '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-[11px] text-muted-foreground uppercase tracking-wide">Código</div><div className="font-mono">{active.code}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase tracking-wide">Comisión</div><div>{active.commissionPct}%{active.fixedAmount ? ` + ${fmt(active.fixedAmount)}` : ''}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase tracking-wide">Trigger</div><div>{active.commissionTrigger}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase tracking-wide">Estatus</div><Badge variant="outline">{active.status}</Badge></div>
        </div>
      </Card>

      {/* Documentos */}
      <EmbajadorDocsCard idPersona={active.idPersona} />

      {/* Notificaciones */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificaciones
            {unread > 0 && <Badge variant="default">{unread}</Badge>}
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAllRead(active.id)}>
              Marcar todas como leídas
            </Button>
          )}
        </div>
        {myNotifs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No tienes notificaciones.</p>
        ) : (
          <ul className="space-y-2">
            {myNotifs.slice(0, 8).map((n) => (
              <li key={n.id} className={`flex items-start gap-3 rounded-md border p-3 ${n.read ? 'border-border' : 'border-primary/30 bg-primary/5'}`}>
                {n.read ? <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" /> : <Bell className="h-4 w-4 text-primary mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{n.message}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString('es-MX')}</div>
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id)}>Marcar leída</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reglas */}
      <Card className="p-5 space-y-4 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" /> Reglas del programa
        </div>
        <p className="text-muted-foreground">
          Los Embajadores únicamente refieren clientes potenciales. El seguimiento comercial, la
          presentación, la negociación y el cierre son responsabilidad del equipo interno de SOZU.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-1">Qué hace un Embajador</h4>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Refiere clientes potenciales con su consentimiento.</li>
              <li>Comparte su link de embajador.</li>
              <li>Mantiene actualizada su documentación de pago.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1">Qué no hace</h4>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>No agenda citas como asesor ni presenta inventario.</li>
              <li>No negocia precios ni descuentos.</li>
              <li>No participa en el cierre.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1">Comisión</h4>
            <p className="text-muted-foreground">La comisión se calculará al cierre validado de la venta, cuando el referido cumpla el evento <strong>{active.commissionTrigger}</strong>.</p>
          </div>
          <div className="flex items-start gap-2">
            <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">Vigencia de protección</h4>
              <p className="text-muted-foreground">Tu referido queda protegido por {active.protectionDays ?? 90} días desde el registro.</p>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <Button variant="outline" size="sm">Cerrar sesión</Button>
        </div>
      </Card>
    </div>
  );

  const NAV: { id: Section; label: string; icon: typeof Home; center?: boolean }[] = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'referrals', label: 'Referidos', icon: Users },
    { id: 'commissions', label: 'Comisiones', icon: Wallet },
    { id: 'payments', label: 'Pagos', icon: Receipt },
    { id: 'profile', label: 'Perfil', icon: UserCircle2 },
  ];

  return (
    <TooltipProvider>
      {/* Desktop top nav */}
      <div className="hidden md:flex items-center justify-center mb-6">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-full border border-border bg-card shadow-sm">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = section === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {n.label}
                {n.id === 'profile' && unread > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1',
                    isActive ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground',
                  )}>{unread}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content with bottom padding so mobile nav doesn't overlap */}
      <div className="pb-24 md:pb-0">
        {section === 'home' && HomeSection}
        {section === 'referrals' && ReferralsSection}
        {section === 'commissions' && CommissionsSection}
        {section === 'payments' && PaymentsSection}
        {section === 'profile' && ProfileSection}
      </div>

      {/* Mobile floating bottom nav */}
      <nav
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur border border-border rounded-full shadow-xl shadow-black/10"
        style={{ bottom: 'max(12px, env(safe-area-inset-bottom))', width: 'min(94vw, 420px)' }}
        aria-label="Navegación principal del embajador"
      >
        <ul className="flex items-center justify-around p-1.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = section === n.id;
            return (
              <li key={n.id} className="flex-1">
                <button
                  onClick={() => setSection(n.id)}
                  className={cn(
                    'w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-full transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground active:bg-muted',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {n.id === 'profile' && unread > 0 && (
                      <span className="absolute -top-1 -right-2 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[14px] h-[14px] px-1">
                        {unread}
                      </span>
                    )}
                  </span>
                  <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>{n.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <ReferralFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        defaultAmbassadorId={activeId}
        hideAdvisor
      />
      <ReferralPortalDrawer referralId={openRefId} onOpenChange={setOpenRefId} />
    </TooltipProvider>
  );
}
