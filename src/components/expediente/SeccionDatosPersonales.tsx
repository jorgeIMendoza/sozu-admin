import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, User, Clock } from "lucide-react";
import {
  useFormalReservationStore,
  type FormalReservation,
  type DatosPersonalesCompletos,
} from "@/lib/offers/formal-reservation-data";

type CurpValidationState = "idle" | "validating" | "validated" | "error";

const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
  "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México",
  "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

const ESTADO_CURP_MAP: Record<string, string> = {
  AS: "Aguascalientes", BC: "Baja California", BS: "Baja California Sur",
  CC: "Campeche", CL: "Coahuila", CM: "Colima", CS: "Chiapas",
  CH: "Chihuahua", DF: "Ciudad de México", DG: "Durango",
  GT: "Guanajuato", GR: "Guerrero", HG: "Hidalgo", JC: "Jalisco",
  MC: "Estado de México", MN: "Michoacán", MS: "Morelos", NT: "Nayarit",
  NL: "Nuevo León", OC: "Oaxaca", PL: "Puebla", QT: "Querétaro",
  QR: "Quintana Roo", SP: "San Luis Potosí", SL: "Sinaloa",
  SR: "Sonora", TC: "Tabasco", TS: "Tamaulipas", TL: "Tlaxcala",
  VZ: "Veracruz", YN: "Yucatán", ZS: "Zacatecas",
};

const SeccionDatosPersonales = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const updateDatosPersonales = useFormalReservationStore((s) => s.updateDatosPersonales);
  const updateSeccionStatus = useFormalReservationStore((s) => s.updateSeccionStatus);

  const seccion = formalReservation.expediente!.datosPersonales;
  const data = seccion.data;
  const isCompleted = seccion.status === "completed";
  const isInProgress = seccion.status === "in_progress";

  const [expanded, setExpanded] = useState(!isCompleted);
  const [curpInput, setCurpInput] = useState(data?.curp ?? "");
  const [curpState, setCurpState] = useState<CurpValidationState>(
    data?.curpValidatedAt ? "validated" : "idle",
  );

  const statusLabel = isCompleted ? "Completada" : isInProgress ? "En progreso" : "Pendiente";

  const handleValidateCurp = () => {
    const cleanCurp = curpInput.trim().toUpperCase();
    if (cleanCurp.length !== 18) return;
    setCurpState("validating");
    setTimeout(() => {
      const yy = parseInt(cleanCurp.slice(4, 6), 10);
      const mm = cleanCurp.slice(6, 8);
      const dd = cleanCurp.slice(8, 10);
      const fullYear = yy > 30 ? 1900 + yy : 2000 + yy;
      const sexo: "H" | "M" = cleanCurp[10] === "H" ? "H" : "M";
      const estadoNacimiento = ESTADO_CURP_MAP[cleanCurp.slice(11, 13)] ?? "—";

      updateDatosPersonales(formalReservation.id, {
        curp: cleanCurp,
        curpValidatedAt: new Date().toISOString(),
        fechaNacimiento: `${fullYear}-${mm}-${dd}`,
        estadoNacimiento,
        sexo,
        nacionalidad: data?.nacionalidad ?? "Mexicana",
      });
      setCurpState("validated");
    }, 1500);
  };

  const updateField = <K extends keyof DatosPersonalesCompletos>(
    field: K,
    value: DatosPersonalesCompletos[K] | null,
  ) =>
    updateDatosPersonales(formalReservation.id, { [field]: value } as Partial<DatosPersonalesCompletos>);

  const updateDomicilioField = (field: string, value: string) =>
    updateDatosPersonales(formalReservation.id, {
      domicilioFiscal: {
        calle: data?.domicilioFiscal?.calle ?? "",
        numeroExterior: data?.domicilioFiscal?.numeroExterior ?? "",
        numeroInterior: data?.domicilioFiscal?.numeroInterior ?? "",
        colonia: data?.domicilioFiscal?.colonia ?? "",
        codigoPostal: data?.domicilioFiscal?.codigoPostal ?? "",
        municipio: data?.domicilioFiscal?.municipio ?? "",
        estado: data?.domicilioFiscal?.estado ?? "",
        [field]: value,
      },
    });

  const isAllFieldsValid = (): boolean => {
    if (!data?.curpValidatedAt || !data.estadoCivil) return false;
    if (data.estadoCivil === "casado" && !data.regimenPatrimonial) return false;
    if (!data.ocupacion?.trim()) return false;
    const d = data.domicilioFiscal;
    if (!d?.calle?.trim() || !d?.numeroExterior?.trim() || !d?.colonia?.trim()) return false;
    if (!d?.codigoPostal?.trim() || !d?.municipio?.trim() || !d?.estado?.trim()) return false;
    return true;
  };

  const handleMarkComplete = () => {
    if (!isAllFieldsValid()) return;
    updateSeccionStatus(formalReservation.id, "datosPersonales", "completed");
    setExpanded(false);
  };

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : isInProgress ? (
            <Clock className="w-4 h-4 text-warning" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sección 2</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{statusLabel}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Datos personales</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {isCompleted
                ? `CURP ${data?.curp} · ${data?.estadoCivil}`
                : "CURP, estado civil, domicilio fiscal, ocupación"}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-border">
          {/* CURP */}
          <div className="space-y-2 pt-4">
            <label className="text-xs font-semibold text-foreground">CURP *</label>
            {curpState === "validated" && data ? (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-xs font-semibold text-success">CURP validado contra RENAPO</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniField label="CURP" value={data.curp} mono />
                  <MiniField label="Fecha nacimiento" value={data.fechaNacimiento} />
                  <MiniField label="Estado nacimiento" value={data.estadoNacimiento} />
                  <MiniField label="Sexo" value={data.sexo === "H" ? "Hombre" : "Mujer"} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurpState("idle");
                    setCurpInput("");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cambiar CURP
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={curpInput}
                  onChange={(e) => setCurpInput(e.target.value.toUpperCase())}
                  placeholder="ABCD123456HEFGHIJ12"
                  maxLength={18}
                  disabled={curpState === "validating"}
                  className="flex-1 h-11 px-3 rounded-lg bg-card border-2 border-border text-sm font-mono uppercase text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleValidateCurp}
                  disabled={curpInput.length !== 18 || curpState === "validating"}
                  className="h-11 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {curpState === "validating" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Validando…
                    </>
                  ) : (
                    "Validar"
                  )}
                </button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              18 caracteres. Si no recuerdas tu CURP, consúltalo en{" "}
              <a
                href="https://www.gob.mx/curp"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                gob.mx/curp
              </a>
            </p>
          </div>

          {curpState === "validated" && data && (
            <>
              {/* Estado civil */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Estado civil *</label>
                <select
                  value={data.estadoCivil ?? ""}
                  onChange={(e) =>
                    updateField(
                      "estadoCivil",
                      (e.target.value || null) as DatosPersonalesCompletos["estadoCivil"],
                    )
                  }
                  className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">Selecciona…</option>
                  <option value="soltero">Soltero(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viudo">Viudo(a)</option>
                  <option value="concubinato">Concubinato</option>
                </select>
              </div>

              {data.estadoCivil === "casado" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Régimen patrimonial *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "separacion_bienes", label: "Separación de bienes" },
                      { id: "sociedad_conyugal", label: "Sociedad conyugal" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          updateField(
                            "regimenPatrimonial",
                            r.id as DatosPersonalesCompletos["regimenPatrimonial"],
                          )
                        }
                        className={`h-11 px-3 rounded-lg border-2 text-xs font-semibold transition-colors ${
                          data.regimenPatrimonial === r.id
                            ? "border-primary bg-primary/[0.04] text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Ocupación *</label>
                <input
                  type="text"
                  value={data.ocupacion ?? ""}
                  onChange={(e) => updateField("ocupacion", e.target.value)}
                  placeholder="Ej: Ingeniero, Médico, Empresario…"
                  className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Domicilio fiscal *</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={data.domicilioFiscal?.calle ?? ""}
                      onChange={(e) => updateDomicilioField("calle", e.target.value)}
                      placeholder="Calle"
                      className="col-span-2 h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={data.domicilioFiscal?.numeroExterior ?? ""}
                      onChange={(e) => updateDomicilioField("numeroExterior", e.target.value)}
                      placeholder="No. ext."
                      className="h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={data.domicilioFiscal?.numeroInterior ?? ""}
                      onChange={(e) => updateDomicilioField("numeroInterior", e.target.value)}
                      placeholder="No. int. (opcional)"
                      className="h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={data.domicilioFiscal?.colonia ?? ""}
                      onChange={(e) => updateDomicilioField("colonia", e.target.value)}
                      placeholder="Colonia"
                      className="h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      maxLength={5}
                      value={data.domicilioFiscal?.codigoPostal ?? ""}
                      onChange={(e) =>
                        updateDomicilioField("codigoPostal", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="CP"
                      className="h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground tabular-nums focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={data.domicilioFiscal?.municipio ?? ""}
                      onChange={(e) => updateDomicilioField("municipio", e.target.value)}
                      placeholder="Municipio / Alcaldía"
                      className="col-span-2 h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={data.domicilioFiscal?.estado ?? ""}
                    onChange={(e) => updateDomicilioField("estado", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Estado…</option>
                    {ESTADOS_MX.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  disabled={!isAllFieldsValid()}
                  className="w-full h-11 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Marcar sección como completa
                </button>
                {!isAllFieldsValid() && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Completa todos los campos requeridos para continuar
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const MiniField = ({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => (
  <div>
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <p className={`text-xs text-foreground ${mono ? "font-mono tabular-nums" : ""}`}>{value ?? "—"}</p>
  </div>
);

export default SeccionDatosPersonales;
