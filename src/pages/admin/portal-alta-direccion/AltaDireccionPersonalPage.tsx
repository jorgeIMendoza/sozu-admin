/**
 * Personal, roles y sueldos — Portal Alta Dirección (solo lectura).
 *
 * Visualiza el catálogo de RRHH que administra el Portal Estructura de
 * comisiones (`roles_organizacionales` + `personal_organizacional`):
 *   - Roles de la empresa.
 *   - Personal de la organización (con su rol y costos).
 *   - KPIs: Personal activo y Costo total mensual (suma del costo_total de los
 *     activos).
 *
 * No edita nada: reutiliza los hooks de lectura de `useDirectorioPuestos`.
 */
import { useMemo } from "react";
import { Users, DollarSign, ShieldCheck, Loader2, Briefcase, Percent } from "lucide-react";
import { PageHeader, Kpi, Panel, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useRolesOrganizacionales,
  usePersonal,
  useDirectorioSchemaReady,
  type RoleType,
  type RoleBelongsTo,
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

export default function AltaDireccionPersonalPage() {
  const { data: schemaReady, isLoading: loadingSchema } = useDirectorioSchemaReady();
  const { data: roles = [], isLoading: loadingRoles } = useRolesOrganizacionales();
  const { data: personal = [], isLoading: loadingPersonal } = usePersonal(true); // incluye bajas

  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const kpis = useMemo(() => {
    const activos = personal.filter((p) => p.activo);
    const costoMensual = activos.reduce((s, p) => s + Number(p.costo_total || 0), 0);
    return {
      personalActivo: activos.length,
      personalTotal: personal.length,
      costoMensual,
      rolesActivos: roles.length,
    };
  }, [personal, roles]);

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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Personal activo"
              value={loadingPersonal ? "—" : kpis.personalActivo}
              hint={`${kpis.personalTotal} en total (incluye bajas)`}
              icon={Users}
              tone="primary"
            />
            <Kpi
              label="Costo total mensual"
              value={loadingPersonal ? "—" : fmtMxn(kpis.costoMensual)}
              hint="Suma del costo total del personal activo"
              icon={DollarSign}
              tone="success"
            />
            <Kpi
              label="Roles de la empresa"
              value={loadingRoles ? "—" : kpis.rolesActivos}
              icon={ShieldCheck}
              tone="info"
            />
            <Kpi
              label="Costo promedio / persona"
              value={
                loadingPersonal || kpis.personalActivo === 0
                  ? "—"
                  : fmtMxn(kpis.costoMensual / kpis.personalActivo)
              }
              hint="Sobre personal activo"
              icon={DollarSign}
              tone="default"
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

          {/* ─── Personal de la organización ─── */}
          <div className="mt-6">
            <Panel
              title="Personal de la organización"
              description={loadingPersonal ? "Cargando…" : `${kpis.personalActivo} activos · ${kpis.personalTotal} en total`}
            >
              {loadingPersonal ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando personal…
                </p>
              ) : personal.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin personal registrado.</p>
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
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personal.map((p) => {
                        const rol = p.id_rol != null ? rolesById.get(p.id_rol) : null;
                        return (
                          <TableRow key={p.id} className={p.activo ? undefined : "opacity-60"}>
                            <TableCell>
                              <div className="font-medium">{p.nombre}</div>
                              {(p.email_contacto || p.email_usuario) && (
                                <div className="text-[11px] font-mono text-muted-foreground break-all">
                                  {p.email_contacto || p.email_usuario}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {rol?.nombre || "Sin rol"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{fmtMxn(Number(p.costo_nominal || 0))}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMxn(Number(p.costo_externo || 0))}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMxn(Number(p.costo_social || 0))}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtMxn(Number(p.costo_total || 0))}</TableCell>
                            <TableCell>
                              {p.activo ? (
                                <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Activo</Pill>
                              ) : (
                                <Pill className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Baja</Pill>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
