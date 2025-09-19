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
  es_incluido: boolean;
}

interface EstacionamientosDetailDialogProps {
  open: boolean;
  onClose: () => void;
  estacionamientos: EstacionamientoDetalle[];
  propertyNumber: string;
}

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
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Incluido</TableHead>
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
                    <TableCell>{estacionamiento.ubicacion || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={estacionamiento.es_incluido ? "default" : "secondary"}>
                        {estacionamiento.es_incluido ? "Incluido" : "No incluido"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay estacionamientos asignados a esta propiedad.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};