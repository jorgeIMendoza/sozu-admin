import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { CATEGORIAS, PROPIETARIOS, PROYECTOS } from '@/lib/portal-productos/types';

export function GlobalFiltersBar({ showExport = false, showRango = true }: { showExport?: boolean; showRango?: boolean }) {
  const filtros = usePortalProductosStore(s => s.filtros);
  const setFiltros = usePortalProductosStore(s => s.setFiltros);
  const resetFiltros = usePortalProductosStore(s => s.resetFiltros);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <Select value={filtros.proyecto} onValueChange={v => setFiltros({ proyecto: v as never })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Proyecto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {PROYECTOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filtros.propietario} onValueChange={v => setFiltros({ propietario: v as never })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Propietario" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los propietarios</SelectItem>
          {PROPIETARIOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filtros.categoria} onValueChange={v => setFiltros({ categoria: v as never })}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      {showRango && (
        <Select value={String(filtros.rangoMeses)} onValueChange={v => setFiltros({ rangoMeses: Number(v) })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Rango" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Todo el periodo</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
            <SelectItem value="24">Últimos 24 meses</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Button variant="ghost" size="sm" onClick={resetFiltros} className="text-slate-600">
        <X className="h-4 w-4" /> Limpiar filtros
      </Button>
      {showExport && (
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.success('Exportación simulada a Excel')}>
          <Download className="h-4 w-4" /> Exportar a Excel
        </Button>
      )}
    </div>
  );
}