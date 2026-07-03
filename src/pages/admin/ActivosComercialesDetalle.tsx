import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Dict = Record<string, any>;

const TIPO_LABEL: Record<number, string> = {
  11: "Local comercial",
  12: "Oficina",
  13: "Bodega comercial",
  14: "Terreno",
};

const TRANS_LABEL: Record<number, string> = {
  1: "Venta",
  2: "Renta",
  3: "Venta o Renta",
};

const formatMoney = (n: any) =>
  n == null || n === ""
    ? "-"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(n));

const fmt = (v: any) => (v == null || v === "" ? "-" : String(v));
const yesNo = (v: any) => (v == null ? "-" : v ? "Sí" : "No");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value ?? "-"}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function ActivosComercialesDetalle() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ? Number(routeId) : null;

  const [loading, setLoading] = useState(true);
  const [prop, setProp] = useState<Dict | null>(null);
  const [pac, setPac] = useState<Dict | null>(null);
  const [atts, setAtts] = useState<Dict | null>(null);
  const [renta, setRenta] = useState<Dict | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, Record<number, string>>>({});

  useEffect(() => {
    if (!id || Number.isNaN(id)) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: p, error: eP } = await (supabase as any)
          .from("propiedades")
          .select("*, tipos_propiedad:id_tipo_propiedad(nombre), estatus_disponibilidad:id_estatus_disponibilidad(nombre)")
          .eq("id", id)
          .maybeSingle();
        if (eP) throw eP;
        if (!p) throw new Error("Activo no encontrado");

        const tipoId = Number(p.id_tipo_propiedad);
        const attTable =
          tipoId === 14
            ? "propiedades_atributos_terreno"
            : tipoId === 12
              ? "propiedades_atributos_oficina"
              : "propiedades_atributos_comercio";

        const [{ data: pacRow }, { data: attRow }, { data: rentaRow }] = await Promise.all([
          (supabase as any).from("propiedades_activo_comercial").select("*").eq("id_propiedad", id).maybeSingle(),
          (supabase as any).from(attTable).select("*").eq("id_propiedad", id).maybeSingle(),
          (supabase as any).from("ofertas_renta").select("*").eq("id_propiedad", id).eq("activa", true).maybeSingle(),
        ]);

        // Cargar catálogos necesarios en lote
        const catalogTables = [
          "estados_conservacion",
          "regimenes_propiedad",
          "tipos_terreno",
          "usos_suelo",
          "estandares_medicion",
          "estados_acabados",
          "clases_edificio",
          "hvac_tipo",
          "tipos_comercio",
          "tipos_centro",
          "estados_entrega_comercio",
          "tipos_contrato_renta",
          "indexaciones_renta",
          "giros_comerciales",
          "tipos_garantia_renta",
        ];
        const catResults = await Promise.all(
          catalogTables.map((t) => (supabase as any).from(t).select("id, nombre")),
        );
        const cats: Record<string, Record<number, string>> = {};
        catalogTables.forEach((t, i) => {
          const map: Record<number, string> = {};
          (catResults[i].data ?? []).forEach((r: any) => (map[r.id] = r.nombre));
          cats[t] = map;
        });

        if (cancel) return;
        setProp(p);
        setPac(pacRow ?? null);
        setAtts(attRow ?? null);
        setRenta(rentaRow ?? null);
        setCatalogs(cats);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "No se pudo cargar el activo",
          description: e.message ?? "Error desconocido",
          variant: "destructive",
        });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id, toast]);

  const cat = (table: string, val: any) =>
    val == null ? "-" : catalogs[table]?.[Number(val)] ?? `#${val}`;

  const tipoId = Number(prop?.id_tipo_propiedad ?? 0);
  const transId = Number(prop?.id_tipo_transaccion ?? 0);
  const a = atts ?? {};
  const c = pac ?? {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando activo…
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/activos-comerciales")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <p className="text-sm text-muted-foreground">Activo no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/activos-comerciales")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">
                {TIPO_LABEL[tipoId] ?? "Activo"} · {prop.numero_propiedad ?? `#${prop.id}`}
              </h1>
              {prop.activo ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
              )}
              {prop.es_aprobado ? (
                <Badge className="bg-green-600 hover:bg-green-600">Aprobado</Badge>
              ) : (
                <Badge variant="outline">Borrador</Badge>
              )}
              <Badge variant="secondary">{prop.estatus_disponibilidad?.nombre ?? "-"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {TRANS_LABEL[transId] ?? "-"} · ID {prop.id}
              {c.codigo_interno ? ` · Código ${c.codigo_interno}` : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin/activos-comerciales/${prop.id}/editar`)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ubicacion">Ubicación & Legal</TabsTrigger>
          <TabsTrigger value="atributos">Atributos ({TIPO_LABEL[tipoId] ?? "-"})</TabsTrigger>
          {(transId === 1 || transId === 3) && <TabsTrigger value="venta">Venta</TabsTrigger>}
          {(transId === 2 || transId === 3) && <TabsTrigger value="renta">Renta</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Section title="Datos generales">
            <Row label="Tipo de activo" value={TIPO_LABEL[tipoId]} />
            <Row label="Transacción" value={TRANS_LABEL[transId]} />
            <Row label="Número / Clave" value={fmt(prop.numero_propiedad)} />
            <Row label="Piso" value={fmt(prop.numero_piso)} />
            <Row label="m² interiores" value={fmt(prop.m2_interiores)} />
            <Row label="m² exteriores" value={fmt(prop.m2_exteriores)} />
            <Row label="Precio de lista" value={formatMoney(prop.precio_lista)} />
            <Row label="Código interno" value={fmt(c.codigo_interno)} />
            <Row label="Año de construcción" value={fmt(c.anio_construccion)} />
            <Row label="Estado de conservación" value={cat("estados_conservacion", c.id_estado_conservacion)} />
            <Row label="Cuota condominio mensual" value={formatMoney(c.cuota_condominio_mensual)} />
            <Row label="Recorrido virtual" value={
              c.url_recorrido_virtual ? (
                <a className="text-primary underline" href={c.url_recorrido_virtual} target="_blank" rel="noreferrer">Ver</a>
              ) : "-"
            } />
          </Section>
          {(prop.descripcion || prop.url_imagen_portada) && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Descripción</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {prop.url_imagen_portada && (
                  <img
                    src={prop.url_imagen_portada}
                    alt={prop.numero_propiedad ?? "Portada"}
                    className="rounded-md border max-h-64 object-cover"
                  />
                )}
                <p className="text-sm whitespace-pre-line">{prop.descripcion ?? "-"}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ubicacion" className="space-y-4">
          <Section title="Ubicación">
            <Row label="Dirección" value={fmt(c.ubicacion_direccion)} />
            <Row label="Ciudad" value={fmt(c.ubicacion_ciudad)} />
            <Row label="Latitud" value={fmt(c.ubicacion_lat)} />
            <Row label="Longitud" value={fmt(c.ubicacion_lng)} />
          </Section>
          <Section title="Datos legales y fiscales">
            <Row label="Régimen de propiedad" value={cat("regimenes_propiedad", c.id_regimen_propiedad)} />
            <Row label="Subtipo condominio" value={fmt(c.subtipo_condominio)} />
            <Row label="Folio real" value={fmt(c.folio_real)} />
            <Row label="Clave catastral" value={fmt(c.clave_catastral)} />
            <Row label="Cuenta predial" value={fmt(c.cuenta_predial)} />
            <Row label="Valor catastral" value={formatMoney(c.valor_catastral)} />
            <Row label="Predial anual" value={formatMoney(c.monto_predial_anual)} />
            <Row label="Predial al corriente" value={yesNo(c.predial_al_corriente)} />
            <Row label="Origen ejidal" value={yesNo(c.origen_ejidal)} />
            <Row label="Dominio pleno" value={yesNo(c.dominio_pleno)} />
            <Row label="Libre de gravamen" value={yesNo(c.libre_gravamen)} />
            {!c.libre_gravamen && (
              <Row label="Descripción del gravamen" value={fmt(c.gravamen_descripcion)} />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="atributos" className="space-y-4">
          {tipoId === 14 && (
            <>
              <Section title="Terreno">
                <Row label="Tipo de terreno" value={cat("tipos_terreno", a.id_tipo_terreno)} />
                <Row label="Uso de suelo" value={cat("usos_suelo", a.id_uso_suelo)} />
                <Row label="Manzana" value={fmt(a.manzana)} />
                <Row label="Lote" value={fmt(a.lote)} />
                <Row label="Superficie terreno (m²)" value={fmt(a.superficie_terreno)} />
                <Row label="Superficie construida (m²)" value={fmt(a.superficie_construida)} />
                <Row label="Frente (m)" value={fmt(a.frente)} />
                <Row label="Fondo (m)" value={fmt(a.fondo)} />
                <Row label="Número de frentes" value={fmt(a.numero_frentes)} />
                <Row label="Topografía" value={fmt(a.topografia)} />
                <Row label="Forma" value={fmt(a.forma)} />
                <Row label="Densidad" value={fmt(a.densidad)} />
                <Row label="COS" value={fmt(a.cos)} />
                <Row label="CUS" value={fmt(a.cus)} />
                <Row label="CAS" value={fmt(a.cas)} />
                <Row label="Niveles permitidos" value={fmt(a.niveles_permitidos)} />
                <Row label="Restricciones" value={fmt(a.restricciones)} />
              </Section>
              <Section title="Servicios">
                <Row label="Agua" value={yesNo(a.serv_agua)} />
                <Row label="Drenaje" value={yesNo(a.serv_drenaje)} />
                <Row label="Electricidad" value={yesNo(a.serv_electricidad)} />
                <Row label="Gas" value={yesNo(a.serv_gas)} />
                <Row label="Fibra" value={yesNo(a.serv_fibra)} />
                <Row label="Alumbrado" value={yesNo(a.serv_alumbrado)} />
                <Row label="Calles pavimentadas" value={yesNo(a.serv_calles_pavimentadas)} />
                <Row label="Banquetas" value={yesNo(a.serv_banquetas)} />
                <Row label="Urbanizado" value={yesNo(a.serv_urbanizado)} />
                <Row label="Factibilidad agua" value={yesNo(a.serv_factibilidad_agua)} />
                <Row label="Factibilidad CFE" value={yesNo(a.serv_factibilidad_cfe)} />
              </Section>
            </>
          )}

          {tipoId === 12 && (
            <Section title="Oficina">
              <Row label="Edificio" value={fmt(a.edificio)} />
              <Row label="Piso" value={fmt(a.piso)} />
              <Row label="Número oficina" value={fmt(a.numero_oficina)} />
              <Row label="Corredor" value={fmt(a.corredor)} />
              <Row label="Área rentable (m²)" value={fmt(a.area_rentable)} />
              <Row label="Área útil (m²)" value={fmt(a.area_util)} />
              <Row label="Factor de eficiencia" value={fmt(a.factor_eficiencia)} />
              <Row label="Estándar de medición" value={cat("estandares_medicion", a.id_estandar_medicion)} />
              <Row label="Altura libre (m)" value={fmt(a.altura_libre)} />
              <Row label="Niveles" value={fmt(a.niveles)} />
              <Row label="Mínimo rentable" value={fmt(a.minimo_rentable)} />
              <Row label="Estado de acabados" value={cat("estados_acabados", a.id_estado_acabados)} />
              <Row label="Clase de edificio" value={cat("clases_edificio", a.id_clase_edificio)} />
              <Row label="HVAC" value={cat("hvac_tipo", a.id_hvac)} />
              <Row label="Elevadores" value={fmt(a.elevadores)} />
              <Row label="Cajones estacionamiento" value={fmt(a.cajones_estacionamiento)} />
              <Row label="Ratio estacionamiento" value={fmt(a.ratio_estacionamiento)} />
              <Row label="Certificación LEED" value={fmt(a.certificacion_leed)} />
              <Row label="Divisible" value={yesNo(a.divisible)} />
              <Row label="Planta de luz" value={yesNo(a.planta_luz)} />
              <Row label="CCTV" value={yesNo(a.seguridad_cctv)} />
              <Row label="Control de acceso" value={yesNo(a.control_acceso)} />
              <Row label="Fibra" value={yesNo(a.fibra)} />
            </Section>
          )}

          {(tipoId === 11 || tipoId === 13) && (
            <Section title={tipoId === 13 ? "Bodega comercial" : "Local comercial"}>
              <Row label="Tipo de comercio" value={cat("tipos_comercio", a.id_tipo_comercio)} />
              <Row label="Tipo de centro" value={cat("tipos_centro", a.id_tipo_centro)} />
              <Row label="Estado de entrega" value={cat("estados_entrega_comercio", a.id_estado_entrega)} />
              <Row label="Plaza" value={fmt(a.plaza)} />
              <Row label="Número local" value={fmt(a.numero_local)} />
              <Row label="Nivel" value={fmt(a.nivel)} />
              <Row label="GLA (m²)" value={fmt(a.gla)} />
              <Row label="Área privativa (m²)" value={fmt(a.area_privativa)} />
              <Row label="Mezzanine (m²)" value={fmt(a.mezzanine)} />
              <Row label="Terraza (m²)" value={fmt(a.terraza)} />
              <Row label="Frente exhibición (m)" value={fmt(a.frente_exhibicion)} />
              <Row label="Fondo (m)" value={fmt(a.fondo)} />
              <Row label="Altura libre (m)" value={fmt(a.altura_libre)} />
              <Row label="Visibilidad" value={fmt(a.visibilidad)} />
              <Row label="Aforo vehicular" value={fmt(a.aforo_vehicular)} />
              <Row label="Foot traffic" value={fmt(a.foot_traffic)} />
              <Row label="Cajones estacionamiento" value={fmt(a.cajones_estacionamiento)} />
              <Row label="Capacidad carga piso" value={fmt(a.capacidad_carga_piso)} />
              <Row label="Andenes de carga" value={fmt(a.andenes_carga)} />
              <Row label="Patio maniobras (m²)" value={fmt(a.patio_maniobras)} />
              <Row label="kVA energía" value={fmt(a.kva_energia)} />
              <Row label="Esquina" value={yesNo(a.esquina)} />
              <Row label="Licencia funcionamiento" value={yesNo(a.licencia_funcionamiento)} />
            </Section>
          )}

          {!atts && (
            <p className="text-sm text-muted-foreground px-1">Sin atributos capturados aún.</p>
          )}
        </TabsContent>

        {(transId === 1 || transId === 3) && (
          <TabsContent value="venta">
            <Section title="Condiciones de venta">
              <Row label="Precio de lista" value={formatMoney(prop.precio_lista)} />
              <Row label="Precio por m²" value={
                prop.precio_lista && prop.m2_interiores
                  ? formatMoney(Number(prop.precio_lista) / Number(prop.m2_interiores))
                  : "-"
              } />
            </Section>
          </TabsContent>
        )}

        {(transId === 2 || transId === 3) && (
          <TabsContent value="renta">
            <Section title="Condiciones de renta">
              {renta ? (
                <>
                  <Row label="Renta mensual" value={formatMoney(renta.renta_mensual)} />
                  <Row label="Precio m²/mes" value={formatMoney(renta.precio_m2_mes)} />
                  <Row label="Moneda" value={fmt(renta.moneda)} />
                  <Row label="Tipo de contrato" value={cat("tipos_contrato_renta", renta.id_tipo_contrato)} />
                  <Row label="Plazo forzoso (meses)" value={fmt(renta.plazo_forzoso_meses)} />
                  <Row label="Depósito (meses)" value={fmt(renta.deposito_meses)} />
                  <Row label="Meses de gracia" value={fmt(renta.meses_gracia)} />
                  <Row label="Escalación anual (%)" value={fmt(renta.escalacion_anual)} />
                  <Row label="Indexación" value={cat("indexaciones_renta", renta.id_indexacion)} />
                  <Row label="CAM" value={formatMoney(renta.cam)} />
                  <Row label="Cuota publicidad" value={formatMoney(renta.cuota_publicidad)} />
                  <Row label="Giro permitido" value={cat("giros_comerciales", renta.id_giro_permitido)} />
                  <Row label="Tipo de garantía" value={cat("tipos_garantia_renta", renta.id_tipo_garantia)} />
                  <Row label="Exclusividad" value={fmt(renta.exclusividad)} />
                  <Row label="Comisión corretaje" value={fmt(renta.comision_corretaje)} />
                  <Row label="Disponible desde" value={fmt(renta.disponible_desde)} />
                  <Row label="IVA aplica" value={yesNo(renta.iva_aplica)} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground col-span-full">Sin oferta de renta activa.</p>
              )}
            </Section>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}