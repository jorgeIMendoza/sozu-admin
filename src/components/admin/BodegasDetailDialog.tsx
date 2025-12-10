import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BodegaDetalle {
  id: number;
  nombre: string;
  m2: number;
  ubicacion: string;
  precio_m2: number | null;
  precio_final: number | null;
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
                    <TableCell>{formatCurrency(bodega.precio_final)}</TableCell>
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
