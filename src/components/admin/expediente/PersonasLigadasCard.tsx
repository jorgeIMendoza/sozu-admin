/**
 * Representante legal y accionistas de una persona moral, con alta y baja desde
 * el back office.
 *
 * El cliente los registra desde su portal; esta tarjeta existe para resolverlo
 * internamente cuando eso falla o cuando el dato ya lo tenía capturado el equipo.
 * Las reglas viven en `lib/expediente/personas-ligadas.ts` y son las mismas que
 * aplica la edge function `cliente-expediente`.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ErrorPersonaLigada,
  UMBRAL_ACCIONISTA,
  altaPersonaLigada,
  bajaPersonaLigada,
  buscarPersonas,
  fetchPersonasLigadas,
  ligarPersonaExistente,
  porcentajeDisponible,
  type PersonaLigada,
  type RolLigado,
} from '@/lib/expediente/personas-ligadas';

const ROL_LABEL: Record<RolLigado, string> = {
  representante: 'Representante legal',
  accionista: 'Accionista',
};

export function PersonasLigadasCard({
  personaId,
  nombreEmpresa,
  className,
}: {
  /** Persona MORAL de la que cuelgan el representante y los accionistas. */
  personaId: number;
  nombreEmpresa?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [porQuitar, setPorQuitar] = useState<PersonaLigada | null>(null);

  const { data: ligadas = [], isLoading } = useQuery({
    queryKey: ['personas-ligadas', personaId],
    enabled: !!personaId,
    staleTime: 60_000,
    queryFn: () => fetchPersonasLigadas(personaId, supabase as never),
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['personas-ligadas', personaId] });
    // El expediente cambia con esto: el representante aporta sus propios grupos.
    queryClient.invalidateQueries({ queryKey: ['expediente-personas'] });
    queryClient.invalidateQueries({ queryKey: ['expediente-obligatorios'] });
  };

  const quitar = useMutation({
    mutationFn: (l: PersonaLigada) => bajaPersonaLigada(l.vinculoId!, supabase as never),
    onSuccess: () => {
      toast.success('Vínculo quitado');
      setPorQuitar(null);
      refrescar();
    },
    onError: (e: Error) => toast.error('No se pudo quitar', { description: e.message }),
  });

  const disponible = porcentajeDisponible(ligadas);

  return (
    <div className={cn('rounded-xl border overflow-hidden', className)}>
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            Personas ligadas
          </p>
          <p className="text-[11px] text-muted-foreground">
            {nombreEmpresa ? `De ${nombreEmpresa}. ` : ''}
            Cada una tiene su propio expediente.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" onClick={() => setDialogoAbierto(true)}>
          <Plus className="size-3.5 mr-1" />
          Agregar
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Cargando…</span>
        </div>
      ) : ligadas.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-muted-foreground text-center">
          Sin representante legal ni accionistas registrados. Sin representante, sus documentos
          (poder notarial, identificación, CURP, CSF, domicilio) no se pueden validar.
        </p>
      ) : (
        <div className="divide-y">
          {ligadas.map(l => (
            <div key={`${l.rol}-${l.personaId}`} className="px-4 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate">{l.nombre}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ROL_LABEL[l.rol]}
                  {l.porcentaje != null && ` · ${l.porcentaje}%`}
                  {l.tipoPersona === 'pm' && ' · Persona moral'}
                </p>
              </div>
              {l.legacy && (
                <Badge variant="outline" className="text-[10px] whitespace-nowrap" title="Capturado en la ficha de la empresa, no en la tabla de relaciones">
                  Ficha de la empresa
                </Badge>
              )}
              {l.vinculoId != null && (
                <button
                  type="button"
                  onClick={() => setPorQuitar(l)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive shrink-0"
                  title="Quitar vínculo"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DialogoAgregar
        abierto={dialogoAbierto}
        onCerrar={() => setDialogoAbierto(false)}
        personaId={personaId}
        ligadas={ligadas}
        disponible={disponible}
        onListo={refrescar}
      />

      <AlertDialog open={!!porQuitar} onOpenChange={o => !o && setPorQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {porQuitar?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de formar parte de este expediente. La persona y sus documentos no se borran:
              puede seguir ligada a otra empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => porQuitar && quitar.mutate(porQuitar)}>
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DialogoAgregar({
  abierto, onCerrar, personaId, ligadas, disponible, onListo,
}: {
  abierto: boolean;
  onCerrar: () => void;
  personaId: number;
  ligadas: PersonaLigada[];
  disponible: number;
  onListo: () => void;
}) {
  const [rol, setRol] = useState<RolLigado>('representante');
  const [modo, setModo] = useState<'buscar' | 'nueva'>('buscar');
  const [porcentaje, setPorcentaje] = useState('');

  // Ligar existente
  const [termino, setTermino] = useState('');
  const [seleccionada, setSeleccionada] = useState<{ id: number; nombre: string } | null>(null);

  // Alta nueva
  const [nombre, setNombre] = useState('');
  const [tipoPersona, setTipoPersona] = useState<'pf' | 'pm'>('pf');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');

  const limpiar = () => {
    setRol('representante'); setModo('buscar'); setPorcentaje('');
    setTermino(''); setSeleccionada(null);
    setNombre(''); setTipoPersona('pf'); setCorreo(''); setTelefono('');
  };

  const cerrar = () => { limpiar(); onCerrar(); };

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['buscar-personas-ligar', termino, personaId],
    enabled: abierto && modo === 'buscar' && termino.trim().length >= 3,
    staleTime: 30_000,
    queryFn: () => buscarPersonas(termino, supabase as never, [personaId, ...ligadas.map(l => l.personaId)]),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const pct = rol === 'accionista' ? Number(porcentaje) : null;
      if (modo === 'buscar') {
        if (!seleccionada) throw new ErrorPersonaLigada('sin_seleccion', 'Elige a quién ligar.');
        await ligarPersonaExistente(
          { personaId, personaRelacionId: seleccionada.id, rol, porcentaje: pct, ligadasActuales: ligadas },
          supabase as never,
        );
        return seleccionada.nombre;
      }
      await altaPersonaLigada(
        { personaId, rol, nombre, tipoPersona, correo, telefono, porcentaje: pct, ligadasActuales: ligadas },
        supabase as never,
      );
      return nombre;
    },
    onSuccess: (quien) => {
      toast.success(`${quien} quedó ligada como ${ROL_LABEL[rol].toLowerCase()}`, {
        description: 'Ahora se le piden sus documentos en el expediente.',
      });
      onListo();
      cerrar();
    },
    onError: (e: Error) => toast.error('No se pudo guardar', { description: e.message }),
  });

  return (
    <Dialog open={abierto} onOpenChange={o => !o && cerrar()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Agregar persona al expediente</DialogTitle>
          <DialogDescription>
            El representante legal y los accionistas de más del {UMBRAL_ACCIONISTA}% tienen
            expediente propio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rol</Label>
            <div className="flex gap-2">
              {(['representante', 'accionista'] as RolLigado[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRol(r)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-[12px] font-medium transition-colors',
                    rol === r ? 'border-primary bg-primary/[0.06] text-primary' : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {ROL_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {rol === 'accionista' && (
            <div className="space-y-1.5">
              <Label htmlFor="pct" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Porcentaje de acciones
              </Label>
              <Input
                id="pct" type="number" min={0} max={100} value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
                placeholder={`Más de ${UMBRAL_ACCIONISTA}`}
              />
              <p className="text-[10px] text-muted-foreground">
                Disponible: {disponible}%. Por debajo del {UMBRAL_ACCIONISTA}% no hace falta expediente.
              </p>
            </div>
          )}

          <div className="flex gap-2 border-b">
            {([['buscar', 'Ya existe'], ['nueva', 'Registrar nueva']] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={cn(
                  'px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors',
                  modo === m ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {modo === 'buscar' ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={termino}
                  onChange={e => { setTermino(e.target.value); setSeleccionada(null); }}
                  placeholder="Nombre, correo o RFC…"
                  className="pl-8"
                />
              </div>
              {termino.trim().length > 0 && termino.trim().length < 3 && (
                <p className="text-[10px] text-muted-foreground">Escribe al menos 3 caracteres.</p>
              )}
              {isFetching && <p className="text-[11px] text-muted-foreground">Buscando…</p>}
              {!isFetching && termino.trim().length >= 3 && resultados.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Nadie coincide. Si no está en el sistema, regístrala en la otra pestaña.
                </p>
              )}
              <div className="max-h-48 overflow-y-auto divide-y rounded-md border empty:hidden">
                {resultados.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSeleccionada({ id: p.id, nombre: p.nombre })}
                    className={cn(
                      'w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors',
                      seleccionada?.id === p.id && 'bg-primary/[0.06]',
                    )}
                  >
                    <p className="text-[12px] font-medium truncate">{p.nombre}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {p.tipoPersona === 'pm' ? 'Persona moral' : 'Persona física'}
                      {p.rfc && ` · ${p.rfc}`}
                      {p.email && ` · ${p.email}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nombre" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nombre legal
                </Label>
                <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como aparece en su identificación" />
              </div>
              <div className="flex gap-2">
                {(['pf', 'pm'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoPersona(t)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors',
                      tipoPersona === t ? 'border-primary bg-primary/[0.06] text-primary' : 'text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    {t === 'pf' ? 'Persona física' : 'Persona moral'}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="correo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Correo</Label>
                <Input id="correo" type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@dominio.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel" className="text-[11px] uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                <Input id="tel" inputMode="numeric" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Correo y teléfono son obligatorios: son el único modo de pedirle después sus documentos.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
            {guardar.isPending
              ? <><Loader2 className="size-3.5 mr-1 animate-spin" /> Guardando…</>
              : <><UserPlus className="size-3.5 mr-1" /> Agregar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
