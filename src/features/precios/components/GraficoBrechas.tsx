/**
 * Barras horizontales divergentes de brecha de política, en puntos
 * porcentuales (SVG plano). El valor recibido es la brecha en fracción
 * decimal; se grafica multiplicada por 100 para que coincida exactamente con
 * la fila "Brecha" de la matriz del comparador.
 */
export function GraficoBrechas({
  datos,
}: {
  datos: Array<{ nombre: string; brecha: number }>;
}) {
  if (datos.length === 0) return null;

  const alturaBarra = 24;
  const separacion = 12;
  const paso = alturaBarra + separacion;
  const etiqueta = 210;
  const margenDerecho = 70;
  const w = 700;
  const topeSuperior = 8;
  const ejeAlto = 28;
  const h = datos.length * paso + topeSuperior + ejeAlto;

  // Puntos porcentuales, no fracción decimal.
  const puntosDatos = datos.map((d) => ({ nombre: d.nombre, pts: d.brecha * 100 }));

  const maxAbs = Math.max(...puntosDatos.map((d) => Math.abs(d.pts)), 0);
  const dominio = Math.max(1, Math.ceil(maxAbs * 1.15));

  const anchoTrazo = w - etiqueta - margenDerecho;
  const centro = etiqueta + anchoTrazo / 2;
  const escala = anchoTrazo / 2 / dominio;
  const yEje = datos.length * paso + topeSuperior;

  const marcas: number[] = [];
  for (let v = -dominio; v <= dominio; v += 1) marcas.push(v);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ height: h }}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Brecha entre la política aplicada y el valor presente, en puntos porcentuales"
      >
        {marcas.map((v) => (
          <g key={`m-${v}`}>
            <line
              x1={centro + v * escala}
              x2={centro + v * escala}
              y1={yEje}
              y2={yEje + 4}
              stroke="#d4d4d4"
              strokeWidth={1}
            />
            <text
              x={centro + v * escala}
              y={yEje + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {v > 0 ? `+${v}` : String(v)}
            </text>
          </g>
        ))}

        <line
          x1={etiqueta}
          x2={w - margenDerecho}
          y1={yEje}
          y2={yEje}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
        <line
          x1={centro}
          x2={centro}
          y1={topeSuperior - 4}
          y2={yEje}
          stroke="#575757"
          strokeWidth={1}
        />

        {puntosDatos.map((d, i) => {
          const y = topeSuperior + i * paso;
          const ancho = Math.max(1, Math.abs(d.pts) * escala);
          const x = d.pts >= 0 ? centro : centro - ancho;
          return (
            <g key={d.nombre}>
              <text
                x={etiqueta - 12}
                y={y + alturaBarra / 2 + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {d.nombre.length > 30 ? `${d.nombre.slice(0, 29)}…` : d.nombre}
              </text>
              <rect
                x={x}
                y={y}
                width={ancho}
                height={alturaBarra}
                rx={2}
                fill={d.pts >= 0 ? "#059669" : "#dc2626"}
              />
              <text
                x={d.pts >= 0 ? x + ancho + 8 : x - 8}
                y={y + alturaBarra / 2 + 4}
                textAnchor={d.pts >= 0 ? "start" : "end"}
                className="fill-foreground text-[11px] tabular-nums"
              >
                {`${d.pts > 0 ? "+" : d.pts < 0 ? "−" : ""}${Math.abs(d.pts).toFixed(2)} pts`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
