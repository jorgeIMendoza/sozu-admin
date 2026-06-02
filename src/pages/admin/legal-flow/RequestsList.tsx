import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_CONFIG } from '@/data/legalFlow/mockData';
import { useLegalFlowSolicitudesRecibidas } from '@/hooks/useLegalFlowSolicitudesRecibidas';

const PRIORITY_LABELS: Record<string, string> = { 'Alto': 'Alta', 'Medio': 'Media', 'Bajo': 'Baja' };

/**
 * Solicitudes Legales — lista plana de todas las cuentas de cobranza
 * con propiedad en estatus Apartado. Mismo universo que la primera
 * columna del Pipeline (Solicitud recibida).
 *
 * Las cuentas que ya tienen expediente en una etapa posterior aparecerán
 * en este listado una vez que `legal_flow_expedientes` esté en BD (ver
 * Ejecuciones_manuales/legal_flow_expedientes.md).
 */
export default function RequestsList() {
  const { data: solicitudes, isLoading, error } = useLegalFlowSolicitudesRecibidas();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const list = solicitudes ?? [];
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
        || (r.counterparties || []).some((c) => c.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [list, search, statusFilter, priorityFilter]);

  const counts = {
    all: list.length,
    active: list.filter((r) => !['Firmado', 'Cancelado', 'Archivado', 'Rechazado'].includes(r.status)).length,
  };

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1600px]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold tracking-tight">Solicitudes Legales</h1>
          <p className="text-[13px] text-muted-foreground">
            {isLoading ? 'Cargando…' : `${counts.active} activas · ${counts.all} total`}
          </p>
        </div>
        <Button asChild className="h-9 text-[13px] gap-1.5 rounded-lg">
          <Link to="/admin/legal-flow/requests/new"><Plus className="h-4 w-4" /> Nueva Solicitud</Link>
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por ID cuenta, proyecto, modelo, comprador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-[38px] text-[13px] bg-card rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-[38px] text-[13px] bg-card rounded-lg">
            <SelectValue placeholder="Estatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estatus</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] h-[38px] text-[13px] bg-card rounded-lg">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            <SelectItem value="Alto">Alta</SelectItem>
            <SelectItem value="Medio">Media</SelectItem>
            <SelectItem value="Bajo">Baja</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
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
                <th className="table-head w-[90px]">Prioridad</th>
                <th className="table-head">Estatus</th>
                <th className="table-head">Responsable</th>
                <th className="table-head w-[110px]">Fecha límite</th>
                <th className="table-head w-[80px] text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-5 py-20 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes…
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-destructive">Error al cargar</p>
                    <p className="text-[13px] text-muted-foreground mt-1">{(error as Error).message}</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-foreground">Sin resultados</p>
                    <p className="text-[13px] text-muted-foreground mt-1">No hay solicitudes que coincidan con tus filtros.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const compradores = (req.counterparties && req.counterparties.length > 0
                    ? req.counterparties
                    : [req.counterparty]
                  ).filter(Boolean);
                  return (
                    <tr key={req.id} className="border-t border-border/50 table-row-hover" style={{ height: '52px' }}>
                      <td className="table-cell font-mono text-[12px] text-muted-foreground/80 whitespace-nowrap">
                        {req.id}
                      </td>
                      <td className="table-cell text-[13px]">{req.project || '—'}</td>
                      <td className="table-cell text-[13px] text-muted-foreground">{req.modelo || '—'}</td>
                      <td className="table-cell text-[13px]">{req.property || '—'}</td>
                      <td className="table-cell text-[13px] text-muted-foreground">{req.titular || '—'}</td>
                      <td className="table-cell text-[13px]">
                        <div className="max-w-[220px]">
                          {compradores.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : compradores.length === 1 ? (
                            compradores[0]
                          ) : (
                            <span title={compradores.join(', ')}>
                              {compradores[0]}{' '}
                              <span className="text-muted-foreground">+{compradores.length - 1}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="flex items-center gap-1.5">
                          <span className={`priority-dot priority-dot-${req.priority}`} />
                          <span className="text-[13px]">{PRIORITY_LABELS[req.priority]}</span>
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`status-badge ${STATUS_CONFIG[req.status]?.style ?? 'status-queued'}`}>
                          {STATUS_CONFIG[req.status]?.label ?? req.status}
                        </span>
                      </td>
                      <td className="table-cell text-[13px] text-muted-foreground">{req.assignedTo || '—'}</td>
                      <td className="table-cell text-[12px] font-mono text-muted-foreground/70 tabular-nums whitespace-nowrap">
                        {req.dueDate
                          ? new Date(req.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                          : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]">
                          <Link
                            to={`/admin/legal-flow/cases/${req.id}`}
                            aria-label={`Ver detalle del expediente ${req.id}`}
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
