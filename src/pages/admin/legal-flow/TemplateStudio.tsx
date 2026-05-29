import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Copy, Archive, CheckCircle2, XCircle, Eye,
  Plus, Trash2, GripVertical, Fingerprint, Shield, PenTool, FileUp,
  Clock, User, FileText, Code, Hash, Calendar, DollarSign, ToggleLeft,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { mockTemplates } from '@/data/mockData';
import type { ContractTemplate, TemplateVariable, TemplateSigner } from '@/types/legal';

const DATA_TYPE_ICONS: Record<string, typeof Code> = {
  text: Code,
  number: Hash,
  date: Calendar,
  currency: DollarSign,
  boolean: ToggleLeft,
};

export default function TemplateStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const template = mockTemplates.find((t) => t.id === id);

  if (!template) {
    return (
      <div className="px-10 py-20 text-center">
        <p className="text-lg font-medium">Plantilla no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/templates')}>Volver al catálogo</Button>
      </div>
    );
  }

  return (
    <div className="px-10 py-8 max-w-[1400px] space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <button onClick={() => navigate('/templates')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Catálogo de Plantillas
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold tracking-tight">{template.name}</h1>
              <StatusPill status={template.templateStatus} />
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">{template.description}</p>
            <div className="flex items-center gap-4 mt-2 text-[12px] text-muted-foreground/60">
              <span className="font-mono">{template.id}</span>
              <span>v{template.version}</span>
              <span>{template.category}</span>
              <span>{template.project}</span>
              {template.responsibleLawyer && <span>Responsable: {template.responsibleLawyer}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-[13px]"><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-[13px]"><Archive className="h-3.5 w-3.5" /> Archivar</Button>
            <Button size="sm" className="gap-1.5 text-[13px]"><Save className="h-3.5 w-3.5" /> Guardar cambios</Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <Tabs defaultValue="editor" className="space-y-5">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger value="editor" className="text-[13px] px-4 py-2">Editor</TabsTrigger>
            <TabsTrigger value="variables" className="text-[13px] px-4 py-2">Variables / Placeholders</TabsTrigger>
            <TabsTrigger value="signers" className="text-[13px] px-4 py-2">Firmantes</TabsTrigger>
            <TabsTrigger value="signature" className="text-[13px] px-4 py-2">Firma y validación</TabsTrigger>
            <TabsTrigger value="preview" className="text-[13px] px-4 py-2">Vista previa</TabsTrigger>
            <TabsTrigger value="versions" className="text-[13px] px-4 py-2">Versiones</TabsTrigger>
            <TabsTrigger value="usage" className="text-[13px] px-4 py-2">Historial de uso</TabsTrigger>
          </TabsList>

          <TabsContent value="editor"><EditorTab template={template} /></TabsContent>
          <TabsContent value="variables"><VariablesTab template={template} /></TabsContent>
          <TabsContent value="signers"><SignersTab template={template} /></TabsContent>
          <TabsContent value="signature"><SignatureTab template={template} /></TabsContent>
          <TabsContent value="preview"><PreviewTab template={template} /></TabsContent>
          <TabsContent value="versions"><VersionsTab template={template} /></TabsContent>
          <TabsContent value="usage"><UsageTab template={template} /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'active') return <span className="status-badge status-success">Activa</span>;
  if (status === 'inactive') return <span className="status-badge status-queued">Inactiva</span>;
  return <span className="status-badge status-queued">Archivada</span>;
}

/* ================================================================
   EDITOR TAB
   ================================================================ */
function EditorTab({ template }: { template: ContractTemplate }) {
  const [content, setContent] = useState(template.bodyContent || '');
  const placeholders = template.placeholders || [];

  return (
    <div className="grid grid-cols-[1fr_280px] gap-5">
      {/* Editor area */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-[13px] font-semibold">Contenido del documento</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-[12px] h-7">Formato</Button>
            <Button variant="outline" size="sm" className="text-[12px] h-7">Vista previa</Button>
          </div>
        </div>
        <div className="p-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[500px] font-mono text-[13px] leading-relaxed border-0 bg-muted/30 rounded-lg p-4 resize-none focus-visible:ring-1"
            placeholder="Escribe el contenido del documento aquí. Usa {{variable}} para insertar placeholders."
          />
        </div>
      </div>

      {/* Placeholders sidebar */}
      <div className="space-y-4">
        <div className="panel">
          <div className="panel-header">
            <span className="text-[13px] font-semibold">Placeholders</span>
            <span className="text-[11px] text-muted-foreground">{placeholders.length}</span>
          </div>
          <div className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
            {placeholders.map((p) => (
              <button
                key={p}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-accent transition-colors group"
                onClick={() => {
                  navigator.clipboard.writeText(`{{${p}}}`);
                }}
              >
                <Code className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[12px] font-mono text-muted-foreground group-hover:text-foreground truncate">{`{{${p}}}`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-4 space-y-3">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Insertar placeholder</p>
          <p className="text-[12px] text-muted-foreground/60">Haz clic en un placeholder para copiarlo al portapapeles e insertarlo en el editor.</p>
          <Separator />
          <p className="text-[12px] text-muted-foreground/60">Los placeholders se reemplazan automáticamente con los datos del expediente al generar el contrato.</p>
        </div>

        <div className="panel p-4 space-y-2">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Información</p>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Estructura</span><span className="font-medium">{template.documentStructure || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Categoría</span><span className="font-medium">{template.category}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Proyecto</span><span className="font-medium">{template.project || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Versión</span><span className="font-medium font-mono">v{template.version}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   VARIABLES TAB
   ================================================================ */
function VariablesTab({ template }: { template: ContractTemplate }) {
  const variables = template.variables || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold">Variables y placeholders</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">Campos dinámicos utilizados en esta plantilla</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-[13px]"><Plus className="h-3.5 w-3.5" /> Agregar variable</Button>
      </div>

      {variables.length === 0 ? (
        <div className="panel p-12 text-center">
          <Code className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-[14px] font-medium mt-3">Sin variables definidas</p>
          <p className="text-[13px] text-muted-foreground mt-1">Las variables de esta plantilla se definen desde la lista de placeholders.</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="table-head">Variable</th>
                <th className="table-head">Etiqueta</th>
                <th className="table-head">Origen</th>
                <th className="table-head">Tipo</th>
                <th className="table-head text-center">Obligatorio</th>
                <th className="table-head text-center">Autocalculado</th>
                <th className="table-head">Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => {
                const Icon = DATA_TYPE_ICONS[v.dataType] || Code;
                return (
                  <tr key={v.key} className="border-t border-border/50 table-row-hover">
                    <td className="table-cell">
                      <span className="font-mono text-[12px] bg-muted/50 px-2 py-0.5 rounded">{`{{${v.key}}}`}</span>
                    </td>
                    <td className="table-cell text-[13px]">{v.label}</td>
                    <td className="table-cell">
                      <span className="badge-base badge-request">{v.source}</span>
                    </td>
                    <td className="table-cell">
                      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" /> {v.dataType}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      {v.required ? <CheckCircle2 className="h-4 w-4 text-primary mx-auto" /> : <span className="text-[11px] text-muted-foreground/40">—</span>}
                    </td>
                    <td className="table-cell text-center">
                      {v.autoCalculated ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-info))] mx-auto" /> : <span className="text-[11px] text-muted-foreground/40">—</span>}
                    </td>
                    <td className="table-cell text-[12px] text-muted-foreground italic">{v.example}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SIGNERS TAB
   ================================================================ */
function SignersTab({ template }: { template: ContractTemplate }) {
  const signers = template.signerConfig || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold">Configuración de firmantes</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">Define quién firma esta plantilla y bajo qué reglas</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-[13px]"><Plus className="h-3.5 w-3.5" /> Agregar firmante</Button>
      </div>

      {signers.length === 0 ? (
        <div className="panel p-12 text-center">
          <User className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-[14px] font-medium mt-3">Sin firmantes configurados</p>
          <p className="text-[13px] text-muted-foreground mt-1">Agrega los roles de firmantes requeridos para esta plantilla.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {signers.map((s, i) => (
            <div key={s.id} className="panel p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-[13px] font-bold text-muted-foreground">
                    {s.order}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold">{s.roleName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge-base ${s.signerType === 'internal' ? 'badge-case' : 'badge-signer'}`}>
                        {s.signerType === 'internal' ? 'Interno' : 'Externo'}
                      </span>
                      {s.required && <span className="text-[11px] text-muted-foreground">Obligatorio</span>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Métodos de firma</p>
                  <div className="flex gap-1.5">
                    {s.allowedMethods.map((m) => (
                      <span key={m} className={`badge-base ${m === 'digital' ? 'badge-signature' : 'badge-document'}`}>
                        {m === 'digital' ? 'Digital' : 'Física'}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Biometría</p>
                  <p className={s.requiresBiometric ? 'text-[hsl(var(--status-warning))] font-semibold' : 'text-muted-foreground/50'}>
                    {s.requiresBiometric ? 'Requerida' : 'No requerida'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">KYC</p>
                  <p className={s.requiresKyc ? 'text-[hsl(var(--status-warning))] font-semibold' : 'text-muted-foreground/50'}>
                    {s.requiresKyc ? 'Requerido' : 'No requerido'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Datos requeridos</p>
                  {s.requiredData.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.requiredData.map((d) => (
                        <span key={d} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{d}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground/50">—</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SIGNATURE & VALIDATION TAB
   ================================================================ */
function SignatureTab({ template }: { template: ContractTemplate }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px] font-semibold">Firma y validación</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">Configura los requisitos de firma y cumplimiento para esta plantilla</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel p-5 space-y-4">
          <p className="text-[13px] font-semibold">Métodos de firma</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-[hsl(258_56%_42%)]" />
                <span className="text-[13px]">Requiere firma digital (MiFiel)</span>
              </div>
              <Switch checked={template.requiresMifiel} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">Permite firma física</span>
              </div>
              <Switch checked={template.allowsPhysical} />
            </div>
          </div>
        </div>

        <div className="panel p-5 space-y-4">
          <p className="text-[13px] font-semibold">Validaciones</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-[hsl(28_72%_40%)]" />
                <span className="text-[13px]">Requiere biometría</span>
              </div>
              <Switch checked={template.requiresBiometric} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[hsl(26_72%_36%)]" />
                <span className="text-[13px]">Requiere KYC</span>
              </div>
              <Switch checked={template.requiresKyc} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">Requiere validación documental</span>
              </div>
              <Switch checked={true} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-5 space-y-4">
        <p className="text-[13px] font-semibold">Orden de firma</p>
        <p className="text-[12px] text-muted-foreground">El orden de firma define la secuencia en la que los firmantes deben completar el proceso.</p>
        <div className="space-y-2">
          {(template.signerConfig || []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[11px] font-bold">{s.order}</span>
              <span className="text-[13px] font-medium">{s.roleName}</span>
              <span className={`badge-base text-[10px] ${s.signerType === 'internal' ? 'badge-case' : 'badge-signer'}`}>
                {s.signerType === 'internal' ? 'Interno' : 'Externo'}
              </span>
              <div className="flex gap-1 ml-auto">
                {s.allowedMethods.map((m) => (
                  <span key={m} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{m === 'digital' ? 'Digital' : 'Física'}</span>
                ))}
              </div>
            </div>
          ))}
          {(!template.signerConfig || template.signerConfig.length === 0) && (
            <p className="text-[13px] text-muted-foreground/50 text-center py-4">Sin firmantes configurados</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PREVIEW TAB
   ================================================================ */
function PreviewTab({ template }: { template: ContractTemplate }) {
  const body = template.bodyContent || '';
  const variables = template.variables || [];

  // Replace placeholders with sample values
  let rendered = body;
  variables.forEach((v) => {
    rendered = rendered.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), `[${v.example}]`);
  });
  // Replace any remaining placeholders
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, '[$1]');

  return (
    <div className="grid grid-cols-[1fr_300px] gap-5">
      <div className="panel">
        <div className="panel-header">
          <span className="text-[13px] font-semibold">Vista previa del documento</span>
          <span className="badge-base badge-request">Con valores de ejemplo</span>
        </div>
        <div className="p-6">
          {body ? (
            <div className="bg-white border rounded-lg p-8 shadow-sm max-h-[600px] overflow-y-auto scrollbar-thin">
              <pre className="whitespace-pre-wrap font-serif text-[14px] leading-[1.8] text-foreground">{rendered}</pre>
              <Separator className="my-8" />
              <div className="space-y-6">
                <p className="text-[12px] uppercase tracking-wider text-muted-foreground font-semibold">Sección de firmas</p>
                {(template.signerConfig || []).map((s) => (
                  <div key={s.id} className="flex items-end gap-8">
                    <div className="flex-1">
                      <div className="border-b border-foreground/30 mb-1" style={{ minWidth: 200 }} />
                      <p className="text-[13px] font-medium">{s.roleName}</p>
                      <p className="text-[11px] text-muted-foreground">{s.signerType === 'internal' ? 'Firmante interno' : 'Firmante externo'}</p>
                    </div>
                    <div className="text-right text-[12px] text-muted-foreground">
                      <p>Fecha: ______________</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-[14px] font-medium mt-3">Sin contenido</p>
              <p className="text-[13px] text-muted-foreground mt-1">Agrega contenido en la pestaña Editor para ver la vista previa.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sample values panel */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-[13px] font-semibold">Valores de ejemplo</span>
        </div>
        <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
          {variables.length > 0 ? variables.map((v) => (
            <div key={v.key} className="px-3 py-2 rounded-lg bg-muted/30">
              <p className="text-[11px] font-mono text-muted-foreground/60">{`{{${v.key}}}`}</p>
              <p className="text-[13px] font-medium mt-0.5">{v.example}</p>
            </div>
          )) : (
            <p className="text-[12px] text-muted-foreground/50 text-center py-4">Sin variables definidas</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   VERSIONS TAB
   ================================================================ */
function VersionsTab({ template }: { template: ContractTemplate }) {
  const versions = template.versions || [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold">Historial de versiones</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">Control de cambios y versiones de esta plantilla</p>
      </div>

      {versions.length === 0 ? (
        <div className="panel p-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-[14px] font-medium mt-3">Sin historial</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="table-head w-[80px]">Versión</th>
                <th className="table-head">Fecha</th>
                <th className="table-head">Usuario</th>
                <th className="table-head">Descripción del cambio</th>
                <th className="table-head w-[100px]">Estado</th>
                <th className="table-head w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version} className="border-t border-border/50 table-row-hover">
                  <td className="table-cell font-mono text-[13px] font-semibold">v{v.version}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{v.date}</td>
                  <td className="table-cell text-[13px]">{v.user}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{v.description}</td>
                  <td className="table-cell">
                    {v.status === 'active' ? (
                      <span className="status-badge status-success">Activa</span>
                    ) : v.status === 'historical' ? (
                      <span className="status-badge status-queued">Histórica</span>
                    ) : (
                      <span className="status-badge status-queued">Archivada</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2">Ver</Button>
                      {v.status !== 'active' && <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2">Activar</Button>}
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2">Duplicar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   USAGE TAB
   ================================================================ */
function UsageTab({ template }: { template: ContractTemplate }) {
  const usage = template.usageHistory || [];
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold">Historial de uso</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">Expedientes que han utilizado esta plantilla</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>{template.usageCount} usos totales</span>
          {template.lastUsed && <span>Último uso: {template.lastUsed}</span>}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="kpi-card py-3 px-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total usos</p>
          <p className="text-[20px] font-bold tabular-nums mt-1">{template.usageCount}</p>
        </div>
        <div className="kpi-card py-3 px-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Registros</p>
          <p className="text-[20px] font-bold tabular-nums mt-1">{usage.length}</p>
        </div>
        <div className="kpi-card py-3 px-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Último uso</p>
          <p className="text-[14px] font-medium mt-1">{template.lastUsed || '—'}</p>
        </div>
        <div className="kpi-card py-3 px-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Proyectos</p>
          <p className="text-[20px] font-bold tabular-nums mt-1">{new Set(usage.map(u => u.project)).size}</p>
        </div>
      </div>

      {usage.length === 0 ? (
        <div className="panel p-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-[14px] font-medium mt-3">Sin expedientes registrados</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="table-head">Expediente</th>
                <th className="table-head">Título</th>
                <th className="table-head">Proyecto</th>
                <th className="table-head">Fecha</th>
                <th className="table-head">Estado</th>
                <th className="table-head w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.caseId} className="border-t border-border/50 table-row-hover cursor-pointer" onClick={() => navigate(`/cases/${u.caseId}`)}>
                  <td className="table-cell font-mono text-[12px] text-muted-foreground">{u.caseId}</td>
                  <td className="table-cell text-[13px] font-medium">{u.caseTitle}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{u.project}</td>
                  <td className="table-cell text-[13px] text-muted-foreground">{u.date}</td>
                  <td className="table-cell">
                    <span className={`status-badge ${
                      u.status === 'Firmado' || u.status === 'Archivado' ? 'status-success' :
                      u.status.includes('firma') || u.status.includes('Firma') ? 'status-purple' :
                      u.status.includes('Aprobado') ? 'status-success' :
                      u.status.includes('Revisión') || u.status.includes('revisión') ? 'status-active' :
                      'status-queued'
                    }`}>{u.status}</span>
                  </td>
                  <td className="table-cell">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
