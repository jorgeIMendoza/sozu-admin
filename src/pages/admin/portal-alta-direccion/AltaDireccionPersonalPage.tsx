/**
 * Personal, roles y sueldos — Portal Alta Dirección (solo lectura).
 *
 * Visualiza el catálogo de RRHH que administra el Portal Estructura de
 * comisiones (`roles_organizacionales` + `personal_organizacional`):
 *   - Roles de la empresa.
 *   - Personal de la organización, SEPARADO en Empleados SOZU y Colaboradores
 *     Investimento, ordenado de mayor a menor costo mensual, con el costo fijo
 *     total de las plazas ocupadas.
 *   - Vacantes registradas: costo de plazas ocupadas, de las vacantes y el costo
 *     fijo con vacantes (ocupadas + vacantes).
 *
 * No edita nada: reutiliza los hooks de lectura de `useDirectorioPuestos`.
 */
import { useMemo } from "react";
import { Users, DollarSign, ShieldCheck, Loader2, Briefcase, Percent, Building2, UserPlus, UserMinus } from "lucide-react";
import { PageHeader, Kpi, Panel, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useRolesOrganizacionales,
  usePersonal,
  useDirectorioSchemaReady,
  useVacantesSchemaReady,
  ETIQUETA_TIPO_PERSONAL,
  type RoleType,
  type RoleBelongsTo,
  type PersonalOrganizacional,
  type RolOrganizacional,
} from "@/hooks/usePortalEstructuraComisiones/useDirectorioPuestos";

const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const TIPO_ROL_LABEL: Record<RoleType, string> = {
  strategic: "Estratégico",
  operative: "Operativo",
  support: "Soporte",
};
const TIPO_ROL_TONE: Record<RoleType, string> = {
  strategic: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  operative: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  support: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};
const PERTENECE_LABEL: Record<RoleBelongsTo, string> = {
  sozu_central: "SOZU Central",
  project: "Proyecto",
};

const sumCosto = (list: PersonalOrganizacional[]) =>
  list.reduce((s, p) => s + Number(p.costo_total || 0), 0);
const porCostoDesc = (a: PersonalOrganizacional, b: PersonalOrganizacional) =>
  Number(b.costo_total || 0) - Number(a.costo_total || 0);

export default function AltaDireccionPersonalPage() {
  const { data: schemaReady, isLoading: loadingSchema } = useDirectorioSchemaReady();
  const { data: vacantesReady } = useVacantesSchemaReady();
  const { data: roles = [], isLoading: loadingRoles } = useRolesOrganizacionales();
  const { data: personal = [], isLoading: loadingPersonal } = usePersonal(true); // incluye bajas

  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const grupos = useMemo(() => {
    // Ocupadas = personas activas con ocupante; vacantes = plaza activa sin ocupante.
    const activas = personal.filter((p) => p.activo);
    const ocupadas = activas.filter((p) => !p.es_vacante);
    const vacantes = activas.filter((p) => p.es_vacante).sort(porCostoDesc);
    const bajas = personal.filter((p) => !p.activo).sort(porCostoDesc);

    const sozu = ocupadas.filter((p) => p.tipo_personal === "empleado_sozu").sort(porCostoDesc);
    const investimento = ocupadas
      .filter((p) => p.tipo_personal === "colaborador_investimento")
      .sort(porCostoDesc);

    const costoSozu = sumCosto(sozu);
    const costoInvestimento = sumCosto(investimento);
    const costoOcupadas = costoSozu + costoInvestimento;
    const costoVacantes = sumCosto(vacantes);

    return {
      sozu,
      investimento,
      vacantes,
      bajas,
      costoSozu,
      costoInvestimento,
      costoOcupadas,
      costoVacantes,
      costoConVacantes: costoOcupadas + costoVacantes,
      ocupadasCount: ocupadas.length,
    };
  }, [personal]);

  return (
    <>
      <PageHeader
        title="Personal, roles y sueldos"
        description="Roles de la empresa y personal de la organización, con su costo mensual."
      />

      {!loadingSchema && schemaReady === false ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          El catálogo de RRHH (<code className="font-mono">roles_organizacionales</code> /{" "}
          <code className="font-mono">personal_organizacional</code>) aún no está disponible en esta
          base. Aplicar el DDL de{" "}
          <code className="font-mono">Ejecuciones_manuales/20260809_directorio_personal_rrhh.md</code>{" "}
          y refrescar.
        </div>
      ) : (
        <>
          {/* ─── KPIs ─── */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Personal activo"
              value={loadingPersonal ? "—" : grupos.ocupadasCount}
              hint={`${grupos.sozu.length} SOZU · ${grupos.investimento.length} Investimento`}
              icon={Users}
              tone="primary"
            />
            <Kpi
              label="Costo fijo total"
              value={loadingPersonal ? "—" : fmtMxn(grupos.costoOcupadas)}
              hint="Plazas ocupadas (SOZU + Investimento)"
              icon={DollarSign}
              tone="success"
            />
            <Kpi
              label="Vacantes"
              value={loadingPersonal ? "—" : grupos.vacantes.length}
              hint={`${fmtMxn(grupos.costoVacantes)} en plazas por cubrir`}
              icon={UserPlus}
              tone="warning"
            />
            <Kpi
              label="Costo fijo con vacantes"
              value={loadingPersonal ? "—" : fmtMxn(grupos.costoConVacantes)}
              hint="Ocupadas + vacantes"
              icon={DollarSign}
              tone="info"
            />
          </div>

          {/* ─── Roles de la empresa ─── */}
          <Panel
            title="Roles de la empresa"
            description={loadingRoles ? "Cargando…" : `${roles.length} roles`}
          >
            {loadingRoles ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando roles…
              </p>
            ) : roles.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin roles registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pertenece a</TableHead>
                    <TableHead>Comisiona</TableHead>
                    <TableHead>Objetivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.nombre}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Pill className={TIPO_ROL_TONE[r.tipo]}>{TIPO_ROL_LABEL[r.tipo] ?? r.tipo}</Pill>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {PERTENECE_LABEL[r.pertenece_a] ?? r.pertenece_a}
                      </TableCell>
                      <TableCell>
                        {r.participa_comision ? (
                          <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <Percent className="mr-1 h-3 w-3" /> Sí
                          </Pill>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[360px] text-xs text-muted-foreground">
                        {r.objetivo || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          {/* ─── Personal de la organización (SOZU vs Investimento) ─── */}
          <div className="mt-6">
            <Panel
              title="Personal de la organización"
              description="Empleados SOZU y Colaboradores Investimento, ordenados por costo mensual descendente."
              action={
                !loadingPersonal ? (
                  <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Costo fijo total: {fmtMxn(grupos.costoOcupadas)}
                  </Pill>
                ) : undefined
              }
            >
              {loadingPersonal ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando personal…
                </p>
              ) : grupos.ocupadasCount === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin personal registrado.</p>
              ) : (
                <div className="space-y-8">
                  <GrupoPersonal
                    titulo="Empleados SOZU"
                    icon={Users}
                    tono="bg-primary/10 text-primary"
                    personas={grupos.sozu}
                    rolesById={rolesById}
                    subtotal={grupos.costoSozu}
                    subtotalLabel="Costo fijo SOZU"
                    vacio="Sin empleados SOZU registrados."
                  />
                  <GrupoPersonal
                    titulo="Colaboradores Investimento"
                    icon={Building2}
                    tono="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                    personas={grupos.investimento}
                    rolesById={rolesById}
                    subtotal={grupos.costoInvestimento}
                    subtotalLabel="Costo Investimento"
                    subtotalHint="Lo cubre Grupo Investimento"
                    vacio="Sin colaboradores Investimento registrados."
                  />

                  {/* Costo fijo total combinado */}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <span className="text-sm font-semibold text-foreground">
                      Costo fijo total <span className="font-normal text-muted-foreground">· plazas ocupadas</span>
                    </span>
                    <span className="text-lg font-bold tabular-nums text-foreground">{fmtMxn(grupos.costoOcupadas)}</span>
                  </div>

                  {/* Bajas (informativo, fuera del costo fijo) */}
                  {grupos.bajas.length > 0 && (
                    <GrupoPersonal
                      titulo="Bajas"
                      icon={UserMinus}
                      tono="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      personas={grupos.bajas}
                      rolesById={rolesById}
                      dimmed
                      subtotalLabel="No suma al costo fijo"
                      vacio="Sin bajas."
                    />
                  )}
                </div>
              )}
            </Panel>
          </div>

          {/* ─── Vacantes registradas ─── */}
          <div className="mt-6">
            <Panel
              title="Vacantes registradas"
              description="Plazas presupuestadas sin ocupante y su impacto en el costo fijo."
            >
              {vacantesReady === false && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  La columna <code className="font-mono">es_vacante</code> aún no existe en esta base:
                  todas las plazas se leen como ocupadas. Aplicar el DDL de{" "}
                  <code className="font-mono">Ejecuciones_manuales/20260814_vacantes_en_roles_y_sueldos.md</code>.
                </div>
              )}

              {/* Resumen de costos */}
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ResumenCosto
                  label="Plazas ocupadas"
                  monto={fmtMxn(grupos.costoOcupadas)}
                  detalle={`${grupos.ocupadasCount} ${grupos.ocupadasCount === 1 ? "plaza" : "plazas"}`}
                  tono="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  montoClass="text-emerald-700 dark:text-emerald-300"
                />
                <ResumenCosto
                  label="Vacantes"
                  monto={fmtMxn(grupos.costoVacantes)}
                  detalle={`${grupos.vacantes.length} ${grupos.vacantes.length === 1 ? "plaza por cubrir" : "plazas por cubrir"}`}
                  tono="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
                  montoClass="text-amber-700 dark:text-amber-300"
                />
                <ResumenCosto
                  label="Costo fijo con vacantes"
                  monto={fmtMxn(grupos.costoConVacantes)}
                  detalle="Ocupadas + vacantes"
                  tono="border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20"
                  montoClass="text-sky-700 dark:text-sky-300"
                />
              </div>

              {/* Detalle de vacantes */}
              {grupos.vacantes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin vacantes registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plaza</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead className="text-right">Costo mensual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupos.vacantes.map((p) => {
                        const rol = p.id_rol != null ? rolesById.get(p.id_rol) : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.nombre}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rol?.nombre || "Sin rol"}</TableCell>
                            <TableCell>
                              <Pill className={p.tipo_personal === "empleado_sozu"
                                ? "bg-primary/10 text-primary"
                                : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}>
                                {ETIQUETA_TIPO_PERSONAL[p.tipo_personal]}
                              </Pill>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtMxn(Number(p.costo_total || 0))}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="border-t-2 border-border bg-muted/30">
                        <TableCell colSpan={3} className="text-right font-medium">Total vacantes</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{fmtMxn(grupos.costoVacantes)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Subcomponentes ─── */

function GrupoPersonal({
  titulo,
  icon: Icon,
  tono,
  personas,
  rolesById,
  subtotal,
  subtotalLabel,
  subtotalHint,
  dimmed = false,
  vacio,
}: {
  titulo: string;
  icon: typeof Users;
  tono: string;
  personas: PersonalOrganizacional[];
  rolesById: Map<number, RolOrganizacional>;
  subtotal?: number;
  subtotalLabel: string;
  subtotalHint?: string;
  dimmed?: boolean;
  vacio: string;
}) {
  const total = subtotal ?? sumCosto(personas);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={cn("grid h-6 w-6 place-items-center rounded-md", tono)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          {titulo}
          <Pill className="bg-muted text-muted-foreground">{personas.length}</Pill>
        </h3>
        {personas.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {subtotalLabel}:{" "}
            <span className="font-semibold tabular-nums text-foreground">{fmtMxn(total)}</span>
          </span>
        )}
      </div>

      {personas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Nómina</TableHead>
                <TableHead className="text-right">Externo</TableHead>
                <TableHead className="text-right">Cargas sociales</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas.map((p) => {
                const rol = p.id_rol != null ? rolesById.get(p.id_rol) : null;
                return (
                  <TableRow key={p.id} className={dimmed ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="font-medium">{p.nombre}</div>
                      {(p.email_contacto || p.email_usuario) && (
                        <div className="text-[11px] font-mono text-muted-foreground break-all">
                          {p.email_contacto || p.email_usuario}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rol?.nombre || "Sin rol"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMxn(Number(p.costo_nominal || 0))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMxn(Number(p.costo_externo || 0))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMxn(Number(p.costo_social || 0))}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtMxn(Number(p.costo_total || 0))}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 border-border bg-muted/30">
                <TableCell colSpan={5} className="text-right font-medium">
                  {subtotalLabel}
                  {subtotalHint && <span className="ml-1 font-normal text-muted-foreground">· {subtotalHint}</span>}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">{fmtMxn(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ResumenCosto({
  label,
  monto,
  detalle,
  tono,
  montoClass,
}: {
  label: string;
  monto: string;
  detalle: string;
  tono: string;
  montoClass: string;
}) {
  return (
    <div className={cn("rounded-lg border p-4", tono)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", montoClass)}>{monto}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
