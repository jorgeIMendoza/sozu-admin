import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, UserCheck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import sozuLogoBlack from "@/assets/sozu-logo-black.png";
import { getPortalHost } from "@/lib/portalUrls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INMOB_HOST = getPortalHost("inmobiliarias");

type RepLegalData = {
  nombre: string;
  email: string;
  telefono: string;
  clave_pais_telefono: string;
};

export default function RegistroInmobiliaria() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre_comercial: "",
    email: "",
    telefono: "",
    clave_pais_telefono: "MX",
  });
  const [repLegal, setRepLegal] = useState<RepLegalData | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRepLegalModal, setShowRepLegalModal] = useState(false);

  // Temp state for the modal form
  const [repForm, setRepForm] = useState<RepLegalData>({
    nombre: "",
    email: "",
    telefono: "",
    clave_pais_telefono: "MX",
  });
  const [repFormError, setRepFormError] = useState("");

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('registro-inmobiliaria-publica', {
        body: {
          inmobiliaria: {
            razon_social: formData.nombre_comercial.trim(),
            email: formData.email.trim().toLowerCase(),
            telefono: formData.telefono.trim(),
            clave_pais_telefono: formData.clave_pais_telefono,
          },
          representante_legal: {
            nombre_legal: repLegal!.nombre.trim(),
            email: repLegal!.email.trim().toLowerCase(),
            telefono: repLegal!.telefono.trim(),
            clave_pais_telefono: repLegal!.clave_pais_telefono,
          },
        },
      });

      if (error) {
        let message = "Error al registrar";
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errorBody = await error.context.json();
            if (errorBody?.message) message = errorBody.message;
          } else if (data?.message) {
            message = data.message;
          }
        } catch {
          if (data?.message) message = data.message;
        }
        throw new Error(message);
      }
      if (!data.success) throw new Error(data.message || "Error al registrar");
      return data;
    },
    onSuccess: () => setIsSuccess(true),
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al registrar", variant: "destructive" });
    },
  });

  const isFormValid =
    formData.nombre_comercial.trim() !== "" &&
    formData.email.trim() !== "" &&
    formData.email.includes("@") &&
    formData.telefono.length === 10 &&
    repLegal !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_comercial.trim()) {
      toast({ title: "Campo requerido", description: "El nombre comercial es obligatorio", variant: "destructive" });
      return;
    }
    if (!repLegal) {
      toast({ title: "Campo requerido", description: "Debes agregar un representante legal", variant: "destructive" });
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast({ title: "Campo requerido", description: "Ingresa un email válido", variant: "destructive" });
      return;
    }
    if (repLegal.email.trim().toLowerCase() === formData.email.trim().toLowerCase()) {
      toast({ title: "Email duplicado", description: "El email del representante legal no puede ser el mismo que el de la inmobiliaria", variant: "destructive" });
      return;
    }
    if (!formData.telefono.trim() || formData.telefono.length !== 10) {
      toast({ title: "Campo requerido", description: "El teléfono debe tener 10 dígitos", variant: "destructive" });
      return;
    }
    registerMutation.mutate();
  };

  const openRepLegalModal = () => {
    setRepForm(repLegal || { nombre: "", email: "", telefono: "", clave_pais_telefono: "MX" });
    setRepFormError("");
    setShowRepLegalModal(true);
  };

  const handleSaveRepLegal = () => {
    if (!repForm.nombre.trim()) { setRepFormError("El nombre es obligatorio"); return; }
    if (!repForm.email.trim() || !repForm.email.includes("@")) { setRepFormError("Ingresa un email válido"); return; }
    if (repForm.email.trim().toLowerCase() === formData.email.trim().toLowerCase() && formData.email.trim() !== "") {
      setRepFormError("El email no puede ser el mismo que el de la inmobiliaria");
      return;
    }
    if (repForm.telefono.length !== 10) { setRepFormError("El teléfono debe tener 10 dígitos"); return; }
    setRepLegal({ ...repForm });
    setShowRepLegalModal(false);
  };

  if (isSuccess) {
    return (
      <div className="login-page">
        <div className="login-bg-gradient" />
        <div className="login-card relative z-10 text-center">
          <img src={sozuLogoBlack} alt="Sozu" className="h-10 mx-auto mb-7" />
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(145 38% 46%), hsl(152 40% 54%))',
              boxShadow: '0 6px 24px -4px hsl(145 35% 51% / 0.30)',
            }}>
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2" style={{ letterSpacing: '-0.02em' }}>
            ¡Registro recibido!
          </h2>
          <p className="text-sm mb-2" style={{ color: 'hsl(0 0% 45%)' }}>
            Tu solicitud de registro ha sido enviada. Un administrador revisará tu información.
          </p>
          <p className="text-[hsl(0_0%_5%)] font-semibold mb-2 text-base">{formData.email}</p>
          <p className="text-sm mb-2" style={{ color: 'hsl(0 0% 45%)' }}>
            Recibirás un correo con tus credenciales de acceso una vez que tu cuenta sea aprobada.
          </p>
          <p className="text-xs mb-7" style={{ color: 'hsl(0 0% 55%)' }}>
            Si tienes preguntas, contacta a nuestro equipo de soporte.
          </p>
          <a href={`${INMOB_HOST}/login`} className="block">
            <button type="button" className="login-btn-outline">Ir a iniciar sesión</button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-bg-gradient" />
      <div className="login-card relative z-10">
        <div className="text-center mb-7">
          <img src={sozuLogoBlack} alt="Sozu" className="h-10 mx-auto" />
        </div>

        <h1 className="text-2xl font-black text-center text-[hsl(0_0%_5%)] mb-1.5" style={{ letterSpacing: '-0.02em' }}>
          Registro de Inmobiliaria
        </h1>
        <p className="text-sm text-center mb-7" style={{ color: 'hsl(0 0% 45%)' }}>
          Completa tus datos para crear tu cuenta
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre Comercial */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Nombre Comercial</label>
            <input
              type="text"
              value={formData.nombre_comercial}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre_comercial: e.target.value }))}
              placeholder="Nombre de tu inmobiliaria"
              required
              className="login-input w-full"
            />
          </div>

          {/* Representante Legal Button / Summary */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">
              Representante Legal <span className="text-red-500">*</span>
            </label>
            {repLegal ? (
              <button
                type="button"
                onClick={openRepLegalModal}
                className="w-full border rounded-lg p-3 flex items-center gap-3 text-left transition-colors hover:bg-[hsl(0_0%_97%)]"
                style={{ borderColor: 'hsl(145 35% 51%)' }}
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(145 35% 51%)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(0_0%_5%)] truncate">{repLegal.nombre}</p>
                  <p className="text-xs truncate" style={{ color: 'hsl(0 0% 45%)' }}>{repLegal.email} · {repLegal.telefono}</p>
                </div>
                <span className="text-xs font-medium" style={{ color: 'hsl(145 35% 51%)' }}>Editar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openRepLegalModal}
                className="w-full border border-dashed rounded-lg p-3 flex items-center justify-center gap-2 transition-colors hover:bg-[hsl(0_0%_97%)]"
                style={{ borderColor: 'hsl(0 0% 78%)' }}
              >
                <UserCheck className="w-4 h-4" style={{ color: 'hsl(0 0% 45%)' }} />
                <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 45%)' }}>Agregar Representante Legal</span>
              </button>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Email de la inmobiliaria</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="contacto@tuinmobiliaria.com"
              required
              className="login-input w-full"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Teléfono de la inmobiliaria</label>
            <div className="flex gap-3">
              <select
                value={formData.clave_pais_telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, clave_pais_telefono: e.target.value }))}
                className="login-input w-24 px-3"
              >
                <option value="MX">🇲🇽 +52</option>
                <option value="US">🇺🇸 +1</option>
              </select>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, telefono: value }));
                }}
                placeholder="10 dígitos"
                required
                className="login-input flex-1"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={registerMutation.isPending || !isFormValid}
            className="login-btn-primary"
          >
            {registerMutation.isPending ? "Registrando..." : "Registrarme como Inmobiliaria"}
          </button>

          <a href={`${INMOB_HOST}/login`} className="block">
            <button type="button" className="login-btn-outline">¿Ya tienes cuenta? Inicia sesión</button>
          </a>
        </form>

        <p className="text-center text-xs mt-7 px-4 leading-relaxed" style={{ color: 'hsl(0 0% 55%)' }}>
          Al registrarte, aceptas nuestros{" "}
          <a href="https://www.sozu.com/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'hsl(145 35% 51%)' }}>
            Términos y condiciones
          </a>
          . Ver{" "}
          <a href="https://www.sozu.com/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'hsl(145 35% 51%)' }}>
            Aviso de privacidad
          </a>
          .
        </p>
      </div>

      {/* Modal Representante Legal */}
      <Dialog open={showRepLegalModal} onOpenChange={setShowRepLegalModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" style={{ color: 'hsl(145 35% 51%)' }} />
              Representante Legal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Nombre completo</label>
              <input
                type="text"
                value={repForm.nombre}
                onChange={(e) => { setRepForm(p => ({ ...p, nombre: e.target.value })); setRepFormError(""); }}
                placeholder="Nombre del representante legal"
                className="login-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Email</label>
              <input
                type="email"
                value={repForm.email}
                onChange={(e) => { setRepForm(p => ({ ...p, email: e.target.value })); setRepFormError(""); }}
                placeholder="email@representante.com"
                className="login-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Teléfono</label>
              <div className="flex gap-3">
                <select
                  value={repForm.clave_pais_telefono}
                  onChange={(e) => setRepForm(p => ({ ...p, clave_pais_telefono: e.target.value }))}
                  className="login-input w-24 px-3"
                >
                  <option value="MX">🇲🇽 +52</option>
                  <option value="US">🇺🇸 +1</option>
                </select>
                <input
                  type="tel"
                  value={repForm.telefono}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setRepForm(p => ({ ...p, telefono: value }));
                    setRepFormError("");
                  }}
                  placeholder="10 dígitos"
                  className="login-input flex-1"
                />
              </div>
            </div>

            {repFormError && (
              <p className="text-xs text-red-500">{repFormError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowRepLegalModal(false)} className="login-btn-outline flex-1">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveRepLegal} className="login-btn-primary flex-1">
                Guardar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
