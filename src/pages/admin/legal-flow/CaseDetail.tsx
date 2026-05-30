import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, FileText, Users, Clock, AlertCircle, CheckCircle2,
  Circle, Download, Eye, ChevronRight, Shield, Fingerprint, PenTool, Zap,
  Info, FileCheck, Send, Archive, XCircle, ClipboardCheck, Building2, User, Calendar, Hash, Landmark, Receipt,
  Plus, MessageSquare, AlertTriangle, Handshake, Bell, StickyNote, Pencil, Trash2, Filter,
  UserCheck, ChevronDown, ShieldCheck, CircleAlert, Phone, Mail, Copy, MapPin, X,
  Search, RotateCcw, Scale, FileSearch, RefreshCw, Stamp, Upload, FileUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  mockRequests, mockTimeline, STATUS_CONFIG, REQUEST_TYPE_LABELS,
  TIMELINE_EVENT_CONFIG, SIGNER_STATUS_CONFIG, DOCUMENT_STATUS_CONFIG,
} from '@/data/legalFlow/mockData';
import { useLegalFlowSolicitudesRecibidas } from '@/hooks/useLegalFlowSolicitudesRecibidas';
import { useLegalFlowExpedientesArchivados } from '@/hooks/useLegalFlowExpedientesArchivados';
import { Loader2 } from 'lucide-react';
import type { CaseStatus, CompradorDetalle, IntegrationStatus, TipoPersona } from '@/types/legal-flow';

// ── Mock data for clickable detail drawers ──

interface RequesterProfile {
  name: string;
  phone: string;
  email: string;
  type: 'independiente' | 'inmobiliaria';
  inmobiliaria?: string;
}

const REQUESTER_PROFILES: Record<string, RequesterProfile> = {
  'Pablo Espinosa': { name: 'Pablo Espinosa', phone: '+52 33 1234 5678', email: 'pablo.espinosa@sozu.mx', type: 'independiente' },
  'Rodrigo Ter Veen': { name: 'Rodrigo Ter Veen', phone: '+52 33 2345 6789', email: 'rodrigo.terveen@sozu.mx', type: 'inmobiliaria', inmobiliaria: 'Red Aliados Premium' },
  'Yenisse Delgadillo': { name: 'Yenisse Delgadillo', phone: '+52 33 3456 7890', email: 'yenisse.delgadillo@sozu.mx', type: 'independiente' },
  'Abel Salazar': { name: 'Abel Salazar', phone: '+52 33 4567 8901', email: 'abel.salazar@sozu.mx', type: 'inmobiliaria', inmobiliaria: 'Broker Partner Network' },
  'Diana Castañeda': { name: 'Diana Castañeda', phone: '+52 33 5678 9012', email: 'diana.castaneda@sozu.mx', type: 'independiente' },
  'Roberto Fuentes': { name: 'Roberto Fuentes', phone: '+52 33 6789 0123', email: 'roberto.fuentes@sozu.mx', type: 'independiente' },
  'Alejandro Ruiz': { name: 'Alejandro Ruiz', phone: '+52 33 7890 1234', email: 'alejandro.ruiz@sozu.mx', type: 'independiente' },
  'Fernando Ibarra': { name: 'Fernando Ibarra', phone: '+52 33 8901 2345', email: 'fernando.ibarra@sozu.mx', type: 'independiente' },
  'Mariana Delgado': { name: 'Mariana Delgado', phone: '+52 33 9012 3456', email: 'mariana.delgado@sozu.mx', type: 'independiente' },
};

interface CounterpartyDetail {
  name: string;
  tipo: 'Persona física' | 'Persona moral';
  phone: string;
  email: string;
  rfc: string;
  representante?: string;
  documents: { name: string; status: 'cargado' | 'pendiente' | 'validado' }[];
}

const COUNTERPARTY_DETAILS: Record<string, CounterpartyDetail> = {
  'Mariana Gómez Herrera': { name: 'Mariana Gómez Herrera', tipo: 'Persona física', phone: '+52 33 5111 2233', email: 'mgomez@gmail.com', rfc: 'GOMH920815MGTRRR04', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'pendiente' }, { name: 'CURP', status: 'cargado' }] },
  'José Luis Cárdenas Romero': { name: 'José Luis Cárdenas Romero', tipo: 'Persona física', phone: '+52 33 5222 3344', email: 'jlcardenas@outlook.com', rfc: 'CARJ880304HDFRMS09', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'cargado' }, { name: 'Comprobante de domicilio', status: 'cargado' }] },
  'María Fernanda Castro Díaz': { name: 'María Fernanda Castro Díaz', tipo: 'Persona física', phone: '+52 33 5333 4455', email: 'mfcastro@outlook.com', rfc: 'CADM950622MGTRSZ07', documents: [{ name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }, { name: 'CURP', status: 'validado' }] },
  'Fernanda Salas Ortega': { name: 'Fernanda Salas Ortega', tipo: 'Persona física', phone: '+52 33 5444 5566', email: 'fsalas@gmail.com', rfc: 'SAOF900312MGTLRR08', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'pendiente' }, { name: 'Comprobante de domicilio', status: 'pendiente' }] },
  'Daniel Arriaga Méndez': { name: 'Daniel Arriaga Méndez', tipo: 'Persona física', phone: '+52 33 5555 6677', email: 'darriaga@hotmail.com', rfc: 'AIMD870715HGTRNN05', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'cargado' }, { name: 'Comprobante de domicilio', status: 'cargado' }, { name: 'CURP', status: 'pendiente' }] },
  'Inmuebles Urbanos del Pacífico, S. de R.L. de C.V.': { name: 'Inmuebles Urbanos del Pacífico, S. de R.L. de C.V.', tipo: 'Persona moral', phone: '+52 33 6789 0123', email: 'legal@iupacifico.com', rfc: 'IUP2304158R2', representante: 'José Antonio Cárdenas Romero', documents: [{ name: 'Acta constitutiva', status: 'cargado' }, { name: 'Poder notarial', status: 'cargado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'cargado' }, { name: 'Constancia de situación fiscal', status: 'pendiente' }] },
  'Abel Salazar García': { name: 'Abel Salazar García', tipo: 'Persona física', phone: '+52 33 4567 8901', email: 'abel.salazar@gmail.com', rfc: 'SAGA850920HGLLRL02', documents: [{ name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }] },
  'Rodrigo Ter Veen': { name: 'Rodrigo Ter Veen', tipo: 'Persona física', phone: '+52 33 2345 6789', email: 'rodrigo.tv@outlook.com', rfc: 'TEVR900115HGTRRR03', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'pendiente' }, { name: 'Comprobante de domicilio', status: 'pendiente' }] },
  'Red Aliados Premium S.A. de C.V.': { name: 'Red Aliados Premium S.A. de C.V.', tipo: 'Persona moral', phone: '+52 33 7890 1234', email: 'lpvega@redaliados.mx', rfc: 'RAP210518KT5', representante: 'Laura Patricia Vega Hernández', documents: [{ name: 'Acta constitutiva', status: 'validado' }, { name: 'Poder notarial', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }] },
  'Broker Partner Network S.C.': { name: 'Broker Partner Network S.C.', tipo: 'Persona moral', phone: '+52 33 8901 2345', email: 'legal@bpnetwork.mx', rfc: 'BPN220310AB1', representante: 'Eduardo Martínez Leal', documents: [{ name: 'Acta constitutiva', status: 'pendiente' }, { name: 'Poder notarial', status: 'pendiente' }, { name: 'RFC', status: 'pendiente' }] },
  'Claudia Sofía Martínez Ríos': { name: 'Claudia Sofía Martínez Ríos', tipo: 'Persona física', phone: '+52 33 5678 9012', email: 'claudia.martinez@email.com', rfc: 'MARC900312HDFRLS08', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'cargado' }, { name: 'Comprobante de domicilio', status: 'pendiente' }] },
  'Luis Enrique Domínguez Vargas': { name: 'Luis Enrique Domínguez Vargas', tipo: 'Persona física', phone: '+52 33 6111 2233', email: 'ledominguez@gmail.com', rfc: 'DOVL880715HGTMRS06', documents: [{ name: 'INE', status: 'pendiente' }, { name: 'RFC', status: 'pendiente' }, { name: 'Comprobante de domicilio', status: 'pendiente' }] },
  'Patricia Morales Guzmán': { name: 'Patricia Morales Guzmán', tipo: 'Persona física', phone: '+52 33 6222 3344', email: 'pmorales@gmail.com', rfc: 'MOGP910520MGTRRL07', documents: [{ name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }] },
  'Eduardo Sánchez Paredes': { name: 'Eduardo Sánchez Paredes', tipo: 'Persona física', phone: '+52 33 6333 4455', email: 'esanchez@gmail.com', rfc: 'SAPE870310HGTNRD04', documents: [{ name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'cargado' }, { name: 'Comprobante de domicilio', status: 'cargado' }] },
  'Inmobiliaria Punto Norte S.A. de C.V.': { name: 'Inmobiliaria Punto Norte S.A. de C.V.', tipo: 'Persona moral', phone: '+52 33 6444 5566', email: 'legal@puntonorte.mx', rfc: 'IPN200815QR3', representante: 'Gabriela Torres Méndez', documents: [{ name: 'Acta constitutiva', status: 'validado' }, { name: 'Poder notarial', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }] },
  'Andrea López Fuentes': { name: 'Andrea López Fuentes', tipo: 'Persona física', phone: '+52 33 7111 2233', email: 'alopez@gmail.com', rfc: 'LOFA930415MGTPND03', documents: [{ name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' }, { name: 'Comprobante de domicilio', status: 'validado' }, { name: 'CURP', status: 'validado' }] },
};

interface ContractTypeDetail {
  name: string;
  category: string;
  description: string;
  relatedTemplate?: string;
}

const CONTRACT_TYPE_DETAILS: Record<string, ContractTypeDetail> = {
  'new_contract': { name: 'Contrato de promesa de compraventa', category: 'Inmobiliario', description: 'Documento para formalizar la promesa de compraventa de una unidad inmobiliaria previo a escrituración. Incluye condiciones de precio, plazos de pago, penalidades y cláusulas de desistimiento.', relatedTemplate: 'Contrato de promesa de compraventa' },
  'new_agreement': { name: 'Alianza comercial', category: 'Comercial', description: 'Acuerdo formal para establecer relación comercial con agentes inmobiliarios o inmobiliarias. Define esquemas de comisiones, exclusividad, obligaciones y vigencia de la alianza.', relatedTemplate: 'Alianza comercial' },
  'amendment': { name: 'Convenio modificatorio', category: 'Corporativo', description: 'Documento que formaliza cambios a un contrato existente. Puede incluir ajustes de precio, plazos de entrega, condiciones de pago o cualquier cláusula previamente acordada.', relatedTemplate: 'Convenio modificatorio comercial' },
  'renewal': { name: 'Renovación de contrato', category: 'Comercial', description: 'Extensión formal de la vigencia de un contrato o alianza existente, con posibilidad de actualizar condiciones comerciales.', relatedTemplate: 'Renovación de alianza comercial' },
  'termination': { name: 'Terminación de contrato', category: 'Corporativo', description: 'Documento que formaliza la terminación anticipada o natural de un contrato vigente, estableciendo condiciones de cierre y liquidación.' },
  'external_validation': { name: 'Validación externa', category: 'Corporativo', description: 'Proceso de validación documental y legal de entidades externas. Incluye revisión de personalidad jurídica, poderes y documentación de soporte.' },
};

interface CuentaCobranzaDetail {
  cuenta: string;
  proyecto: string;
  modelo: string;
  propiedad: string;
  metraje: string;
  precio: string;
  precioM2: string;
  ofertaComercial: string;
}

const CUENTA_COBRANZA_DETAILS: Record<string, CuentaCobranzaDetail> = {
  'CC-001696': { cuenta: 'CC-001696', proyecto: 'Bottura', modelo: 'Gala', propiedad: '1010', metraje: '112.30 m²', precio: '$6,850,000 MXN', precioM2: '$61,000 MXN', ofertaComercial: 'O-001882' },
  'CC-001690': { cuenta: 'CC-001690', proyecto: 'Bottura', modelo: 'Gala', propiedad: '1213', metraje: '98.50 m²', precio: '$7,200,000 MXN', precioM2: '$73,096 MXN', ofertaComercial: 'O-001876' },
  'CC-001664': { cuenta: 'CC-001664', proyecto: 'Daiku', modelo: 'Modena', propiedad: '304', metraje: '85.20 m²', precio: '$5,400,000 MXN', precioM2: '$63,380 MXN', ofertaComercial: 'O-001845' },
  'CC-001336': { cuenta: 'CC-001336', proyecto: 'Monócolo', modelo: 'Ébano', propiedad: '801', metraje: '94.50 m²', precio: '$9,500,000 MXN', precioM2: '$100,529 MXN', ofertaComercial: 'O-001790' },
  'CC-001315': { cuenta: 'CC-001315', proyecto: 'Red de Agentes', modelo: '—', propiedad: '—', metraje: '—', precio: '—', precioM2: '—', ofertaComercial: '—' },
  'CC-001291': { cuenta: 'CC-001291', proyecto: 'Alianzas Inmobiliarias', modelo: '—', propiedad: '—', metraje: '—', precio: '—', precioM2: '—', ofertaComercial: '—' },
};

// ── Drawer components ──

interface RequesterDrawerRealProfile {
  name: string;
  phone?: string | null;
  email?: string | null;
  empresaName?: string | null;
}

function RequesterDrawer({
  open,
  onClose,
  requester,
  realProfile,
}: {
  open: boolean;
  onClose: () => void;
  requester: string;
  realProfile?: RequesterDrawerRealProfile;
}) {
  // Cuando el expediente proviene de la BD (real) usamos realProfile;
  // si no, caemos a los perfiles mock heredados por nombre.
  const mock = REQUESTER_PROFILES[requester];
  const profile:
    | (RequesterDrawerRealProfile & { type: 'inmobiliaria' | 'independiente'; inmobiliaria?: string })
    | null = realProfile
    ? {
        name: realProfile.name,
        phone: realProfile.phone ?? null,
        email: realProfile.email ?? null,
        type: realProfile.empresaName ? 'inmobiliaria' : 'independiente',
        inmobiliaria: realProfile.empresaName ?? undefined,
      }
    : mock
      ? { ...mock }
      : null;
  if (!profile) return null;

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[400px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Detalle del solicitante</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[14px]">
              {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-[15px] font-semibold">{profile.name}</p>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                profile.type === 'inmobiliaria' ? 'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]' : 'bg-muted text-muted-foreground'
              }`}>
                <User className="h-2.5 w-2.5" />
                {profile.type === 'inmobiliaria' ? 'Ligado a empresa' : 'Agente independiente'}
              </span>
            </div>
          </div>

          {profile.type === 'inmobiliaria' && profile.inmobiliaria && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Empresa</p>
              <p className="text-[13px] font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />{profile.inmobiliaria}</p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Contacto</p>
            <div className="flex items-center justify-between rounded-lg border p-3 group hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-muted-foreground/50" />
                <div>
                  <p className="text-[11px] text-muted-foreground/60">Teléfono</p>
                  <p className="text-[13px] font-medium font-mono">{profile.phone || '—'}</p>
                </div>
              </div>
              {profile.phone && (
                <button onClick={() => copyToClipboard(profile.phone!)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 group hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-muted-foreground/50" />
                <div>
                  <p className="text-[11px] text-muted-foreground/60">Correo electrónico</p>
                  <p className="text-[13px] font-medium">{profile.email || '—'}</p>
                </div>
              </div>
              {profile.email && (
                <button onClick={() => copyToClipboard(profile.email!)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const TIPO_PERSONA_LABEL: Record<TipoPersona, 'Persona física' | 'Persona moral' | 'Persona extranjera'> = {
  pf: 'Persona física',
  pm: 'Persona moral',
  pe: 'Persona extranjera',
};

function CounterpartyDrawer({
  open,
  onClose,
  counterparties,
  realDetalle,
}: {
  open: boolean;
  onClose: () => void;
  counterparties: string[];
  realDetalle?: CompradorDetalle[];
}) {
  // Si hay datos reales (cuentas de BD), los renderizamos en un shape
  // compatible con la UI existente. Si no, caemos al mock heredado.
  const realDetails = (realDetalle ?? []).map((cd) => ({
    name: cd.name,
    tipo: TIPO_PERSONA_LABEL[cd.tipoPersona] ?? 'Persona física',
    phone: cd.phone ?? '—',
    email: cd.email ?? '—',
    rfc: cd.rfc ?? '—',
    representante: undefined as string | undefined,
    documents: [] as Array<{ name: string; status: 'cargado' | 'pendiente' | 'validado' }>,
    porcentajeCopropiedad: cd.porcentajeCopropiedad,
  }));
  const mockDetails = counterparties.map(cp => COUNTERPARTY_DETAILS[cp]).filter(Boolean);
  const details = realDetails.length > 0 ? realDetails : mockDetails;
  const docStatusStyle = (s: string) =>
    s === 'validado' ? 'bg-primary/10 text-primary' :
    s === 'cargado' ? 'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]' :
    'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[460px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Partes y documentación</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-6">
          {details.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No se encontró información detallada de las contrapartes.</p>
          ) : details.map((cp, idx) => (
            <div key={idx} className="space-y-4">
              {idx > 0 && <div className="border-t" />}
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  cp.tipo === 'Persona moral' ? 'bg-[hsl(var(--status-purple)/0.1)] text-[hsl(var(--status-purple))]' : 'bg-muted text-muted-foreground'
                }`}>
                  {cp.tipo === 'Persona moral' ? <Building2 className="h-4 w-4" /> : cp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-tight">{cp.name}</p>
                  <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                    cp.tipo === 'Persona moral' ? 'bg-[hsl(var(--status-purple)/0.1)] text-[hsl(var(--status-purple))]' : 'bg-muted text-muted-foreground'
                  }`}>{cp.tipo}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Teléfono</p>
                  <p className="text-[13px] font-mono">{cp.phone}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Correo</p>
                  <p className="text-[13px] truncate">{cp.email}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">RFC</p>
                  <p className="text-[13px] font-mono">{cp.rfc}</p>
                </div>
                {cp.representante && (
                  <div>
                    <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Representante legal</p>
                    <p className="text-[13px] font-medium">{cp.representante}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Documentación de soporte</p>
                <div className="space-y-1.5">
                  {cp.documents.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground italic">
                      Documentación pendiente de cargar.
                    </p>
                  ) : (
                    cp.documents.map((doc, di) => (
                      <div key={di} className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <span className="text-[13px]">{doc.name}</span>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${docStatusStyle(doc.status)}`}>{doc.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContractTypeDrawer({ open, onClose, type }: { open: boolean; onClose: () => void; type: string }) {
  const detail = CONTRACT_TYPE_DETAILS[type];
  if (!detail) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[400px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Detalle del tipo de contrato</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Tipo de contrato</p>
            <p className="text-[16px] font-semibold">{detail.name}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Categoría</p>
            <span className="inline-flex items-center text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">{detail.category}</span>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1.5">Descripción</p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{detail.description}</p>
          </div>
          {detail.relatedTemplate && (
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Plantilla relacionada</p>
              <p className="text-[13px] font-medium flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground/50" />{detail.relatedTemplate}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CuentaCobranzaDrawer({ open, onClose, cuenta }: { open: boolean; onClose: () => void; cuenta: string }) {
  const detail = CUENTA_COBRANZA_DETAILS[cuenta];
  if (!detail) return null;
  const hasPropertyData = detail.modelo !== '—';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[420px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Detalle de cuenta de cobranza</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-bold font-mono">{detail.cuenta}</p>
              <p className="text-[12px] text-muted-foreground">{detail.proyecto}</p>
            </div>
          </div>

          {hasPropertyData ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Modelo</p>
                  <p className="text-[14px] font-medium">{detail.modelo}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">No. propiedad</p>
                  <p className="text-[14px] font-mono font-medium">{detail.propiedad}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Metraje</p>
                  <p className="text-[14px] font-mono font-medium">{detail.metraje}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Precio</p>
                  <p className="text-[15px] font-bold font-mono">{detail.precio}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Precio por m²</p>
                  <p className="text-[14px] font-medium font-mono">{detail.precioM2}</p>
                </div>
              </div>
              {detail.ofertaComercial !== '—' && (
                <div className="rounded-lg border p-3 hover:bg-muted/20 transition-colors cursor-pointer group">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1.5">Oferta comercial</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-mono font-medium">{detail.ofertaComercial}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-[12px] gap-1 text-primary">
                      <Download className="h-3 w-3" /> Descargar
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-[13px] text-muted-foreground">Esta cuenta no tiene datos de propiedad inmobiliaria asociados.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const AVAILABLE_LAWYERS = [
  { id: 'vladimir', name: 'Vladimir Huerta' },
  { id: 'miguel', name: 'Miguel Ochoa' },
];

// ── Template options for Revisión stage ──
const LEGAL_TEMPLATES = [
  { id: 'tpl-bot-pf', label: 'Bottura — Persona Física — Contrato de promesa de compraventa', project: 'Bottura', profile: 'Persona Física' },
  { id: 'tpl-bot-pm', label: 'Bottura — Persona Moral — Contrato de promesa de compraventa', project: 'Bottura', profile: 'Persona Moral' },
  { id: 'tpl-bot-co', label: 'Bottura — CoPropiedad — Contrato de promesa de compraventa', project: 'Bottura', profile: 'CoPropiedad' },
  { id: 'tpl-dai-pf', label: 'Daiku — Persona Física — Contrato de promesa de compraventa', project: 'Daiku', profile: 'Persona Física' },
  { id: 'tpl-dai-pm', label: 'Daiku — Persona Moral — Contrato de promesa de compraventa', project: 'Daiku', profile: 'Persona Moral' },
  { id: 'tpl-dai-co', label: 'Daiku — CoPropiedad — Contrato de promesa de compraventa', project: 'Daiku', profile: 'CoPropiedad' },
  { id: 'tpl-ali-ag', label: 'Alianza comercial — Agente inmobiliario', project: 'Comercial', profile: 'Agente' },
  { id: 'tpl-ali-in', label: 'Alianza comercial — Inmobiliaria', project: 'Comercial', profile: 'Inmobiliaria' },
  { id: 'tpl-conv', label: 'Convenio modificatorio comercial', project: 'Corporativo', profile: 'General' },
];

// ── Signer detail data for Revisión ──
interface SignerReviewDetail {
  name: string;
  signerType: string;
  role: string;
  personType: 'Persona física' | 'Persona moral' | 'Representante de persona moral';
  phone: string;
  email: string;
  rfc: string;
  curp?: string;
  relation: string;
  documents: { name: string; status: 'cargado' | 'validado' | 'pendiente' | 'inconsistente' }[];
  validations: { field: string; status: 'ok' | 'warning' | 'error' }[];
}

const SIGNER_REVIEW_DETAILS: Record<string, SignerReviewDetail> = {
  'Carlos Mendoza': {
    name: 'Carlos Mendoza', signerType: 'Representante Legal', role: 'Representante legal',
    personType: 'Representante de persona moral', phone: '+52 33 1234 0001', email: 'cmendoza@sozu.mx', rfc: 'MERC850720HGTNDL05', relation: 'Firmante interno representando al titular',
    documents: [
      { name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' },
      { name: 'Poder notarial', status: 'validado' }, { name: 'Constancia de situación fiscal', status: 'validado' },
    ],
    validations: [
      { field: 'Nombre coincide', status: 'ok' }, { field: 'RFC coincide', status: 'ok' },
      { field: 'Representación legal válida', status: 'ok' }, { field: 'Documento legible', status: 'ok' },
    ],
  },
  'Roberto Fuentes': {
    name: 'Roberto Fuentes', signerType: 'Director General', role: 'Director general',
    personType: 'Persona física', phone: '+52 33 6789 0123', email: 'roberto.fuentes@sozu.mx', rfc: 'FURB880410HGTBRT06', relation: 'Firmante interno con poder de firma',
    documents: [
      { name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' },
      { name: 'Poder notarial', status: 'validado' },
    ],
    validations: [
      { field: 'Nombre coincide', status: 'ok' }, { field: 'RFC coincide', status: 'ok' },
      { field: 'Representación legal válida', status: 'ok' }, { field: 'Documento legible', status: 'ok' },
    ],
  },
  'Mariana Gómez Herrera': {
    name: 'Mariana Gómez Herrera', signerType: 'Compradora', role: 'Comprador',
    personType: 'Persona física', phone: '+52 33 5111 2233', email: 'mgomez@gmail.com', rfc: 'GOMH920815MGTRRR04', curp: 'GOMH920815MJCRRR04', relation: 'Compradora de la unidad inmobiliaria',
    documents: [
      { name: 'INE', status: 'cargado' }, { name: 'RFC', status: 'validado' },
      { name: 'Comprobante de domicilio', status: 'pendiente' }, { name: 'CURP', status: 'cargado' },
    ],
    validations: [
      { field: 'Nombre coincide', status: 'ok' }, { field: 'RFC coincide', status: 'ok' },
      { field: 'Documento legible', status: 'ok' }, { field: 'Comprobante de domicilio', status: 'warning' },
    ],
  },
  'Ana Lucía Restrepo': {
    name: 'Ana Lucía Restrepo', signerType: 'Abogada revisora', role: 'Representante legal',
    personType: 'Persona física', phone: '+52 33 2222 3344', email: 'arestrepo@sozu.mx', rfc: 'RERA900515MGTSTR08', relation: 'Firmante interno — abogada de operaciones',
    documents: [
      { name: 'INE', status: 'validado' }, { name: 'RFC', status: 'validado' },
    ],
    validations: [
      { field: 'Nombre coincide', status: 'ok' }, { field: 'RFC coincide', status: 'ok' },
    ],
  },
};

function getSignerReviewDetail(name: string): SignerReviewDetail {
  return SIGNER_REVIEW_DETAILS[name] || {
    name, signerType: 'Firmante', role: 'Parte contratante',
    personType: 'Persona física', phone: '—', email: '—', rfc: '—', relation: 'Firmante del contrato',
    documents: [{ name: 'INE', status: 'pendiente' }, { name: 'RFC', status: 'pendiente' }],
    validations: [{ field: 'Nombre coincide', status: 'warning' }, { field: 'RFC coincide', status: 'warning' }],
  };
}

// ── Signer Review Drawer ──
function SignerReviewDrawer({ open, onClose, signerName }: { open: boolean; onClose: () => void; signerName: string }) {
  const detail = getSignerReviewDetail(signerName);
  const docStatusStyle = (s: string) =>
    s === 'validado' ? 'bg-primary/10 text-primary' :
    s === 'cargado' ? 'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]' :
    s === 'inconsistente' ? 'bg-destructive/10 text-destructive' :
    'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]';
  const valIcon = (s: string) =>
    s === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> :
    s === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
    <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-warning))]" />;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[460px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-[16px]">Detalle del firmante</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[14px]">
              {detail.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-[15px] font-semibold">{detail.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{detail.signerType}</span>
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]">{detail.personType}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-3">Datos generales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Rol</p>
                <p className="text-[13px] font-medium mt-0.5">{detail.role}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">RFC</p>
                <p className="text-[13px] font-mono mt-0.5">{detail.rfc}</p>
              </div>
              {detail.curp && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">CURP</p>
                  <p className="text-[13px] font-mono mt-0.5">{detail.curp}</p>
                </div>
              )}
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Teléfono</p>
                <p className="text-[13px] font-mono mt-0.5">{detail.phone}</p>
              </div>
              <div className="rounded-lg border p-2.5 col-span-2">
                <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Correo</p>
                <p className="text-[13px] mt-0.5">{detail.email}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-2.5 col-span-2">
                <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Relación con la operación</p>
                <p className="text-[13px] mt-0.5">{detail.relation}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Documentación de soporte</p>
            <div className="space-y-1.5">
              {detail.documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-[13px]">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${docStatusStyle(doc.status)}`}>{doc.status}</span>
                    {(doc.status === 'cargado' || doc.status === 'validado') && (
                      <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                        <Eye className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Cotejo documental</p>
            <div className="space-y-1.5">
              {detail.validations.map((v, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                  {valIcon(v.status)}
                  <span className="text-[13px]">{v.field}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const PROGRESSION_STEPS = [
  { key: 'request_received', label: 'Recibida', step: 0 },
  { key: 'in_legal_review', label: 'Revisión', step: 1 },
  { key: 'approved_for_generation', label: 'Aprobada', step: 2 },
  { key: 'client_signature', label: 'Firma de cliente', step: 3 },
  { key: 'in_validation', label: 'Firma titular', step: 4 },
  { key: 'fully_signed', label: 'Firmado', step: 5 },
];

const NEXT_ACTIONS: Record<string, { label: string; icon: React.ElementType; primary?: boolean }[]> = {
  missing_information: [{ label: 'Completar información', icon: Info, primary: true }],
  in_signature_process: [
    { label: 'Seguimiento de firma', icon: Send, primary: true },
    { label: 'Descargar PDF', icon: Download },
  ],
  partially_signed: [
    { label: 'Seguimiento de firma', icon: Send, primary: true },
    { label: 'Descargar PDF', icon: Download },
  ],
};

function StatusStepper({ status }: { status: CaseStatus }) {
  const config = STATUS_CONFIG[status];
  const currentStep = config.step;
  const isTerminal = currentStep === -1;
  const isArchived = status === 'archived';

  return (
    <div className="panel">
      <div className="px-6 py-5">
        {isArchived ? (
          <div className="flex items-center gap-2.5 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Archive className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-muted-foreground">Este expediente ha sido archivado. Proceso completado.</span>
          </div>
        ) : isTerminal ? (
          <div className="flex items-center gap-2.5 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <span className="font-medium">Este expediente ha sido {status === 'rejected' ? 'rechazado' : 'cancelado'}.</span>
          </div>
        ) : (
          <div className="flex items-center">
            {PROGRESSION_STEPS.map((step, i) => {
              const isComplete = currentStep > step.step;
              const isCurrent = currentStep === step.step;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center gap-2 min-w-0">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-300 shrink-0 ${
                      isComplete ? 'bg-primary text-primary-foreground' :
                      isCurrent ? 'bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]' :
                      'bg-muted text-muted-foreground/60'
                    }`}>
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${
                      isCurrent ? 'text-primary font-semibold' :
                      currentStep < step.step ? 'text-muted-foreground/40' : 'text-foreground/70'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < PROGRESSION_STEPS.length - 1 && (
                    <div className={`h-[2px] flex-1 mx-2 mt-[-20px] rounded-full transition-colors duration-300 ${
                      isComplete ? 'bg-primary' : 'bg-border'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationCard({ name, icon: Icon, status, detail, color }: {
  name: string; icon: React.ElementType; status: IntegrationStatus; detail?: string; color: string;
}) {
  const styles: Record<IntegrationStatus, string> = {
    idle: 'integration-idle', pending: 'integration-pending', connected: 'integration-connected', error: 'integration-error',
  };
  const statusLabels: Record<IntegrationStatus, string> = {
    idle: 'Sin iniciar', pending: 'Pendiente', connected: 'Conectado', error: 'Error',
  };
  return (
    <div className={`integration-chip ${styles[status]}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[13px]">{name}</p>
        <p className="text-[11px] opacity-60 mt-0.5">{statusLabels[status]}</p>
        {detail && <p className="text-[11px] font-mono truncate opacity-50 mt-0.5">{detail}</p>}
      </div>
      <ChevronRight className="h-4 w-4 opacity-30 shrink-0" />
    </div>
  );
}

function RecibidaActions({
  assignedLawyer, onAssignLawyer, intakeValidation, onMarkComplete, onMarkMissing, onAdvance,
}: {
  assignedLawyer: string | null; onAssignLawyer: (id: string) => void;
  intakeValidation: 'pending' | 'complete' | 'missing'; onMarkComplete: () => void; onMarkMissing: () => void; onAdvance: () => void;
}) {
  const canAdvance = assignedLawyer !== null && intakeValidation === 'complete';

  return (
    <div className="panel">
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Próxima acción — Intake legal</span>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            assignedLawyer ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {assignedLawyer ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[13px] font-bold">1</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold">Asignar abogado responsable</p>
            <div className="mt-2.5 max-w-[260px]">
              <Select value={assignedLawyer || ''} onValueChange={onAssignLawyer}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Seleccionar abogado" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_LAWYERS.map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-[13px]">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            intakeValidation === 'complete' ? 'bg-primary/10 text-primary' :
            intakeValidation === 'missing' ? 'bg-destructive/10 text-destructive' :
            'bg-muted text-muted-foreground'
          }`}>
            {intakeValidation === 'complete' ? <CheckCircle2 className="h-4 w-4" /> :
             intakeValidation === 'missing' ? <CircleAlert className="h-4 w-4" /> :
             <span className="text-[13px] font-bold">2</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold">Validación de información inicial</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {intakeValidation === 'complete'
                ? 'Información validada como completa.'
                : intakeValidation === 'missing'
                ? 'Información faltante registrada.'
                : '¿La información está completa para iniciar revisión?'}
            </p>
            {intakeValidation === 'pending' && (
              <div className="flex gap-2 mt-2.5">
                <Button variant="default" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg" onClick={onMarkComplete}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completa
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg text-destructive hover:text-destructive" onClick={onMarkMissing}>
                  <CircleAlert className="h-3.5 w-3.5" /> Faltante
                </Button>
              </div>
            )}
            {intakeValidation === 'missing' && (
              <div className="flex gap-2 mt-2.5">
                <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg" onClick={onMarkComplete}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como completa
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          {canAdvance ? (
            <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={onAdvance}>
              <ChevronRight className="h-4 w-4" /> Pasar a Revisión
            </Button>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 border border-border/60 p-3.5">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Para avanzar:{' '}
                {!assignedLawyer && <strong className="text-foreground">asignar abogado</strong>}
                {!assignedLawyer && intakeValidation !== 'complete' && ' y '}
                {intakeValidation !== 'complete' && <strong className="text-foreground">validar información</strong>}
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RevisionActions ──
function RevisionActions({
  signers, selectedTemplate, onSelectTemplate, reviewChecklist, onToggleCheck, onOpenSignerDetail, onApprove, onReturn,
}: {
  signers: { id: string; name: string; signerType: string; role: 'internal' | 'external' }[];
  selectedTemplate: string | null; onSelectTemplate: (id: string) => void;
  reviewChecklist: Record<string, boolean>; onToggleCheck: (key: string) => void;
  onOpenSignerDetail: (name: string) => void; onApprove: () => void; onReturn: () => void;
}) {
  const checklistItems = [
    { key: 'template', label: 'Plantilla correcta seleccionada', auto: !!selectedTemplate },
    { key: 'signers', label: 'Firmantes revisados' },
    { key: 'documents', label: 'Documentación cotejada' },
    { key: 'data', label: 'Datos listos para generación' },
  ];

  const allChecked = !!selectedTemplate && checklistItems.every(c => c.auto || reviewChecklist[c.key]);

  return (
    <div className="panel">
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Revisión legal</span>
        </div>

        {/* Step 1: Template selection */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            selectedTemplate ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {selectedTemplate ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[13px] font-bold">1</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold">Seleccionar plantilla legal</p>
            <div className="mt-2.5">
              <Select value={selectedTemplate || ''} onValueChange={onSelectTemplate}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Seleccionar plantilla" />
                </SelectTrigger>
                <SelectContent className="max-w-[460px]">
                  {LEGAL_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-[13px]">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {LEGAL_TEMPLATES.find(t => t.id === selectedTemplate)?.profile}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {LEGAL_TEMPLATES.find(t => t.id === selectedTemplate)?.project}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Signer review */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            reviewChecklist['signers'] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {reviewChecklist['signers'] ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[13px] font-bold">2</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold">Revisar firmantes</p>
            {signers.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {signers.map(s => (
                  <div
                    key={s.id}
                    onClick={() => onOpenSignerDetail(s.name)}
                    className="flex items-center justify-between rounded-lg border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        s.role === 'internal' ? 'bg-primary/8 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground/60">{s.signerType} · {s.role === 'internal' ? 'Interno' : 'Externo'}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground/60 mt-2">No hay firmantes configurados aún.</p>
            )}
          </div>
        </div>

        {/* Step 3: Validation checklist */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            allChecked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {allChecked ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[13px] font-bold">3</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold">Checklist de revisión</p>
            <div className="mt-2.5 space-y-1.5">
              {checklistItems.map(item => {
                const checked = item.auto || reviewChecklist[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      item.auto ? 'opacity-70' : 'cursor-pointer hover:bg-muted/30'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 transition-colors ${
                      checked ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-[13px] ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                    {!item.auto && !checked && (
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggleCheck(item.key)} />
                    )}
                    {item.auto && <span className="text-[10px] text-muted-foreground/50 ml-auto">Auto</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Decision */}
        <div className="border-t pt-4 space-y-2.5">
          {allChecked ? (
            <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={onApprove}>
              <CheckCircle2 className="h-4 w-4" /> Aprobar generación
            </Button>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 border border-border/60 p-3.5">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Completa la revisión para habilitar la generación.
              </p>
            </div>
          )}
          <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg w-full text-destructive hover:text-destructive" onClick={onReturn}>
            <RotateCcw className="h-3.5 w-3.5" /> Regresar a Recibida
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Contract preview clauses for Aprobada stage ──
const CONTRACT_PREVIEW_CLAUSES = [
  { num: 'I', title: 'Antecedentes', text: 'Las partes declaran que han convenido celebrar el presente contrato de promesa de compraventa respecto del inmueble descrito en la cláusula siguiente, sujeto a los términos y condiciones que se establecen a continuación.' },
  { num: 'II', title: 'Objeto del contrato', text: 'El Promitente Vendedor se obliga a vender, y el Promitente Comprador se obliga a comprar, la unidad inmobiliaria identificada como [UNIDAD], ubicada en el desarrollo [PROYECTO], con una superficie aproximada de [METRAJE] m², por el precio total pactado en la cláusula de precio.' },
  { num: 'III', title: 'Precio y forma de pago', text: 'El precio total de la operación será de [PRECIO] MXN (Moneda Nacional), pagadero conforme al esquema de pagos que se detalla en el Anexo A del presente contrato.' },
  { num: 'IV', title: 'Plazo y condiciones de escrituración', text: 'Las partes acuerdan que la escritura definitiva de compraventa se otorgará dentro de un plazo máximo de [PLAZO] días naturales contados a partir de la firma del presente instrumento.' },
  { num: 'V', title: 'Penalidades por incumplimiento', text: 'En caso de incumplimiento por parte del Promitente Comprador, el Promitente Vendedor podrá rescindir el presente contrato y retener como pena convencional el equivalente al [PENALIDAD]% del precio total pactado.' },
  { num: 'VI', title: 'Declaraciones de las partes', text: 'Ambas partes declaran bajo protesta de decir verdad que cuentan con la capacidad legal necesaria para celebrar el presente contrato y que no existe impedimento legal alguno para ello.' },
  { num: 'VII', title: 'Jurisdicción y legislación aplicable', text: 'Para la interpretación y cumplimiento del presente contrato, las partes se someten a la jurisdicción de los tribunales competentes de la ciudad de Guadalajara, Jalisco.' },
];

// ── AprobadaActions ──
function AprobadaActions({
  request, onGenerate, onReturn, previewChecklist, onTogglePreviewCheck,
}: {
  request: { title: string; project: string; property?: string; templateName?: string; counterparty: string; counterparties?: string[] };
  onGenerate: () => void; onReturn: () => void;
  previewChecklist: Record<string, boolean>; onTogglePreviewCheck: (key: string) => void;
}) {
  const checklistItems = [
    { key: 'template', label: 'Plantilla correcta' },
    { key: 'parties', label: 'Datos de las partes' },
    { key: 'commercial', label: 'Información comercial' },
    { key: 'clauses', label: 'Cláusulas revisadas' },
    { key: 'structure', label: 'Estructura legal' },
    { key: 'ready', label: 'Listo para generar' },
  ];

  const allChecked = checklistItems.every(c => previewChecklist[c.key]);

  return (
    <div className="space-y-5">
      {/* Contract preview */}
      <div className="panel">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSearch className="h-4 w-4 text-muted-foreground/60" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Vista previa del contrato</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]">
            <Circle className="h-2 w-2 fill-current" /> Borrador sincronizado
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border bg-muted/20 p-5">
            <p className="text-[16px] font-bold leading-tight">{request.title}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{request.project} {request.property && `· ${request.property}`}</p>
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-5 max-h-[420px] overflow-y-auto">
            <div className="text-center border-b pb-4">
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-semibold">Borrador de contrato</p>
              <p className="text-[15px] font-bold mt-1">CONTRATO DE PROMESA DE COMPRAVENTA</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Que celebran por una parte <strong>Tallwood</strong> como Promitente Vendedor y por otra parte{' '}
                <strong>{request.counterparties?.[0] || request.counterparty}</strong> como Promitente Comprador.
              </p>
            </div>

            {CONTRACT_PREVIEW_CLAUSES.map((clause) => (
              <div key={clause.num} className="group">
                <p className="text-[13px] font-semibold text-foreground">
                  Cláusula {clause.num}. {clause.title}
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5">{clause.text}</p>
              </div>
            ))}

            <div className="border-t pt-4 mt-6">
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-semibold mb-3">Firmas</p>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="border-b border-dashed border-muted-foreground/30 pb-8 mb-2" />
                  <p className="text-[12px] font-medium">Promitente Vendedor</p>
                  <p className="text-[11px] text-muted-foreground">Tallwood</p>
                </div>
                <div className="text-center">
                  <div className="border-b border-dashed border-muted-foreground/30 pb-8 mb-2" />
                  <p className="text-[12px] font-medium">Promitente Comprador</p>
                  <p className="text-[11px] text-muted-foreground">{request.counterparties?.[0] || request.counterparty}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg">
              <ExternalLink className="h-3 w-3" /> Google Docs
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg">
              <RefreshCw className="h-3 w-3" /> Actualizar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg">
              <Download className="h-3 w-3" /> Descargar
            </Button>
          </div>
        </div>
      </div>

      {/* Validation + action panel */}
      <div className="panel">
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Stamp className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Control previo a generación</span>
          </div>

          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
            {checklistItems.map(item => {
              const checked = previewChecklist[item.key];
              return (
                <label key={item.key} className="flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 transition-colors ${
                    checked ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <span className={`text-[13px] ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                  <input type="checkbox" className="sr-only" checked={!!checked} onChange={() => onTogglePreviewCheck(item.key)} />
                </label>
              );
            })}
          </div>

          <div className="border-t pt-4 space-y-2.5">
            {allChecked ? (
              <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={onGenerate}>
                <FileCheck className="h-4 w-4" /> Validar y generar contrato
              </Button>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 border border-border/60 p-3.5">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Confirma todos los puntos para habilitar la generación.
                </p>
              </div>
            )}
            <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg w-full text-destructive hover:text-destructive" onClick={onReturn}>
              <RotateCcw className="h-3.5 w-3.5" /> Regresar a Revisión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock observations for Firma de cliente ──
type ObsStatus = 'pending' | 'in_analysis' | 'approved' | 'rejected' | 'clarification_sent' | 'counterproposal_sent' | 'resolved';
type ObsType = 'redaccion' | 'economico' | 'datos' | 'clausula' | 'adicion';
type ObsImpact = 'bajo' | 'medio' | 'alto';

interface CounterpartyObservation {
  id: string; title: string; from: string; date: string; description: string;
  clauseAffected?: string; obsType?: ObsType; impact?: ObsImpact; status: ObsStatus;
  resolution?: { by: string; date: string; reason: string; action?: string };
}

const MOCK_OBSERVATIONS: CounterpartyObservation[] = [
  { id: 'obs-1', title: 'Ajuste en cláusula de penalización', from: 'Mariana Gómez Herrera', date: '2026-03-22T10:30:00', description: 'La contraparte solicita reducir el porcentaje de penalización por incumplimiento del 15% al 10%.', clauseAffected: 'Cláusula 12 — Penalización por incumplimiento', obsType: 'economico', impact: 'alto', status: 'pending' },
  { id: 'obs-2', title: 'Corrección del nombre del comprador', from: 'José Luis Cárdenas Romero', date: '2026-03-22T11:15:00', description: 'El segundo nombre aparece incorrecto en el borrador.', clauseAffected: 'Declaraciones — Datos del comprador', obsType: 'datos', impact: 'bajo', status: 'approved', resolution: { by: 'Vladimir Huerta', date: '2026-03-22T14:00:00', reason: 'El ajuste es consistente con la documentación oficial.' } },
  { id: 'obs-3', title: 'Solicitud para agregar obligado solidario', from: 'Daniel Arriaga Méndez', date: '2026-03-23T09:00:00', description: 'Solicitan incorporar a una segunda persona como obligada solidaria en el contrato.', clauseAffected: 'Cláusula 5 — Partes y representación', obsType: 'adicion', impact: 'alto', status: 'pending' },
];

const obsStatusConfig: Record<string, { label: string; style: string }> = {
  pending: { label: 'Pendiente', style: 'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]' },
  in_analysis: { label: 'En análisis', style: 'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]' },
  approved: { label: 'Aprobada', style: 'bg-primary/10 text-primary' },
  rejected: { label: 'Rechazada', style: 'bg-destructive/10 text-destructive' },
  clarification_sent: { label: 'Aclaración enviada', style: 'bg-[hsl(var(--status-purple)/0.1)] text-[hsl(var(--status-purple))]' },
  counterproposal_sent: { label: 'Contrapropuesta enviada', style: 'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]' },
  resolved: { label: 'Resuelta', style: 'bg-primary/10 text-primary' },
};

const obsTypeLabels: Record<string, string> = {
  redaccion: 'Redacción', economico: 'Económico', datos: 'Datos', clausula: 'Cláusula', adicion: 'Adición',
};

const obsImpactLabels: Record<string, { label: string; style: string }> = {
  bajo: { label: 'Bajo', style: 'bg-muted text-muted-foreground' },
  medio: { label: 'Medio', style: 'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]' },
  alto: { label: 'Alto', style: 'bg-destructive/10 text-destructive' },
};

// ── FirmaClienteActions ──
function FirmaClienteActions({
  signers, observations: initialObs, onAdvance, onReturn,
}: {
  signers: { id: string; name: string; signerType: string; role: 'internal' | 'external'; status: string; signedAt?: string; signatureMethod?: 'digital' | 'physical'; uploadedSignedDoc?: { fileName: string; uploadedAt: string; uploadedBy: string; status: string; version?: number } }[];
  observations: CounterpartyObservation[]; onAdvance: () => void; onReturn: () => void;
}) {
  const [observations, setObservations] = useState(initialObs);
  const [activeDecision, setActiveDecision] = useState<{ obs: CounterpartyObservation; action: 'approve' | 'reject' | 'clarify' | 'counterproposal' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionImpact, setDecisionImpact] = useState<'menor' | 'moderado' | 'relevante'>('menor');
  const [decisionRequiresUpdate, setDecisionRequiresUpdate] = useState(false);
  const [decisionRequiresResend, setDecisionRequiresResend] = useState(false);
  const [rejectBasis, setRejectBasis] = useState<'juridico' | 'comercial' | 'politica' | 'operativo'>('juridico');
  const [rejectFollowUp, setRejectFollowUp] = useState<'mantener' | 'contrapropuesta' | 'revision' | 'escalar'>('mantener');
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [counterproposalText, setCounterproposalText] = useState('');
  const [detailObs, setDetailObs] = useState<CounterpartyObservation | null>(null);

  const externalSigners = signers.filter(s => s.role === 'external');
  const internalSigners = signers.filter(s => s.role === 'internal');
  const signedCount = externalSigners.filter(s => s.status === 'signed').length;
  const allExternalSigned = externalSigners.length > 0 && externalSigners.every(s => s.status === 'signed');
  const unresolvedObs = observations.filter(o => o.status === 'pending' || o.status === 'in_analysis').length;
  const canAdvance = allExternalSigned && unresolvedObs === 0;

  const submitDecision = () => {
    if (!activeDecision) return;
    const actionStatusMap: Record<string, ObsStatus> = {
      approve: 'approved', reject: 'rejected', clarify: 'clarification_sent', counterproposal: 'counterproposal_sent',
    };
    const newStatus = actionStatusMap[activeDecision.action] || 'resolved';
    setObservations(prev => prev.map(o =>
      o.id === activeDecision.obs.id
        ? { ...o, status: newStatus, resolution: { by: 'Vladimir Huerta', date: new Date().toISOString(), reason: decisionReason || counterproposalText || clarificationQuestion || 'Decisión registrada.' } }
        : o
    ));
    setActiveDecision(null);
    setDecisionReason('');
    setClarificationQuestion('');
    setCounterproposalText('');
  };

  const canSubmitDecision = activeDecision && (
    (activeDecision.action === 'approve' && decisionReason.trim()) ||
    (activeDecision.action === 'reject' && decisionReason.trim()) ||
    (activeDecision.action === 'clarify' && clarificationQuestion.trim()) ||
    (activeDecision.action === 'counterproposal' && counterproposalText.trim() && decisionReason.trim())
  );

  return (
    <div className="space-y-5">
      {/* Signature status */}
      <div className="panel">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Send className="h-4 w-4 text-muted-foreground/60" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Firma de cliente</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{signedCount}/{externalSigners.length} firmas</span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-3">Firmantes externos</p>
            <div className="space-y-2">
              {externalSigners.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/60">No hay firmantes externos configurados.</p>
              ) : externalSigners.map(s => {
                const isPhysical = s.signatureMethod === 'physical';
                const physDoc = s.uploadedSignedDoc;
                return (
                  <div key={s.id} className="rounded-xl border p-3.5 hover:bg-muted/20 transition-colors space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                          {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">{s.name}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isPhysical ? 'bg-muted text-muted-foreground' : 'bg-[hsl(var(--status-info)/0.08)] text-[hsl(var(--status-info))]'}`}>
                            {isPhysical ? <><FileUp className="h-2.5 w-2.5" /> Física</> : <><Zap className="h-2.5 w-2.5" /> Digital</>}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === 'signed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            <CheckCircle2 className="h-3 w-3" /> Firmado
                          </span>
                        ) : s.status === 'notified' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]">
                            <Send className="h-3 w-3" /> Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <Clock className="h-3 w-3" /> Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                    {isPhysical && s.status !== 'signed' && physDoc && (
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 space-y-2">
                        {physDoc.status === 'pending_upload' && (
                          <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5 rounded-lg w-full">
                            <Upload className="h-3 w-3" /> Cargar contrato firmado
                          </Button>
                        )}
                        {physDoc.status === 'uploaded' && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground truncate">{physDoc.fileName}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg flex-1">
                                <Eye className="h-2.5 w-2.5" /> Ver
                              </Button>
                              <Button size="sm" className="h-7 text-[10px] gap-1 rounded-lg flex-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Validar
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg text-destructive hover:text-destructive">
                                <XCircle className="h-2.5 w-2.5" /> Rechazar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {isPhysical && physDoc?.status === 'validated' && (
                      <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-medium text-primary">Documento validado</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="panel">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Observaciones</h3>
          </div>
          {unresolvedObs > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]">
              {unresolvedObs} pendiente{unresolvedObs > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="px-6 py-5">
          {observations.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-dashed border-border/60">
              <p className="text-[13px] font-medium text-foreground/70">Sin observaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {observations.map(obs => {
                const sc = obsStatusConfig[obs.status] || obsStatusConfig.pending;
                return (
                  <div key={obs.id} className="rounded-xl border p-4 space-y-3 hover:border-border transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold">{obs.title}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{obs.from} · {new Date(obs.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${sc.style}`}>{sc.label}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{obs.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {obs.impact && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obsImpactLabels[obs.impact].style}`}>Impacto: {obsImpactLabels[obs.impact].label}</span>
                      )}
                    </div>
                    {obs.resolution && (
                      <div className="rounded-lg bg-muted/30 border border-border/50 p-3 mt-1">
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{obs.resolution.reason}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">{obs.resolution.by}</p>
                      </div>
                    )}
                    {(obs.status === 'pending' || obs.status === 'in_analysis') && (
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button size="sm" className="h-7 text-[11px] gap-1 rounded-lg" onClick={() => setDetailObs(obs)}>
                          <Eye className="h-3 w-3" /> Revisar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Decision panel */}
      <div className="panel">
        <div className="px-5 py-4 space-y-4">
          <div className="border-t pt-4 space-y-2.5">
            {canAdvance ? (
              <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={onAdvance}>
                <ChevronRight className="h-4 w-4" /> Avanzar a Firma titular
              </Button>
            ) : (
              <>
                {!allExternalSigned && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 border border-border/60 p-3.5">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[12px] text-muted-foreground">Faltan firmas ({signedCount}/{externalSigners.length}).</p>
                  </div>
                )}
                {!allExternalSigned && (
                  <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg w-full">
                    <Send className="h-3.5 w-3.5" /> Reenviar a contrapartes
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg w-full text-destructive hover:text-destructive" onClick={onReturn}>
              <RotateCcw className="h-3.5 w-3.5" /> Regresar a Revisión
            </Button>
          </div>
        </div>
      </div>

      {/* Observation detail drawer */}
      <Sheet open={!!detailObs} onOpenChange={() => setDetailObs(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailObs && (() => {
            const sc = obsStatusConfig[detailObs.status] || obsStatusConfig.pending;
            return (
              <>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle className="text-base">Detalle de observación</SheetTitle>
                </SheetHeader>
                <div className="py-5 space-y-5">
                  <div>
                    <h4 className="text-[14px] font-semibold">{detailObs.title}</h4>
                    <p className="text-[12px] text-muted-foreground mt-1">{detailObs.from}</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-[13px] text-foreground/80 leading-relaxed">{detailObs.description}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="h-8 text-[12px] gap-1 rounded-lg" onClick={() => { setActiveDecision({ obs: detailObs, action: 'approve' }); setDetailObs(null); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1 rounded-lg text-destructive hover:text-destructive" onClick={() => { setActiveDecision({ obs: detailObs, action: 'reject' }); setDetailObs(null); }}>
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1 rounded-lg" onClick={() => { setActiveDecision({ obs: detailObs, action: 'clarify' }); setDetailObs(null); }}>
                      <MessageSquare className="h-3.5 w-3.5" /> Aclaración
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1 rounded-lg" onClick={() => { setActiveDecision({ obs: detailObs, action: 'counterproposal' }); setDetailObs(null); }}>
                      <Handshake className="h-3.5 w-3.5" /> Contrapropuesta
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Decision dialog */}
      <Dialog open={!!activeDecision} onOpenChange={() => setActiveDecision(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {activeDecision && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[16px]">
                  {activeDecision.action === 'approve' ? 'Aprobar observación' :
                   activeDecision.action === 'reject' ? 'Rechazar observación' :
                   activeDecision.action === 'clarify' ? 'Solicitar aclaración' :
                   'Enviar contrapropuesta'}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">{activeDecision.obs.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {activeDecision.action === 'approve' && (
                  <div>
                    <Label className="text-[12px]">Justificación *</Label>
                    <Textarea className="mt-1.5 text-[13px]" rows={3} placeholder="¿Por qué se aprueba esta observación?" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                  </div>
                )}
                {activeDecision.action === 'reject' && (
                  <div>
                    <Label className="text-[12px]">Fundamento del rechazo *</Label>
                    <Textarea className="mt-1.5 text-[13px]" rows={3} placeholder="Fundamento jurídico o comercial..." value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                  </div>
                )}
                {activeDecision.action === 'clarify' && (
                  <div>
                    <Label className="text-[12px]">Pregunta o aclaración *</Label>
                    <Textarea className="mt-1.5 text-[13px]" rows={3} placeholder="¿Qué información adicional necesitas?" value={clarificationQuestion} onChange={(e) => setClarificationQuestion(e.target.value)} />
                  </div>
                )}
                {activeDecision.action === 'counterproposal' && (
                  <>
                    <div>
                      <Label className="text-[12px]">Propuesta alternativa *</Label>
                      <Textarea className="mt-1.5 text-[13px]" rows={3} placeholder="Describe la contrapropuesta..." value={counterproposalText} onChange={(e) => setCounterproposalText(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[12px]">Justificación *</Label>
                      <Textarea className="mt-1.5 text-[13px]" rows={2} placeholder="¿Por qué se ofrece esta alternativa?" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" className="text-[12px]" onClick={() => setActiveDecision(null)}>Cancelar</Button>
                <Button className="text-[12px] gap-1.5" disabled={!canSubmitDecision} onClick={submitDecision}>
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FirmaTitularActions ──
function FirmaTitularActions({
  request, signers, onAdvance, onReturn,
}: {
  request: { title: string; project: string; property?: string; titular?: string; templateName?: string; counterparty: string; counterparties?: string[] };
  signers: { id: string; name: string; signerType: string; role: 'internal' | 'external'; status: string; signedAt?: string; signatureMethod?: 'digital' | 'physical'; uploadedSignedDoc?: { fileName: string; uploadedAt: string; uploadedBy: string; status: string; version?: number } }[];
  onAdvance: () => void; onReturn: () => void;
}) {
  const [titularSent, setTitularSent] = useState(false);
  const [titularMethod, setTitularMethod] = useState<'digital' | 'physical'>(
    signers.find(s => s.role === 'internal')?.signatureMethod || 'digital'
  );
  const [physDocUploaded, setPhysDocUploaded] = useState(false);
  const [physDocValidated, setPhysDocValidated] = useState(false);

  const externalSigners = signers.filter(s => s.role === 'external');
  const internalSigners = signers.filter(s => s.role === 'internal');
  const allExternalSigned = externalSigners.length > 0 && externalSigners.every(s => s.status === 'signed');

  const readinessItems = [
    { key: 'contract', label: 'Contrato generado', done: true },
    { key: 'counterparty', label: 'Contraparte firmó', done: allExternalSigned },
    { key: 'observations', label: 'Observaciones resueltas', done: true },
    { key: 'ready', label: 'Listo para firma del titular', done: allExternalSigned },
  ];

  const allReady = readinessItems.every(r => r.done);

  return (
    <div className="space-y-5">
      <div className="panel">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-4 w-4 text-muted-foreground/60" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Firma del titular</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
            allReady ? 'bg-primary/10 text-primary' : 'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]'
          }`}>
            {allReady ? 'Listo' : 'Pendiente'}
          </span>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Readiness checklist */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
            {readinessItems.map(item => (
              <div key={item.key} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                <div className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 ${
                  item.done ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {item.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
                <span className={`text-[13px] ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Signature method selector */}
          <div className="rounded-xl border bg-muted/20 p-3.5">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Método de firma</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTitularMethod('digital')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-2.5 text-[12px] font-medium transition-colors cursor-pointer ${
                  titularMethod === 'digital' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <Zap className="h-3.5 w-3.5" /> Digital
              </button>
              <button
                onClick={() => setTitularMethod('physical')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-2.5 text-[12px] font-medium transition-colors cursor-pointer ${
                  titularMethod === 'physical' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <FileUp className="h-3.5 w-3.5" /> Física
              </button>
            </div>
          </div>

          {/* Titular */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[12px]">
                  {(request.titular || 'T').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">{request.titular || 'Titular'}</p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${titularMethod === 'physical' ? 'bg-muted text-muted-foreground' : 'bg-[hsl(var(--status-info)/0.08)] text-[hsl(var(--status-info))]'}`}>
                    {titularMethod === 'physical' ? <><FileUp className="h-2.5 w-2.5" /> Física</> : <><Zap className="h-2.5 w-2.5" /> Digital</>}
                  </span>
                </div>
              </div>
              {physDocValidated ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Validado
                </span>
              ) : titularSent ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))]">
                  <Send className="h-3 w-3" /> Enviado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  <Clock className="h-3 w-3" /> Pendiente
                </span>
              )}
            </div>

            {titularMethod === 'physical' && titularSent && !physDocValidated && (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 space-y-2">
                {!physDocUploaded ? (
                  <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5 rounded-lg w-full" onClick={() => setPhysDocUploaded(true)}>
                    <Upload className="h-3 w-3" /> Cargar contrato firmado
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg flex-1">
                      <Eye className="h-2.5 w-2.5" /> Ver
                    </Button>
                    <Button size="sm" className="h-7 text-[10px] gap-1 rounded-lg flex-1" onClick={() => setPhysDocValidated(true)}>
                      <CheckCircle2 className="h-2.5 w-2.5" /> Validar
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg text-destructive hover:text-destructive" onClick={() => setPhysDocUploaded(false)}>
                      <XCircle className="h-2.5 w-2.5" /> Rechazar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t pt-4 space-y-2.5">
            {allReady && !titularSent && (
              <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={() => setTitularSent(true)}>
                <Send className="h-4 w-4" /> {titularMethod === 'digital' ? 'Enviar a firma digital' : 'Registrar envío de firma física'}
              </Button>
            )}
            {physDocValidated && (
              <Button className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={onAdvance}>
                <CheckCircle2 className="h-4 w-4" /> Completar proceso de firma
              </Button>
            )}
            <Button variant="outline" className="h-9 text-[13px] gap-1.5 rounded-lg w-full text-destructive hover:text-destructive" onClick={onReturn}>
              <RotateCcw className="h-3.5 w-3.5" /> Regresar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FirmadoActions ──
function FirmadoActions({
  request, signers,
}: {
  request: { title: string; project: string; property?: string; titular?: string; templateName?: string; counterparty: string; counterparties?: string[]; createdAt: string; updatedAt: string };
  signers: { id: string; name: string; signerType: string; role: 'internal' | 'external'; status: string; signedAt?: string; signatureMethod?: 'digital' | 'physical'; uploadedSignedDoc?: { fileName: string; uploadedAt: string; uploadedBy: string; status: string; version?: number } }[];
}) {
  const [archived, setArchived] = useState(false);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="panel">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Resumen de cierre</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            Contrato formalizado
          </span>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">Proceso concluido</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Firmado por todas las partes. Listo para archivo.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Solicitud</p>
              <p className="text-[13px] font-medium mt-0.5">{formatDate(request.createdAt)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold">Cierre</p>
              <p className="text-[13px] font-medium mt-0.5">{formatDate(request.updatedAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="h-10 text-[13px] gap-2 rounded-lg flex-1">
              <Download className="h-4 w-4" /> Descargar contrato
            </Button>
            <Button variant="outline" size="sm" className="h-10 text-[13px] gap-1.5 rounded-lg">
              <Eye className="h-3.5 w-3.5" /> Ver
            </Button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Cierre</span>
          </div>
          {archived ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5">
              <Archive className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[12px] text-primary font-medium">Expediente archivado</p>
            </div>
          ) : (
            <Button variant="outline" className="h-10 text-[13px] gap-2 rounded-lg w-full" onClick={() => setArchived(true)}>
              <Archive className="h-4 w-4" /> Archivar expediente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  // Buscar en datos reales primero (cuentas Apartado / Vendido) y caer al
  // mock como fallback. Los expedientes con folio CC-XXXXXX / CCP-XXXXXX
  // viven en BD; el mock conserva los EXP-2025-* heredados.
  const {
    data: solicitudesRecibidas = [],
    isLoading: loadingSolicitudes,
  } = useLegalFlowSolicitudesRecibidas();
  const {
    data: archivados = [],
    isLoading: loadingArchivados,
  } = useLegalFlowExpedientesArchivados();
  const realRequest = [...solicitudesRecibidas, ...archivados].find((r) => r.id === id);
  const mockRequest = mockRequests.find((r) => r.id === id);
  const request = realRequest ?? mockRequest;
  const isLoadingReal = loadingSolicitudes || loadingArchivados;
  const timeline = mockTimeline.filter((e) => e.caseId === id).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const [assignedLawyer, setAssignedLawyer] = useState<string | null>(
    request?.assignedTo ? (request.assignedTo === 'Vladimir Huerta' ? 'vladimir' : request.assignedTo === 'Miguel Ochoa' ? 'miguel' : null) : null
  );
  const [intakeValidation, setIntakeValidation] = useState<'pending' | 'complete' | 'missing'>('pending');
  const [showMissingInfoDialog, setShowMissingInfoDialog] = useState(false);
  const [missingTitle, setMissingTitle] = useState('Información faltante para revisión');
  const [missingDesc, setMissingDesc] = useState('');

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [reviewChecklist, setReviewChecklist] = useState<Record<string, boolean>>({});
  const [showSignerReview, setShowSignerReview] = useState(false);
  const [selectedSignerName, setSelectedSignerName] = useState('');
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnTitle, setReturnTitle] = useState('');
  const [returnDesc, setReturnDesc] = useState('');

  const [previewChecklist, setPreviewChecklist] = useState<Record<string, boolean>>({});
  const [showReturnToRevisionDialog, setShowReturnToRevisionDialog] = useState(false);
  const [returnToRevisionTitle, setReturnToRevisionTitle] = useState('');
  const [returnToRevisionDesc, setReturnToRevisionDesc] = useState('');

  const [showRequester, setShowRequester] = useState(false);
  const [showCounterparty, setShowCounterparty] = useState(false);
  const [showContractType, setShowContractType] = useState(false);
  const [showCuentaCobranza, setShowCuentaCobranza] = useState(false);

  if (!request && isLoadingReal) {
    return (
      <div className="px-10 py-8 text-center py-24">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Cargando expediente…</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="px-10 py-8 text-center py-24">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Expediente no encontrado</p>
        <Link to="/admin/legal-flow/requests" className="text-primary text-sm hover:underline mt-3 inline-block">Volver a solicitudes</Link>
      </div>
    );
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const formatCurrency = (n: number) => n > 0 ? `$${n.toLocaleString('es-MX')} MXN` : '—';

  const signers = request.signers || [];
  const documents = request.documents || [];
  const integrations = request.integrations || { sozu: 'idle', googleDocs: 'idle', mifiel: 'idle', kyc: 'idle' };
  const nextActions = NEXT_ACTIONS[request.status] || [];
  const priorityLabels: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
  const isRecibida = request.status === 'request_received';
  const isRevision = request.status === 'in_legal_review';
  const isAprobada = request.status === 'approved_for_generation';
  const isClientSignature = request.status === 'client_signature';
  const isFirmaTitular = request.status === 'in_validation';
  const isFirmado = request.status === 'fully_signed';
  const lawyerName = assignedLawyer ? AVAILABLE_LAWYERS.find(l => l.id === assignedLawyer)?.name || 'Sin asignar' : 'Sin asignar';

  return (
    <div className="px-10 py-8 max-w-[1400px] space-y-6">
      {/* Header — concise: title, status, priority, one subtitle */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Link to="/admin/legal-flow/requests" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Todas las solicitudes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-muted-foreground/60">{request.id}</span>
              <span className={`status-badge ${STATUS_CONFIG[request.status].style}`}>{STATUS_CONFIG[request.status].label}</span>
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <span className={`priority-dot priority-dot-${request.priority}`} />
                {priorityLabels[request.priority]}
              </span>
            </div>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">{request.title}</h1>
            <p className="text-[13px] text-muted-foreground">
              {request.counterparty} · {request.project}{request.property ? ` · ${request.property}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {nextActions.map((action, i) => (
              <Button
                key={i}
                variant={action.primary ? 'default' : 'outline'}
                className="h-9 text-[13px] gap-1.5 rounded-lg"
              >
                <action.icon className="h-3.5 w-3.5" /> {action.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stepper */}
      <StatusStepper status={request.status} />

      {/* Stage-specific actions */}
      {isRecibida && (
        <RecibidaActions
          assignedLawyer={assignedLawyer}
          onAssignLawyer={setAssignedLawyer}
          intakeValidation={intakeValidation}
          onMarkComplete={() => setIntakeValidation('complete')}
          onMarkMissing={() => { setIntakeValidation('missing'); setShowMissingInfoDialog(true); }}
          onAdvance={() => {/* advance status */}}
        />
      )}

      {isRevision && (
        <RevisionActions
          signers={signers.map(s => ({ id: s.id, name: s.name, signerType: s.signerType, role: s.role }))}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          reviewChecklist={reviewChecklist}
          onToggleCheck={(key) => setReviewChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
          onOpenSignerDetail={(name) => { setSelectedSignerName(name); setShowSignerReview(true); }}
          onApprove={() => {/* advance status */}}
          onReturn={() => setShowReturnDialog(true)}
        />
      )}

      {isAprobada && (
        <AprobadaActions
          request={request}
          onGenerate={() => {/* advance */}}
          onReturn={() => setShowReturnToRevisionDialog(true)}
          previewChecklist={previewChecklist}
          onTogglePreviewCheck={(key) => setPreviewChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
        />
      )}

      {isClientSignature && (
        <FirmaClienteActions
          signers={signers}
          observations={MOCK_OBSERVATIONS}
          onAdvance={() => {/* advance */}}
          onReturn={() => setShowReturnToRevisionDialog(true)}
        />
      )}

      {isFirmaTitular && (
        <FirmaTitularActions
          request={request}
          signers={signers}
          onAdvance={() => {/* advance */}}
          onReturn={() => {/* return */}}
        />
      )}

      {isFirmado && (
        <FirmadoActions request={request} signers={signers} />
      )}

      {/* Dialogs */}
      <Dialog open={showMissingInfoDialog} onOpenChange={setShowMissingInfoDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Registrar información faltante</DialogTitle>
            <DialogDescription className="text-[13px]">Describe qué información necesitas para continuar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Título</Label>
              <Input value={missingTitle} onChange={(e) => setMissingTitle(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Descripción</Label>
              <Textarea placeholder="Detalla la información faltante..." value={missingDesc} onChange={(e) => setMissingDesc(e.target.value)} className="min-h-[100px] text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissingInfoDialog(false)} className="h-9 text-[13px]">Cancelar</Button>
            <Button variant="destructive" onClick={() => { setShowMissingInfoDialog(false); setMissingTitle(''); setMissingDesc(''); }} disabled={!missingTitle.trim()} className="h-9 text-[13px] gap-1">
              <CircleAlert className="h-3.5 w-3.5" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Regresar expediente</DialogTitle>
            <DialogDescription className="text-[13px]">Registra la observación antes de devolver.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Título</Label>
              <Input value={returnTitle} onChange={(e) => setReturnTitle(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Descripción</Label>
              <Textarea value={returnDesc} onChange={(e) => setReturnDesc(e.target.value)} className="min-h-[100px] text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)} className="h-9 text-[13px]">Cancelar</Button>
            <Button variant="destructive" onClick={() => { setShowReturnDialog(false); setReturnTitle(''); setReturnDesc(''); }} disabled={!returnTitle.trim() || !returnDesc.trim()} className="h-9 text-[13px] gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Regresar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnToRevisionDialog} onOpenChange={setShowReturnToRevisionDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Regresar a Revisión</DialogTitle>
            <DialogDescription className="text-[13px]">Registra la observación legal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Título</Label>
              <Input value={returnToRevisionTitle} onChange={(e) => setReturnToRevisionTitle(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Descripción</Label>
              <Textarea value={returnToRevisionDesc} onChange={(e) => setReturnToRevisionDesc(e.target.value)} className="min-h-[100px] text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnToRevisionDialog(false)} className="h-9 text-[13px]">Cancelar</Button>
            <Button variant="destructive" onClick={() => { setShowReturnToRevisionDialog(false); setReturnToRevisionTitle(''); setReturnToRevisionDesc(''); }} disabled={!returnToRevisionTitle.trim() || !returnToRevisionDesc.trim()} className="h-9 text-[13px] gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Regresar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignerReviewDrawer open={showSignerReview} onClose={() => setShowSignerReview(false)} signerName={selectedSignerName} />

      {/* Main content — 2/3 + 1/3 layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Tabs defaultValue="overview" className="space-y-5">
            <TabsList className="bg-muted/40 p-0.5 h-10">
              <TabsTrigger value="overview" className="text-[13px] h-8 rounded-md">Resumen</TabsTrigger>
              <TabsTrigger value="documents" className="text-[13px] h-8 rounded-md">
                Documentos {documents.length > 0 && <span className="ml-1 text-[11px] text-muted-foreground">({documents.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="signers" className="text-[13px] h-8 rounded-md">
                Firmantes {signers.length > 0 && <span className="ml-1 text-[11px] text-muted-foreground">({signers.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="integrations" className="text-[13px] h-8 rounded-md">Integraciones</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5 mt-0">
              {/* Resumen narrativo — short */}
              <div className="panel">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Resumen del caso</h3>
                </div>
                <div className="px-6 py-5">
                  <p className="text-[14px] text-foreground/80 leading-relaxed">{request.description}</p>
                </div>
              </div>

              {/* Origen — single source of request metadata */}
              <div className="panel">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Origen de la solicitud</h3>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
                    <DossierField
                      icon={Building2}
                      label="Empresa"
                      value={
                        realRequest
                          ? realRequest.empresaName ?? 'Agente Independiente'
                          : request.company
                      }
                    />
                    <DossierField
                      icon={User}
                      label="Solicitante"
                      value={request.requester}
                      sub={request.requesterDept}
                      onClick={() => setShowRequester(true)}
                    />
                    <DossierField
                      icon={Calendar}
                      label="Solicitud"
                      value={formatDate(realRequest?.fechaCompra ?? request.createdAt)}
                    />
                    <DossierField
                      icon={Clock}
                      label="Fecha límite"
                      value={formatDate(request.dueDate)}
                      highlight={new Date(request.dueDate) < new Date()}
                    />
                  </div>
                </div>
              </div>

              {/* Partes — single source of party info */}
              <div className="panel">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Partes del contrato</h3>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
                    <DossierField icon={Landmark} label="Titular" value={request.titular || 'Sin asignar'} />
                    <div className="cursor-pointer group/cp" onClick={() => setShowCounterparty(true)}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Contraparte</p>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/cp:opacity-100 transition-opacity" />
                      </div>
                      {(request.counterparties && request.counterparties.length > 0) ? (
                        <div className="space-y-1">
                          {request.counterparties.map((cp, i) => (
                            <p key={i} className="text-[14px] font-medium text-primary group-hover/cp:underline underline-offset-2 decoration-primary/40">{cp}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[14px] font-medium text-primary group-hover/cp:underline underline-offset-2 decoration-primary/40">{request.counterparty}</p>
                      )}
                    </div>
                    <DossierField icon={FileText} label="Tipo de contrato" value={REQUEST_TYPE_LABELS[request.type]} onClick={() => setShowContractType(true)} />
                  </div>
                </div>
              </div>

              {/* Operación — single source of commercial context */}
              <div className="panel">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Operación asociada</h3>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
                    <DossierField icon={Receipt} label="Cuenta cobranza" value={request.cuentaCobranza || '—'} mono onClick={request.cuentaCobranza ? () => setShowCuentaCobranza(true) : undefined} />
                    <DossierField icon={Building2} label="Proyecto" value={request.project} sub={request.property} />
                    <DossierField icon={Hash} label="Valor estimado" value={formatCurrency(request.estimatedValue)} mono />
                    <DossierField icon={FileText} label="Plantilla" value={request.templateName || 'Sin asignar'} />
                  </div>
                </div>
              </div>

              {/* Signers summary — only show in overview if relevant to current stage, no duplication with Firmantes tab */}
              {signers.length > 0 && (isRevision || isClientSignature || isFirmaTitular) && (
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Firmantes</h3>
                  </div>
                  <div className="divide-y divide-border/50">
                    {signers.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between px-5 py-4 ${isRevision ? 'cursor-pointer hover:bg-muted/20 transition-colors group' : ''}`}
                        onClick={isRevision ? () => { setSelectedSignerName(s.name); setShowSignerReview(true); } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            s.role === 'internal' ? 'bg-primary/8 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className={`text-[14px] font-medium ${isRevision ? 'text-primary group-hover:underline underline-offset-2 decoration-primary/40' : ''}`}>{s.name}</p>
                            <p className="text-[12px] text-muted-foreground/70 mt-0.5">{s.signerType} · {s.role === 'internal' ? 'Interno' : 'Externo'}</p>
                          </div>
                        </div>
                        <span className={`status-badge ${SIGNER_STATUS_CONFIG[s.status].style}`}>
                          {SIGNER_STATUS_CONFIG[s.status].label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <div className="panel">
                {documents.length === 0 ? (
                  <div className="panel-body text-center py-20">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                      <FileText className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Sin documentos generados</p>
                    <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">Aparecerán una vez aprobado para generación.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(28_72%_94%)]">
                            <FileText className="h-4 w-4 text-[hsl(28_72%_40%)]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-medium">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`status-badge ${DOCUMENT_STATUS_CONFIG[doc.status].style}`}>
                                {DOCUMENT_STATUS_CONFIG[doc.status].label}
                              </span>
                              {doc.generatedAt && <span className="text-[11px] text-muted-foreground/60">{formatDate(doc.generatedAt)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.pdfUrl && <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Download className="h-4 w-4" /></Button>}
                          {doc.googleDocUrl && <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Eye className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="signers" className="mt-0">
              <div className="panel">
                {signers.length === 0 ? (
                  <div className="panel-body text-center py-20">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                      <Users className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Sin firmantes configurados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="table-head">Nombre</th>
                          <th className="table-head">Rol</th>
                          <th className="table-head">KYC</th>
                          <th className="table-head">Biométrico</th>
                          <th className="table-head">Firma</th>
                          <th className="table-head">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signers.map((s) => (
                          <tr key={s.id} className="border-t border-border/50 table-row-hover" style={{ height: '52px' }}>
                            <td className="table-cell">
                              <p className="font-medium text-[14px]">{s.name}</p>
                              <p className="text-[12px] text-muted-foreground/60 mt-0.5">{s.email}</p>
                            </td>
                            <td className="table-cell">
                              <span className={`badge-base ${s.role === 'internal' ? 'badge-case' : 'badge-signer'}`}>
                                {s.role === 'internal' ? 'Interno' : 'Externo'}
                              </span>
                            </td>
                            <td className="table-cell"><MicroStatus status={s.kycStatus || 'not_required'} /></td>
                            <td className="table-cell"><MicroStatus status={s.biometricStatus || 'not_required'} /></td>
                            <td className="table-cell">
                              <span className={`status-badge ${SIGNER_STATUS_CONFIG[s.status].style}`}>
                                {SIGNER_STATUS_CONFIG[s.status].label}
                              </span>
                            </td>
                            <td className="table-cell text-[13px] text-muted-foreground font-mono tabular-nums">
                              {s.signedAt ? formatTime(s.signedAt) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="mt-0">
              <div className="grid sm:grid-cols-2 gap-3">
                <IntegrationCard name="Motor de Contratos SOZU" icon={Zap} status={integrations.sozu} detail={integrations.sozuContractId} color="bg-primary" />
                <IntegrationCard name="Google Docs" icon={FileText} status={integrations.googleDocs} color="bg-[hsl(var(--status-info))]" />
                <IntegrationCard name="MiFiel Firma Digital" icon={PenTool} status={integrations.mifiel} color="bg-[hsl(var(--status-purple))]" />
                <IntegrationCard name="KYC y Biometría" icon={Fingerprint} status={integrations.kyc} color="bg-[hsl(var(--status-warning))]" />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Right sidebar — REFACTORED: consolidated, no duplication with body */}
        <motion.div className="space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          {/* Datos de control — only stage-specific context not visible elsewhere */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Control del expediente</h3>
            </div>
            <div className="panel-body space-y-4">
              <InfoCell label="Abogado responsable" value={isRecibida ? lawyerName : (request.assignedTo || 'Sin asignar')} />
              <InfoCell label="Última actualización" value={formatDate(request.updatedAt)} />
              {isRecibida && (
                <InfoCell label="Validación inicial" value={intakeValidation === 'complete' ? 'Completa' : intakeValidation === 'missing' ? 'Faltante' : 'Pendiente'} />
              )}
              {isRevision && (
                <InfoCell label="Plantilla" value={selectedTemplate ? (LEGAL_TEMPLATES.find(t => t.id === selectedTemplate)?.label || '—') : 'Sin seleccionar'} />
              )}
              {(isAprobada || isClientSignature || isFirmaTitular || isFirmado) && request.templateName && (
                <InfoCell label="Plantilla" value={request.templateName} />
              )}
              {isClientSignature && (
                <InfoCell label="Firmas externas" value={`${signers.filter(s => s.role === 'external' && s.status === 'signed').length}/${signers.filter(s => s.role === 'external').length}`} />
              )}
            </div>
          </div>

          {/* Bitácora */}
          <BitacoraPanel caseId={id!} timeline={timeline} formatTime={formatTime} />
        </motion.div>
      </div>

      {/* Detail drawers */}
      <RequesterDrawer
        open={showRequester}
        onClose={() => setShowRequester(false)}
        requester={request.requester}
        realProfile={
          realRequest
            ? {
                name: realRequest.requester,
                phone: realRequest.requesterPhone ?? null,
                email: realRequest.requesterEmail ?? null,
                empresaName: realRequest.empresaName ?? null,
              }
            : undefined
        }
      />
      <CounterpartyDrawer
        open={showCounterparty}
        onClose={() => setShowCounterparty(false)}
        counterparties={request.counterparties || [request.counterparty]}
        realDetalle={realRequest?.compradoresDetalle}
      />
      <ContractTypeDrawer open={showContractType} onClose={() => setShowContractType(false)} type={request.type} />
      <CuentaCobranzaDrawer open={showCuentaCobranza} onClose={() => setShowCuentaCobranza(false)} cuenta={request.cuentaCobranza || ''} />
    </div>
  );
}

const NOTE_TYPES = [
  { value: 'nota_interna', label: 'Nota interna', icon: StickyNote, color: 'bg-muted text-muted-foreground' },
  { value: 'observacion_legal', label: 'Observación legal', icon: MessageSquare, color: 'bg-[hsl(var(--status-info)/0.12)] text-[hsl(var(--status-info))]' },
  { value: 'riesgo', label: 'Riesgo', icon: AlertTriangle, color: 'bg-destructive/10 text-destructive' },
  { value: 'acuerdo', label: 'Acuerdo', icon: Handshake, color: 'bg-primary/10 text-primary' },
  { value: 'seguimiento', label: 'Seguimiento', icon: Bell, color: 'bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))]' },
] as const;

interface ManualNote {
  id: string; title: string; description: string; type: string; author: string; createdAt: string; edited?: boolean;
}

const MOCK_MANUAL_NOTES: ManualNote[] = [
  { id: 'note-1', title: 'Documentación pendiente de contraparte', description: 'Falta identificación oficial vigente del representante legal.', type: 'seguimiento', author: 'Carlos Mendoza', createdAt: '2026-03-21T11:20:00' },
  { id: 'note-2', title: 'Riesgo en cláusula de comisión', description: 'Revisar alcance de exclusividad comercial antes de enviar a firma.', type: 'riesgo', author: 'Ana Lucía Restrepo', createdAt: '2026-03-21T12:05:00', edited: true },
  { id: 'note-3', title: 'Acuerdo verbal con contraparte', description: 'Confirmó envío de RFC y comprobante hoy.', type: 'acuerdo', author: 'Rodrigo Ter Veen', createdAt: '2026-03-21T13:40:00' },
];

type BitacoraFilter = 'todo' | 'sistema' | 'notas';

function BitacoraPanel({ caseId, timeline, formatTime }: {
  caseId: string;
  timeline: { id: string; caseId: string; type: string; timestamp: string; actor: string; actorType: string; notes?: string }[];
  formatTime: (iso: string) => string;
}) {
  const [filter, setFilter] = useState<BitacoraFilter>('todo');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteType, setNoteType] = useState('nota_interna');
  const [manualNotes, setManualNotes] = useState<ManualNote[]>(MOCK_MANUAL_NOTES);

  type UnifiedEntry = { id: string; kind: 'system' | 'manual'; timestamp: string; data: any };
  const systemEntries: UnifiedEntry[] = timeline.map(evt => ({ id: evt.id, kind: 'system', timestamp: evt.timestamp, data: evt }));
  const manualEntries: UnifiedEntry[] = manualNotes.map(n => ({ id: n.id, kind: 'manual', timestamp: n.createdAt, data: n }));

  let allEntries = [...systemEntries, ...manualEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (filter === 'sistema') allEntries = allEntries.filter(e => e.kind === 'system');
  if (filter === 'notas') allEntries = allEntries.filter(e => e.kind === 'manual');

  const handleSaveNote = () => {
    if (!noteTitle.trim()) return;
    const newNote: ManualNote = { id: `note-${Date.now()}`, title: noteTitle, description: noteDesc, type: noteType, author: 'Carlos Mendoza', createdAt: new Date().toISOString() };
    setManualNotes(prev => [newNote, ...prev]);
    setNoteTitle(''); setNoteDesc(''); setNoteType('nota_interna'); setShowAddNote(false);
  };

  const handleDeleteNote = (noteId: string) => setManualNotes(prev => prev.filter(n => n.id !== noteId));
  const getNoteTypeConfig = (type: string) => NOTE_TYPES.find(t => t.value === type) || NOTE_TYPES[0];

  const filterButtons: { key: BitacoraFilter; label: string; count: number }[] = [
    { key: 'todo', label: 'Todo', count: systemEntries.length + manualNotes.length },
    { key: 'sistema', label: 'Sistema', count: systemEntries.length },
    { key: 'notas', label: 'Notas', count: manualNotes.length },
  ];

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Bitácora
            </h3>
          </div>
          <Button variant="default" size="sm" className="h-7 text-[12px] gap-1 rounded-lg px-2.5" onClick={() => setShowAddNote(true)}>
            <Plus className="h-3 w-3" /> Nota
          </Button>
        </div>

        <div className="px-5 pt-3 pb-1 flex gap-1">
          {filterButtons.map(fb => (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filter === fb.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {fb.label}
              <span className="ml-1 text-[10px] opacity-60">{fb.count}</span>
            </button>
          ))}
        </div>

        <div className="panel-body">
          {allEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[13px] font-medium text-foreground">Sin registros</p>
              <Button variant="outline" size="sm" className="mt-4 h-8 text-[12px] gap-1 rounded-lg" onClick={() => setShowAddNote(true)}>
                <Plus className="h-3 w-3" /> Agregar nota
              </Button>
            </div>
          ) : (
            <div className="space-y-0 relative">
              <div className="absolute left-[7px] top-2.5 bottom-2.5 w-px bg-border/60" />
              {allEntries.map((entry) => {
                if (entry.kind === 'system') {
                  const evt = entry.data;
                  const config = TIMELINE_EVENT_CONFIG[evt.type] || { label: evt.type, icon: '•', color: 'bg-muted-foreground' };
                  return (
                    <div key={entry.id} className="relative pl-7 pb-5 last:pb-0">
                      <div className={`absolute left-0 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full ${config.color}`}>
                        <Circle className="h-[5px] w-[5px] fill-current text-white" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-foreground/70">{config.label}</p>
                          <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap font-mono tabular-nums">{formatTime(evt.timestamp)}</span>
                        </div>
                        {evt.notes && <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{evt.notes}</p>}
                        <p className="text-[11px] text-muted-foreground/40 mt-1">{evt.actor}</p>
                      </div>
                    </div>
                  );
                } else {
                  const note = entry.data as ManualNote;
                  const typeConfig = getNoteTypeConfig(note.type);
                  const TypeIcon = typeConfig.icon;
                  return (
                    <div key={entry.id} className="relative pl-7 pb-5 last:pb-0 group">
                      <div className={`absolute left-0 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full ${typeConfig.color.split(' ')[0]}`}>
                        <TypeIcon className={`h-[8px] w-[8px] ${typeConfig.color.split(' ')[1]}`} />
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground">{note.title}</p>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{note.description}</p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" onClick={() => handleDeleteNote(note.id)}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground/40 mt-2">{note.author} · {formatTime(note.createdAt)}</p>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Nueva nota</DialogTitle>
            <DialogDescription className="text-[13px]">Registra una observación o seguimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Título</Label>
              <Input placeholder="Ej: Documentación pendiente" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Tipo</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTE_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setNoteType(t.value)}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                      noteType === t.value ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <t.icon className="h-3 w-3" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Descripción</Label>
              <Textarea placeholder="Describe la observación..." value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} className="min-h-[80px] text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)} className="h-9 text-[13px]">Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={!noteTitle.trim()} className="h-9 text-[13px] gap-1">
              <Plus className="h-3.5 w-3.5" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DossierField({ icon: Icon, label, value, sub, mono, highlight, onClick }: {
  icon: React.ElementType; label: string; value: string; sub?: string; mono?: boolean; highlight?: boolean; onClick?: () => void;
}) {
  const isClickable = !!onClick;
  return (
    <div className={isClickable ? 'cursor-pointer group/df' : ''} onClick={onClick}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{label}</p>
        {isClickable && <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/df:opacity-100 transition-opacity" />}
      </div>
      <p className={`text-[14px] ${mono ? 'font-mono tabular-nums' : 'font-medium'} ${highlight ? 'text-destructive font-semibold' : isClickable ? 'text-primary group-hover/df:underline underline-offset-2 decoration-primary/40' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/50 mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoCell({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-[14px] mt-0.5 ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

function MicroStatus({ status }: { status: string }) {
  const styles: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'text-[hsl(var(--status-warning))]' },
    passed: { label: 'Aprobado', cls: 'text-primary' },
    failed: { label: 'Fallido', cls: 'text-destructive' },
    not_required: { label: 'N/A', cls: 'text-muted-foreground/50' },
  };
  const s = styles[status] || styles.not_required;
  return <span className={`text-[13px] font-medium ${s.cls}`}>{s.label}</span>;
}
