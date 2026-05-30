import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import {
  PREFERRED_BANKS,
  isValidOtherBank,
  type MortgageChoice,
  type OtherBankDetails,
} from "@/lib/portal-cliente/mortgage-data";

interface MortgageBankSelectorProps {
  onConfirm: (choice: MortgageChoice) => void;
  onBack: () => void;
}

type Mode = "select" | "other-form";

const MortgageBankSelector = ({ onConfirm, onBack }: MortgageBankSelectorProps) => {
  const [mode, setMode] = useState<Mode>("select");
  const [details, setDetails] = useState<OtherBankDetails>({
    institution: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    branch: "",
  });

  if (mode === "other-form") {
    const valid = isValidOtherBank(details);
    return (
      <div className="animate-fade-in">
        <button
          type="button"
          onClick={() => setMode("select")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ver bancos aliados con SOZU
        </button>

        <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
          <div>
            <Label className="text-xs text-muted-foreground">Institución *</Label>
            <Input
              placeholder="Ej. HSBC, Scotiabank, Inbursa..."
              value={details.institution}
              maxLength={80}
              onChange={(e) => setDetails({ ...details, institution: e.target.value })}
              className="mt-1 h-10 rounded-lg text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nombre del ejecutivo *</Label>
            <Input
              placeholder="Nombre completo"
              value={details.contactName}
              maxLength={80}
              onChange={(e) => setDetails({ ...details, contactName: e.target.value })}
              className="mt-1 h-10 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Teléfono *</Label>
              <Input
                placeholder="10 dígitos"
                type="tel"
                inputMode="numeric"
                value={details.contactPhone}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                className="mt-1 h-10 rounded-lg text-sm tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Correo</Label>
              <Input
                placeholder="ejecutivo@banco.com"
                type="email"
                value={details.contactEmail || ""}
                maxLength={120}
                onChange={(e) => setDetails({ ...details, contactEmail: e.target.value })}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Sucursal *</Label>
            <Input
              placeholder="Ej. Polanco, Roma Norte..."
              value={details.branch}
              maxLength={80}
              onChange={(e) => setDetails({ ...details, branch: e.target.value })}
              className="mt-1 h-10 rounded-lg text-sm"
            />
          </div>
        </div>

        <Button
          className="w-full mt-5 rounded-xl h-12 text-sm font-semibold gap-2"
          disabled={!valid}
          onClick={() => onConfirm({ type: "other", details })}
        >
          Registrar mi banco
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          Bancos aliados con SOZU
        </span>
      </div>

      <div className="space-y-2.5">
        {PREFERRED_BANKS.map((bank) => {
          const visuals: Record<string, { color: string; short: string }> = {
            BBVA: { color: "#004481", short: "BBVA" },
            Santander: { color: "#EC0000", short: "SAN" },
            Banorte: { color: "#EB0029", short: "BAN" },
          };
          const v = visuals[bank.id];
          return (
            <button
              key={bank.id}
              type="button"
              onClick={() => onConfirm({ type: "preferred", bankId: bank.id })}
              className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-border-soft hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px] tracking-tight"
                  style={v ? { backgroundColor: v.color } : undefined}
                >
                  {v ? v.short : <Building2 className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold text-sm text-foreground">
                      {bank.name}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bank.shortDescription}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {bank.benefits.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium"
                      >
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          O bien
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={() => setMode("other-form")}
        className="w-full text-left p-4 rounded-xl border border-border hover:border-foreground/30 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-semibold text-sm text-foreground">
                Otro banco
              </p>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Comparte la información y SOZU se pondrá en contacto.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Cambiar método de pago
      </button>
    </div>
  );
};

export default MortgageBankSelector;
