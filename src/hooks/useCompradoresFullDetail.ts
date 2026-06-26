import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTipoPersonaLabel } from "@/utils/tipo-persona";

/**
 * Carga el detalle completo de uno o más compradores (personas) para
 * mostrarlo en el drawer "Partes y documentación" del Detalle de
 * Expediente en SOZU Legal Flow.
 *
 * Devuelve, por id de persona:
 *  - Información Básica (tipo_persona, nombre, email, teléfono, RFC,
 *    CURP, sexo, representante legal si aplica)
 *  - Dirección (fiscal y/o domicilio: calle, exterior/interior, CP,
 *    país, estado, municipio, colonia)
 *  - Información Fiscal (régimen, uso CFDI, estado civil, tipo de
 *    identificación, fecha y lugar de nacimiento)
 *  - Documentos personales (url, tipo y estatus de verificación)
 *  - Cuentas Bancarias (banco, número, CLABE, SWIFT, titular, evidencia)
 *
 * Los catálogos (regimen / uso_cfdi / estados_civil / paises /
 * estados_mx / municipios_mx / bancos / tipos_documento) se cargan en
 * el mismo hook y se hidratan en los objetos retornados para que la
 * UI no tenga que hacer lookups extras.
 */

export interface CompradorFullDetail {
  idPersona: number;
  basica: {
    tipoPersona: 'pf' | 'pm' | 'pe';
    tipoPersonaLabel: string;
    nombreLegal: string | null;
    nombreComercial: string | null;
    email: string | null;
    telefono: string | null;
    clavePaisTelefono: string | null;
    rfc: string | null;
    curp: string | null;
    sexo: string | null;
    representanteLegal?: string | null;
  };
  direccion: {
    calle: string | null;
    numExterior: string | null;
    numInterior: string | null;
    codigoPostal: string | null;
    colonia: string | null;
    paisNombre: string | null;
    estadoNombre: string | null;
    municipioNombre: string | null;
  };
  fiscal: {
    nacionalidadCodigo: string | null;
    nacionalidadNombre: string | null;
    regimenCodigo: string | null;
    regimenNombre: string | null;
    usoCfdiCodigo: string | null;
    usoCfdiNombre: string | null;
    estadoCivilNombre: string | null;
    tipoIdentificacionNombre: string | null;
    fechaNacimiento: string | null;
    paisNacimientoNombre: string | null;
    estadoNacimientoNombre: string | null;
    municipioNacimientoNombre: string | null;
    ocupacion: string | null;
  };
  documentos: Array<{
    id: number;
    tipoDocumentoNombre: string;
    url: string;
    fechaCreacion: string;
    estatusVerificacionId: number | null;
  }>;
  cuentasBancarias: Array<{
    id: number;
    bancoNombre: string | null;
    numeroCuenta: string;
    cuentaClabe: string | null;
    cuentaSwift: string | null;
    titular: string | null;
    urlEvidencia: string | null;
  }>;
}

export function useCompradoresFullDetail(idPersonas: number[]) {
  const uniqIds = Array.from(new Set(idPersonas)).filter((x) => !!x);
  const key = uniqIds.slice().sort((a, b) => a - b).join(",");
  return useQuery<Record<number, CompradorFullDetail>>({
    queryKey: ["compradores_full_detail", key],
    queryFn: () => fetchCompradoresFullDetail(uniqIds),
    enabled: uniqIds.length > 0,
    staleTime: 60_000,
  });
}

async function fetchCompradoresFullDetail(
  idPersonas: number[],
): Promise<Record<number, CompradorFullDetail>> {
  if (!idPersonas.length) return {};

  // 1) Personas completas.
  const { data: pers, error: persErr } = (await (supabase as any)
    .from("personas")
    .select("*")
    .in("id", idPersonas)) as any;
  if (persErr) throw persErr;
  const personas = (pers || []) as Array<any>;
  if (!personas.length) return {};

  // 2) Documentos por persona (tipos_documento embebido).
  const { data: docs } = (await (supabase as any)
    .from("documentos")
    .select("id, id_persona, url, id_tipo_documento, fecha_creacion, id_estatus_verificacion, activo")
    .in("id_persona", idPersonas)
    .eq("activo", true)) as any;
  const docsRows = (docs || []) as Array<any>;

  const tipoDocIds = Array.from(
    new Set(
      docsRows.map((d) => d.id_tipo_documento).filter((v): v is number => !!v),
    ),
  );
  const { data: tiposDoc } = tipoDocIds.length
    ? ((await (supabase as any)
        .from("tipos_documento")
        .select("id, nombre")
        .in("id", tipoDocIds)) as any)
    : { data: [] };
  const tipoDocMap = new Map<number, string>(
    (tiposDoc || []).map((t: any) => [t.id, t.nombre as string]),
  );

  // 3) Cuentas bancarias por persona.
  const { data: cuentasBank } = (await (supabase as any)
    .from("cuentas_bancarias")
    .select(
      "id, id_persona, id_banco, numero_cuenta, cuenta_clabe, cuenta_swift, titular, url_evidencia, activo",
    )
    .in("id_persona", idPersonas)
    .eq("activo", true)) as any;
  const cuentasBankRows = (cuentasBank || []) as Array<any>;

  const bancoIds = Array.from(
    new Set(
      cuentasBankRows
        .map((c) => c.id_banco)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: bancos } = bancoIds.length
    ? ((await (supabase as any)
        .from("bancos")
        .select("id, nombre")
        .in("id", bancoIds)) as any)
    : { data: [] };
  const bancoMap = new Map<number, string>(
    (bancos || []).map((b: any) => [b.id, b.nombre as string]),
  );

  // 4) Catálogos para enrich.
  const regimenIds = Array.from(
    new Set(
      personas.map((p) => p.regimen).filter((v: any): v is string => !!v),
    ),
  );
  const { data: regimenes } = regimenIds.length
    ? ((await (supabase as any)
        .from("regimen")
        .select("id, nombre")
        .in("id", regimenIds)) as any)
    : { data: [] };
  const regimenMap = new Map<string, string>(
    (regimenes || []).map((r: any) => [String(r.id), r.nombre as string]),
  );

  const usoCfdiCodigos = Array.from(
    new Set(
      personas.map((p) => p.uso_cfdi).filter((v: any): v is string => !!v),
    ),
  );
  const { data: usosCfdi } = usoCfdiCodigos.length
    ? ((await (supabase as any)
        .from("uso_cfdi")
        .select("codigo, nombre")
        .in("codigo", usoCfdiCodigos)) as any)
    : { data: [] };
  const usoCfdiMap = new Map<string, string>(
    (usosCfdi || []).map((u: any) => [u.codigo as string, u.nombre as string]),
  );

  const estadoCivilIds = Array.from(
    new Set(
      personas
        .map((p) => p.id_estado_civil)
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: estadosCivil } = estadoCivilIds.length
    ? ((await (supabase as any)
        .from("estados_civil")
        .select("id, nombre")
        .in("id", estadoCivilIds)) as any)
    : { data: [] };
  const estadoCivilMap = new Map<number, string>(
    (estadosCivil || []).map((e: any) => [e.id, e.nombre as string]),
  );

  const paisIds = Array.from(
    new Set(
      personas
        .flatMap((p) => [p.direccion_id_pais, p.direccion_fiscal_id_pais, p.id_pais_nacimiento])
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: paises } = paisIds.length
    ? ((await (supabase as any)
        .from("paises")
        .select("id, nombre")
        .in("id", paisIds)) as any)
    : { data: [] };
  const paisMap = new Map<number, string>(
    (paises || []).map((p: any) => [p.id, p.nombre as string]),
  );

  const estadoIds = Array.from(
    new Set(
      personas
        .flatMap((p) => [p.direccion_id_estado, p.direccion_fiscal_id_estado, p.id_estado_nacimiento])
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: estadosMx } = estadoIds.length
    ? ((await (supabase as any)
        .from("estados_mx")
        .select("id, nombre")
        .in("id", estadoIds)) as any)
    : { data: [] };
  const estadoMap = new Map<number, string>(
    (estadosMx || []).map((e: any) => [e.id, e.nombre as string]),
  );

  const municipioIds = Array.from(
    new Set(
      personas
        .flatMap((p) => [p.direccion_id_municipio, p.direccion_fiscal_id_municipio, p.id_municipio_nacimiento])
        .filter((v: any): v is number => !!v),
    ),
  );
  const { data: municipios } = municipioIds.length
    ? ((await (supabase as any)
        .from("municipios_mx")
        .select("id, nombre")
        .in("id", municipioIds)) as any)
    : { data: [] };
  const municipioMap = new Map<number, string>(
    (municipios || []).map((m: any) => [m.id, m.nombre as string]),
  );

  // 5) Componer el detalle por persona.
  const result: Record<number, CompradorFullDetail> = {};
  for (const p of personas) {
    const personaDocs = docsRows
      .filter((d) => d.id_persona === p.id)
      .map((d) => ({
        id: d.id as number,
        tipoDocumentoNombre: tipoDocMap.get(d.id_tipo_documento) ?? `Documento ${d.id_tipo_documento}`,
        url: d.url as string,
        fechaCreacion: d.fecha_creacion as string,
        estatusVerificacionId: (d.id_estatus_verificacion as number | null) ?? null,
      }));

    const personaCuentas = cuentasBankRows
      .filter((c) => c.id_persona === p.id)
      .map((c) => ({
        id: c.id as number,
        bancoNombre: c.id_banco ? bancoMap.get(c.id_banco) ?? null : null,
        numeroCuenta: c.numero_cuenta as string,
        cuentaClabe: (c.cuenta_clabe as string | null) ?? null,
        cuentaSwift: (c.cuenta_swift as string | null) ?? null,
        titular: (c.titular as string | null) ?? null,
        urlEvidencia: (c.url_evidencia as string | null) ?? null,
      }));

    // Preferir dirección fiscal si existe; fallback a domicilio normal.
    const useFiscal = !!(
      p.direccion_fiscal_calle ||
      p.direccion_fiscal_codigo_postal ||
      p.direccion_fiscal_id_pais
    );
    const dirCalle = useFiscal ? p.direccion_fiscal_calle : p.direccion_calle;
    const dirNumExt = useFiscal ? p.direccion_fiscal_num_ext : p.direccion_num_ext;
    const dirNumInt = useFiscal ? p.direccion_fiscal_num_int : p.direccion_num_int;
    const dirCp = useFiscal ? p.direccion_fiscal_codigo_postal : p.direccion_codigo_postal;
    const dirColonia = useFiscal ? p.direccion_fiscal_colonia : p.direccion_colonia;
    const dirIdPais = useFiscal ? p.direccion_fiscal_id_pais : p.direccion_id_pais;
    const dirIdEstado = useFiscal ? p.direccion_fiscal_id_estado : p.direccion_id_estado;
    const dirIdMunicipio = useFiscal ? p.direccion_fiscal_id_municipio : p.direccion_id_municipio;

    result[p.id as number] = {
      idPersona: p.id as number,
      basica: {
        tipoPersona: (p.tipo_persona as any) ?? 'pf',
        tipoPersonaLabel: getTipoPersonaLabel(p.tipo_persona as string | null),
        nombreLegal: p.nombre_legal ?? null,
        nombreComercial: p.nombre_comercial ?? null,
        email: p.email ?? null,
        telefono: p.telefono ?? null,
        clavePaisTelefono: p.clave_pais_telefono ?? null,
        rfc: p.rfc ?? null,
        curp: p.curp ?? null,
        sexo: p.sexo ?? null,
      },
      direccion: {
        calle: dirCalle ?? null,
        numExterior: dirNumExt ?? null,
        numInterior: dirNumInt ?? null,
        codigoPostal: dirCp ?? null,
        colonia: dirColonia ?? null,
        paisNombre: dirIdPais ? paisMap.get(dirIdPais) ?? null : null,
        estadoNombre: dirIdEstado ? estadoMap.get(dirIdEstado) ?? null : null,
        municipioNombre: dirIdMunicipio ? municipioMap.get(dirIdMunicipio) ?? null : null,
      },
      fiscal: {
        nacionalidadCodigo: null,
        nacionalidadNombre: null,
        regimenCodigo: p.regimen ?? null,
        regimenNombre: p.regimen ? regimenMap.get(String(p.regimen)) ?? null : null,
        usoCfdiCodigo: p.uso_cfdi ?? null,
        usoCfdiNombre: p.uso_cfdi ? usoCfdiMap.get(p.uso_cfdi) ?? null : null,
        estadoCivilNombre: p.id_estado_civil ? estadoCivilMap.get(p.id_estado_civil) ?? null : null,
        tipoIdentificacionNombre: p.tipo_identificacion ?? null,
        fechaNacimiento: p.fecha_nacimiento ?? null,
        paisNacimientoNombre: p.id_pais_nacimiento ? paisMap.get(p.id_pais_nacimiento) ?? null : null,
        estadoNacimientoNombre: p.id_estado_nacimiento ? estadoMap.get(p.id_estado_nacimiento) ?? null : null,
        municipioNacimientoNombre: p.id_municipio_nacimiento ? municipioMap.get(p.id_municipio_nacimiento) ?? null : null,
        ocupacion: p.ocupacion ?? null,
      },
      documentos: personaDocs,
      cuentasBancarias: personaCuentas,
    };
  }

  return result;
}
