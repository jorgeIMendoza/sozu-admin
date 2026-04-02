import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

export interface Tramo {
  orden: number;
  numero_mensualidades: number;
}

interface TramosEscalonadosSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  tramos: Tramo[];
  onTramosChange: (tramos: Tramo[]) => void;
  totalMensualidades: number;
  visible: boolean;
}

export const TramosEscalonadosSection = ({
  enabled,
  onEnabledChange,
  tramos,
  onTramosChange,
  totalMensualidades,
  visible,
}: TramosEscalonadosSectionProps) => {
  if (!visible) return null;

  const sumTramos = tramos.reduce((sum, t) => sum + (t.numero_mensualidades || 0), 0);
  const isValid = sumTramos === totalMensualidades;
  const remaining = totalMensualidades - sumTramos;

  const addTramo = () => {
    if (tramos.length >= 3) return;
    const newTramo: Tramo = {
      orden: tramos.length + 1,
      numero_mensualidades: remaining > 0 ? remaining : 0,
    };
    onTramosChange([...tramos, newTramo]);
  };

  const removeTramo = (index: number) => {
    const updated = tramos
      .filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, orden: i + 1 }));
    onTramosChange(updated);
  };

  const updateTramo = (index: number, value: number) => {
    const updated = tramos.map((t, i) =>
      i === index ? { ...t, numero_mensualidades: value } : t
    );
    onTramosChange(updated);
  };

  const handleToggle = (checked: boolean) => {
    onEnabledChange(checked);
    if (checked && tramos.length === 0) {
      // Auto-create 2 tramos splitting evenly
      const half = Math.floor(totalMensualidades / 2);
      onTramosChange([
        { orden: 1, numero_mensualidades: half },
        { orden: 2, numero_mensualidades: totalMensualidades - half },
      ]);
    }
    if (!checked) {
      onTramosChange([]);
    }
  };

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          Mensualidades escalonadas
          {enabled && (
            <Badge variant="outline" className="text-xs">
              {tramos.length} tramo{tramos.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </Label>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Divide las {totalMensualidades} mensualidades en bloques. La suma debe ser igual al total.
          </p>

          {tramos.map((tramo, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                Tramo {tramo.orden}:
              </span>
              <Input
                type="number"
                min="1"
                max={totalMensualidades}
                value={tramo.numero_mensualidades || ""}
                onChange={(e) => updateTramo(index, parseInt(e.target.value) || 0)}
                className="h-8"
                placeholder="Mensualidades"
              />
              <span className="text-xs text-muted-foreground shrink-0">meses</span>
              {tramos.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => removeTramo(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between">
            {tramos.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addTramo}
              >
                <Plus className="h-3 w-3 mr-1" />
                Agregar tramo
              </Button>
            )}
            <div className="ml-auto">
              <Badge variant={isValid ? "default" : "destructive"} className="text-xs">
                {sumTramos}/{totalMensualidades} meses
              </Badge>
            </div>
          </div>

          {!isValid && sumTramos > 0 && (
            <p className="text-xs text-destructive">
              {remaining > 0
                ? `Faltan ${remaining} mensualidades por asignar.`
                : `Excede por ${Math.abs(remaining)} mensualidades.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
