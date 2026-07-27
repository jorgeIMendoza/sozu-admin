import { useState } from "react";
import { Download, PenTool } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import {
  type ResaleScenario,
  generateContractBinding,
  generateContract,
  acceptContract,
} from "@/lib/portal-cliente/resale-data";

interface ResaleStepContractProps {
  property: InvestmentProperty;
  scenario: ResaleScenario;
  onNext: () => void;
}

const POINTS = [
  <>Autorizas a <strong>SOZU</strong> como tu intermediario inmobiliario para vender tu unidad.</>,
  <>Comisión <strong>5% + IVA</strong>, solo se cobra si se concreta la venta.</>,
  <>Exclusividad por <strong>6 meses</strong>, prorrogable salvo aviso por escrito.</>,
  <>Puedes <strong>cancelar sin costo</strong> los primeros <strong>5 días naturales</strong>.</>,
  <>El <strong>ISR</strong> lo retiene el notario al firmar la escritura final.</>,
];

const ResaleStepContract = ({ property, scenario, onNext }: ResaleStepContractProps) => {
  const [accepted, setAccepted] = useState(false);
  const binding = generateContractBinding(property, scenario);

  const contractText = `CONTRATO DE INTERMEDIACIÓN INMOBILIARIA

Que celebran por una parte SOZU como Intermediario, representada por su
apoderado legal, y por la otra parte el Sr./Sra. ${binding.clientFullName} como
Propietario, con RFC ${binding.clientRFC}, respecto del inmueble ubicado en
${binding.propertyAddress}, identificado como Unidad ${binding.unitNumber} del proyecto
${binding.projectName}, con superficie de ${binding.m2} m².

CLÁUSULAS

PRIMERA - Objeto. El Propietario encomienda al Intermediario la
promoción y comercialización de su inmueble para localizar comprador,
promover, negociar y coordinar el cierre de la operación de compraventa.

SEGUNDA - Precio. Las partes acuerdan que el precio de salida será
de $${binding.listingPrice.toLocaleString()} MXN, conforme al escenario
"${scenario.label}".

TERCERA - Honorarios. El Intermediario cobrará una comisión del
${(binding.commissionRate * 100).toFixed(0)}% sobre el precio efectivamente
pagado, más el IVA correspondiente. Esta comisión se devenga únicamente
al formalizarse la compraventa en escritura pública.

CUARTA - Plazo y exclusividad. Vigencia de ${binding.exclusivityMonths}
meses a partir de la firma, prorrogables tácitamente por periodos iguales
salvo aviso por escrito con 15 días naturales de anticipación.

QUINTA - Derecho de cancelación. El Propietario puede cancelar este
contrato dentro de los ${binding.cancellationDays} días naturales
siguientes a la firma, sin responsabilidad alguna.

SEXTA - Obligaciones de SOZU. Publicidad, atención de prospectos,
calificación financiera de compradores, coordinación de visitas y
asesoría legal y fiscal hasta la firma notarial.

SÉPTIMA - Obligaciones del Propietario. Entregar documentación
(escritura, predial al corriente, mantenimiento al corriente, INE,
RFC, CURP, estado civil), permitir visitas razonables, no negociar
paralelamente bajo exclusividad.

OCTAVA - Gastos a cargo del Propietario. ISR, certificados de libertad
de gravamen, no adeudo de predial, agua y mantenimiento, avalúo
bancario si lo solicita el comprador hipotecario, honorarios notariales.

NOVENA - Forma de pago de la comisión. Al firmar la escritura,
mediante transferencia electrónica con CFDI emitido por SOZU.

DÉCIMA - Terminación. Por mutuo consentimiento, por venta concretada,
por incumplimiento, o por cancelación del Propietario en plazo.

DÉCIMA PRIMERA - Confidencialidad y protección de datos. Conforme a
la Ley Federal de Protección de Datos Personales en Posesión de los
Particulares.

DÉCIMA SEGUNDA - Jurisdicción. Tribunales de Guadalajara, Jalisco.

DÉCIMA TERCERA - Firma electrónica. Las partes reconocen la validez
jurídica plena de la firma electrónica conforme al Código de
Comercio, artículos 89 y 97, mediante el servicio MIFIEL.`;

  const handleSign = () => {
    if (!accepted) return;
    generateContract(property.property.id, binding);
    acceptContract(property.property.id);
    onNext();
  };

  return (
    <div className="animate-fade-in pb-6">
      <div className="px-5 pt-4">
        <h2 className="font-display font-bold text-xl text-foreground">
          Tu contrato está listo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generado automáticamente con tus datos. Revísalo antes de firmar.
        </p>
      </div>

      {/* 5 puntos */}
      <div className="rounded-xl border border-border bg-card p-5 mx-5 mt-5">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-4">
          LO IMPORTANTE EN 5 PUNTOS
        </p>
        <ul className="space-y-3">
          {POINTS.map((node, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-foreground leading-relaxed flex-1">{node}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-muted/20 mx-5 mt-4 overflow-hidden">
        <div className="flex border-b border-border bg-card">
          <div className="border-b-2 border-primary text-primary px-4 py-3 text-xs font-semibold">
            Vista previa
          </div>
          <button
            onClick={() =>
              toast.info("La descarga estará disponible cuando esté integrado MIFIEL.")
            }
            className="text-muted-foreground px-4 py-3 text-xs hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar PDF
          </button>
        </div>
        <pre className="max-h-[280px] overflow-y-auto p-5 text-[11px] leading-relaxed text-muted-foreground bg-card whitespace-pre-wrap font-mono">
{contractText}
        </pre>
        <p className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground text-center bg-card">
          Este es un resumen. El contrato completo se firma en MIFIEL con validez legal.
        </p>
      </div>

      {/* Checkbox */}
      <div className="flex items-start gap-3 mx-5 mt-4 p-3 rounded-lg border border-border bg-muted/10">
        <Checkbox
          id="accept-contract"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          className="mt-0.5"
        />
        <label
          htmlFor="accept-contract"
          className="text-xs text-foreground leading-relaxed cursor-pointer"
        >
          He leído y acepto los términos del Contrato de Intermediación Inmobiliaria.
        </label>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-2 px-5">
        Puedes cancelar este contrato dentro de los 5 días naturales siguientes a la firma sin responsabilidad alguna.
      </p>

      {/* CTA */}
      <div className="px-5 pt-3">
        <button
          onClick={handleSign}
          disabled={!accepted}
          className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
            accepted
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <PenTool className="w-4 h-4" />
          Firmar electrónicamente con MIFIEL
        </button>
      </div>
    </div>
  );
};

export default ResaleStepContract;
