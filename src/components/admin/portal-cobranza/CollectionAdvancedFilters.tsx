import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { SlidersHorizontal } from 'lucide-react';
import {
  PrioridadMultiSelect, InvalidosMultiSelect, EstatusPropiedadMultiSelect, ModeloMultiSelect,
} from '@/components/admin/portal-cobranza/CobranzaFilterSelects';

// Right-side advanced-filters panel for the Collection Inbox.
// The everyday filters (Project, Client, Unit, Type) live in the main bar; the
// rest live here to keep the view clean and let it scale.
//
// A new filter = one more <Field> block below. Nothing else to touch.

export interface CollectionAdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  filterPriority: string[];       setFilterPriority: (v: string[]) => void;
  filterInvalidLevel: string[];   setFilterInvalidLevel: (v: string[]) => void;
  filterStatus: string[];         setFilterStatus: (v: string[]) => void;
  searchAccount: string;          setSearchAccount: (v: string) => void;
  searchClabe: string;            setSearchClabe: (v: string) => void;
  filterModel: string[];          setFilterModel: (v: string[]) => void;

  /** Dynamic options (distinct from the DB). */
  statusOptions: string[];
  modelOptions: string[];

  /** Number of active advanced filters (for the external button/badge). */
  activeCount: number;
  /** Clears only the advanced filters (leaves Project/Client/Unit/Type). */
  onClearAdvanced: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-medium text-muted-foreground px-0.5">{label}</span>
      {children}
    </div>
  );
}

export function CollectionAdvancedFilters({
  open, onOpenChange,
  filterPriority, setFilterPriority,
  filterInvalidLevel, setFilterInvalidLevel,
  filterStatus, setFilterStatus,
  searchAccount, setSearchAccount,
  searchClabe, setSearchClabe,
  filterModel, setFilterModel,
  statusOptions, modelOptions,
  activeCount, onClearAdvanced,
}: CollectionAdvancedFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[380px] sm:max-w-[380px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-foreground" />
            Filtros avanzados
          </SheetTitle>
          <SheetDescription>
            Filtros específicos de las cuentas de cobranza. Los cambios se aplican al instante.
          </SheetDescription>
        </SheetHeader>

        {/* Single column. The panel is narrow (width = input + padding) so it
            looks clean. Order: Model, Status, Priority, Invalid payments,
            Account, CLABE. A new filter = one more <Field>. */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Modelo propiedad">
            <ModeloMultiSelect value={filterModel} onChange={setFilterModel} options={modelOptions} className="w-full" />
          </Field>

          <Field label="Estatus propiedad">
            <EstatusPropiedadMultiSelect value={filterStatus} onChange={setFilterStatus} options={statusOptions} className="w-full" />
          </Field>

          <Field label="Prioridad cuenta">
            <PrioridadMultiSelect value={filterPriority} onChange={setFilterPriority} className="w-full" />
          </Field>

          <Field label="Pagos inválidos">
            <InvalidosMultiSelect value={filterInvalidLevel} onChange={setFilterInvalidLevel} className="w-full" />
          </Field>

          <Field label="Cuenta cobranza">
            <Input
              value={searchAccount}
              onChange={e => setSearchAccount(e.target.value)}
              placeholder="842"
              className="h-9 w-full text-sm font-mono"
            />
          </Field>

          <Field label="Cuenta CLABE">
            <Input
              value={searchClabe}
              onChange={e => setSearchClabe(e.target.value)}
              placeholder="646180110400123456"
              className="h-9 w-full text-sm font-mono"
            />
          </Field>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAdvanced}
            disabled={activeCount === 0}
            className="text-[13px] text-muted-foreground disabled:opacity-40"
          >
            Limpiar avanzados
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="text-[13px]">
            Ver resultados
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
