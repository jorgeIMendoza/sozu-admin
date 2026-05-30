import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Archive, Search, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLegalFlowExpedientesArchivados } from '@/hooks/useLegalFlowExpedientesArchivados';

/**
 * Expedientes Archivados — lista de cuentas de cobranza tipo Propiedad
 * cuya propiedad está en estatus "Vendido" (id_estatus_disponibilidad = 5).
 * El expediente que se muestra es el folio CC-XXXXXX. El detalle se abre
 * en /admin/legal-flow/cases/:folio.
 */
export default function ArchivedRequests() {
  const { data: expedientes, isLoading, error } = useLegalFlowExpedientesArchivados();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const list = expedientes ?? [];

  const projects = useMemo(
    () => Array.from(new Set(list.map((r) => r.project).filter(Boolean))) as string[],
    [list],
  );
  const agents = useMemo(
    () =>
      Array.from(
        new Set(list.map((r) => r.agenteVendedor).filter(Boolean)),
      ) as string[],
    [list],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      const matchSearch = !q
        || r.id.toLowerCase().includes(q)
        || (r.project || '').toLowerCase().includes(q)
        || (r.modelo || '').toLowerCase().includes(q)
        || (r.property || '').toLowerCase().includes(q)
        || (r.titular || '').toLowerCase().includes(q)
        || r.counterparty.toLowerCase().includes(q)
        || (r.counterparties || []).some((c) => c.toLowerCase().includes(q))
        || (r.agenteVendedor || '').toLowerCase().includes(q);
      const matchProject = projectFilter === 'all' || r.project === projectFilter;
      const matchAgent = agentFilter === 'all' || r.agenteVendedor === agentFilter;
      return matchSearch && matchProject && matchAgent;
    });
  }, [list, search, projectFilter, agentFilter]);

  const archivedThisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return list.filter((r) => {
      const d = r.fechaCompra ? new Date(r.fechaCompra) : null;
      return d != null && d >= start;
    }).length;
  }, [list]);

  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1600px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Archive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Expedientes Archivados</h1>
            <p className="text-[13px] text-muted-foreground">
              Cuentas de cobranza con propiedad en estatus Vendido — proceso legal completado
            </p>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-2 gap-4"
      >
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
            Total archivados
          </p>
          <p className="text-[28px] font-bold text-foreground mt-1 tabular-nums">
            {isLoading ? '…' : list.length}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
            Archivados este mes
          </p>
          <p className="text-[28px] font-bold text-foreground mt-1 tabular-nums">
            {isLoading ? '…' : archivedThisMonth}
          </p>
        </div>
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[260px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por ID cuenta, proyecto, modelo, comprador, agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-[38px] text-[13px] bg-card rounded-lg"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px] h-[38px] text-[13px] bg-card rounded-lg">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[220px] h-[38px] text-[13px] bg-card rounded-lg">
            <SelectValue placeholder="Agente vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="panel overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="table-head w-[120px]">ID Cuenta</th>
                <th className="table-head">Proyecto</th>
                <th className="table-head">Modelo</th>
                <th className="table-head">Propiedad</th>
                <th className="table-head">Dueño</th>
                <th className="table-head">Compradores</th>
                <th className="table-head">Agente Vendedor</th>
                <th className="table-head w-[130px]">Fecha Compra</th>
                <th className="table-head w-[80px] text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-20 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando expedientes…
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-destructive">Error al cargar</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {(error as Error).message}
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-20 text-center">
                    <Archive className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      No se encontraron expedientes archivados
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Ajusta los filtros de búsqueda
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const compradores = (r.counterparties && r.counterparties.length > 0
                    ? r.counterparties
                    : [r.counterparty]
                  ).filter(Boolean);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border/50 table-row-hover"
                      style={{ height: '52px' }}
                    >
                      <td className="table-cell font-mono text-[12px] text-muted-foreground/80 whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="table-cell text-[13px]">{r.project || '—'}</td>
                      <td className="table-cell text-[13px] text-muted-foreground">
                        {r.modelo || '—'}
                      </td>
                      <td className="table-cell text-[13px]">{r.property || '—'}</td>
                      <td className="table-cell text-[13px] text-muted-foreground">
                        {r.titular || '—'}
                      </td>
                      <td className="table-cell text-[13px]">
                        <div className="max-w-[220px]">
                          {compradores.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : compradores.length === 1 ? (
                            compradores[0]
                          ) : (
                            <span title={compradores.join(', ')}>
                              {compradores[0]}{' '}
                              <span className="text-muted-foreground">
                                +{compradores.length - 1}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-[13px] text-muted-foreground">
                        {r.agenteVendedor || '—'}
                      </td>
                      <td className="table-cell text-[12px] font-mono text-muted-foreground/70 tabular-nums whitespace-nowrap">
                        {fmtDate(r.fechaCompra)}
                      </td>
                      <td className="table-cell text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]">
                          <Link
                            to={`/admin/legal-flow/cases/${r.id}`}
                            aria-label={`Ver detalle del expediente ${r.id}`}
                            title="Ver detalle del expediente"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
