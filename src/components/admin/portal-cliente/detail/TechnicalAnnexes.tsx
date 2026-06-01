import { useState } from "react";
import { MapPin, Ruler, Eye, Download, ChevronDown, Package, Layers } from "lucide-react";
import planoReferencia from "@/assets/plano-referencia.png";
import seccionReferencia from "@/assets/seccion-referencia.png";
import planoArquitectonico from "@/assets/plano-arquitectonico.png";
import planoArquitectonicoCotas from "@/assets/plano-arquitectonico-cotas.png";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { technicalAnnexes, type PlanData, type TechnicalAnnex } from "@/lib/portal-cliente/technical-annexes-data";

interface TechnicalAnnexesProps {
  propertyId: string;
}

/* ── Plan Card ── */
const PlanCard = ({ plan }: { plan: PlanData }) => {
  const icon = plan.type === "ubicacion" ? MapPin : Ruler;
  const Icon = icon;
  const imageMap: Record<string, string> = {
    ubicacion: planoReferencia,
    arquitectonico: planoArquitectonico,
  };
  const image = imageMap[plan.type] || planoReferencia;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Preview area */}
      <div className="bg-muted/30 flex items-center justify-center relative p-4">
        <img
          src={image}
          alt={plan.title}
          className="max-h-56 w-auto object-contain"
        />
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{plan.title}</h4>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {plan.level && (
            <div>
              <span className="text-muted-foreground">Nivel</span>
              <p className="font-medium text-foreground">{plan.level}</p>
            </div>
          )}
          {plan.model && (
            <div>
              <span className="text-muted-foreground">Modelo</span>
              <p className="font-medium text-foreground">{plan.model}</p>
            </div>
          )}
          {plan.totalArea && (
            <div>
              <span className="text-muted-foreground">Área total</span>
              <p className="font-medium text-foreground">{plan.totalArea}</p>
            </div>
          )}
          {plan.mainDimensions && (
            <div>
              <span className="text-muted-foreground">Dimensiones</span>
              <p className="font-medium text-foreground">{plan.mainDimensions}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs rounded-xl">
            <Eye className="w-3.5 h-3.5" />
            Ver plano
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs rounded-xl">
            <Download className="w-3.5 h-3.5" />
            Descargar PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ── Specs Accordion ── */
const SpecsSection = ({ annex }: { annex: TechnicalAnnex }) => (
  <div className="bg-card rounded-2xl border border-border overflow-hidden">
    <div className="px-4 pt-4 pb-2 flex items-center gap-2">
      <Layers className="w-4 h-4 text-primary" />
      <h4 className="text-sm font-semibold text-foreground">Especificaciones y acabados</h4>
    </div>
    <Accordion type="multiple" className="px-4 pb-2">
      {annex.specs.map((spec) => (
        <AccordionItem key={spec.category} value={spec.category} className="border-border/50">
          <AccordionTrigger className="text-xs font-medium py-3 hover:no-underline">
            {spec.category}
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 pb-1">
              {spec.items.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-primary/60 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);

/* ── Inventory Table ── */
const InventorySection = ({ annex }: { annex: TechnicalAnnex }) => (
  <div className="bg-card rounded-2xl border border-border overflow-hidden">
    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Inventario y mobiliario</h4>
      </div>
      <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 h-7 px-2">
        <Download className="w-3 h-3" />
        Anexo completo
      </Button>
    </div>

    <div className="px-4 pb-4 space-y-4">
      {annex.inventory.map((group) => (
        <div key={group.category}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">
            {group.category}
          </p>
          <div className="border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2.5rem_1fr_5rem] bg-muted/50 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              <span>Cant.</span>
              <span>Descripción</span>
              <span className="text-right">Ubicación</span>
            </div>
            {/* Rows */}
            {group.items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[2.5rem_1fr_5rem] px-3 py-2 text-xs border-t border-border/50 items-start"
              >
                <span className="font-semibold text-foreground tabular-nums">{item.qty}</span>
                <span className="text-foreground leading-snug">{item.description}</span>
                <span className="text-muted-foreground text-right text-[11px]">{item.location}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Main Component ── */
const TechnicalAnnexes = ({ propertyId }: TechnicalAnnexesProps) => {
  const annex = technicalAnnexes[propertyId];

  if (!annex) return null;

  return (
    <section className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Anexos y detalles técnicos</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Ficha técnica oficial del inmueble
        </p>
      </div>

      {/* Plans */}
      {annex.plans.map((plan) => (
        <PlanCard key={plan.type} plan={plan} />
      ))}

      {/* Specs */}
      <SpecsSection annex={annex} />

      {/* Inventory */}
      <InventorySection annex={annex} />

      {/* Legal disclaimer */}
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed px-1">
        Las descripciones son ilustrativas, pueden variar en marca por cuestión de disponibilidad en modelos e inventarios; siempre y cuando sean de calidad equivalente.
      </p>
    </section>
  );
};

export default TechnicalAnnexes;
