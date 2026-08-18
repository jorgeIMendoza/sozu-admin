import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de captura de un importe en pesos.
 *
 * Un precio de lista tecleado como `10000000` obliga a contar ceros para saber
 * si son diez millones o cien mil, y ese error no lo cacha ninguna validación:
 * el activo se guarda con el precio equivocado. En reposo se muestra
 * `$10,000,000.00`; al enfocarlo cambia al número crudo, que es lo único cómodo
 * de teclear, y al salir vuelve a formatearse.
 *
 * Es `type="text"` a propósito: un `type="number"` no admite separadores de
 * miles ni el símbolo de moneda. La entrada se filtra a dígitos con un solo
 * separador decimal.
 *
 * El valor viaja como cadena porque así lo consume el payload del RPC, que hace
 * `NULLIF(...,'')::numeric`: una cadena vacía significa "sin capturar", que no
 * es lo mismo que cero.
 */
export function CampoMoneda({
  valor,
  onChange,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  valor: string | number | null | undefined;
  onChange: (valor: string) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const crudo = valor == null ? "" : String(valor);
  const [enfocado, setEnfocado] = useState(false);
  const [borrador, setBorrador] = useState(crudo);

  useEffect(() => {
    if (!enfocado) setBorrador(crudo);
  }, [crudo, enfocado]);

  const n = Number(crudo);
  const formateado =
    crudo === "" || !Number.isFinite(n)
      ? ""
      : `$${n.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      placeholder="$0.00"
      value={enfocado ? borrador : formateado}
      onFocus={(e) => {
        setEnfocado(true);
        setBorrador(crudo);
        requestAnimationFrame(() => e.target.select());
      }}
      onBlur={() => setEnfocado(false)}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d.]/g, "");
        const partes = limpio.split(".");
        const normalizado =
          partes.length > 2 ? `${partes[0]}.${partes.slice(1).join("")}` : limpio;
        setBorrador(normalizado);
        onChange(normalizado);
      }}
      className={cn("tabular-nums", className)}
    />
  );
}
