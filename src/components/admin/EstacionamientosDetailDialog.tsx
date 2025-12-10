import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EstacionamientoDetalle {
  id: number;
  nombre: string;
  tipo_nombre: string;
  m2: number;
  ubicacion: string;
  precio_m2: number | null;
  precio_final: number | null;
}

interface EstacionamientosDetailDialogProps {
  open: boolean;
  onClose: () => void;
  estacionamientos: EstacionamientoDetalle[];
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

export const EstacionamientosDetailDialog = ({
  open,
  onClose,
  estacionamientos,
  propertyNumber,
}: EstacionamientosDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estacionamientos - Propiedad {propertyNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {estacionamientos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>M2</TableHead>
                  <TableHead>Precio por M2</TableHead>
                  <TableHead>Precio Final</TableHead>
                  <TableHead>Ubicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estacionamientos.map((estacionamiento) => (
                  <TableRow key={estacionamiento.id}>
                    <TableCell className="font-medium">
                      {estacionamiento.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{estacionamiento.tipo_nombre}</Badge>
                    </TableCell>
                    <TableCell>{estacionamiento.m2} m²</TableCell>
                    <TableCell>{formatCurrency(estacionamiento.precio_m2)}</TableCell>
                    <TableCell>{formatCurrency(estacionamiento.precio_final)}</TableCell>
                    <TableCell>{estacionamiento.ubicacion || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No hay estacionamientos asignados a esta propiedad.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
