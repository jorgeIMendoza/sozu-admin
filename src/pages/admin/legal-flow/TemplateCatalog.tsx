import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Fingerprint, FileUp, CheckCircle2, XCircle, Plus, Loader2, Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NuevaCartaAcuerdoDialog } from '@/components/admin/NuevaCartaAcuerdoDialog';
import { useLegalFlowPlantillas } from '@/hooks/useLegalFlowPlantillas';

type EstadoFiltro = 'all' | 'active' | 'inactive';

const formatFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function TemplateCatalog() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data: plantillas = [], isLoading } = useLegalFlowPlantillas();

  const filtered = plantillas.filter((t) => {
    const matchSearch =
      !search ||
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? t.activa : !t.activa);
    return matchSearch && matchStatus;
  });

  const activeCount = plantillas.filter((t) => t.activa).length;
  const inactiveCount = plantillas.filter((t) => !t.activa).length;
  const totalUsos = plantillas.reduce((s, t) => s + t.usos, 0);
  const biometricaCount = plantillas.filter((t) => t.requiereBiometrica).length;
  const firmaFisicaCount = plantillas.filter((t) => t.requiereFirmaAutografa).length;

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Catálogo de Plantillas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Registro de plantillas de cartas de acuerdo y sus firmantes configurados</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </motion.div>

      {/* KPI summary — sólo métricas con respaldo real */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.03 }} className="flex gap-3">
        {[
          { label: 'Activas', value: activeCount, style: 'text-[hsl(145_45%_28%)]' },
          { label: 'Inactivas', value: inactiveCount, style: 'text-muted-foreground' },
          { label: 'Total usos', value: totalUsos, style: 'text-foreground' },
          { label: 'Requieren biometría', value: biometricaCount, style: 'text-foreground' },
        ].map((k) => (
          <div key={k.label} className="kpi-card flex-1 min-w-[120px] py-4 px-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{k.label}</p>
            <p className={`text-[22px] font-bold tabular-nums mt-1 ${k.style}`}>{k.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Buscar por nombre o ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-[38px] text-[13px] bg-card rounded-lg" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EstadoFiltro)}>
          <SelectTrigger className="w-[140px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="table-head w-[90px]">ID</th>
                <th className="table-head">Nombre</th>
                <th className="table-head text-center">Requisitos</th>
                <th className="table-head text-center">Firmantes</th>
                <th className="table-head text-right">Usos</th>
                <th className="table-head">Actualizada</th>
                <th className="table-head w-[110px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-[13px] text-muted-foreground mt-2">Cargando plantillas…</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-foreground">Sin resultados</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {plantillas.length === 0
                        ? 'Aún no hay plantillas registradas.'
                        : 'No hay plantillas que coincidan con tus filtros.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="border-t border-border/50"
                    style={{ height: '52px' }}
                  >
                    <td className="table-cell font-mono text-[12px] text-muted-foreground/60">{tpl.id}</td>
                    <td className="table-cell">
                      <p className="font-medium text-[13px]">{tpl.nombre}</p>
                      {tpl.descripcion && (
                        <p className="text-[12px] text-muted-foreground/60 line-clamp-1 mt-0.5">{tpl.descripcion}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center gap-1.5">
                        {tpl.requiereBiometrica && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(28_72%_94%)]" title="Requiere validación biométrica">
                            <Fingerprint className="h-3.5 w-3.5 text-[hsl(28_72%_40%)]" />
                          </span>
                        )}
                        {tpl.requiereFirmaAutografa && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(220_13%_95%)]" title="Requiere firma autógrafa">
                            <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        )}
                        {!tpl.requiereBiometrica && !tpl.requiereFirmaAutografa && (
                          <span className="text-[11px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-center text-[13px] tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                        {tpl.numFirmantes}
                      </span>
                    </td>
                    <td className="table-cell text-right text-[13px] tabular-nums font-medium">
                      {tpl.usos > 0 ? tpl.usos : '—'}
                    </td>
                    <td className="table-cell text-[13px] text-muted-foreground tabular-nums">{formatFecha(tpl.actualizada)}</td>
                    <td className="table-cell">
                      {tpl.activa ? (
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activa
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground/50">
                          <XCircle className="h-3.5 w-3.5" /> Inactiva
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Footer stats — sólo métricas reales */}
      {!isLoading && plantillas.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-6 text-[12px] text-muted-foreground/60">
          <span>{activeCount} activas</span>
          <span>{inactiveCount} inactivas</span>
          <span>{biometricaCount} requieren biometría</span>
          <span>{firmaFisicaCount} requieren firma autógrafa</span>
        </motion.div>
      )}

      {/* Create dialog — flujo real de creación de cartas de acuerdo */}
      <NuevaCartaAcuerdoDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
