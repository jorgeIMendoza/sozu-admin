import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatoMoneda } from "../lib/formato";

/**
 * Campo de captura de un precio por metro cuadrado.
 *
 * Un precio por m² se lee en pesos, no como un número pelón: `95862.6` obliga a
 * contar cifras para saber si son noventa y cinco mil o novecientos cincuenta
 * mil. En reposo muestra `$95,862.60 /m²`; al enfocarlo cambia al número crudo,
 * que es lo único cómodo de teclear, y al salir vuelve a formatearse.
 *
 * Es `type="text"` a propósito: un `type="number"` no admite separadores de
 * miles ni el símbolo de moneda. La validación se hace al escribir, aceptando
 * solo dígitos y un separador decimal.
 */
export function CampoPrecioM2({
  valor,
  onChange,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  valor: number;
  onChange: (valor: number) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [enfocado, setEnfocado] = useState(false);
  const [borrador, setBorrador] = useState(String(valor ?? 0));

  // El valor puede cambiar desde fuera —al mover el precio base del proyecto se
  // recalculan todos los modelos—, y el campo tiene que reflejarlo salvo que se
  // esté escribiendo en él.
  useEffect(() => {
    if (!enfocado) setBorrador(String(valor ?? 0));
  }, [valor, enfocado]);

  return (
    <div className="relative inline-flex items-center">
      <Input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        value={enfocado ? borrador : `${formatoMoneda(valor ?? 0)} /m²`}
        onFocus={(e) => {
          setEnfocado(true);
          setBorrador(String(valor ?? 0));
          // Seleccionar todo evita tener que borrar el importe anterior a mano.
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          setEnfocado(false);
          const n = Number(borrador.replace(/,/g, ""));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        onChange={(e) => {
          const limpio = e.target.value.replace(/[^\d.]/g, "");
          // Un solo punto decimal: lo demás se descarta al vuelo.
          const partes = limpio.split(".");
          const normalizado =
            partes.length > 2 ? `${partes[0]}.${partes.slice(1).join("")}` : limpio;
          setBorrador(normalizado);
          const n = Number(normalizado);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        className={cn("tabular-nums", enfocado ? "text-left" : "text-right", className)}
      />
    </div>
  );
}
