import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PropertyCharacteristicsSectionProps {
  propertyId: number;
}

export function PropertyCharacteristicsSection({ propertyId }: PropertyCharacteristicsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingCharacteristic, setIsAddingCharacteristic] = useState(false);
  const [newCharacteristicName, setNewCharacteristicName] = useState("");
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>([]);

  // Fetch available characteristics (only enabled ones)
  const { data: availableCharacteristics = [] } = useQuery({
    queryKey: ['availableCharacteristics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caracteristicas')
        .select('*')
        .eq('activo', true)
        .eq('habilitar_asignar', true)
        .order('nombre');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch property's current characteristics
  const { data: propertyCharacteristics = [] } = useQuery({
    queryKey: ['propertyCharacteristics', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propiedades_caracteristicas')
        .select(`
          *,
          caracteristicas (
            id,
            nombre
          )
        `)
        .eq('id_propiedad', propertyId)
        .eq('activo', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!propertyId
  });

  // Mutation to add new characteristic
  const addCharacteristicMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('caracteristicas')
        .insert([{
          nombre: name,
          habilitar_asignar: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableCharacteristics'] });
      setNewCharacteristicName("");
      setIsAddingCharacteristic(false);
      toast({ title: "Característica agregada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al agregar característica", variant: "destructive" });
    }
  });

  // Mutation to update property characteristics
  const updateCharacteristicsMutation = useMutation({
    mutationFn: async (characteristicIds: string[]) => {
      // First, deactivate all existing characteristics for this property
      const { error: deactivateError } = await supabase
        .from('propiedades_caracteristicas')
        .update({ activo: false })
        .eq('id_propiedad', propertyId);
      
      if (deactivateError) throw deactivateError;

      // Then, add/reactivate selected characteristics
      for (const characteristicId of characteristicIds) {
        // Check if relationship already exists
        const { data: existing } = await supabase
          .from('propiedades_caracteristicas')
          .select('id')
          .eq('id_propiedad', propertyId)
          .eq('id_caracteristica', parseInt(characteristicId))
          .single();

        if (existing) {
          // Reactivate existing relationship
          const { error } = await supabase
            .from('propiedades_caracteristicas')
            .update({ activo: true })
            .eq('id', existing.id);
          
          if (error) throw error;
        } else {
          // Create new relationship
          const { error } = await supabase
            .from('propiedades_caracteristicas')
            .insert([{
              id_propiedad: propertyId,
              id_caracteristica: parseInt(characteristicId)
            }]);
          
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propertyCharacteristics', propertyId] });
      toast({ title: "Características actualizadas exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar características", variant: "destructive" });
    }
  });

  // Get currently selected characteristic IDs
  React.useEffect(() => {
    if (propertyCharacteristics) {
      const currentIds = propertyCharacteristics.map(pc => pc.id_caracteristica.toString());
      setSelectedCharacteristics(currentIds);
    }
  }, [propertyCharacteristics]);

  const handleCharacteristicToggle = (characteristicId: string, checked: boolean) => {
    let newSelected;
    if (checked) {
      newSelected = [...selectedCharacteristics, characteristicId];
    } else {
      newSelected = selectedCharacteristics.filter(id => id !== characteristicId);
    }
    setSelectedCharacteristics(newSelected);
    updateCharacteristicsMutation.mutate(newSelected);
  };

  const handleAddNewCharacteristic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacteristicName.trim()) {
      toast({ title: "Por favor ingresa un nombre para la característica", variant: "destructive" });
      return;
    }
    addCharacteristicMutation.mutate(newCharacteristicName.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Características de la Propiedad</h3>
        <Button
          onClick={() => setIsAddingCharacteristic(true)}
          disabled={isAddingCharacteristic}
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Característica
        </Button>
      </div>

      {isAddingCharacteristic && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva Característica</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNewCharacteristic} className="space-y-4">
              <div>
                <Label htmlFor="characteristic-name">Nombre de la Característica</Label>
                <Input
                  id="characteristic-name"
                  type="text"
                  value={newCharacteristicName}
                  onChange={(e) => setNewCharacteristicName(e.target.value)}
                  placeholder="Ej. Balcón, Terraza, etc."
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={addCharacteristicMutation.isPending}>
                  {addCharacteristicMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddingCharacteristic(false);
                    setNewCharacteristicName("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Características</CardTitle>
        </CardHeader>
        <CardContent>
          {availableCharacteristics.length === 0 ? (
            <p className="text-muted-foreground">No hay características disponibles</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCharacteristics.map((characteristic) => (
                <div key={characteristic.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`characteristic-${characteristic.id}`}
                    checked={selectedCharacteristics.includes(characteristic.id.toString())}
                    onCheckedChange={(checked) => 
                      handleCharacteristicToggle(characteristic.id.toString(), checked as boolean)
                    }
                    disabled={updateCharacteristicsMutation.isPending}
                  />
                  <Label 
                    htmlFor={`characteristic-${characteristic.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {characteristic.nombre}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {propertyCharacteristics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Características Asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {propertyCharacteristics.map((pc: any) => (
                <Badge key={pc.id} variant="secondary">
                  {pc.caracteristicas.nombre}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}