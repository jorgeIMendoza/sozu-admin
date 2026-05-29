import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Shield, Fingerprint, PenTool, CheckCircle2, XCircle, ChevronRight,
  Plus, Copy, Archive, MoreHorizontal, FileUp, Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { mockTemplates } from '@/data/legalFlow/mockData';
import type { TemplateStatus } from '@/types/legal-flow';

export default function TemplateCatalog() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TemplateStatus>('active');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const categories = [...new Set(mockTemplates.map((t) => t.category))];
  const projects = [...new Set(mockTemplates.map((t) => t.project).filter(Boolean))];

  const filtered = mockTemplates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || t.templateStatus === statusFilter;
    const matchProject = projectFilter === 'all' || t.project === projectFilter;
    return matchSearch && matchCategory && matchStatus && matchProject;
  });

  const activeCount = mockTemplates.filter(t => t.templateStatus === 'active').length;
  const inactiveCount = mockTemplates.filter(t => t.templateStatus === 'inactive').length;
  const archivedCount = mockTemplates.filter(t => t.templateStatus === 'archived').length;

  return (
    <div className="px-10 py-8 space-y-6 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Catálogo de Plantillas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Registro controlado de plantillas de contratos y acuerdos legales</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </motion.div>

      {/* KPI summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.03 }} className="flex gap-3">
        {[
          { label: 'Activas', value: activeCount, style: 'text-[hsl(145_45%_28%)]' },
          { label: 'Inactivas', value: inactiveCount, style: 'text-muted-foreground' },
          { label: 'Archivadas', value: archivedCount, style: 'text-muted-foreground/60' },
          { label: 'Total usos', value: mockTemplates.reduce((s, t) => s + t.usageCount, 0), style: 'text-foreground' },
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((p) => <SelectItem key={p!} value={p!}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px] h-[38px] text-[13px] bg-card rounded-lg"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
            <SelectItem value="archived">Archivadas</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="table-head w-[80px]">ID</th>
                <th className="table-head">Nombre</th>
                <th className="table-head">Proyecto</th>
                <th className="table-head">Tipo</th>
                <th className="table-head">Versión</th>
                <th className="table-head text-center">Requisitos</th>
                <th className="table-head text-center">Firmantes</th>
                <th className="table-head text-right">Usos</th>
                <th className="table-head">Responsable</th>
                <th className="table-head w-[90px]">Estado</th>
                <th className="table-head w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="border-t border-border/50 table-row-hover cursor-pointer group"
                  style={{ height: '52px' }}
                  onClick={() => navigate(`/admin/legal-flow/templates/${tpl.id}`)}
                >
                  <td className="table-cell font-mono text-[12px] text-muted-foreground/60">{tpl.id}</td>
                  <td className="table-cell">
                    <p className="font-medium text-[13px]">{tpl.name}</p>
                    <p className="text-[12px] text-muted-foreground/60 line-clamp-1 mt-0.5">{tpl.description}</p>
                  </td>
                  <td className="table-cell text-[13px] text-muted-foreground">{tpl.project || '—'}</td>
                  <td className="table-cell">
                    <span className="badge-base badge-document">
                      {tpl.type === 'contract' ? 'Contrato' : 'Convenio'}
                    </span>
                  </td>
                  <td className="table-cell font-mono text-[13px] tabular-nums text-muted-foreground">v{tpl.version}</td>
                  <td className="table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      {tpl.requiresBiometric && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(28_72%_94%)]" title="Requiere biometría">
                          <Fingerprint className="h-3.5 w-3.5 text-[hsl(28_72%_40%)]" />
                        </span>
                      )}
                      {tpl.requiresKyc && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(48_96%_89%)]" title="Requiere KYC">
                          <Shield className="h-3.5 w-3.5 text-[hsl(26_72%_36%)]" />
                        </span>
                      )}
                      {tpl.requiresMifiel && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(258_56%_95%)]" title="Requiere MiFiel">
                          <PenTool className="h-3.5 w-3.5 text-[hsl(258_56%_42%)]" />
                        </span>
                      )}
                      {tpl.allowsPhysical && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(220_13%_95%)]" title="Permite firma física">
                          <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      )}
                      {!tpl.requiresBiometric && !tpl.requiresKyc && !tpl.requiresMifiel && !tpl.allowsPhysical && (
                        <span className="text-[11px] text-muted-foreground/40">—</span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell text-center text-[13px] tabular-nums text-muted-foreground">
                    {tpl.internalSigners}i / {tpl.externalSigners}e
                  </td>
                  <td className="table-cell text-right text-[13px] tabular-nums font-medium">
                    {tpl.usageCount > 0 ? tpl.usageCount : '—'}
                  </td>
                  <td className="table-cell text-[13px] text-muted-foreground">{tpl.responsibleLawyer || '—'}</td>
                  <td className="table-cell">
                    {tpl.templateStatus === 'active' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Activa
                      </span>
                    ) : tpl.templateStatus === 'inactive' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground/50">
                        <XCircle className="h-3.5 w-3.5" /> Inactiva
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground/40">
                        <Archive className="h-3.5 w-3.5" /> Archivada
                      </span>
                    )}
                  </td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-accent transition-colors">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground/50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/admin/legal-flow/templates/${tpl.id}`)}>Ver / Editar</DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {tpl.templateStatus === 'active' && <DropdownMenuItem>Desactivar</DropdownMenuItem>}
                        {tpl.templateStatus === 'inactive' && <DropdownMenuItem>Activar</DropdownMenuItem>}
                        {tpl.templateStatus !== 'archived' && <DropdownMenuItem>Archivar</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-20 text-center">
                    <p className="text-sm font-medium text-foreground">Sin resultados</p>
                    <p className="text-[13px] text-muted-foreground mt-1">No hay plantillas que coincidan con tus filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Footer stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-6 text-[12px] text-muted-foreground/60">
        <span>{activeCount} activas</span>
        <span>{inactiveCount} inactivas</span>
        <span>{archivedCount} archivadas</span>
        <span>{mockTemplates.filter(t => t.requiresMifiel).length} requieren MiFiel</span>
        <span>{mockTemplates.filter(t => t.requiresKyc).length} requieren KYC</span>
        <span>{mockTemplates.filter(t => t.allowsPhysical).length} permiten firma física</span>
      </motion.div>

      {/* Create dialog */}
      <CreateTemplateDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function CreateTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[18px]">Nueva plantilla</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Define los datos iniciales de la nueva plantilla legal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Nombre de la plantilla</Label>
            <Input placeholder="Ej. Contrato de promesa de compraventa — Proyecto — Tipo" className="text-[13px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Categoría</Label>
              <Select>
                <SelectTrigger className="text-[13px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inmobiliario">Inmobiliario</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Corporativo">Corporativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Tipo de documento</Label>
              <Select>
                <SelectTrigger className="text-[13px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contrato</SelectItem>
                  <SelectItem value="agreement_letter">Convenio</SelectItem>
                  <SelectItem value="carta">Carta acuerdo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Proyecto</Label>
            <Select>
              <SelectTrigger className="text-[13px]"><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bottura">Bottura</SelectItem>
                <SelectItem value="Daiku">Daiku</SelectItem>
                <SelectItem value="Monócolo">Monócolo</SelectItem>
                <SelectItem value="Red de Agentes">Red de Agentes</SelectItem>
                <SelectItem value="Alianzas Inmobiliarias">Alianzas Inmobiliarias</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Descripción breve</Label>
            <Textarea placeholder="Describe el propósito de esta plantilla..." className="text-[13px] min-h-[60px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Base duplicada (opcional)</Label>
            <Select>
              <SelectTrigger className="text-[13px]"><SelectValue placeholder="Crear desde cero" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Crear desde cero</SelectItem>
                <SelectItem value="TPL-001">TPL-001 — Bottura PF</SelectItem>
                <SelectItem value="TPL-002">TPL-002 — Daiku PF</SelectItem>
                <SelectItem value="TPL-003">TPL-003 — Monócolo PF</SelectItem>
                <SelectItem value="TPL-004">TPL-004 — Agente inmobiliario</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onClose}>Crear plantilla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
