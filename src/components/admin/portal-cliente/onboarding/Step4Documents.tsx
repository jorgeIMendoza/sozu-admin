import { DocumentUploader } from "./DocumentUploader";
import { Button } from "@/components/ui/button";
import {
  usePortal,
  requiredDocsFor,
  type PurchaseType,
  type PurchaseRecency,
} from "@/lib/portal-cliente/onboarding-store";
import { CheckCircle2, Clock, Info, ShieldCheck, Trash2 } from "lucide-react";

type Requirement = "obligatorio" | "opcional" | "condicional";

function RequirementChip({ level }: { level: Requirement }) {
  const map: Record<Requirement, string> = {
    obligatorio: "bg-primary/10 text-primary border-primary/30",
    opcional: "bg-muted text-muted-foreground border-border",
    condicional: "bg-state-pending/10 text-state-pending border-state-pending/30",
  };
  const label: Record<Requirement, string> = {
    obligatorio: "Obligatorio",
    opcional: "Opcional",
    condicional: "Condicional",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[level]}`}
    >
      {label[level]}
    </span>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            value === o.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Step4Documents() {
  const personType = usePortal((s) => s.onboarding.personType);
  const onboarding = usePortal((s) => s.onboarding);
  const setOnb = usePortal((s) => s.setOnboarding);
  const removeDoc = usePortal((s) => s.removeDoc);

  const { purchaseType, purchaseRecency, rppInTramite } = onboarding;
  const isCredito = purchaseType === "credito";
  const isReciente = purchaseRecency === "reciente";

  const rppDoc = onboarding.docs.find((d) => d.type === "certificado_rpp");
  const rppUploaded = !!rppDoc;

  function markInTramite() {
    if (rppDoc) removeDoc(rppDoc.id);
    // SWAP POINT: alta de solicitud de "en trámite de inscripción" al área legal.
    setOnb({ rppInTramite: true });
  }
  function undoInTramite() {
    setOnb({ rppInTramite: false });
  }

  const isMoral = personType === "moral";
  const titularNoun = isMoral ? "la razón social" : "tu nombre";

  // Header + calificador — comunes a ambas variantes
  const Header = (
    <>
      <header>
        <h2 className="text-xl font-semibold">Validación de titularidad</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube tus documentos. Extraemos los datos automáticamente para que solo tengas que
          confirmarlos. Ningún documento se aprueba solo: son evidencia para el área legal.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-secondary/30 p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Cuéntanos cómo fue tu compra
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">¿Cómo compraste?</div>
            <SegmentedToggle<PurchaseType>
              value={purchaseType}
              onChange={(v) => setOnb({ purchaseType: v })}
              options={[
                { key: "contado", label: "De contado" },
                { key: "credito", label: "Con crédito hipotecario" },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">¿Hace cuánto compraste?</div>
            <SegmentedToggle<PurchaseRecency>
              value={purchaseRecency}
              onChange={(v) => setOnb({ purchaseRecency: v })}
              options={[
                { key: "reciente", label: "Menos de 6 meses" },
                { key: "antiguo", label: "Más de 6 meses" },
              ]}
            />
          </div>
        </div>
        {(isCredito || isReciente) && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              {isCredito && (
                <div>
                  Con crédito hipotecario, es normal que tu certificado del RPP muestre la
                  hipoteca como gravamen (el titular registral es {titularNoun}). No te
                  descalifica.
                </div>
              )}
              {isReciente && (
                <div className={isCredito ? "mt-1" : ""}>
                  En compras recientes, el predial y la inscripción registral pueden aún no
                  estar a nombre de {isMoral ? "la empresa" : "ti"}. Es normal.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  const RppSection = (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <RequirementChip level="obligatorio" />
        <span className="text-[11px] text-muted-foreground">
          Se resuelve subiéndolo, con "SOZU lo gestiona" o marcando "en trámite".
        </span>
      </div>

      {!rppInTramite && <DocumentUploader type="certificado_rpp" allowManagedBySozu />}

      {rppInTramite && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Certificado del RPP (inscripción / titularidad)
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Marcado como en trámite de inscripción.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-state-review/30 bg-state-review/10 px-2 py-0.5 text-xs font-medium text-state-review">
              <Clock className="h-3 w-3" />
              En revisión
            </span>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            El área legal verificará el avance de tu inscripción en el RPP de Jalisco usando
            el folio real de tu escritura.
            {/* SWAP POINT: alta de caso "en trámite de inscripción". */}
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={undoInTramite}>
                <Trash2 className="mr-1 h-3 w-3" /> Deshacer
              </Button>
            </div>
          </div>
        </div>
      )}

      {!rppInTramite && !rppUploaded && isReciente && (
        <button
          type="button"
          onClick={markInTramite}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-xs font-medium text-primary transition hover:bg-primary/10"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          No lo tengo: mi inscripción está en trámite
        </button>
      )}
    </div>
  );

  const ClosingBanner = (
    <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>
        Ningún documento se aprueba solo: son evidencia para el área legal. La presencia de
        una hipoteca en tu certificado del RPP no bloquea este paso.
      </span>
    </div>
  );

  // ============ Persona Moral ============
  if (isMoral) {
    return (
      <div className="space-y-5">
        {Header}

        {/* 1. Acta constitutiva */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="obligatorio" />
            <span className="text-[11px] text-muted-foreground">
              Da vida a la empresa y aporta el RFC de la moral.
            </span>
          </div>
          <DocumentUploader type="acta_constitutiva" />
        </div>

        {/* 2. Poder del representante legal */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="obligatorio" />
            <span className="text-[11px] text-muted-foreground">
              Para revender más adelante se requiere poder para actos de dominio; su ausencia
              no bloquea este paso.
            </span>
          </div>
          <DocumentUploader type="poder_rl" />
          {/* SWAP POINT: validación de facultades del poder. */}
        </div>

        {/* 3. Identificación oficial del representante legal */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="obligatorio" />
          </div>
          <DocumentUploader type="id_rl" />
        </div>

        {/* 4. Escritura pública */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="obligatorio" />
            {isReciente && (
              <span className="text-[11px] text-muted-foreground">
                Si la compra es muy reciente, la inscripción puede estar en trámite; la
                escritura sí existe desde la firma.
              </span>
            )}
          </div>
          <DocumentUploader type="escritura" />
        </div>

        {/* 5. Certificado del RPP */}
        {RppSection}

        {/* 6. Predial (opcional) */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="opcional" />
            <span className="text-[11px] text-muted-foreground">
              No bloquea el avance. En compras recientes puede seguir a nombre del vendedor.
            </span>
          </div>
          <DocumentUploader type="predial" optional />
        </div>

        {/* 7. Constancia de situación fiscal de la moral */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RequirementChip level="condicional" />
            <span className="text-[11px] text-muted-foreground">
              Opcional para Nivel 1 · requerida para facturar mantenimiento de la moral.
            </span>
          </div>
          <DocumentUploader type="csf" optional />
        </div>

        {ClosingBanner}
      </div>
    );
  }

  // ============ Persona Física ============
  return (
    <div className="space-y-5">
      {Header}

      {/* 1. Identificación oficial */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RequirementChip level="obligatorio" />
        </div>
        <DocumentUploader type="id_oficial" />
      </div>

      {/* 2. Escritura */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RequirementChip level="obligatorio" />
          {isReciente && (
            <span className="text-[11px] text-muted-foreground">
              Si la compra es muy reciente, la inscripción puede estar en trámite; la escritura
              sí existe desde la firma.
            </span>
          )}
        </div>
        <DocumentUploader type="escritura" />
      </div>

      {/* 3. Certificado del RPP */}
      {RppSection}

      {/* 4. Predial (opcional) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RequirementChip level="opcional" />
          <span className="text-[11px] text-muted-foreground">No bloquea el avance.</span>
        </div>
        <DocumentUploader type="predial" optional />
      </div>

      {/* 5. CURP (condicional) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RequirementChip level="condicional" />
          <span className="text-[11px] text-muted-foreground">
            Nos permite identificarte ante autoridades.
          </span>
        </div>
        <DocumentUploader type="curp" optional />
      </div>

      {/* 6. Constancia de situación fiscal (condicional) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RequirementChip level="condicional" />
          <span className="text-[11px] text-muted-foreground">
            Requerida para facturar tu mantenimiento con tus datos fiscales.
          </span>
        </div>
        <DocumentUploader type="csf" optional />
      </div>

      {ClosingBanner}
    </div>
  );
}
