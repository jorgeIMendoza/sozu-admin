import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Settings2, Users, Shield, Link2, Bell, Database, ChevronRight } from 'lucide-react';

const sections = [
  { title: 'Perfil y usuarios', description: 'Gestiona cuentas de usuario, perfiles y acceso al sistema.', icon: Users },
  { title: 'Roles y permisos', description: 'Define roles, niveles de acceso y políticas de autorización.', icon: Shield },
  { title: 'Integraciones', description: 'Conecta con SOZU, Google Docs, MiFiel y servicios de KYC.', icon: Link2 },
  { title: 'Notificaciones y automatizaciones', description: 'Configura reglas de notificación y flujos automáticos.', icon: Bell },
  { title: 'Catálogos auxiliares', description: 'Administra empresas, proyectos, tipos de contrato y variables.', icon: Database },
  { title: 'Preferencias del sistema', description: 'Ajustes generales, idioma, zona horaria y personalización.', icon: Settings2 },
];

export default function SettingsPage() {
  return (
    <div className="px-10 py-8 max-w-3xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-[24px] font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Administración del sistema y preferencias generales</p>
      </motion.div>

      <div className="space-y-3">
        {sections.map((sec, i) => (
          <motion.div
            key={sec.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="panel hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4 px-5 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/8 group-hover:text-primary transition-colors shrink-0">
                <sec.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold group-hover:text-primary transition-colors">{sec.title}</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">{sec.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] font-medium text-muted-foreground/60 group-hover:text-primary transition-colors">Próximamente</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
