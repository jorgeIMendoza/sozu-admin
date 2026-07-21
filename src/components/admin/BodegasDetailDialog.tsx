import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BodegaDetalle {
  id: number;
  nombre: string;
  m2: number;
  ubicacion: string;
  precio_m2: number | null;
  precio_final: number | null;
  es_incluido?: boolean;
}

interface BodegasDetailDialogProps {
  open: boolean;
  onClose: () => void;
  bodegas: BodegaDetalle[];
  propertyNumber: string;
}

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Componente para mostrar precio final con badge
const PrecioFinalBadge = ({ value, esIncluido }: { value: number | null; esIncluido?: boolean }) => {
  if (!esIncluido && (value === null || value === undefined)) {
    return <span className="text-muted-foreground">N/A</span>;
  }

  const shown = value ?? 0;
  const formattedValue = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(shown);

  // es_incluido = bodega incluida en el precio del depa → muestra su valor con la leyenda.
  if (esIncluido) {
    return (
      <div className="flex items-center gap-1">
        <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
          {formattedValue}
        </Badge>
        <span className="text-xs text-muted-foreground italic">(incluido en precio del depa)</span>
      </div>
    );
  }

  return (
    <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
      {formattedValue}
    </Badge>
  );
};

export const BodegasDetailDialog = ({
  open,
  onClose,
  bodegas,
  propertyNumber,
}: BodegasDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bodegas - Propiedad {propertyNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {bodegas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>M2</TableHead>
                  <TableHead>Precio por M2</TableHead>
                  <TableHead>Precio Final</TableHead>
                  <TableHead>Ubicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bodegas.map((bodega) => (
                  <TableRow key={bodega.id}>
                    <TableCell className="font-medium">
                      {bodega.nombre}
                    </TableCell>
                    <TableCell>{bodega.m2} m²</TableCell>
                    <TableCell>{formatCurrency(bodega.precio_m2)}</TableCell>
                    <TableCell><PrecioFinalBadge value={bodega.precio_final} esIncluido={bodega.es_incluido} /></TableCell>
                    <TableCell>{bodega.ubicacion || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No hay bodegas asignadas a esta propiedad.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
