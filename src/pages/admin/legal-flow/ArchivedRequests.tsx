import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Archive, Search, Download, Eye, FileText, Calendar, Building2, User,
  Filter, CheckCircle2, Zap, FileUp, ShieldCheck, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockRequests, REQUEST_TYPE_LABELS } from '@/data/mockData';
import type { LegalRequest } from '@/types/legal';

const archivedRequests = mockRequests.filter(r => r.status === 'archived');

const INTEGRITY_STATUS: Record<string, { label: string; style: string }> = {
  complete: { label: 'Expediente íntegro', style: 'bg-primary/10 text-primary' },
  pending: { label: 'Pendiente de evidencia', style: 'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]' },
  validated: { label: 'Archivo validado', style: 'bg-primary/10 text-primary' },
};

function getIntegrity(r: LegalRequest): string {
  const allSigned = r.signers?.every(s => s.status === 'signed');
  const hasDoc = r.documents?.some(d => d.status === 'signed');
  return allSigned && hasDoc ? 'complete' : 'pending';
}

function getArchiveDate(r: LegalRequest): string {
  return r.updatedAt;
}

function getLastSignatureDate(r: LegalRequest): string | undefined {
  const dates = r.signers?.filter(s => s.signedAt).map(s => s.signedAt!) || [];
  if (dates.length === 0) return undefined;
  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ArchivedRequests() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const projects = [...new Set(archivedRequests.map(r => r.project).filter(Boolean))];
  const lawyers = [...new Set(archivedRequests.map(r => r.assignedTo).filter(Boolean))];
  const types = [...new Set(archivedRequests.map(r => r.type))];

  const filtered = archivedRequests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.title.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.counterparty.toLowerCase().includes(q) ||
      (r.titular || '').toLowerCase().includes(q) ||
      (r.project || '').toLowerCase().includes(q) ||
      (r.cuentaCobranza || '').toLowerCase().includes(q) ||
      (r.property || '').toLowerCase().includes(q);
    const matchProject = projectFilter === 'all' || r.project === projectFilter;
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const matchLawyer = lawyerFilter === 'all' || r.assignedTo === lawyerFilter;
    const matchMethod = methodFilter === 'all' || r.signers?.some(s =>
      methodFilter === 'digital' ? s.signatureMethod === 'digital' : s.signatureMethod === 'physical'
    );
    return matchSearch && matchProject && matchType && matchLawyer && matchMethod;
  });

  // KPIs
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const archivedThisMonth = archivedRequests.filter(r => new Date(getArchiveDate(r)) >= thisMonth).length;
  const byProject: Record<string, number> = {};
  archivedRequests.forEach(r => { byProject[r.project || 'Otro'] = (byProject[r.project || 'Otro'] || 0) + 1; });
  const digitalCount = archivedRequests.filter(r => r.signers?.every(s => s.signatureMethod === 'digital')).length;
  const physicalCount = archivedRequests.filter(r => r.signers?.some(s => s.signatureMethod === 'physical')).length;

  const hasActiveFilters = projectFilter !== 'all' || typeFilter !== 'all' || lawyerFilter !== 'all' || methodFilter !== 'all';

  const clearFilters = () => {
    setProjectFilter('all');
    setTypeFilter('all');
    setLawyerFilter('all');
    setMethodFilter('all');
  };

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Archive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Expedientes Archivados</h1>
            <p className="text-[13px] text-muted-foreground">
              Repositorio de contratos y convenios que completaron el proceso legal
            </p>
          </div>
        </div>
      </motion.div>

      {/* KPI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Total archivados</p>
          <p className="text-[28px] font-bold text-foreground mt-1">{archivedRequests.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Archivados este mes</p>
          <p className="text-[28px] font-bold text-foreground mt-1">{archivedThisMonth}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Firma digital</p>
          <div className="flex items-center gap-2 mt-1">
            <Zap className="h-4 w-4 text-primary" />
            <p className="text-[28px] font-bold text-foreground">{digitalCount}</p>
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Firma física</p>
          <div className="flex items-center gap-2 mt-1">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-[28px] font-bold text-foreground">{physicalCount}</p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Buscar por expediente, contraparte, titular, proyecto, cuenta cobranza, unidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-[38px] text-[13px] bg-card rounded-lg"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            className="h-[38px] text-[13px] gap-1.5 rounded-lg"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary-foreground text-primary text-[11px] font-bold">
                {[projectFilter, typeFilter, lawyerFilter, methodFilter].filter(f => f !== 'all').length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-[38px] text-[13px] gap-1 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-3 pt-1"
          >
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px] h-[36px] text-[13px] bg-card rounded-lg">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] h-[36px] text-[13px] bg-card rounded-lg">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{REQUEST_TYPE_LABELS[t] || t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
              <SelectTrigger className="w-[200px] h-[36px] text-[13px] bg-card rounded-lg">
                <SelectValue placeholder="Abogado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los abogados</SelectItem>
                {lawyers.map(l => <SelectItem key={l} value={l!}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px] h-[36px] text-[13px] bg-card rounded-lg">
                <SelectValue placeholder="Método de firma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                <SelectItem value="digital">Firma digital</SelectItem>
                <SelectItem value="physical">Firma física</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </motion.div>

      {/* Results */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} expediente{filtered.length !== 1 ? 's' : ''} archivado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Archive className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-[14px] text-muted-foreground font-medium">No se encontraron expedientes archivados</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Ajusta los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((r) => (
                <ArchivedRow key={r.id} request={r} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ArchivedRow({ request: r }: { request: LegalRequest }) {
  const integrity = getIntegrity(r);
  const integrityConfig = INTEGRITY_STATUS[integrity];
  const lastSig = getLastSignatureDate(r);
  const archiveDate = getArchiveDate(r);
  const hasPhysical = r.signers?.some(s => s.signatureMethod === 'physical');

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono text-muted-foreground/60">{r.id}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${integrityConfig.style}`}>
            <ShieldCheck className="h-2.5 w-2.5" />
            {integrityConfig.label}
          </span>
        </div>
        <Link to={`/cases/${r.id}`} className="text-[14px] font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
          {r.title}
        </Link>
        <div className="flex items-center gap-4 mt-1.5 text-[12px] text-muted-foreground">
          {r.project && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {r.project}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" /> {r.counterparty}
          </span>
          {r.titular && (
            <span className="flex items-center gap-1 text-muted-foreground/60">
              Titular: {r.titular}
            </span>
          )}
        </div>
      </div>

      {/* Signature info */}
      <div className="hidden lg:flex flex-col items-end gap-1 min-w-[140px]">
        <div className="flex items-center gap-1.5">
          {hasPhysical ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <FileUp className="h-3 w-3" /> Firma física
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
              <Zap className="h-3 w-3" /> Firma digital
            </span>
          )}
        </div>
        {lastSig && (
          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Firma: {formatDate(lastSig)}
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="hidden md:flex flex-col items-end gap-1 min-w-[130px]">
        <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Archivo: {formatDate(archiveDate)}
        </span>
        {r.assignedTo && (
          <span className="text-[11px] text-muted-foreground/60">
            {r.assignedTo}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" asChild>
          <Link to={`/cases/${r.id}`}>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
          <Download className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
