import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Comprador {
  nombre_legal: string;
  rfc: string | null;
  porcentaje_copropiedad: number;
}

interface CompradoresDetailDialogProps {
  compradores: Comprador[];
  trigger?: React.ReactNode;
}

export function CompradoresDetailDialog({ compradores, trigger }: CompradoresDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigateToCompradores = () => {
    navigate('/admin/compradores');
    setOpen(false);
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Users className="h-4 w-4 mr-1" />
      Ver {compradores.length} compradores
    </Button>
  );

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(2)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalle de Compradores</DialogTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNavigateToCompradores}
              className="ml-4"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver Listado Completo
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Total de compradores: {compradores.length}
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RFC</TableHead>
                <TableHead className="text-right">% Copropiedad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compradores.map((comprador, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{comprador.nombre_legal}</TableCell>
                  <TableCell>
                    {comprador.rfc ? (
                      <Badge variant="outline">{comprador.rfc}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Sin RFC</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPercentage(comprador.porcentaje_copropiedad)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Verificación del 100% */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Total:</span>
            <span className="font-bold">
              {formatPercentage(compradores.reduce((sum, c) => sum + c.porcentaje_copropiedad, 0))}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}