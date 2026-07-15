import { Fragment, useState } from 'react';
import {
  ArrowRightLeft, CreditCard, FileDown, Pencil,
  Loader2, Upload, FileText, Eye,
  FileClock, FileCheck, FileWarning,
  Undo2, Building2, Calendar, Hash, Home, Landmark,
  User, Phone, Mail, ChevronRight, Briefcase, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  fmtCurrency, fmtDate, acuerdoEstado,
  KpiCard, TabBar, EstadoBadge, ValidacionBadge, ClaveCopyable, IconTip,
  DocEstatusBadge, InfoRow, RecalcularDispersionButton,
  INFO_TABS, ACTIVITY_TABS,
  type InfoTab, type ActivityTab, type CuentaDetalleCtx,
} from './cuentaDetalleShared';

const ACUERDOS_PAGE_SIZE = 12;

export function CuentaDetalleMantenimiento({ ctx }: { ctx: CuentaDetalleCtx }) {
  const navigate = useNavigate();
  const [infoTab, setInfoTab] = useState<InfoTab>('resumen');
  const [activityTab, setActivityTab] = useState<ActivityTab>('acuerdos');

  const {
    cuentaId, precio_final, totalPagado, parcialidadesVencidas, montoVencido,
    acuerdos, docs, docsLoading,
    expandedAcuerdos, setExpandedAcuerdos,
    acuerdosPage, setAcuerdosPage,
    setPagoDialog, setUploadDialog, openCargarEvidencia, setEditCuentaDialog,
    setMultaAcuerdoId, setMultaDialog, setMultaGestionAcuerdoId, setMultaGestionDialog,
    setPagoEvidenciaModal, setPdfPreviewModal,
    canDeletePago, openEliminarPago,
    aplicacionesList,
    hayDiscrepanciaAplicaciones, recalculandoAplic, handleRecalcularAplicaciones,
    generatingPDF, handleEstadoCuenta,
    clabe_stp, fecha_compra,
    compradores, agente,
    proyectoNombre, edificioNombre, modeloNombre, numero_propiedad,
    productoNombre, estatusPropiedad, m2Interiores, m2Exteriores,
    tipo,
  } = ctx;

  const totalPages = Math.ceil(acuerdos.length / ACUERDOS_PAGE_SIZE);
  const pagedAcuerdos = acuerdos.length > ACUERDOS_PAGE_SIZE
    ? acuerdos.slice(acuerdosPage * ACUERDOS_PAGE_SIZE, (acuerdosPage + 1) * ACUERDOS_PAGE_SIZE)
    : acuerdos;

  return (
    <>
      {/* KPI grid — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Pagado"
          value={fmtCurrency(totalPagado)}
          sub={`${acuerdos.filter((a: any) => a.pago_completado).length} de ${acuerdos.length} acuerdos`}
          accent={totalPagado > 0 ? 'success' : undefined}
        />
        <KpiCard
          label="Acuerdos Vencidos"
          value={String(parcialidadesVencidas)}
          accent={parcialidadesVencidas > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          label="Monto Vencido"
          value={fmtCurrency(montoVencido)}
          accent={montoVencido > 0 ? 'danger' : undefined}
        />
        <KpiCard
          label="Próximo Vencimiento"
          value={(() => {
            const prox = acuerdos.find((a: any) => !a.pago_completado && a.fecha_pago)?.fecha_pago ?? null;
            return prox ? fmtDate(prox) : 'Sin pendientes';
          })()}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <button
          onClick={() => navigate(`/admin/portal-cobranza/cuentas-cobranza/${cuentaId}/detalle`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRightLeft className="size-3.5" />Transferir
        </button>
        <button
          onClick={() => setPagoDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
        >
          <CreditCard className="size-3.5" />Agregar Pago
        </button>
        <RecalcularDispersionButton
          show={hayDiscrepanciaAplicaciones}
          loading={recalculandoAplic}
          onClick={handleRecalcularAplicaciones}
        />
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <button
          onClick={handleEstadoCuenta}
          disabled={generatingPDF}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          {generatingPDF ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
          Estado de Cuenta
        </button>
        <button
          onClick={() => setEditCuentaDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="size-3.5" />Editar Cuenta
        </button>
      </div>

      {/* Info section */}
      <div className="sozu-kpi-card p-0 overflow-hidden">
        <TabBar tabs={INFO_TABS} active={infoTab} onChange={setInfoTab} />

        {infoTab === 'resumen' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                {tipo === 'Propiedad' ? 'Unidad' : 'Producto'}
              </h3>
              <InfoRow icon={Building2} label="Proyecto"   value={proyectoNombre} />
              {edificioNombre && <InfoRow icon={Building2} label="Edificio"   value={edificioNombre} />}
              {modeloNombre   && <InfoRow icon={Home}      label="Modelo"     value={modeloNombre} />}
              {numero_propiedad && <InfoRow icon={Hash}    label="Unidad"     value={numero_propiedad} />}
              {productoNombre && <InfoRow icon={Home}      label="Producto"   value={productoNombre} />}
              {estatusPropiedad && <InfoRow icon={ChevronRight} label="Estatus" value={estatusPropiedad} />}
              {(m2Interiores > 0 || m2Exteriores > 0) && (
                <InfoRow icon={Home} label="Metraje"
                  value={m2Exteriores > 0
                    ? `${m2Interiores} m2 int · ${m2Exteriores} m2 ext`
                    : `${m2Interiores} m2`}
                />
              )}
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Datos de la cuenta</h3>
              <InfoRow icon={Landmark}   label="CLABE STP"    value={clabe_stp ?? ''} />
              <InfoRow icon={Calendar}   label="Fecha compra" value={fmtDate(fecha_compra)} />
            </div>
          </div>
        )}

        {infoTab === 'personas' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
                Compradores ({compradores.length})
              </h3>
              {compradores.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Sin compradores registrados.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {compradores.map((c: any, i: number) => (
                    <div key={i} className="py-3 flex items-center gap-3">
                      <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{c.nombre || 'Sin nombre'}</p>
                        {c.porcentaje != null && (
                          <p className="text-[11px] text-muted-foreground">{c.porcentaje}% copropiedad</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Vendedor</h3>
              {agente ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold leading-tight">{agente.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[agente.tipoAgente !== 'Otro' ? agente.tipoAgente : null, agente.organizacion].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    <div className="flex items-center gap-2 py-2">
                      <Mail className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-foreground break-all">{agente.email}</span>
                    </div>
                    {agente.telefono && (
                      <div className="flex items-center gap-2 py-2">
                        <Phone className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-foreground">{agente.telefono}</span>
                      </div>
                    )}
                    {agente.rolNombre && (
                      <div className="flex items-center gap-2 py-2">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground">{agente.rolNombre}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">Sin información de vendedor.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity section */}
      <div className="sozu-kpi-card p-0 overflow-hidden">
        <TabBar tabs={ACTIVITY_TABS} active={activityTab} onChange={setActivityTab} />

        {activityTab === 'acuerdos' && (
          <>
            <div className="px-5 py-3 border-b border-border/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {acuerdos.filter(a => a.pago_completado).length} de {acuerdos.length} pagados
                  </span>
                </div>
                <button
                  onClick={() => setPagoDialog(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <CreditCard className="size-3.5" />Registrar pago
                </button>
              </div>
            </div>

            {acuerdos.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted-foreground">Sin acuerdos de pago.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sozu-thead">
                      {['Concepto', 'Aplic.', 'F. límite', 'F. pagado', 'Metodo', 'Clave rastreo', 'Monto', 'Aplicado', '%', 'Estado', 'Valido', '', ''].map((h, i) => (
                        <th key={i} className={cn(
                          'px-3 py-2.5 text-[10px] whitespace-nowrap',
                          i === 1 && 'w-10',
                          i === 10 && 'w-20',
                          i === 11 && 'w-8 text-center'
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAcuerdos.map(a => {
                      const isExpanded = expandedAcuerdos.has(a.id);
                      return (
                        <Fragment key={a.id}>
                          <tr
                            onClick={() => a.numAplicaciones > 1 && setExpandedAcuerdos(prev => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(a.id) : next.add(a.id);
                              return next;
                            })}
                            className={cn(
                              'border-b border-border/50 transition-colors duration-100',
                              a.numAplicaciones > 1 ? 'cursor-pointer hover:bg-muted/30' : 'hover:bg-muted/20'
                            )}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-2 min-w-0">
                                <span className="inline-flex items-center justify-center size-[18px] rounded-full bg-muted text-[9px] font-bold text-muted-foreground shrink-0">{a.orden}</span>
                                <span className="text-[12px] text-foreground leading-tight">
                                  {a.concepto.toLowerCase().includes('contra entrega') ? 'Entrega' : a.concepto}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {a.numAplicaciones > 0 ? (
                                <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{a.numAplicaciones}</span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/40">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className="text-[12px] tabular-nums text-muted-foreground">{a.fecha_pago ? fmtDate(a.fecha_pago) : 'Sin registro'}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className={cn('text-[12px] tabular-nums', a.ultimoPago?.fecha_pago ? 'text-emerald-600' : 'text-muted-foreground/40')}>
                                {a.ultimoPago?.fecha_pago ? fmtDate(a.ultimoPago.fecha_pago) : 'Sin registro'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className="text-[12px] text-foreground">{a.ultimoPago?.metodo ?? 'Sin registro'}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {a.numAplicaciones >= 2
                                ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground/70">
                                    <Undo2 className="size-2.5 shrink-0" style={{ transform: 'rotate(180deg)' }} />{a.numAplicaciones}
                                  </span>
                                : <ClaveCopyable value={a.ultimoPago?.clave_rastreo} />
                              }
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className="text-[12px] font-medium tabular-nums">{fmtCurrency(a.monto)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className={cn('text-[12px] tabular-nums',
                                a.montoAplicado >= a.monto ? 'text-emerald-600 font-medium'
                                : a.montoAplicado > 0 ? 'text-amber-600'
                                : 'text-muted-foreground/40'
                              )}>
                                {a.montoAplicado > 0 ? fmtCurrency(a.montoAplicado) : 'Sin aplicar'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              {a.montoAplicado > 0 && precio_final > 0 ? (
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                  {(Math.floor(a.montoAplicado / precio_final * 10000) / 100).toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/30">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <EstadoBadge estado={
                                a.numAplicaciones >= 2
                                  ? (a.aplicacionesDetalle.every((ap: any) => ap.id_pago != null)
                                      ? 'pagado'
                                      : acuerdoEstado(false, a.fecha_pago))
                                  : a.estado
                              } />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <ValidacionBadge estado={a.validacion?.estado} />
                            </td>
                            {/* Evidencia (columna propia) */}
                            <td className="px-0 py-2.5 text-center w-8">
                              <IconTip label={a.ultimoPago?.url_cep ? (a.numAplicaciones >= 2 ? 'Ver en parcialidades' : 'Pago validado') : a.ultimoPago?.url_recibo ? (a.numAplicaciones >= 2 ? 'Ver en parcialidades' : 'Pago sin validar') : 'Sin evidencia'}>
                                <span className="p-1.5 inline-flex shrink-0">
                                  {a.ultimoPago?.url_cep ? (
                                    <FileCheck className={cn('size-4 shrink-0', a.numAplicaciones >= 2 ? 'text-muted-foreground/25' : 'text-emerald-500')} />
                                  ) : a.ultimoPago?.url_recibo ? (
                                    <FileWarning className={cn('size-4 shrink-0', a.numAplicaciones >= 2 ? 'text-muted-foreground/25' : 'text-amber-500')} />
                                  ) : (
                                    <FileText className="size-4 shrink-0 text-muted-foreground/25" />
                                  )}
                                </span>
                              </IconTip>
                            </td>
                            {/* Acciones (juntas): ver, cargar, multa */}
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {/* Ver evidencia (ojo) */}
                                <IconTip label={a.numAplicaciones >= 2 ? 'Ver en parcialidades expandidas' : 'Ver evidencia y validación'}>
                                  <button
                                    onClick={() => {
                                      if (a.numAplicaciones >= 2) return;
                                      const listItem = aplicacionesList.find((x: any) => x.id_pago === a.ultimoPago?.id);
                                      if (listItem) setPagoEvidenciaModal(listItem);
                                    }}
                                    disabled={a.numAplicaciones >= 2 || !a.ultimoPago?.id}
                                    className={cn('p-1.5 rounded transition-colors', a.numAplicaciones >= 2 || !a.ultimoPago?.id ? 'text-muted-foreground/25 cursor-not-allowed' : 'text-foreground hover:bg-muted')}
                                  >
                                    <Eye className="size-4" />
                                  </button>
                                </IconTip>
                                {/* Cargar evidencia (activo solo en pago único) */}
                                {a.numAplicaciones < 2 && a.ultimoPago?.id ? (
                                  <IconTip label="Cargar evidencia de pago">
                                    <button
                                      onClick={() => openCargarEvidencia(a.ultimoPago)}
                                      className="p-1.5 rounded transition-colors text-foreground hover:bg-muted"
                                    >
                                      <Upload className="size-4" />
                                    </button>
                                  </IconTip>
                                ) : (
                                  <IconTip label={a.numAplicaciones >= 2 ? 'Cargar en cada parcialidad' : 'Sin pago registrado'}>
                                    <span className="p-1.5 inline-flex text-muted-foreground/25 cursor-not-allowed">
                                      <Upload className="size-4" />
                                    </span>
                                  </IconTip>
                                )}
                                {/* Multa (por acuerdo) */}
                                <IconTip label={a.multas ? `${a.multas.count} multa${a.multas.count !== 1 ? 's' : ''} · ver detalle` : 'Agregar multa'}>
                                  <button
                                    onClick={() => {
                                      if (a.multas) { setMultaGestionAcuerdoId(a.id); setMultaGestionDialog(true); }
                                      else { setMultaAcuerdoId(a.id); setMultaDialog(true); }
                                    }}
                                    className={cn('p-1.5 rounded transition-colors', a.multas ? 'text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600' : 'text-foreground hover:bg-muted')}
                                  >
                                    <FileClock className="size-4" />
                                  </button>
                                </IconTip>
                                {/* Eliminar pago (solo pago único; en acumulados va en cada parcialidad) */}
                                {canDeletePago && a.numAplicaciones < 2 && a.ultimoPago?.id && (
                                  a.ultimoPago.metodo === 'STP' ? (
                                    <IconTip label="Pago STP: no se puede eliminar">
                                      <span className="p-1.5 inline-flex text-muted-foreground/25 cursor-not-allowed"><Trash2 className="size-4" /></span>
                                    </IconTip>
                                  ) : (
                                    <IconTip label="Eliminar pago">
                                      <button
                                        onClick={() => openEliminarPago(a.ultimoPago.id)}
                                        className="p-1.5 rounded transition-colors text-foreground hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </IconTip>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && a.aplicacionesDetalle.map((ap: any, idx: number) => (
                            <tr key={`aplic-${ap.id}`} className="border-b border-primary/10 bg-primary/5">
                              <td className="px-3 py-1.5">
                                <span className="flex items-center pl-4">
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-[9px] font-semibold text-primary/60">
                                    <Undo2 className="size-2.5 shrink-0" style={{ transform: 'rotate(180deg)' }} />{idx + 1}
                                  </span>
                                </span>
                              </td>
                              <td />
                              <td />
                              <td className="px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
                                {ap.fecha_pago ? fmtDate(ap.fecha_pago) : '-'}
                              </td>
                              <td className="px-3 py-1.5 text-center text-[11px] text-foreground whitespace-nowrap">
                                {ap.metodo ?? '-'}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <ClaveCopyable value={ap.clave_rastreo} />
                              </td>
                              <td />
                              <td className="px-3 py-1.5 text-center text-[11px] font-semibold tabular-nums text-emerald-600">
                                {fmtCurrency(ap.monto)}
                              </td>
                              <td />
                              <td className="px-3 py-1.5 text-center">
                                <EstadoBadge estado={ap.id_pago ? 'pagado' : acuerdoEstado(false, a.fecha_pago)} />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <ValidacionBadge estado={ap.validacion?.estado} />
                              </td>
                              {/* Evidencia (columna propia) */}
                              <td className="px-0 py-1.5 text-center w-8">
                                <IconTip label={ap.url_cep ? 'Pago validado' : ap.url_recibo ? 'Pago sin validar' : 'Sin evidencia'}>
                                  <span className="p-1.5 inline-flex shrink-0">
                                    {ap.url_cep ? (
                                      <FileCheck className="size-4 shrink-0 text-emerald-500" />
                                    ) : ap.url_recibo ? (
                                      <FileWarning className="size-4 shrink-0 text-amber-500" />
                                    ) : (
                                      <FileText className="size-4 shrink-0 text-muted-foreground/25" />
                                    )}
                                  </span>
                                </IconTip>
                              </td>
                              {/* Acciones (juntas): ver, cargar, multa */}
                              <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                  {/* Ver evidencia (ojo) */}
                                  <IconTip label="Ver evidencia y validación">
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        const listItem = aplicacionesList.find((x: any) => x.id === ap.id);
                                        if (listItem) setPagoEvidenciaModal(listItem);
                                      }}
                                      disabled={!ap.id_pago}
                                      className={cn('p-1.5 rounded transition-colors', ap.id_pago ? 'text-foreground hover:bg-muted' : 'text-muted-foreground/25 cursor-not-allowed')}
                                    >
                                      <Eye className="size-4" />
                                    </button>
                                  </IconTip>
                                  {/* Cargar evidencia */}
                                  {ap.id_pago ? (
                                    <IconTip label="Cargar evidencia de pago">
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          openCargarEvidencia({ id: ap.id_pago, metodo: ap.metodo, fecha_pago: ap.fecha_pago, monto: ap.monto, id_metodos_pago: ap.id_metodos_pago, clave_rastreo: ap.clave_rastreo });
                                        }}
                                        className="p-1.5 rounded transition-colors text-foreground hover:bg-muted"
                                      >
                                        <Upload className="size-4" />
                                      </button>
                                    </IconTip>
                                  ) : (
                                    <IconTip label="Sin pago">
                                      <span className="p-1.5 inline-flex text-muted-foreground/25 cursor-not-allowed"><Upload className="size-4" /></span>
                                    </IconTip>
                                  )}
                                  {/* Multa: por acuerdo (fila superior) */}
                                  <IconTip label="Multa en la parcialidad (fila superior)">
                                    <span className="p-1.5 inline-flex shrink-0"><FileClock className="size-4 text-muted-foreground/25" /></span>
                                  </IconTip>
                                  {/* Eliminar este pago (parcialidad) */}
                                  {canDeletePago && ap.id_pago && ap.metodo !== 'STP' ? (
                                    <IconTip label="Eliminar pago">
                                      <button
                                        onClick={e => { e.stopPropagation(); openEliminarPago(ap.id_pago); }}
                                        className="p-1.5 rounded transition-colors text-foreground hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </IconTip>
                                  ) : canDeletePago ? (
                                    <IconTip label={ap.metodo === 'STP' ? 'Pago STP: no se puede eliminar' : 'Sin pago'}>
                                      <span className="p-1.5 inline-flex text-muted-foreground/25 cursor-not-allowed"><Trash2 className="size-4" /></span>
                                    </IconTip>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {acuerdos.length > ACUERDOS_PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                <span className="text-[12px] text-muted-foreground">
                  {acuerdosPage * ACUERDOS_PAGE_SIZE + 1}–{Math.min((acuerdosPage + 1) * ACUERDOS_PAGE_SIZE, acuerdos.length)} de {acuerdos.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={acuerdosPage === 0}
                    onClick={() => setAcuerdosPage(p => p - 1)}
                    className="px-3 py-1 text-[12px] rounded border border-border/60 text-muted-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >Anterior</button>
                  <span className="text-[12px] text-muted-foreground">{acuerdosPage + 1} / {totalPages}</span>
                  <button
                    disabled={acuerdosPage >= totalPages - 1}
                    onClick={() => setAcuerdosPage(p => p + 1)}
                    className="px-3 py-1 text-[12px] rounded border border-border/60 text-muted-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}

        {activityTab === 'documentos' && (
          <>
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {docsLoading ? 'Cargando...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''}`}
              </p>
              <button
                onClick={() => setUploadDialog(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Upload className="size-3.5" />Subir
              </button>
            </div>
            {docsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="px-5 py-12 text-center space-y-2">
                <FileText className="size-7 text-muted-foreground/20 mx-auto" />
                <p className="text-[13px] text-muted-foreground">Sin documentos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sozu-thead">
                      {['Archivo', 'Origen', 'Fecha', 'Estatus', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d: any) => (
                      <tr key={d.id} className={cn('border-b border-border/50 transition-colors duration-100', d.missing ? 'bg-muted/20' : 'hover:bg-muted/40')}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('text-[12px]', d.missing && 'text-muted-foreground/60')}>{d.tipoNombre}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing ? (
                            <span className="text-[10px] text-muted-foreground/40">-</span>
                          ) : (
                            <span className={cn(
                              'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded',
                              d.source === 'Cuenta' ? 'bg-primary/10 text-primary' :
                              d.source === 'Propiedad' ? 'bg-blue-500/10 text-blue-600' :
                              'bg-emerald-500/10 text-emerald-700'
                            )}>
                              {d.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing
                            ? <span className="text-[11px] text-muted-foreground/50">Sin registro</span>
                            : <span className="text-[12px] tabular-nums text-muted-foreground">{fmtDate(d.fecha)}</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {d.missing
                            ? <span className="text-[10px] text-muted-foreground/40">-</span>
                            : <DocEstatusBadge id={d.estatusId} />
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            {d.url && (
                              <button
                                onClick={() => setPdfPreviewModal({ url: d.url, title: d.tipoNombre })}
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Ver documento"
                              >
                                <Eye className="size-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setUploadDialog(true); }}
                              className="inline-flex items-center justify-center p-1 rounded hover:bg-emerald-50 text-muted-foreground/50 hover:text-emerald-600 transition-colors"
                              title={d.missing ? 'Subir documento' : 'Reemplazar documento'}
                            >
                              <Upload className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
