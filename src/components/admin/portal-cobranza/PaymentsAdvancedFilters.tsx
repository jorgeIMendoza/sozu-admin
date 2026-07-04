import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { SlidersHorizontal } from 'lucide-react';
import { TipoMultiSelect } from '@/components/admin/portal-cobranza/CobranzaFilterSelects';

// Panel lateral de filtros avanzados de Relación de Pagos.
// Default (barra principal): Proyecto, Cliente, Unidad, Estatus.
// Avanzados (aquí): Tipo, Cuenta, CLABE. Un filtro nuevo = un <Field> más.

export interface PaymentsAdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  filterType: string[];   setFilterType: (v: string[]) => void;
  searchAccount: string;  setSearchAccount: (v: string) => void;
  searchClabe: string;    setSearchClabe: (v: string) => void;

  activeCount: number;
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

export function PaymentsAdvancedFilters({
  open, onOpenChange,
  filterType, setFilterType,
  searchAccount, setSearchAccount,
  searchClabe, setSearchClabe,
  activeCount, onClearAdvanced,
}: PaymentsAdvancedFiltersProps) {
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
            Filtros específicos de la relación de pagos. Los cambios se aplican al instante.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Tipo">
            <TipoMultiSelect value={filterType} onChange={setFilterType} className="w-full" />
          </Field>

          <Field label="Cuenta">
            <Input
              value={searchAccount}
              onChange={e => setSearchAccount(e.target.value)}
              placeholder="CC-000842"
              className="h-9 w-full text-sm font-mono"
            />
          </Field>

          <Field label="CLABE">
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
