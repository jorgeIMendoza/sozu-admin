import AmbassadorsPortalTab from "@/components/ambassadors/AmbassadorsPortalTab";

// El portal de embajadores es una sola vista (AmbassadorsPortalTab) que
// internamente maneja sus propias secciones (Inicio / Mis Referidos /
// Registrar / Comisiones / Perfil) con su navegación interna.
// Cada ruta del admin renderiza el mismo componente.
export default AmbassadorsPortalTab;

export const EmbajadorInicio = AmbassadorsPortalTab;
export const EmbajadorMisReferidos = AmbassadorsPortalTab;
export const EmbajadorRegistrarReferido = AmbassadorsPortalTab;
export const EmbajadorComisiones = AmbassadorsPortalTab;
export const EmbajadorPerfil = AmbassadorsPortalTab;
