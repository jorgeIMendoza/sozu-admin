import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TempBeneficiary {
  tempId: string;
  nombre_beneficiario: string;
  email: string;
  telefono: string;
  id_parentesco: string;
  porcentaje_participacion: string;
}

interface TempBeneficiariosSectionProps {
  beneficiaries: TempBeneficiary[];
  onBeneficiariesChange: (beneficiaries: TempBeneficiary[]) => void;
  personaNombre: string;
}

export function TempBeneficiariosSection({ beneficiaries, onBeneficiariesChange, personaNombre }: TempBeneficiariosSectionProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState({
    nombre_beneficiario: "",
    email: "",
    telefono: "",
    id_parentesco: "",
    porcentaje_participacion: ""
  });

  // Fetch parentescos
  const { data: parentescos = [] } = useQuery({
    queryKey: ['parentescos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parentescos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleAdd = () => {
    if (!newBeneficiary.nombre_beneficiario || !newBeneficiary.id_parentesco || !newBeneficiary.porcentaje_participacion) {
      toast({ title: "Por favor completa los campos requeridos", variant: "destructive" });
      return;
    }

    // Validate percentage
    const percentage = parseFloat(newBeneficiary.porcentaje_participacion);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast({ title: "El porcentaje debe ser un número entre 0.01 y 100", variant: "destructive" });
      return;
    }

    // Check if total percentage doesn't exceed 100%
    const totalPercentage = beneficiaries.reduce((sum, b) => sum + parseFloat(b.porcentaje_participacion), 0) + percentage;
    if (totalPercentage > 100) {
      toast({ title: `El porcentaje total no puede exceder 100%. Total actual: ${totalPercentage.toFixed(2)}%`, variant: "destructive" });
      return;
    }

    const tempBeneficiary: TempBeneficiary = {
      tempId: Date.now().toString(),
      ...newBeneficiary
    };

    onBeneficiariesChange([...beneficiaries, tempBeneficiary]);
    
    setNewBeneficiary({
      nombre_beneficiario: "",
      email: "",
      telefono: "",
      id_parentesco: "",
      porcentaje_participacion: ""
    });
    setIsAdding(false);
    toast({ title: "Beneficiario agregado temporalmente" });
  };

  const handleRemove = (tempId: string) => {
    onBeneficiariesChange(beneficiaries.filter(ben => ben.tempId !== tempId));
    toast({ title: "Beneficiario eliminado" });
  };

  const getParentescoName = (parentescoId: string) => {
    const parentesco = parentescos.find(p => p.id.toString() === parentescoId);
    return parentesco?.nombre || 'N/A';
  };

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + parseFloat(b.porcentaje_participacion || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Beneficiarios de {personaNombre}</h3>
          <p className="text-sm text-muted-foreground">
            Porcentaje total asignado: {totalPercentage.toFixed(2)}%
            {totalPercentage < 100 && (
              <span className="text-orange-500 ml-2">
                (Falta: {(100 - totalPercentage).toFixed(2)}%)
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          disabled={isAdding || totalPercentage >= 100}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Beneficiario
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Beneficiario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre_beneficiario">Nombre del Beneficiario *</Label>
                <Input
                  id="nombre_beneficiario"
                  value={newBeneficiary.nombre_beneficiario}
                  onChange={(e) => setNewBeneficiary(prev => ({ ...prev, nombre_beneficiario: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newBeneficiary.email}
                  onChange={(e) => setNewBeneficiary(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={newBeneficiary.telefono}
                  onChange={(e) => setNewBeneficiary(prev => ({ ...prev, telefono: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="id_parentesco">Parentesco *</Label>
                <Select 
                  value={newBeneficiary.id_parentesco} 
                  onValueChange={(value) => setNewBeneficiary(prev => ({ ...prev, id_parentesco: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un parentesco" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentescos.map((parentesco) => (
                      <SelectItem key={parentesco.id} value={parentesco.id.toString()}>
                        {parentesco.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="porcentaje_participacion">
                  Porcentaje de Participación (%) * 
                  <span className="text-sm text-muted-foreground ml-1">
                    (Disponible: {(100 - totalPercentage).toFixed(2)}%)
                  </span>
                </Label>
                <Input
                  id="porcentaje_participacion"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={100 - totalPercentage}
                  value={newBeneficiary.porcentaje_participacion}
                  onChange={(e) => setNewBeneficiary(prev => ({ ...prev, porcentaje_participacion: e.target.value }))}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={handleAdd}>
                  Agregar
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {beneficiaries.map((beneficiary) => (
          <Card key={beneficiary.tempId}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p><strong>Nombre:</strong> {beneficiary.nombre_beneficiario}</p>
                  {beneficiary.email && (
                    <p><strong>Email:</strong> {beneficiary.email}</p>
                  )}
                  {beneficiary.telefono && (
                    <p><strong>Teléfono:</strong> {beneficiary.telefono}</p>
                  )}
                  <p><strong>Parentesco:</strong> {getParentescoName(beneficiary.id_parentesco)}</p>
                  <p><strong>Porcentaje:</strong> {beneficiary.porcentaje_participacion}%</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemove(beneficiary.tempId)}
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {beneficiaries.length === 0 && !isAdding && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No hay beneficiarios registrados</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}