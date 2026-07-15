import { Fragment, useState } from 'react';
import {
  ArrowRightLeft, CreditCard, FileDown, Pencil, Scale,
  Loader2, Upload, FileText, Eye,
  FileClock, FileCheck, FileWarning,
  Undo2, Layers, Plus, RefreshCw,
  Building2, Calendar, Hash, Home, Landmark,
  User, Phone, Mail, ChevronRight, Briefcase,
  AlertTriangle, Lock, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOfertaId } from '@/utils/cuentaCobranzaUtils';
import {
  fmtCurrency, fmtDate, acuerdoEstado,
  KpiCard, TabBar, EstadoBadge, ValidacionBadge, ClaveCopyable, IconTip,
  DocEstatusBadge, InfoRow,
  INFO_TABS, ACTIVITY_TABS,
  type InfoTab, type ActivityTab, type CuentaDetalleCtx,
} from './cuentaDetalleShared';

export function CuentaDetallePropiedad({ ctx }: { ctx: CuentaDetalleCtx }) {
  const [infoTab, setInfoTab] = useState<InfoTab>('resumen');
  const [activityTab, setActivityTab] = useState<ActivityTab>('acuerdos');

  const {
    cuentaId, precio_final, totalPagado, saldoPendiente, parcialidadesVencidas,
    montoVencido, pagadoEfectivo, limiteEfectivo, aunPermitido, acuerdosPendientes,
    porcentajePagado, montoValidado, montoSinValidar,
    acuerdos, docs, docsLoading, aplicacionesList,
    expandedAcuerdos, setExpandedAcuerdos,
    planIsModified, esquemaNombreDisplay, esquemaNombre, esquemaPct,
    _planParcAcuerdos, _planEngTotal, _planParcTotal, _planEntTotal,
    _planPctE, _planPctP, _planPctEnt,
    isEnDemanda,
    setPagoDialog, setUploadDialog, openCargarEvidencia, setEditCuentaDialog,
    setDemandaDialog, setQuitarDemandaDialog,
    setMultaAcuerdoId, setMultaDialog, setMultaGestionAcuerdoId, setMultaGestionDialog,
    setPagoEvidenciaModal, setPdfPreviewModal,
    canDeletePago, openEliminarPago,
    hayDiscrepancia, sumaAcuerdos,
    hayDiscrepanciaAplicaciones, recalculandoAplic, handleRecalcularAplicaciones,
    generatingPDF, handleEstadoCuenta, downloadingOferta, handleDownloadOferta,
    setTransferDialog,
    clabe_stp, fecha_compra, ofertaId,
    compradores, agente,
    proyectoNombre, edificioNombre, modeloNombre, numero_propiedad,
    productoNombre, estatusPropiedad, m2Interiores, m2Exteriores, precioM2,
    tipo,
  } = ctx;

  const PlanRow = ({ label, pE, nP, pP, pEnt, amtE, amtP, amtEnt, active }: any) => {
    const perPago = nP > 0 ? amtP / nP : 0;
    return (
      <div className={cn('rounded-md border px-3 py-2.5', active ? 'border-emerald-500/60 bg-emerald-50/30' : 'border-border bg-muted/20 opacity-60')}>
        <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-2', active ? 'text-emerald-600' : 'text-muted-foreground')}>{label}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pE > 0 ? `${pE}%` : '-'}</p>
            <p className="text-[11px] font-medium text-muted-foreground">Enganche</p>
            <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{pE > 0 ? fmtCurrency(amtE) : '-'}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pP > 0 ? `${pP}%` : '-'}</p>
            <p className="text-[11px] font-medium text-muted-foreground">Parcialidades</p>
            <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{nP > 0 && pP > 0 ? `${nP} pagos de ${fmtCurrency(perPago)}` : '-'}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none mb-1">{pEnt > 0 ? `${pEnt}%` : '-'}</p>
            <p className="text-[11px] font-medium text-muted-foreground">Pago final</p>
            <p className="text-[12px] font-semibold tabular-nums text-foreground/70">{pEnt > 0 ? fmtCurrency(amtEnt) : '-'}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Demanda banner — solo lectura */}
      {isEnDemanda && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center justify-center size-8 rounded-full bg-red-100 shrink-0 mt-0.5">
            <Lock className="size-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-red-700 leading-tight">Propiedad En Demanda - Solo Lectura</p>
            <p className="text-[11px] text-red-600 mt-0.5">No se pueden registrar pagos, multas ni modificar esta cuenta mientras esté en proceso judicial.</p>
          </div>
          <button
            onClick={() => setQuitarDemandaDialog(true)}
            className="shrink-0 text-[11px] font-semibold text-red-700 border border-red-300 rounded-md px-2.5 py-1.5 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            Juicio Terminado
          </button>
        </div>
      )}

      {/* Discrepancy warning */}
      {hayDiscrepancia && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-800">Discrepancia detectada en acuerdos de pago</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Precio final: <span className="font-semibold">{fmtCurrency(precio_final)}</span>
              {' · '}Suma de acuerdos: <span className="font-semibold">{fmtCurrency(sumaAcuerdos)}</span>
              {' · '}Diferencia: <span className="font-semibold">{fmtCurrency(Math.abs(precio_final - sumaAcuerdos))}</span>
              {sumaAcuerdos > precio_final ? ' (acuerdos exceden el precio)' : ' (acuerdos faltantes)'}
            </p>
          </div>
        </div>
      )}

      {/* KPI grid — 5 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Precio Final" value={fmtCurrency(precio_final)} />
        <KpiCard
          label="Total Pagado"
          value={fmtCurrency(totalPagado)}
          sub={`${porcentajePagado.toFixed(0)}% del total`}
          accent={porcentajePagado >= 100 ? 'success' : undefined}
        />
        <KpiCard
          label="Saldo Pendiente"
          value={fmtCurrency(saldoPendiente)}
          sub={acuerdosPendientes > 0 ? `${acuerdosPendientes} acuerdo${acuerdosPendientes !== 1 ? 's' : ''} pendiente${acuerdosPendientes !== 1 ? 's' : ''}` : undefined}
          accent={saldoPendiente <= 0 ? 'success' : 'danger'}
        />
        <KpiCard label="Pago en efectivo" value="">
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Límite</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{fmtCurrency(limiteEfectivo)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Pagado</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{fmtCurrency(pagadoEfectivo)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground">Restante</span>
              <span className={cn('text-[10px] font-bold tabular-nums', aunPermitido < 0 ? 'text-red-600' : 'text-foreground')}>{fmtCurrency(aunPermitido)}</span>
            </div>
          </div>
        </KpiCard>
        <KpiCard
          label="Avance Cobranza"
          value={`${porcentajePagado.toFixed(1)}%`}
          accent={porcentajePagado >= 85 ? 'success' : porcentajePagado < 25 ? 'danger' : 'warning'}
        >
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                porcentajePagado >= 85 ? 'bg-emerald-500' : porcentajePagado < 25 ? 'bg-red-500' : 'bg-amber-400'
              )}
              style={{ width: `${porcentajePagado}%` }}
            />
          </div>
        </KpiCard>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        {!isEnDemanda && (
          <button
            onClick={() => setTransferDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRightLeft className="size-3.5" />Transferir
          </button>
        )}
        {!isEnDemanda && (
          <button
            onClick={() => setPagoDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
          >
            <CreditCard className="size-3.5" />Agregar Pago
          </button>
        )}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <button
          onClick={handleEstadoCuenta}
          disabled={generatingPDF}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          {generatingPDF ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
          Estado de Cuenta
        </button>
        {!isEnDemanda && (
          <button
            onClick={() => setEditCuentaDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="size-3.5" />Editar Cuenta
          </button>
        )}
        {!isEnDemanda && saldoPendiente > 0 && (
          <button
            onClick={() => setDemandaDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-background text-[12px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Scale className="size-3.5" />Poner en demanda
          </button>
        )}
        {isEnDemanda && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[12px] font-semibold text-amber-700 cursor-default select-none"
            title="Para terminar la demanda usa 'Juicio Terminado' en el aviso superior"
          >
            <Scale className="size-3.5" />En demanda
          </span>
        )}
        {/* Recalcular pagos — solo visible cuando hay discrepancia en aplicaciones */}
        {!isEnDemanda && hayDiscrepanciaAplicaciones && (
          <button
            onClick={handleRecalcularAplicaciones}
            disabled={recalculandoAplic}
            title="Recalcular la aplicación de pagos de esta cuenta"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-background text-[12px] font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {recalculandoAplic ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Recalcular pagos
          </button>
        )}
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
              {precioM2 != null && (
                <InfoRow icon={CreditCard} label="Precio / m2" value={fmtCurrency(precioM2)} />
              )}
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Datos de la cuenta</h3>
              <InfoRow icon={Landmark}   label="CLABE STP"    value={clabe_stp ?? ''} />
              <InfoRow icon={Calendar}   label="Fecha compra" value={fmtDate(fecha_compra)} />
              {ofertaId && (
                <>
                  <div className="flex items-start gap-3 py-2 border-b border-border/50">
                    <Hash className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-[12px] text-muted-foreground w-28 shrink-0">Oferta PDF</span>
                    <button
                      onClick={handleDownloadOferta}
                      disabled={downloadingOferta}
                      title="Descargar PDF de oferta"
                      className="text-[12px] font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                    >
                      {downloadingOferta
                        ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" />{formatOfertaId(ofertaId)}</span>
                        : formatOfertaId(ofertaId)
                      }
                    </button>
                  </div>
                  <div className="flex items-start gap-3 py-2 border-b border-border/50">
                    <Hash className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-[12px] text-muted-foreground w-28 shrink-0">Oferta digital</span>
                    <a
                      href={`${window.location.origin}/oferta/${ofertaId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-700 transition-colors"
                    >
                      {formatOfertaId(ofertaId)}
                    </a>
                  </div>
                </>
              )}
              {esquemaNombreDisplay && <InfoRow icon={Calendar} label="Plan de pagos" value={esquemaNombreDisplay} />}
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
                  {esquemaNombreDisplay && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary">
                      <Layers className="size-2.5" />{esquemaNombreDisplay}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {acuerdos.filter(a => a.pago_completado).length} de {acuerdos.length} pagados
                  </span>
                </div>
                {!isEnDemanda && (
                  <button
                    onClick={() => setPagoDialog(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="size-3.5" />Registrar pago
                  </button>
                )}
              </div>

              {/* Plan de pagos */}
              {(() => {
                const orig = esquemaPct;
                return (
                  <div className="space-y-2 mb-3">
                    {planIsModified && orig && (
                      <PlanRow
                        label="Plan Original"
                        pE={orig.enganche} nP={orig.numMensualidades} pP={orig.mensualidades} pEnt={orig.entrega}
                        amtE={orig.enganche / 100 * precio_final}
                        amtP={orig.mensualidades / 100 * precio_final}
                        amtEnt={orig.entrega / 100 * precio_final}
                        active={false}
                      />
                    )}
                    <PlanRow
                      label={planIsModified ? 'Plan Actual' : 'Plan de Pagos'}
                      pE={_planPctE} nP={_planParcAcuerdos.length} pP={_planPctP} pEnt={_planPctEnt}
                      amtE={_planEngTotal} amtP={_planParcTotal} amtEnt={_planEntTotal}
                      active={true}
                    />
                  </div>
                );
              })()}

              {/* 4-col stats */}
              <div className="grid grid-cols-4 gap-x-2 py-6">
                <div className="text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Por recibir</p>
                  <p className="text-[17px] font-bold tabular-nums text-foreground leading-none">{fmtCurrency(precio_final)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ya recibido</p>
                  <p className="text-[17px] font-bold tabular-nums text-emerald-600 leading-none">{fmtCurrency(montoValidado)}</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-[9px] font-semibold uppercase tracking-wider mb-1', saldoPendiente > 0 ? 'text-red-500' : 'text-muted-foreground')}>Pendiente</p>
                  <p className={cn('text-[17px] font-bold tabular-nums leading-none', saldoPendiente > 0 ? 'text-red-600' : 'text-muted-foreground')}>{fmtCurrency(saldoPendiente)}</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-[9px] font-semibold uppercase tracking-wider mb-1', montoSinValidar > 0 ? 'text-amber-500' : 'text-muted-foreground')}>Sin validar</p>
                  <p className={cn('text-[17px] font-bold tabular-nums leading-none', montoSinValidar > 0 ? 'text-amber-600' : 'text-muted-foreground/40')}>{fmtCurrency(montoSinValidar)}</p>
                </div>
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
                    {acuerdos.map(a => {
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
                            {/* Evidencia (columna propia): estado del comprobante */}
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
                                {/* Cargar evidencia (activo solo en pago único; en acumulados va en las internas) */}
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
                                {isEnDemanda ? (
                                  <IconTip label="En demanda">
                                    <span className="p-1.5 inline-flex shrink-0"><FileClock className="size-4 text-muted-foreground/25" /></span>
                                  </IconTip>
                                ) : (
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
                                )}
                                {/* Eliminar pago (solo pago único; en acumulados va en cada parcialidad) */}
                                {canDeletePago && !isEnDemanda && a.numAplicaciones < 2 && a.ultimoPago?.id && (
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
                                  {/* Multa: por acuerdo (en la fila superior) */}
                                  <IconTip label="Multa en la parcialidad (fila superior)">
                                    <span className="p-1.5 inline-flex shrink-0"><FileClock className="size-4 text-muted-foreground/25" /></span>
                                  </IconTip>
                                  {/* Eliminar este pago (parcialidad) */}
                                  {canDeletePago && !isEnDemanda && ap.id_pago && ap.metodo !== 'STP' ? (
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
          </>
        )}

        {activityTab === 'documentos' && (
          <>
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {docsLoading ? 'Cargando...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''}`}
              </p>
              {!isEnDemanda && (
                <button
                  onClick={() => setUploadDialog(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Upload className="size-3.5" />Subir
                </button>
              )}
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
                            {!isEnDemanda && (
                              <button
                                onClick={() => { setUploadDialog(true); }}
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-emerald-50 text-muted-foreground/50 hover:text-emerald-600 transition-colors"
                                title={d.missing ? 'Subir documento' : 'Reemplazar documento'}
                              >
                                <Upload className="size-3.5" />
                              </button>
                            )}
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
