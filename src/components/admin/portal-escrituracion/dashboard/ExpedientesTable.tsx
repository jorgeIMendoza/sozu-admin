import { useEscrituracionDashboard } from '@/contexts/EscrituracionDashboardContext';
import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/components/admin/PersonForm';
import { EditCuentaCobranzaDialog } from '@/components/admin/EditCuentaCobranzaDialog';
import { toast } from 'sonner';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

const PAGE_SIZE = 20;

const STAGE_COLORS: Record<string, string> = {
  'Expediente': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Avalúo': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Instrucción notarial': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Borrador': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'VoBo banco / dev.': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Firma': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Registro público': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Entrega escritura': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Escriturado': 'text-blue-700 bg-blue-50 border-blue-200',
  'Entregado': 'text-teal-700 bg-teal-50 border-teal-200',
  'En demanda': 'text-orange-700 bg-orange-50 border-orange-200',
};

const SLA_COLORS: Record<string, string> = {
  'En tiempo': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'En riesgo': 'text-amber-700 bg-amber-50 border-amber-200',
  'Retrasado': 'text-rose-700 bg-rose-50 border-rose-200',
  'Concluido': 'text-blue-700 bg-blue-50 border-blue-200',
};

interface RowData {
  id: string;
  proyecto: string;
  unidad: string;
  cliente: string;
  // campos financieros numéricos
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  pagoEfectivo: number;
  valorEscritura: number;
  tieneBodega: boolean;
  tieneCajon: boolean;
  // resto
  banco: string;
  notaria: string;
  etapa: string;
  avance: number | null;
  sla: string;
  ultimaActualizacion: string;
  estatusId: number;
  tipo: string;
  personaId: number | null;
  cuentaCobranzaId: number | null;
}

const fmtMxn = (n: number) =>
  n === 0 ? '$0' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const columnHelper = createColumnHelper<RowData>();

const columns = [
  columnHelper.accessor('id', {
    header: 'ID Cuenta',
    cell: info => {
      const val = info.getValue();
      const hasAccount = !!info.row.original.cuentaCobranzaId;
      const display = val.startsWith('CC-') ? val : '—';
      return (
        <div>
          <div className={`font-bold ${hasAccount ? 'text-emerald-600 underline underline-offset-2 decoration-dotted cursor-pointer' : 'text-slate-900'}`}>{display}</div>
          <div className="text-xs text-slate-500 mt-0.5">{info.row.original.proyecto}</div>
        </div>
      );
    },
  }),
  columnHelper.accessor('tipo', {
    header: 'Tipo',
    cell: info => <span className="text-slate-600 text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('unidad', {
    header: 'Unidad / Cliente',
    cell: info => (
      <div>
        <div className="font-semibold text-slate-900">{info.getValue()}</div>
        <div className={`text-sm mt-0.5 ${info.row.original.personaId ? 'text-emerald-600 underline underline-offset-2 decoration-dotted cursor-pointer' : 'text-slate-500'}`}>
          {info.row.original.cliente}
        </div>
      </div>
    ),
  }),
  // ── Columnas financieras ──────────────────────────────────────────────────
  columnHelper.accessor('precioFinal', {
    header: 'Precio Final',
    cell: info => {
      const v = info.getValue();
      return v > 0
        ? <span className="text-slate-800 text-sm font-medium tabular-nums">{fmtMxn(v)}</span>
        : <span className="text-slate-300 text-sm">—</span>;
    },
  }),
  columnHelper.accessor('totalPagado', {
    header: 'Total Pagado',
    cell: info => {
      const v = info.getValue();
      return v > 0
        ? <span className="text-emerald-600 text-sm font-semibold tabular-nums">{fmtMxn(v)}</span>
        : <span className="text-slate-300 text-sm">$0</span>;
    },
  }),
  columnHelper.accessor('saldoPendiente', {
    header: 'Saldo Pendiente',
    cell: info => {
      const v = info.getValue();
      return v > 0
        ? <span className="text-amber-600 text-sm font-semibold tabular-nums">{fmtMxn(v)}</span>
        : <span className="text-emerald-500 text-sm font-semibold">$0</span>;
    },
  }),
  columnHelper.accessor('pagoEfectivo', {
    header: 'Pago Efectivo',
    cell: info => {
      const v = info.getValue();
      return v > 0
        ? <span className="text-slate-700 text-sm tabular-nums">{fmtMxn(v)}</span>
        : <span className="text-slate-300 text-sm">—</span>;
    },
  }),
  columnHelper.accessor('valorEscritura', {
    header: 'Valor Escritura',
    cell: info => {
      const v = info.getValue();
      const { tieneBodega, tieneCajon } = info.row.original;
      return (
        <div>
          {v > 0
            ? <span className="text-purple-700 text-sm font-semibold tabular-nums">{fmtMxn(v)}</span>
            : <span className="text-slate-300 text-sm">—</span>
          }
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tieneBodega ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
              Bodega {tieneBodega ? 'Sí' : 'No'}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tieneCajon ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
              Cajón {tieneCajon ? 'Sí' : 'No'}
            </span>
          </div>
        </div>
      );
    },
  }),
  // ─────────────────────────────────────────────────────────────────────────
  columnHelper.accessor('banco', {
    header: 'Banco',
    cell: info => <span className="text-slate-500 text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('notaria', {
    header: 'Notaría',
    cell: info => {
      const val = info.getValue();
      const clickable = !!info.row.original.cuentaCobranzaId && val !== '—';
      return (
        <span className={`text-sm ${clickable ? 'text-emerald-600 underline underline-offset-2 decoration-dotted cursor-pointer' : 'text-slate-600'}`}>
          {val}
        </span>
      );
    },
  }),
  columnHelper.accessor('etapa', {
    header: 'Estatus',
    cell: info => {
      const val = info.getValue();
      if (val === '—') return <span className="text-slate-400 text-sm">—</span>;
      const color = STAGE_COLORS[val] || 'text-slate-700 bg-slate-50 border-slate-200';
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {val}
        </span>
      );
    },
  }),
  columnHelper.accessor('avance', {
    header: 'Avance',
    cell: info => {
      const val = info.getValue();
      if (val === null || val === undefined) return <span className="text-slate-400 text-sm">—</span>;
      return (
        <div className="flex items-center gap-3 w-32">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${val}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-500 w-8">{val}%</span>
        </div>
      );
    },
  }),
  columnHelper.accessor('sla', {
    header: 'SLA',
    cell: info => {
      const val = info.getValue();
      if (val === '—') return <span className="text-slate-400 text-sm">—</span>;
      const color = SLA_COLORS[val] || 'text-slate-700 bg-slate-50 border-slate-200';
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
          {val}
        </span>
      );
    },
  }),
  columnHelper.accessor('ultimaActualizacion', {
    header: 'Última Actualización',
    cell: info => <span className="text-slate-500 text-sm">{info.getValue()}</span>,
  }),
];

export function ExpedientesTable() {
  const {
    proyectoActivo,
    busqueda,
    setBusqueda,
    filtroEtapa,
    setFiltroEtapa,
    filtroSla,
    setFiltroSla,
    filtroPago,
    setFiltroPago,
    filtroNotaria,
    setFiltroNotaria,
    expedienteSeleccionado,
    setExpedienteSeleccionado,
  } = useEscrituracionDashboard();

  const [currentPage, setCurrentPage] = useState(0);
  const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<{ id: number; precio_final: number; initialTab: string } | null>(null);
  const queryClient = useQueryClient();

  // Reset página cuando cambian los filtros o búsqueda
  useEffect(() => { setCurrentPage(0); }, [filtroEtapa, filtroSla, filtroPago, filtroNotaria, busqueda, proyectoActivo?.id]);

  // Fetch datos completos de la persona a editar
  const { data: editingPersona } = useQuery({
    queryKey: ['persona-edit', editingPersonaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('personas')
        .select('*')
        .eq('id', editingPersonaId)
        .single();
      return data;
    },
    enabled: !!editingPersonaId,
  });

  const updateMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { entityType, representativeId, commercialRepresentativeId, inmobiliariaId, tempBankAccounts, tempBeneficiaries, pendingDocuments, porcentaje_comision, ...cleanPersonData } = personData;
      const { error } = await supabase.from('personas').update(cleanPersonData).eq('id', editingPersonaId);
      if (error) throw error;
      if (representativeId !== undefined) {
        await supabase.from('personas').update({ id_entidad_relacionada_rep_leg: representativeId || null }).eq('id', editingPersonaId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedientes-real', proyectoActivo?.id] });
      queryClient.invalidateQueries({ queryKey: ['compradores'] });
      setIsEditDialogOpen(false);
      setEditingPersonaId(null);
      toast.success('Comprador actualizado correctamente.');
    },
    onError: () => toast.error('Error al actualizar el comprador.'),
  });

  // Fetch de todas las unidades activas del proyecto
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ['expedientes-real', proyectoActivo?.id],
    queryFn: async (): Promise<RowData[]> => {
      if (!proyectoActivo?.id) return [];

      // Paso 1: IDs de modelos del proyecto (misma query cacheada por React Query)
      const { data: edificios } = await supabase
        .from('edificios').select('id').eq('id_proyecto', proyectoActivo.id).eq('activo', true);
      if (!edificios?.length) return [];

      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id').in('id_edificio', edificios.map(e => e.id));
      if (!modelos?.length) return [];

      const modeloIds = modelos.map(m => m.id);

      // Paso 2: Todas las propiedades activas del proyecto
      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_estatus_disponibilidad, fecha_actualizacion')
        .eq('activo', true)
        .in('id_edificio_modelo', modeloIds)
        .order('numero_propiedad');

      if (!props?.length) return [];
      const propIds = props.map(p => p.id);

      // Paso 3: Cuentas de cobranza — tomar la más reciente por propiedad
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, id_notario, fecha_actualizacion, precio_final')
        .eq('activo', true)
        .in('id_propiedad', propIds);

      const cuentaByProp: Record<number, { id: number; id_propiedad: number; id_notario: number | null; fecha_actualizacion: string; precio_final: number }> = {};
      (cuentas || []).forEach(c => {
        const existing = cuentaByProp[c.id_propiedad];
        if (!existing || c.fecha_actualizacion > existing.fecha_actualizacion) {
          cuentaByProp[c.id_propiedad] = c;
        }
      });

      const cuentaIds = Object.values(cuentaByProp).map(c => c.id);
      const notarioIds = [...new Set(
        Object.values(cuentaByProp).map(c => c.id_notario).filter((id): id is number => id !== null)
      )];

      // Paso 4: Notarios
      const notarioMap: Record<number, string> = {};
      if (notarioIds.length) {
        const { data: notarios } = await supabase
          .from('notarios').select('id, notaria').in('id', notarioIds);
        (notarios || []).forEach(n => { notarioMap[n.id] = n.notaria; });
      }

      // Paso 5: Compradores → Personas (nombre del comprador)
      const buyerByCuenta: Record<number, string> = {};
      const personaIdByCuenta: Record<number, number> = {};
      if (cuentaIds.length) {
        const { data: compradors } = await supabase
          .from('compradores')
          .select('id_cuenta_cobranza, id_persona')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('activo', true);

        const personaIds = [...new Set((compradors || []).map(c => c.id_persona))];
        if (personaIds.length) {
          const { data: personas } = await supabase
            .from('personas').select('id, nombre_legal').in('id', personaIds);

          const personaMap: Record<number, string> = {};
          (personas || []).forEach(p => { personaMap[p.id] = p.nombre_legal || '—'; });

          const seen = new Set<number>();
          (compradors || []).forEach(c => {
            if (!seen.has(c.id_cuenta_cobranza)) {
              seen.add(c.id_cuenta_cobranza);
              buyerByCuenta[c.id_cuenta_cobranza] = personaMap[c.id_persona] || '—';
              personaIdByCuenta[c.id_cuenta_cobranza] = c.id_persona;
            }
          });
        }
      }

      // Paso 6: Totales pagados — query directa a pagos en lotes de 30
      // (evita el límite de 1000 filas de PostgREST: acuerdos→aplicaciones cascade falla en proyectos grandes)
      const BATCH = 30;
      const totalPagadoByCuenta: Record<number, number> = {};
      const pagoEfectivoByCuenta: Record<number, number> = {};

      if (cuentaIds.length) {
        const batches: Promise<any>[] = [];
        for (let i = 0; i < cuentaIds.length; i += BATCH) {
          const slice = (cuentaIds as number[]).slice(i, i + BATCH);
          batches.push(
            supabase.from('pagos')
              .select('id_cuenta_cobranza, monto, id_metodos_pago')
              .in('id_cuenta_cobranza', slice as any)
              .eq('activo', true)
          );
        }
        const results = await Promise.allSettled(batches);
        results.forEach(r => {
          if (r.status !== 'fulfilled') return;
          ((r.value as any).data ?? []).forEach((p: any) => {
            const cid = p.id_cuenta_cobranza;
            totalPagadoByCuenta[cid] = (totalPagadoByCuenta[cid] || 0) + Number(p.monto);
            if (p.id_metodos_pago === 1) { // 1 = efectivo
              pagoEfectivoByCuenta[cid] = (pagoEfectivoByCuenta[cid] || 0) + Number(p.monto);
            }
          });
        });
      }

      // Paso 7: Bodegas y estacionamientos por propiedad
      const bodegaByProp: Record<number, boolean>  = {};
      const cajonByProp:  Record<number, boolean>  = {};
      const extraPorProp: Record<number, number>   = {};

      const [bodegasRes, estacRes] = await Promise.allSettled([
        supabase.from('bodegas').select('id_propiedad, id_producto, es_incluido')
          .in('id_propiedad', propIds).eq('activo', true),
        supabase.from('estacionamientos').select('id_propiedad, id_producto, es_incluido')
          .in('id_propiedad', propIds).eq('activo', true),
      ]);

      const bodegas    = bodegasRes.status    === 'fulfilled' ? (bodegasRes.value.data   ?? []) : [];
      const estaciones = estacRes.status === 'fulfilled' ? (estacRes.value.data ?? []) : [];

      bodegas.forEach((b: any)    => { bodegaByProp[b.id_propiedad] = true; });
      estaciones.forEach((e: any) => { cajonByProp[e.id_propiedad]  = true; });

      // Cuentas de bodegas/estac NO incluidos → para valor de escritura
      const extraItems: { id_propiedad: number; id_producto: number }[] = [
        ...bodegas.filter((b: any)    => !b.es_incluido).map((b: any) => ({ id_propiedad: b.id_propiedad, id_producto: b.id_producto })),
        ...estaciones.filter((e: any) => !e.es_incluido).map((e: any) => ({ id_propiedad: e.id_propiedad, id_producto: e.id_producto })),
      ].filter(x => x.id_producto);

      if (extraItems.length) {
        const extraProductIds = extraItems.map(x => x.id_producto);
        const { data: ofertasExtra } = await supabase
          .from('ofertas').select('id, id_producto').in('id_producto', extraProductIds).eq('activo', true);

        if (ofertasExtra?.length) {
          const { data: ctasExtra } = await supabase
            .from('cuentas_cobranza').select('id_oferta, precio_final')
            .in('id_oferta', ofertasExtra.map((o: any) => o.id)).eq('activo', true);

          const productoPropMap: Record<number, number> = {};
          extraItems.forEach(x => { productoPropMap[x.id_producto] = x.id_propiedad; });
          const ofertaProductoMap: Record<number, number> = {};
          (ofertasExtra ?? []).forEach((o: any) => { ofertaProductoMap[o.id] = o.id_producto; });

          (ctasExtra ?? []).forEach((c: any) => {
            const prodId = ofertaProductoMap[c.id_oferta];
            const propId = productoPropMap[prodId];
            if (propId) extraPorProp[propId] = (extraPorProp[propId] || 0) + Number(c.precio_final || 0);
          });
        }
      }

      // Paso 8: Construir filas (pagos ya en totalPagadoByCuenta + pagoEfectivoByCuenta)
      return props.map(p => {
        const cuenta = cuentaByProp[p.id];
        const cuentaId = cuenta?.id ?? null;
        const notaria = cuenta?.id_notario ? (notarioMap[cuenta.id_notario] || '—') : '—';
        const cliente = cuentaId ? (buyerByCuenta[cuentaId] || '—') : '—';
        const personaId = cuentaId ? (personaIdByCuenta[cuentaId] || null) : null;
        const fechaAct = cuenta?.fecha_actualizacion || p.fecha_actualizacion;

        const precioFinal   = Number(cuenta?.precio_final ?? 0);
        const totalPagado   = cuentaId ? (totalPagadoByCuenta[cuentaId] ?? 0)   : 0;
        const saldoPendiente = Math.max(0, precioFinal - totalPagado);
        const pagoEfectivo  = cuentaId ? (pagoEfectivoByCuenta[cuentaId] ?? 0) : 0;
        const valorEscritura = precioFinal + (extraPorProp[p.id] ?? 0);

        return {
          id: cuentaId ? `CC-${String(cuentaId).padStart(6, '0')}` : `PROP-${p.id}`,
          proyecto: proyectoActivo.nombre,
          unidad: p.numero_propiedad,
          cliente,
          precioFinal,
          totalPagado,
          saldoPendiente,
          pagoEfectivo,
          valorEscritura,
          tieneBodega: bodegaByProp[p.id] ?? false,
          tieneCajon:  cajonByProp[p.id]  ?? false,
          banco: '—',
          notaria,
          etapa: p.id_estatus_disponibilidad === 7
            ? 'Escriturado'
            : p.id_estatus_disponibilidad === 8
            ? 'Entregado'
            : p.id_estatus_disponibilidad === 11
            ? 'En demanda'
            : '—',
          avance: null,
          sla: '—',
          estatusId: p.id_estatus_disponibilidad,
          tipo: cuentaId ? 'Propiedad' : '—',
          personaId,
          cuentaCobranzaId: cuentaId,
          ultimaActualizacion: fechaAct
            ? new Date(fechaAct).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—',
        };
      });
    },
    enabled: !!proyectoActivo?.id,
  });

  // Filtros y búsqueda sobre todos los datos
  const filteredData = useMemo(() => {
    return allRows.filter(row => {
      if (filtroEtapa === 'Escriturado') {
        if (row.estatusId !== 7) return false;
      } else if (filtroEtapa === 'En demanda') {
        if (row.estatusId !== 11) return false;
      } else if (filtroEtapa === 'Entregado') {
        if (row.estatusId !== 8) return false;
      } else if (filtroEtapa !== 'Todas' && row.etapa !== filtroEtapa) {
        return false;
      }
      if (filtroSla !== 'Todas' && row.sla !== filtroSla) return false;
      if (filtroPago !== 'Todos' && row.pago !== filtroPago) return false;
      if (filtroNotaria !== 'Todas' && row.notaria !== filtroNotaria) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        return (
          row.id.toLowerCase().includes(q) ||
          row.unidad.toLowerCase().includes(q) ||
          row.cliente.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRows, filtroEtapa, filtroSla, filtroPago, filtroNotaria, busqueda]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const pagedData = useMemo(() => {
    const from = currentPage * PAGE_SIZE;
    return filteredData.slice(from, from + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const from = currentPage * PAGE_SIZE + 1;
  const to = Math.min((currentPage + 1) * PAGE_SIZE, filteredData.length);

  const table = useReactTable({
    data: pagedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
    <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col mb-6 lg:mb-0">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap lg:flex-nowrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por expediente, unidad o cliente..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
          <select
            value={filtroEtapa}
            onChange={e => setFiltroEtapa(e.target.value)}
            className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none min-w-max"
          >
            <option value="Todas">Etapa: Todas</option>
            <option value="Escriturado">Escriturado</option>
            <option value="En demanda">En demanda</option>
            <option value="Entregado">Entregado</option>
            <option value="Borrador">Borrador</option>
            <option value="Firma">Firma</option>
            <option value="Registro público">Registro público</option>
          </select>

          <select
            value={filtroSla}
            onChange={e => setFiltroSla(e.target.value)}
            className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none min-w-max"
          >
            <option value="Todas">SLA: Todas</option>
            <option value="En tiempo">En tiempo</option>
            <option value="En riesgo">En riesgo</option>
            <option value="Retrasado">Retrasado</option>
          </select>

          <select
            value={filtroPago}
            onChange={e => setFiltroPago(e.target.value)}
            className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none min-w-max"
          >
            <option value="Todos">Tipo de pago: Todos</option>
            <option value="Hipotecario">Hipotecario</option>
            <option value="Contado">Contado</option>
          </select>

          <select
            value={filtroNotaria}
            onChange={e => setFiltroNotaria(e.target.value)}
            className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none min-w-max"
          >
            <option value="Todas">Notaría: Todas</option>
          </select>

          <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ml-auto shadow-sm">
            <Plus className="w-4 h-4" />
            Nuevo expediente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando unidades...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50/50">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map(row => {
                const isSelected = row.original.id === expedienteSeleccionado;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setExpedienteSeleccionado(isSelected ? null : row.original.id)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/30' : ''}`}
                  >
                    {row.getVisibleCells().map(cell => {
                      const isUnidadClickable = cell.column.id === 'unidad' && !!row.original.personaId;
                      const isNotariaClickable = cell.column.id === 'notaria' && !!row.original.cuentaCobranzaId && row.original.notaria !== '—';
                      const isIdClickable = cell.column.id === 'id' && !!row.original.cuentaCobranzaId;
                      return (
                      <td
                        key={cell.id}
                        className={`px-5 py-4 whitespace-nowrap text-sm align-middle ${isNotariaClickable || isIdClickable ? 'cursor-pointer' : ''}`}
                        onClick={
                          isUnidadClickable
                            ? (e) => { e.stopPropagation(); setEditingPersonaId(row.original.personaId); setIsEditDialogOpen(true); }
                            : isNotariaClickable
                            ? (e) => { e.stopPropagation(); setEditingCuenta({ id: row.original.cuentaCobranzaId!, precio_final: row.original.precioFinal, initialTab: 'escrituracion' }); }
                            : isIdClickable
                            ? (e) => { e.stopPropagation(); setEditingCuenta({ id: row.original.cuentaCobranzaId!, precio_final: row.original.precioFinal, initialTab: 'propiedad' }); }
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!isLoading && pagedData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500">
                    No se encontraron unidades con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer / Paginación */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500 rounded-b-2xl">
        <span>
          {filteredData.length > 0
            ? `Mostrando ${from} a ${to} de ${filteredData.length} unidades`
            : 'Sin resultados'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            {'<'}
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const page = totalPages <= 5 ? i : Math.max(0, Math.min(currentPage - 2, totalPages - 5)) + i;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {page + 1}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            {'>'}
          </button>
        </div>
      </div>
    </div>

    {editingCuenta && (
      <EditCuentaCobranzaDialog
        cuenta={editingCuenta}
        initialTab={editingCuenta.initialTab}
        onClose={() => setEditingCuenta(null)}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['expedientes-real', proyectoActivo?.id] });
          setEditingCuenta(null);
        }}
      />
    )}

    <Dialog
      open={isEditDialogOpen}
      onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingPersonaId(null);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Comprador</DialogTitle>
        </DialogHeader>
        {editingPersona && (
          <PersonForm
            initialData={{ ...editingPersona, representativeId: editingPersona.id_entidad_relacionada_rep_leg }}
            onSubmit={(data) => updateMutation.mutate(data)}
            isLoading={updateMutation.isPending}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingPersonaId(null);
            }}
            entityType="comprador"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
