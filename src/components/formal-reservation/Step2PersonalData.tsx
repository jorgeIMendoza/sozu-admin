import { useState, useEffect } from "react";
import {
  useFormalReservationStore,
  validateRFC,
  validateCURP,
  type FormalReservation,
} from "@/lib/offers/formal-reservation-data";
import { ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";

interface Props {
  formalReservation: FormalReservation;
  prefill?: { fullName?: string; email?: string; phone?: string };
}

const Step2PersonalData = ({ formalReservation, prefill }: Props) => {
  const updatePersonalData = useFormalReservationStore((s) => s.updatePersonalData);
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);

  const buyerType = formalReservation.buyerType;
  const data = formalReservation.personalData ?? ({} as any);

  const [formData, setFormData] = useState({
    fullName: data.fullName ?? prefill?.fullName ?? "",
    email: data.email ?? prefill?.email ?? "",
    phone: data.phone ?? prefill?.phone ?? "",
    birthDate: data.birthDate ?? "",
    nationality: data.nationality ?? (buyerType === "individual_mexican" ? "Mexicana" : ""),
    rfc: data.rfc ?? "",
    curp: data.curp ?? "",
    passportNumber: data.passportNumber ?? "",
    passportCountry: data.passportCountry ?? "",
    visaType: data.visaType ?? "",
    companyName: data.companyName ?? "",
    companyRFC: data.companyRFC ?? "",
    legalRepName: data.legalRepName ?? "",
    address: {
      street: data.address?.street ?? "",
      exteriorNumber: data.address?.exteriorNumber ?? "",
      interiorNumber: data.address?.interiorNumber ?? "",
      neighborhood: data.address?.neighborhood ?? "",
      zipCode: data.address?.zipCode ?? "",
      municipality: data.address?.municipality ?? "",
      state: data.address?.state ?? "",
      country: data.address?.country ?? "México",
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePersonalData(formalReservation.id, formData as any);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, formalReservation.id, updatePersonalData]);

  const setField = (path: string, value: string) => {
    if (path.startsWith("address.")) {
      const key = path.replace("address.", "");
      setFormData((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [path]: value }));
    }
    if (errors[path]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  };

  const validateField = (path: string, value: string) => {
    let error = "";
    if (path === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      error = "Email no parece válido";
    }
    if (path === "phone" && value && value.replace(/\D/g, "").length < 10) {
      error = "Teléfono debe tener al menos 10 dígitos";
    }
    if (path === "rfc" && value) {
      const result = validateRFC(value, "individual_mexican");
      if (!result.valid) error = result.error ?? "RFC inválido";
    }
    if (path === "companyRFC" && value) {
      const result = validateRFC(value, "legal_entity");
      if (!result.valid) error = result.error ?? "RFC inválido";
    }
    if (path === "curp" && value) {
      const result = validateCURP(value);
      if (!result.valid) error = result.error ?? "CURP inválido";
    }
    if (path === "address.zipCode" && value && !/^\d{5}$/.test(value)) {
      error = "CP debe tener 5 dígitos";
    }
    if (error) setErrors((prev) => ({ ...prev, [path]: error }));
  };

  const isFormValid = (): boolean => {
    const requiredCommon =
      formData.email && formData.phone && formData.address.street &&
      formData.address.exteriorNumber && formData.address.neighborhood &&
      formData.address.zipCode && formData.address.municipality && formData.address.state;
    if (!requiredCommon) return false;
    if (Object.keys(errors).length > 0) return false;

    if (buyerType === "individual_mexican") {
      return Boolean(
        formData.fullName &&
        formData.rfc && validateRFC(formData.rfc, "individual_mexican").valid &&
        formData.curp && validateCURP(formData.curp).valid
      );
    }
    if (buyerType === "individual_foreign") {
      return Boolean(formData.fullName && formData.passportNumber && formData.passportCountry);
    }
    if (buyerType === "legal_entity") {
      return Boolean(
        formData.companyName &&
        formData.companyRFC && validateRFC(formData.companyRFC, "legal_entity").valid &&
        formData.legalRepName
      );
    }
    return false;
  };

  const handleContinue = () => {
    if (isFormValid()) setCurrentStep(formalReservation.id, 3);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 2 de 6 · Datos personales
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          {buyerType === "legal_entity" ? "Datos de la empresa" : "Tus datos"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estos datos van directo al contrato preliminar y a las escrituras finales.
          Verifica que estén correctos.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-success/5 border border-success/20">
        <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
        <p className="text-xs text-foreground leading-relaxed">
          Tus datos están protegidos bajo el Aviso de Privacidad de SOZU (LFPDPPP México).
          Se usan exclusivamente para fines de esta operación.
        </p>
      </div>

      <div className="space-y-7">
        <FormSection title="Identidad">
          {buyerType === "legal_entity" ? (
            <>
              <Field
                label="Razón social"
                value={formData.companyName}
                onChange={(v) => setField("companyName", v)}
                placeholder="Ej. Inversiones del Country SA de CV"
                required
              />
              <Field
                label="RFC de la empresa"
                value={formData.companyRFC}
                onChange={(v) => setField("companyRFC", v.toUpperCase())}
                onBlur={() => validateField("companyRFC", formData.companyRFC)}
                placeholder="Ej. ABC850315XY1"
                error={errors.companyRFC}
                helper="12 caracteres con homoclave"
                required
                maxLength={12}
              />
              <Field
                label="Nombre del representante legal"
                value={formData.legalRepName}
                onChange={(v) => setField("legalRepName", v)}
                placeholder="Nombre completo"
                required
              />
            </>
          ) : (
            <>
              <Field
                label="Nombre completo"
                value={formData.fullName}
                onChange={(v) => setField("fullName", v)}
                placeholder="Como aparece en tu identificación"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Fecha de nacimiento"
                  type="date"
                  value={formData.birthDate}
                  onChange={(v) => setField("birthDate", v)}
                />
                <Field
                  label="Nacionalidad"
                  value={formData.nationality}
                  onChange={(v) => setField("nationality", v)}
                  placeholder="Ej. Mexicana"
                  required
                />
              </div>
              {buyerType === "individual_mexican" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="RFC"
                    value={formData.rfc}
                    onChange={(v) => setField("rfc", v.toUpperCase())}
                    onBlur={() => validateField("rfc", formData.rfc)}
                    placeholder="Ej. HEGJ850315MN5"
                    error={errors.rfc}
                    helper="13 caracteres con homoclave"
                    required
                    maxLength={13}
                  />
                  <Field
                    label="CURP"
                    value={formData.curp}
                    onChange={(v) => setField("curp", v.toUpperCase())}
                    onBlur={() => validateField("curp", formData.curp)}
                    placeholder="Ej. HEGJ850315HDFRRN09"
                    error={errors.curp}
                    helper="18 caracteres"
                    required
                    maxLength={18}
                  />
                </div>
              )}
              {buyerType === "individual_foreign" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="Número de pasaporte"
                      value={formData.passportNumber}
                      onChange={(v) => setField("passportNumber", v)}
                      placeholder="Ej. A12345678"
                      required
                    />
                    <Field
                      label="País del pasaporte"
                      value={formData.passportCountry}
                      onChange={(v) => setField("passportCountry", v)}
                      placeholder="Ej. Estados Unidos"
                      required
                    />
                  </div>
                  <SelectField
                    label="Tipo de visa / forma migratoria"
                    value={formData.visaType}
                    onChange={(v) => setField("visaType", v)}
                    options={[
                      { value: "", label: "Selecciona..." },
                      { value: "FM2", label: "FM2" },
                      { value: "FM3", label: "FM3" },
                      { value: "Residencia_Temporal", label: "Residencia Temporal" },
                      { value: "Residencia_Permanente", label: "Residencia Permanente" },
                    ]}
                  />
                </>
              )}
            </>
          )}
        </FormSection>

        <FormSection title="Contacto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Email"
              type="email"
              value={formData.email}
              onChange={(v) => setField("email", v.toLowerCase())}
              onBlur={() => validateField("email", formData.email)}
              placeholder="tunombre@dominio.com"
              error={errors.email}
              required
            />
            <Field
              label="Teléfono"
              type="tel"
              value={formData.phone}
              onChange={(v) => setField("phone", v)}
              onBlur={() => validateField("phone", formData.phone)}
              placeholder="+52 33 1234 5678"
              error={errors.phone}
              required
            />
          </div>
        </FormSection>

        <FormSection title="Domicilio fiscal">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Field
                label="Calle"
                value={formData.address.street}
                onChange={(v) => setField("address.street", v)}
                placeholder="Ej. Av. México"
                required
              />
            </div>
            <Field
              label="No. ext."
              value={formData.address.exteriorNumber}
              onChange={(v) => setField("address.exteriorNumber", v)}
              placeholder="123"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              label="No. int."
              value={formData.address.interiorNumber}
              onChange={(v) => setField("address.interiorNumber", v)}
              placeholder="A · opcional"
            />
            <div className="md:col-span-2">
              <Field
                label="Colonia"
                value={formData.address.neighborhood}
                onChange={(v) => setField("address.neighborhood", v)}
                placeholder="Ej. Country Club"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              label="Código postal"
              value={formData.address.zipCode}
              onChange={(v) => setField("address.zipCode", v.replace(/\D/g, "").slice(0, 5))}
              onBlur={() => validateField("address.zipCode", formData.address.zipCode)}
              placeholder="44630"
              error={errors["address.zipCode"]}
              required
              maxLength={5}
            />
            <Field
              label="Municipio / alcaldía"
              value={formData.address.municipality}
              onChange={(v) => setField("address.municipality", v)}
              placeholder="Ej. Guadalajara"
              required
            />
            <Field
              label="Estado"
              value={formData.address.state}
              onChange={(v) => setField("address.state", v)}
              placeholder="Ej. Jalisco"
              required
            />
          </div>
        </FormSection>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(formalReservation.id, 1)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          type="button"
          disabled={!isFormValid()}
          onClick={handleContinue}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const FormSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  error,
  helper,
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  maxLength?: number;
}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-foreground">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full h-11 px-3 rounded-lg bg-card border text-sm text-foreground transition-colors focus:outline-none focus:ring-2 ${
        error
          ? "border-destructive focus:ring-destructive/15"
          : "border-border focus:border-primary focus:ring-primary/15"
      }`}
    />
    {error && <p className="text-[11px] text-destructive">{error}</p>}
    {!error && helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
  </div>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-foreground">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export default Step2PersonalData;
