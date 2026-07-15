import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, FileImage, Loader2 } from "lucide-react";

interface PlanosPropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idEdificio: number | null;
  idEdificioModelo: number | null;
  numeroPropiedad: string;
  numeroPiso: number | null;
  edificio: string;
  modelo: string;
}

const resolveDepto = (unidad: string, piso: number | null): string => {
  const raw = (unidad || "").toString().trim();
  const digits = raw.replace(/\D/g, "");
  const pisoDigits = (piso?.toString() || "").replace(/\D/g, "");

  if (digits.length > 0 && pisoDigits.length > 0 && digits.startsWith(pisoDigits) && digits.length > pisoDigits.length) {
    const extracted = digits.slice(pisoDigits.length);
    return extracted.length === 1 ? extracted.padStart(2, "0") : extracted;
  }

  const fallback = digits.slice(-2) || digits;
  return fallback.length === 1 ? fallback.padStart(2, "0") : fallback || raw;
};

export const FloorPlanCanvas = ({
  imageUrl,
  regiones,
  highlightUnit,
  fullPropertyNumber,
}: {
  imageUrl: string;
  regiones: any[];
  highlightUnit: string;
  fullPropertyNumber?: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; setImageLoaded(true); };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imgRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imgRef.current;
    const containerWidth = containerRef.current.clientWidth;
    const scale = containerWidth / img.width;
    const canvasHeight = img.height * scale;
    canvas.width = containerWidth;
    canvas.height = canvasHeight;
    ctx.drawImage(img, 0, 0, containerWidth, canvasHeight);

    if (regiones && regiones.length > 0 && (highlightUnit || fullPropertyNumber)) {
      const digitsOnly = (v: string) => v.replace(/\D/g, "");
      const normalize = (v: string) => { const t = v.trim(); return t.replace(/^0+/, "") || "0"; };

      const hRaw = (highlightUnit || "").trim();
      const hDigits = digitsOnly(hRaw);
      const fRaw = (fullPropertyNumber || "").trim();
      const fDigits = digitsOnly(fRaw);
      const inferred = fDigits ? (hDigits && fDigits.endsWith(hDigits) ? hDigits : fDigits.slice(-2) || fDigits) : "";
      const padTwo = (v: string) => { const d = digitsOnly(v); return d.length === 1 ? d.padStart(2, "0") : ""; };

      const exact = new Set([hRaw, hDigits, inferred, fRaw, fDigits, padTwo(hRaw), padTwo(hDigits), padTwo(inferred)].map(v => v.trim()).filter(Boolean));
      const norm = new Set(Array.from(exact).map(v => normalize(v)).filter(Boolean));

      const polyArea = (p: number[][]) => {
        if (!p || p.length < 3) return 0;
        let a = 0;
        for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i]; const [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
        return Math.abs(a / 2);
      };

      const scored = regiones.map((r: any) => {
        const uRaw = (r.unit_number || "").toString().trim();
        const uDigits = digitsOnly(uRaw);
        const uNorm = normalize(uRaw);
        let score = 0;
        if (exact.has(uRaw)) score = 300;
        if (uDigits && exact.has(uDigits)) score = Math.max(score, 285);
        if (uNorm && norm.has(uNorm)) score = Math.max(score, 270);
        return { region: r, score, area: polyArea(r.polygon || []) };
      });

      const sel = scored.filter(e => e.score > 0).sort((a, b) => (b.score - a.score) || (b.area - a.area))[0];

      if (sel?.region?.polygon?.length >= 3) {
        const points = sel.region.polygon.map((p: number[]) => [(p[0] / 100) * containerWidth, (p[1] / 100) * canvasHeight] as [number, number]);
        const curves = sel.region.curves || {};
        const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
        const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
        const exp = 1.04;
        const ep = points.map(([x, y]) => [cx + (x - cx) * exp, cy + (y - cy) * exp] as [number, number]);

        ctx.beginPath();
        ctx.moveTo(ep[0][0], ep[0][1]);
        for (let i = 0; i < ep.length; i++) {
          const ni = (i + 1) % ep.length;
          const cp = curves[String(i)];
          if (cp) {
            const cpx = cx + (((cp[0] / 100) * containerWidth) - cx) * exp;
            const cpy = cy + (((cp[1] / 100) * canvasHeight) - cy) * exp;
            ctx.quadraticCurveTo(cpx, cpy, ep[ni][0], ep[ni][1]);
          } else {
            ctx.lineTo(ep[ni][0], ep[ni][1]);
          }
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(34, 197, 94, 0.32)";
        ctx.fill();
        ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }, [imageLoaded, regiones, highlightUnit, fullPropertyNumber]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg" />
    </div>
  );
};

export const PlanosPropertyModal = ({
  open,
  onOpenChange,
  idEdificio,
  idEdificioModelo,
  numeroPropiedad,
  numeroPiso,
  edificio,
  modelo,
}: PlanosPropertyModalProps) => {
  const depto = resolveDepto(numeroPropiedad, numeroPiso);

  // Fetch plano de ubicación
  const { data: planoUbicacion, isLoading: loadingUbicacion } = useQuery({
    queryKey: ["plano-ubicacion-modal", idEdificio, numeroPiso],
    queryFn: async () => {
      if (!idEdificio || !numeroPiso) return null;
      const { data } = await supabase
        .from("edificios_niveles_planos" as any)
        .select("imagen_url, regiones")
        .eq("id_edificio", idEdificio)
        .eq("nivel", numeroPiso)
        .eq("activo", true)
        .maybeSingle();
      return data as unknown as { imagen_url: string; regiones: any[] } | null;
    },
    enabled: open && !!idEdificio && !!numeroPiso,
  });

  // Fetch plano arquitectónico
  const { data: planoArq, isLoading: loadingArq } = useQuery({
    queryKey: ["plano-arq-modal", idEdificioModelo, numeroPiso, depto],
    queryFn: async () => {
      if (!idEdificioModelo || !numeroPiso) return null;
      const { data: planes } = await supabase
        .from("modelos_planos_arquitectonicos" as any)
        .select("imagen_url, departamentos")
        .eq("id_edificio_modelo", idEdificioModelo)
        .eq("nivel", numeroPiso)
        .eq("activo", true);
      if (!planes || planes.length === 0) return null;
      const norm = (v: string) => v.replace(/^0+/, "") || "0";
      const match = (planes as any[]).find((p: any) => {
        const depts: string[] = Array.isArray(p.departamentos) ? p.departamentos : [];
        return depts.some(d => d === depto || norm(d) === norm(depto));
      });
      return match ? { imagen_url: (match as any).imagen_url } : null;
    },
    enabled: open && !!idEdificioModelo && !!numeroPiso,
  });

  const isLoading = loadingUbicacion || loadingArq;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Planos — {edificio} / {modelo} / Unidad {numeroPropiedad}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Nivel {numeroPiso} — Depto. {depto}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="ubicacion" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="ubicacion" className="flex-1 text-xs">
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Ubicación
              </TabsTrigger>
              <TabsTrigger value="arquitectonico" className="flex-1 text-xs">
                <FileImage className="h-3.5 w-3.5 mr-1.5" />
                Arquitectónico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ubicacion" className="mt-3">
              {planoUbicacion?.imagen_url ? (
                <FloorPlanCanvas
                  imageUrl={planoUbicacion.imagen_url}
                  regiones={planoUbicacion.regiones || []}
                  highlightUnit={depto}
                  fullPropertyNumber={numeroPropiedad}
                />
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No hay plano de ubicación configurado para este nivel
                </div>
              )}
            </TabsContent>

            <TabsContent value="arquitectonico" className="mt-3">
              {planoArq?.imagen_url ? (
                <img
                  src={planoArq.imagen_url}
                  alt="Plano arquitectónico"
                  className="w-full rounded-lg"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <FileImage className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No hay plano arquitectónico configurado para esta unidad
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
