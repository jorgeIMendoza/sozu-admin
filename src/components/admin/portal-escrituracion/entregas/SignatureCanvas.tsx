import { useState, useRef } from 'react';
import { RotateCcw } from 'lucide-react';

export function SignatureCanvas({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b'; ctx.lineTo(x, y); ctx.stroke();
    setHasSignature(true);
  };

  const end = () => {
    drawing.current = false;
    const c = canvasRef.current;
    if (c && hasSignature) onChange(c.toDataURL());
  };

  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasSignature(false); onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={440}
        height={140}
        className="w-full border-2 border-dashed border-slate-200 rounded-2xl bg-white cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Dibuja tu firma en el área de arriba</p>
        <button
          onClick={clear}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Limpiar
        </button>
      </div>
    </div>
  );
}
