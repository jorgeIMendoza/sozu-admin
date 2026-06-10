import { useState } from "react";
import {
  FileText,
  ChevronDown,
  User,
  Globe,
  Building2,
  Users,
  Check,
} from "lucide-react";

interface DocCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof User;
  documents: string[];
}

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "fisica_mexicana",
    label: "Persona física — Mexicana",
    description: "Ciudadano mexicano comprando a título personal",
    icon: User,
    documents: [
      "INE vigente (ambos lados)",
      "CURP",
      "Constancia de Situación Fiscal (CSF) del SAT",
      "Comprobante de domicilio reciente (no mayor a 3 meses)",
    ],
  },
  {
    id: "fisica_extranjera",
    label: "Persona física — Extranjera",
    description: "Extranjero residente o no residente en México",
    icon: Globe,
    documents: [
      "Pasaporte vigente",
      "Visa FM2 o FM3 (si aplica)",
      "Comprobante de domicilio (en México o en el extranjero)",
      "RFC con homoclave (si tiene actividad fiscal en México)",
    ],
  },
  {
    id: "persona_moral",
    label: "Persona moral",
    description: "Compra a nombre de una empresa o sociedad",
    icon: Building2,
    documents: [
      "Acta constitutiva de la sociedad",
      "Poder notarial del representante legal",
      "Constancia de Situación Fiscal (CSF) de la persona moral",
      "INE del representante legal",
      "Comprobante de domicilio fiscal",
    ],
  },
  {
    id: "copropiedad",
    label: "Copropiedad",
    description: "Compra entre dos personas físicas con porcentajes definidos",
    icon: Users,
    documents: [
      "INE vigente de ambos copropietarios",
      "CURP de ambos copropietarios",
      "CSF del SAT de ambos copropietarios",
      "Comprobante de domicilio de cada uno",
      "Acuerdo de copropiedad firmado (lo facilitamos como plantilla)",
    ],
  },
];

const DocumentosRequeridosCard = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground leading-tight">
              Documentos que vas a necesitar
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tenlos a la mano para cuando completes tu apartado. Los pedimos según el tipo
              de comprador que elijas.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {DOC_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isExpanded = expandedId === cat.id;
          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {cat.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 pt-1 bg-muted/10">
                  <ul className="space-y-2 pl-11">
                    {cat.documents.map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 mt-0.5 rounded border border-border bg-card flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-muted-foreground/40" />
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{doc}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-muted/20 border-t border-border">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          La validación de tu RFC con la CSF la haremos automáticamente. Los demás documentos
          los podrás cargar en tu expediente después del SPEI.
        </p>
      </div>
    </div>
  );
};

export default DocumentosRequeridosCard;
