import { Construction } from 'lucide-react';

export function JuridicoAdministrar() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center max-w-sm w-full">
        <div className="flex items-center justify-center mb-5">
          <Construction className="w-14 h-14 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Administrar Jurídico</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Esta sección está en desarrollo y estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
