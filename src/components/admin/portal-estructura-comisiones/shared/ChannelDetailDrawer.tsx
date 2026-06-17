import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pencil, Save, X, Plus, Trash2, ArrowUp, ArrowDown, Info, CheckCircle2, ShieldAlert, Sparkles, Palette } from 'lucide-react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import type { Channel, ChannelProfile } from '@/lib/portal-estructura-comisiones/types/simulator';
import { toast } from 'sonner';

interface Props {
  channelId: string | null;
  open: boolean;
  onClose: () => void;
}

const emptyProfile = (): ChannelProfile => ({
  shortDescription: '',
  longDescription: '',
  objective: '',
  idealProfile: '',
  requirements: [],
  benefits: [],
  restrictions: [],
  baseCommission: '',
  maxCommission: '',
  inventoryAccess: '',
  materialsAccess: '',
  attentionPriority: '',
  color: '#10b981',
  badge: '',
  icon: '',
  imageUrl: '',
  blocks: { general: true, requirements: true, benefits: true, restrictions: true, visual: true },
});

export default function ChannelDetailDrawer({ channelId, open, onClose }: Props) {
  const { channels, updateChannel } = useSimulator();
  const channel = channels.find(c => c.id === channelId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Channel | null>(null);

  useEffect(() => {
    if (channel) {
      setDraft({ ...channel, profile: { ...emptyProfile(), ...(channel.profile || {}) } });
      setEditing(false);
    }
  }, [channelId, channel?.id]);

  if (!channel || !draft) return null;
  const profile = draft.profile!;
  const blocks = profile.blocks || {};

  const updateProfile = (patch: Partial<ChannelProfile>) =>
    setDraft({ ...draft, profile: { ...profile, ...patch } });

  const updateList = (key: 'requirements' | 'benefits' | 'restrictions', items: string[]) =>
    updateProfile({ [key]: items } as any);

  const addItem = (key: 'requirements' | 'benefits' | 'restrictions') =>
    updateList(key, [...(profile[key] || []), '']);

  const removeItem = (key: 'requirements' | 'benefits' | 'restrictions', i: number) =>
    updateList(key, (profile[key] || []).filter((_, idx) => idx !== i));

  const editItem = (key: 'requirements' | 'benefits' | 'restrictions', i: number, value: string) => {
    const list = [...(profile[key] || [])];
    list[i] = value;
    updateList(key, list);
  };

  const moveItem = (key: 'requirements' | 'benefits' | 'restrictions', i: number, dir: -1 | 1) => {
    const list = [...(profile[key] || [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateList(key, list);
  };

  const save = () => {
    updateChannel(draft);
    toast.success('Ficha del canal actualizada');
    setEditing(false);
  };

  const cancel = () => {
    setDraft({ ...channel, profile: { ...emptyProfile(), ...(channel.profile || {}) } });
    setEditing(false);
  };

  const ListEditor = ({
    keyName, label, icon: Icon,
  }: { keyName: 'requirements' | 'benefits' | 'restrictions'; label: string; icon: any }) => {
    const items = profile[keyName] || [];
    return (
      <div className="space-y-2">
        {items.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground italic">Sin elementos definidos.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <Icon className="h-4 w-4 text-primary mt-2 shrink-0" />
            {editing ? (
              <>
                <Input value={item} onChange={e => editItem(keyName, i, e.target.value)} className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveItem(keyName, i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveItem(keyName, i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(keyName, i)}><Trash2 className="h-3 w-3" /></Button>
              </>
            ) : (
              <p className="text-sm flex-1 pt-1.5">{item || <span className="italic text-muted-foreground">(vacío)</span>}</p>
            )}
          </div>
        ))}
        {editing && (
          <Button variant="outline" size="sm" onClick={() => addItem(keyName)}>
            <Plus className="h-3 w-3 mr-1" /> Agregar {label.toLowerCase()}
          </Button>
        )}
      </div>
    );
  };

  const Field = ({ label, value, onChange, multiline }: { label: string; value?: string; onChange: (v: string) => void; multiline?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {editing ? (
        multiline
          ? <Textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} />
          : <Input value={value || ''} onChange={e => onChange(e.target.value)} />
      ) : (
        <p className="text-sm">{value || <span className="italic text-muted-foreground">No definido</span>}</p>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: profile.color || 'hsl(var(--primary))' }}
              >
                {(profile.icon || channel.name).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <SheetTitle className="text-xl">{draft.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  {profile.badge && <Badge variant="secondary">{profile.badge}</Badge>}
                  <Badge variant={draft.active ? 'default' : 'secondary'} className="text-[10px]">
                    {draft.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <span className="text-[10px] font-mono">{channel.id}</span>
                </SheetDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-5">
          {/* Block toggles (only in edit) */}
          {editing && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Bloques visibles</CardTitle>
                <CardDescription>Activa o desactiva secciones de la ficha</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {(['general', 'requirements', 'benefits', 'restrictions', 'visual'] as const).map(b => (
                  <div key={b} className="flex items-center gap-2">
                    <Switch
                      checked={blocks[b] !== false}
                      onCheckedChange={(v) => updateProfile({ blocks: { ...blocks, [b]: v } })}
                    />
                    <Label className="text-xs capitalize">{b}</Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION A — General */}
          {blocks.general !== false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-primary" /> Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing && <Field label="Nombre del canal" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />}
                <Field label="Descripción corta" value={profile.shortDescription} onChange={(v) => updateProfile({ shortDescription: v })} />
                <Field label="Descripción larga" value={profile.longDescription} onChange={(v) => updateProfile({ longDescription: v })} multiline />
                <Field label="Objetivo del canal" value={profile.objective} onChange={(v) => updateProfile({ objective: v })} multiline />
                <Field label="Tipo de perfil ideal" value={profile.idealProfile} onChange={(v) => updateProfile({ idealProfile: v })} />
                {editing && (
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                    <Label className="text-sm">Canal activo</Label>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SECTION B — Requirements */}
          {blocks.requirements !== false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" /> Requisitos</CardTitle>
                <CardDescription>Lo que debe cumplir un broker o agente para operar este canal</CardDescription>
              </CardHeader>
              <CardContent>
                <ListEditor keyName="requirements" label="Requisito" icon={CheckCircle2} />
              </CardContent>
            </Card>
          )}

          {/* SECTION C — Benefits */}
          {blocks.benefits !== false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Beneficios y Alcances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Comisión base" value={profile.baseCommission} onChange={(v) => updateProfile({ baseCommission: v })} />
                  <Field label="Comisión máxima" value={profile.maxCommission} onChange={(v) => updateProfile({ maxCommission: v })} />
                  <Field label="Acceso a inventario" value={profile.inventoryAccess} onChange={(v) => updateProfile({ inventoryAccess: v })} />
                  <Field label="Acceso a materiales" value={profile.materialsAccess} onChange={(v) => updateProfile({ materialsAccess: v })} />
                  <Field label="Prioridad de atención" value={profile.attentionPriority} onChange={(v) => updateProfile({ attentionPriority: v })} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Beneficios especiales</Label>
                  <ListEditor keyName="benefits" label="Beneficio" icon={Sparkles} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION D — Restrictions */}
          {blocks.restrictions !== false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-destructive" /> Restricciones y Políticas</CardTitle>
              </CardHeader>
              <CardContent>
                <ListEditor keyName="restrictions" label="Restricción" icon={ShieldAlert} />
              </CardContent>
            </Card>
          )}

          {/* SECTION E — Visual */}
          {blocks.visual !== false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" /> Identidad Visual</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Color distintivo</Label>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Input type="color" value={profile.color || '#10b981'} onChange={(e) => updateProfile({ color: e.target.value })} className="w-16 h-9 p-1" />
                      <Input value={profile.color || ''} onChange={(e) => updateProfile({ color: e.target.value })} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2"><div className="h-5 w-5 rounded" style={{ backgroundColor: profile.color }} /><span className="text-sm font-mono">{profile.color}</span></div>
                  )}
                </div>
                <Field label="Badge / Etiqueta" value={profile.badge} onChange={(v) => updateProfile({ badge: v })} />
                <Field label="Iniciales / Ícono" value={profile.icon} onChange={(v) => updateProfile({ icon: v })} />
                <Field label="URL imagen representativa" value={profile.imageUrl} onChange={(v) => updateProfile({ imageUrl: v })} />
                {profile.imageUrl && !editing && (
                  <div className="sm:col-span-2">
                    <img src={profile.imageUrl} alt={draft.name} className="rounded-lg max-h-40 object-cover" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
