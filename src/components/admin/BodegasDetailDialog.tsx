import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BodegaDetalle {
  id: number;
  nombre: string;
  m2: number;
  ubicacion: string;
  es_incluido: boolean;
}

interface BodegasDetailDialogProps {
  open: boolean;
  onClose: () => void;
  bodegas: BodegaDetalle[];
  propertyNumber: string;
}

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
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Incluido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bodegas.map((bodega) => (
                  <TableRow key={bodega.id}>
                    <TableCell className="font-medium">
                      {bodega.nombre}
                    </TableCell>
                    <TableCell>{bodega.m2} m²</TableCell>
                    <TableCell>{bodega.ubicacion || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={bodega.es_incluido ? "default" : "secondary"}>
                        {bodega.es_incluido ? "Incluido" : "No incluido"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay bodegas asignadas a esta propiedad.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};