import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockRequests, STATUS_CONFIG, REQUEST_TYPE_LABELS } from '@/data/mockData';

const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export default function RequestsList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = mockRequests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.counterparty.toLowerCase().includes(q) || (r.project || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchSearch && matchStatus && matchPriority && matchType;
  });

  const counts = {
    all: mockRequests.length,
    active: mockRequests.filter(r => !['fully_signed', 'cancelled', 'archived', 'rejected'].includes(r.status)).length,
  };

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold tracking-tight">Solicitudes Legales</h1>
          <p className="text-[13px] text-muted-foreground">{counts.active} activas · {counts.all} total</p>
        </div>
        <Button asChild className="h-9 text-[13px] gap-1.5 rounded-lg">
          <Link to="/requests/new"><Plus className="h-4 w-4" /> Nueva Solicitud</Link>
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Buscar por expediente, contraparte, proyecto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-[38px] text-[13px] bg-card rounded-lg" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Estatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estatus</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="table-head w-[100px]">ID</th>
                <th className="table-head">Expediente</th>
                <th className="table-head">Empresa</th>
                <th className="table-head">Tipo</th>
                <th className="table-head w-[80px]">Prioridad</th>
                <th className="table-head">Estatus</th>
                <th className="table-head">Responsable</th>
                <th className="table-head w-[100px]">Fecha límite</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="border-t border-border/50 table-row-hover" style={{ height: '52px' }}>
                  <td className="table-cell font-mono text-[12px] text-muted-foreground/60">{req.id}</td>
                  <td className="table-cell">
                    <Link to={`/cases/${req.id}`} className="font-medium text-[13px] hover:text-primary transition-colors">
                      {req.title}
                    </Link>
                  </td>
                  <td className="table-cell text-[13px] text-muted-foreground">{req.company}</td>
                  <td className="table-cell">
                    <span className="badge-base badge-request">{REQUEST_TYPE_LABELS[req.type]}</span>
                  </td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1.5">
                      <span className={`priority-dot priority-dot-${req.priority}`} />
                      <span className="text-[13px]">{PRIORITY_LABELS[req.priority]}</span>
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`status-badge ${STATUS_CONFIG[req.status].style}`}>
                      {STATUS_CONFIG[req.status].label}
                    </span>
                  </td>
                  <td className="table-cell text-[13px] text-muted-foreground">{req.assignedTo || '—'}</td>
                  <td className="table-cell text-[12px] font-mono text-muted-foreground/70 tabular-nums">
                    {new Date(req.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-foreground">Sin resultados</p>
                    <p className="text-[13px] text-muted-foreground mt-1">No hay solicitudes que coincidan con tus filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
