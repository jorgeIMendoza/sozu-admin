import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortal } from "@/lib/portal-cliente/onboarding-store";

export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const demo = usePortal((s) => s.demo);
  const setDemo = usePortal((s) => s.setDemo);
  const onboarding = usePortal((s) => s.onboarding);
  const setOnb = usePortal((s) => s.setOnboarding);
  const approve = usePortal((s) => s.approveLevel);
  const properties = usePortal((s) => s.properties);
  const transfer = usePortal((s) => s.transferOwnership);
  const seed = usePortal((s) => s.seedOriginalOwner);
  const user = usePortal((s) => s.auth.user);
  const reset = usePortal((s) => s.reset);

  if (!import.meta.env.DEV) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-lg hover:bg-secondary"
          aria-label="Panel DEMO"
        >
          <FlaskConical className="h-4 w-4 text-primary" />
          DEMO
        </button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Simulador interno</SheetTitle>
          <SheetDescription>
            Solo visible en desarrollo. Fuerza escenarios del flujo de reventa.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <section className="space-y-3">
            <h4 className="font-semibold">Persona</h4>
            <div className="flex items-center justify-between">
              <Label>Persona Moral</Label>
              <Switch
                checked={onboarding.personType === "moral"}
                onCheckedChange={(v) => setOnb({ personType: v ? "moral" : "fisica" })}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Onboarding</h4>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() =>
                setOnb({ unitId: "prop-margot-308", unitConfirmed: true })
              }
            >
              Sembrar unidad Margot 308 (Kind · piso 3)
            </Button>
          </section>

          <section className="space-y-3">
            <h4 className="font-semibold">Cruces (forzar)</h4>
            <Toggle
              label="Mismatch de nombre"
              checked={demo.forceNameMismatch}
              onChange={(v) => setDemo({ forceNameMismatch: v })}
            />
            <Toggle
              label="Mismatch de folio real"
              checked={demo.forceFolioMismatch}
              onChange={(v) => setDemo({ forceFolioMismatch: v })}
            />
            <Toggle
              label="Mismatch cadena de dominio (vendedor ≠ dueño original)"
              checked={demo.forceChainMismatch}
              onChange={(v) => setDemo({ forceChainMismatch: v })}
            />
            <div className="flex items-center justify-between">
              <Label>Certificado RPP</Label>
              <Select
                value={demo.rppState}
                onValueChange={(v) => setDemo({ rppState: v as typeof demo.rppState })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="gravamen">Con gravamen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Área legal</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => approve(1)}>
                Aprobar Nivel 1
              </Button>
              <Button size="sm" onClick={() => approve(2)}>
                Aprobar Nivel 2
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nivel actual: <span className="font-semibold">{onboarding.level}</span>
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Transferencia de registro</h4>
            <p className="text-xs text-muted-foreground">
              Traspasa la unidad seleccionada al usuario actual. Requiere Nivel 2 en producción.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!onboarding.unitId || !user}
              onClick={() => onboarding.unitId && user && transfer(onboarding.unitId, user.id)}
            >
              Transferir unidad al usuario actual
            </Button>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Sembrar dueño original</h4>
            {properties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border border-border p-2 text-xs"
              >
                <div>
                  <div className="font-medium">
                    {p.project} · {p.unit}
                  </div>
                  <div className="num text-muted-foreground">{p.originalOwnerId}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    seed(p.id, "user-original-" + Math.floor(Math.random() * 900 + 100))
                  }
                >
                  Regenerar
                </Button>
              </div>
            ))}
          </section>

          <section className="border-t border-border pt-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                if (confirm("Reset completo del estado mock?")) reset();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset global
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="pr-3 leading-tight">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
