import { cn } from "@/lib/utils";

/** Avatar del colaborador. La fotografía es el estado por defecto;
 *  las iniciales son únicamente fallback cuando no hay imagen. */
// SWAP POINT: supabase.usuarios.foto_url
export function AvatarColaborador({
  nombre,
  foto,
  className,
  enmascarado = false,
}: {
  nombre: string;
  foto?: string | null;
  className?: string;
  enmascarado?: boolean;
}) {
  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  if (foto && !enmascarado) {
    return (
      <img
        src={foto}
        alt={`Fotografía de ${nombre}`}
        loading="lazy"
        width={512}
        height={512}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-verde-claro text-xs font-bold text-verde-oscuro",
        className,
      )}
    >
      {enmascarado ? "••" : iniciales}
    </span>
  );
}
