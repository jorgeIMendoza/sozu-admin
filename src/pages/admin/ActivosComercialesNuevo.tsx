import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Dict = Record<string, any>;

const TIPOS = [
  { id: 11, label: "Local comercial" },
  { id: 12, label: "Oficina" },
  { id: 13, label: "Bodega comercial" },
  { id: 14, label: "Terreno" },
];

const TRANSACCIONES = [
  { id: 1, label: "Venta" },
  { id: 2, label: "Renta" },
  { id: 3, label: "Venta o Renta" },
];

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function useCatalog(table: string, extra?: (q: any) => any) {
  return useQuery({
    queryKey: ["catalog", table],
    queryFn: async () => {
      let q: any = (supabase as any).from(table).select("id, nombre").order("nombre");
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
}

function CatalogSelect({
  table,
  value,
  onChange,
  placeholder = "Selecciona…",
}: {
  table: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { data = [], isLoading } = useCatalog(table);
  return (
    <Select value={value ? String(value) : undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Cargando…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {data.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ActivosComercialesNuevo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);

  const [prop, setProp] = useState<Dict>({
    id_tipo_propiedad: "11",
    id_tipo_transaccion: "1",
    numero_propiedad: "",
    numero_piso: "",
    m2_interiores: "",
    m2_exteriores: "",
    precio_lista: "",
    descripcion: "",
    url_imagen_portada: "",
  });
  const [pac, setPac] = useState<Dict>({
    predial_al_corriente: false,
    origen_ejidal: false,
    dominio_pleno: true,
    libre_gravamen: true,
  });
  const [atts, setAtts] = useState<Dict>({});
  const [venta, setVenta] = useState<Dict>({ moneda: "MXN" });
  const [renta, setRenta] = useState<Dict>({
    moneda: "MXN",
    iva_aplica: true,
    cam_es_porcentaje: false,
    comision_es_porcentaje: true,
  });

  const tipo = Number(prop.id_tipo_propiedad);
  const trans = Number(prop.id_tipo_transaccion);
  const showVenta = trans === 1 || trans === 3;
  const showRenta = trans === 2 || trans === 3;

  // Reset atributos al cambiar tipo
  useEffect(() => setAtts({}), [tipo]);

  const setP = (k: string, v: any) => setProp((p) => ({ ...p, [k]: v }));
  const setA = (k: string, v: any) => setAtts((p) => ({ ...p, [k]: v }));
  const setC = (k: string, v: any) => setPac((p) => ({ ...p, [k]: v }));
  const setV = (k: string, v: any) => setVenta((p) => ({ ...p, [k]: v }));
  const setR = (k: string, v: any) => setRenta((p) => ({ ...p, [k]: v }));

  const canSave = useMemo(
    () =>
      !!prop.id_tipo_propiedad &&
      !!prop.id_tipo_transaccion &&
      (!showVenta || Number(prop.precio_lista) > 0) &&
      (!showRenta || Number(renta.renta_mensual) > 0),
    [prop, renta, showVenta, showRenta],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Dict = {
        propiedad: prop,
        activo_comercial: pac,
        atributos: atts,
      };
      if (showVenta) payload.oferta_venta = venta;
      if (showRenta) payload.oferta_renta = renta;

      const { data, error } = await (supabase as any).rpc("crear_activo_comercial", {
        payload,
      });
      if (error) throw error;
      toast({ title: "Activo creado", description: `ID ${data}` });
      navigate(`/admin/activos-comerciales/${data}`);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "No se pudo crear",
        description: e.message ?? "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/activos-comerciales")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nuevo activo comercial</h1>
            <p className="text-sm text-muted-foreground">
              Alta de local, oficina, bodega o terreno.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar activo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ubicacion">Ubicación & Legal</TabsTrigger>
          <TabsTrigger value="atributos">Atributos ({TIPOS.find(t => t.id === tipo)?.label ?? "-"})</TabsTrigger>
          {showVenta && <TabsTrigger value="venta">Venta</TabsTrigger>}
          {showRenta && <TabsTrigger value="renta">Renta</TabsTrigger>}
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Tipo de activo *">
                <Select
                  value={String(prop.id_tipo_propiedad)}
                  onValueChange={(v) => setP("id_tipo_propiedad", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Transacción *">
                <Select
                  value={String(prop.id_tipo_transaccion)}
                  onValueChange={(v) => setP("id_tipo_transaccion", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSACCIONES.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Número / Clave interna">
                <Input value={prop.numero_propiedad} onChange={(e) => setP("numero_propiedad", e.target.value)} />
              </Field>
              <Field label="Piso">
                <Input value={prop.numero_piso} onChange={(e) => setP("numero_piso", e.target.value)} />
              </Field>
              <Field label="m² interiores">
                <Input type="number" value={prop.m2_interiores} onChange={(e) => setP("m2_interiores", e.target.value)} />
              </Field>
              <Field label="m² exteriores">
                <Input type="number" value={prop.m2_exteriores} onChange={(e) => setP("m2_exteriores", e.target.value)} />
              </Field>
              <Field label={showVenta ? "Precio de lista (venta) *" : "Precio de lista"}>
                <Input type="number" value={prop.precio_lista} onChange={(e) => setP("precio_lista", e.target.value)} />
              </Field>
              <Field label="Código interno">
                <Input value={pac.codigo_interno ?? ""} onChange={(e) => setC("codigo_interno", e.target.value)} />
              </Field>
              <Field label="Año de construcción">
                <Input type="number" value={pac.anio_construccion ?? ""} onChange={(e) => setC("anio_construccion", e.target.value)} />
              </Field>
              <Field label="Estado de conservación">
                <CatalogSelect table="estados_conservacion" value={pac.id_estado_conservacion} onChange={(v) => setC("id_estado_conservacion", v)} />
              </Field>
              <Field label="Cuota condominio mensual">
                <Input type="number" value={pac.cuota_condominio_mensual ?? ""} onChange={(e) => setC("cuota_condominio_mensual", e.target.value)} />
              </Field>
              <Field label="URL recorrido virtual">
                <Input value={pac.url_recorrido_virtual ?? ""} onChange={(e) => setC("url_recorrido_virtual", e.target.value)} />
              </Field>
              <Field label="URL imagen portada" className="md:col-span-3">
                <Input value={prop.url_imagen_portada} onChange={(e) => setP("url_imagen_portada", e.target.value)} />
              </Field>
              <Field label="Descripción" className="md:col-span-3">
                <Textarea rows={3} value={prop.descripcion} onChange={(e) => setP("descripcion", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UBICACION */}
        <TabsContent value="ubicacion">
          <Card>
            <CardHeader><CardTitle>Ubicación y legal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Dirección" className="md:col-span-2">
                <Input value={pac.ubicacion_direccion ?? ""} onChange={(e) => setC("ubicacion_direccion", e.target.value)} />
              </Field>
              <Field label="Ciudad">
                <Input value={pac.ubicacion_ciudad ?? ""} onChange={(e) => setC("ubicacion_ciudad", e.target.value)} />
              </Field>
              <Field label="Latitud">
                <Input type="number" value={pac.ubicacion_lat ?? ""} onChange={(e) => setC("ubicacion_lat", e.target.value)} />
              </Field>
              <Field label="Longitud">
                <Input type="number" value={pac.ubicacion_lng ?? ""} onChange={(e) => setC("ubicacion_lng", e.target.value)} />
              </Field>
              <Field label="Régimen de propiedad">
                <CatalogSelect table="regimenes_propiedad" value={pac.id_regimen_propiedad} onChange={(v) => setC("id_regimen_propiedad", v)} />
              </Field>
              <Field label="Subtipo condominio">
                <Input value={pac.subtipo_condominio ?? ""} onChange={(e) => setC("subtipo_condominio", e.target.value)} />
              </Field>
              <Field label="Folio real">
                <Input value={pac.folio_real ?? ""} onChange={(e) => setC("folio_real", e.target.value)} />
              </Field>
              <Field label="Clave catastral">
                <Input value={pac.clave_catastral ?? ""} onChange={(e) => setC("clave_catastral", e.target.value)} />
              </Field>
              <Field label="Cuenta predial">
                <Input value={pac.cuenta_predial ?? ""} onChange={(e) => setC("cuenta_predial", e.target.value)} />
              </Field>
              <Field label="Valor catastral">
                <Input type="number" value={pac.valor_catastral ?? ""} onChange={(e) => setC("valor_catastral", e.target.value)} />
              </Field>
              <Field label="Predial anual">
                <Input type="number" value={pac.monto_predial_anual ?? ""} onChange={(e) => setC("monto_predial_anual", e.target.value)} />
              </Field>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <SwitchRow label="Predial al corriente" value={!!pac.predial_al_corriente} onChange={(v) => setC("predial_al_corriente", v)} />
                <SwitchRow label="Origen ejidal" value={!!pac.origen_ejidal} onChange={(v) => setC("origen_ejidal", v)} />
                <SwitchRow label="Dominio pleno" value={!!pac.dominio_pleno} onChange={(v) => setC("dominio_pleno", v)} />
                <SwitchRow label="Libre de gravamen" value={!!pac.libre_gravamen} onChange={(v) => setC("libre_gravamen", v)} />
              </div>
              {!pac.libre_gravamen && (
                <Field label="Descripción del gravamen" className="md:col-span-3">
                  <Textarea rows={2} value={pac.gravamen_descripcion ?? ""} onChange={(e) => setC("gravamen_descripcion", e.target.value)} />
                </Field>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATRIBUTOS */}
        <TabsContent value="atributos">
          <Card>
            <CardHeader><CardTitle>Atributos específicos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tipo === 14 && (
                <>
                  <Field label="Tipo de terreno">
                    <CatalogSelect table="tipos_terreno" value={atts.id_tipo_terreno} onChange={(v) => setA("id_tipo_terreno", v)} />
                  </Field>
                  <Field label="Uso de suelo">
                    <CatalogSelect table="usos_suelo" value={atts.id_uso_suelo} onChange={(v) => setA("id_uso_suelo", v)} />
                  </Field>
                  <Field label="Manzana"><Input value={atts.manzana ?? ""} onChange={(e) => setA("manzana", e.target.value)} /></Field>
                  <Field label="Lote"><Input value={atts.lote ?? ""} onChange={(e) => setA("lote", e.target.value)} /></Field>
                  <Field label="Superficie terreno (m²)"><Input type="number" value={atts.superficie_terreno ?? ""} onChange={(e) => setA("superficie_terreno", e.target.value)} /></Field>
                  <Field label="Superficie construida (m²)"><Input type="number" value={atts.superficie_construida ?? ""} onChange={(e) => setA("superficie_construida", e.target.value)} /></Field>
                  <Field label="Frente (m)"><Input type="number" value={atts.frente ?? ""} onChange={(e) => setA("frente", e.target.value)} /></Field>
                  <Field label="Fondo (m)"><Input type="number" value={atts.fondo ?? ""} onChange={(e) => setA("fondo", e.target.value)} /></Field>
                  <Field label="Número de frentes"><Input type="number" value={atts.numero_frentes ?? ""} onChange={(e) => setA("numero_frentes", e.target.value)} /></Field>
                  <Field label="Topografía"><Input value={atts.topografia ?? ""} onChange={(e) => setA("topografia", e.target.value)} /></Field>
                  <Field label="Forma"><Input value={atts.forma ?? ""} onChange={(e) => setA("forma", e.target.value)} /></Field>
                  <Field label="Densidad"><Input type="number" value={atts.densidad ?? ""} onChange={(e) => setA("densidad", e.target.value)} /></Field>
                  <Field label="COS"><Input type="number" value={atts.cos ?? ""} onChange={(e) => setA("cos", e.target.value)} /></Field>
                  <Field label="CUS"><Input type="number" value={atts.cus ?? ""} onChange={(e) => setA("cus", e.target.value)} /></Field>
                  <Field label="CAS"><Input type="number" value={atts.cas ?? ""} onChange={(e) => setA("cas", e.target.value)} /></Field>
                  <Field label="Niveles permitidos"><Input type="number" value={atts.niveles_permitidos ?? ""} onChange={(e) => setA("niveles_permitidos", e.target.value)} /></Field>
                  <Field label="Restricciones" className="md:col-span-3">
                    <Textarea rows={2} value={atts.restricciones ?? ""} onChange={(e) => setA("restricciones", e.target.value)} />
                  </Field>
                  <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["serv_agua", "Agua"],
                      ["serv_drenaje", "Drenaje"],
                      ["serv_electricidad", "Electricidad"],
                      ["serv_gas", "Gas"],
                      ["serv_fibra", "Fibra"],
                      ["serv_alumbrado", "Alumbrado"],
                      ["serv_calles_pavimentadas", "Calles pavimentadas"],
                      ["serv_banquetas", "Banquetas"],
                      ["serv_urbanizado", "Urbanizado"],
                      ["serv_factibilidad_agua", "Factibilidad agua"],
                      ["serv_factibilidad_cfe", "Factibilidad CFE"],
                    ].map(([k, lbl]) => (
                      <SwitchRow key={k} label={lbl} value={!!atts[k]} onChange={(v) => setA(k, v)} />
                    ))}
                  </div>
                </>
              )}

              {tipo === 12 && (
                <>
                  <Field label="Edificio"><Input value={atts.edificio ?? ""} onChange={(e) => setA("edificio", e.target.value)} /></Field>
                  <Field label="Piso"><Input value={atts.piso ?? ""} onChange={(e) => setA("piso", e.target.value)} /></Field>
                  <Field label="Número oficina"><Input value={atts.numero_oficina ?? ""} onChange={(e) => setA("numero_oficina", e.target.value)} /></Field>
                  <Field label="Corredor"><Input value={atts.corredor ?? ""} onChange={(e) => setA("corredor", e.target.value)} /></Field>
                  <Field label="Área rentable (m²)"><Input type="number" value={atts.area_rentable ?? ""} onChange={(e) => setA("area_rentable", e.target.value)} /></Field>
                  <Field label="Área útil (m²)"><Input type="number" value={atts.area_util ?? ""} onChange={(e) => setA("area_util", e.target.value)} /></Field>
                  <Field label="Factor de eficiencia"><Input type="number" value={atts.factor_eficiencia ?? ""} onChange={(e) => setA("factor_eficiencia", e.target.value)} /></Field>
                  <Field label="Estándar de medición">
                    <CatalogSelect table="estandares_medicion" value={atts.id_estandar_medicion} onChange={(v) => setA("id_estandar_medicion", v)} />
                  </Field>
                  <Field label="Altura libre (m)"><Input type="number" value={atts.altura_libre ?? ""} onChange={(e) => setA("altura_libre", e.target.value)} /></Field>
                  <Field label="Niveles"><Input type="number" value={atts.niveles ?? ""} onChange={(e) => setA("niveles", e.target.value)} /></Field>
                  <Field label="Mínimo rentable"><Input type="number" value={atts.minimo_rentable ?? ""} onChange={(e) => setA("minimo_rentable", e.target.value)} /></Field>
                  <Field label="Estado de acabados">
                    <CatalogSelect table="estados_acabados" value={atts.id_estado_acabados} onChange={(v) => setA("id_estado_acabados", v)} />
                  </Field>
                  <Field label="Clase de edificio">
                    <CatalogSelect table="clases_edificio" value={atts.id_clase_edificio} onChange={(v) => setA("id_clase_edificio", v)} />
                  </Field>
                  <Field label="HVAC">
                    <CatalogSelect table="hvac_tipo" value={atts.id_hvac} onChange={(v) => setA("id_hvac", v)} />
                  </Field>
                  <Field label="Elevadores"><Input type="number" value={atts.elevadores ?? ""} onChange={(e) => setA("elevadores", e.target.value)} /></Field>
                  <Field label="Cajones estacionamiento"><Input type="number" value={atts.cajones_estacionamiento ?? ""} onChange={(e) => setA("cajones_estacionamiento", e.target.value)} /></Field>
                  <Field label="Ratio estacionamiento"><Input value={atts.ratio_estacionamiento ?? ""} onChange={(e) => setA("ratio_estacionamiento", e.target.value)} /></Field>
                  <Field label="Certificación LEED"><Input value={atts.certificacion_leed ?? ""} onChange={(e) => setA("certificacion_leed", e.target.value)} /></Field>
                  <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SwitchRow label="Divisible" value={!!atts.divisible} onChange={(v) => setA("divisible", v)} />
                    <SwitchRow label="Planta de luz" value={!!atts.planta_luz} onChange={(v) => setA("planta_luz", v)} />
                    <SwitchRow label="CCTV" value={!!atts.seguridad_cctv} onChange={(v) => setA("seguridad_cctv", v)} />
                    <SwitchRow label="Control de acceso" value={!!atts.control_acceso} onChange={(v) => setA("control_acceso", v)} />
                    <SwitchRow label="Fibra" value={!!atts.fibra} onChange={(v) => setA("fibra", v)} />
                  </div>
                </>
              )}

              {(tipo === 11 || tipo === 13) && (
                <>
                  <Field label="Tipo de comercio">
                    <CatalogSelect table="tipos_comercio" value={atts.id_tipo_comercio} onChange={(v) => setA("id_tipo_comercio", v)} />
                  </Field>
                  <Field label="Tipo de centro">
                    <CatalogSelect table="tipos_centro" value={atts.id_tipo_centro} onChange={(v) => setA("id_tipo_centro", v)} />
                  </Field>
                  <Field label="Estado de entrega">
                    <CatalogSelect table="estados_entrega_comercio" value={atts.id_estado_entrega} onChange={(v) => setA("id_estado_entrega", v)} />
                  </Field>
                  <Field label="Plaza"><Input value={atts.plaza ?? ""} onChange={(e) => setA("plaza", e.target.value)} /></Field>
                  <Field label="Número local"><Input value={atts.numero_local ?? ""} onChange={(e) => setA("numero_local", e.target.value)} /></Field>
                  <Field label="Nivel"><Input value={atts.nivel ?? ""} onChange={(e) => setA("nivel", e.target.value)} /></Field>
                  <Field label="GLA (m²)"><Input type="number" value={atts.gla ?? ""} onChange={(e) => setA("gla", e.target.value)} /></Field>
                  <Field label="Área privativa (m²)"><Input type="number" value={atts.area_privativa ?? ""} onChange={(e) => setA("area_privativa", e.target.value)} /></Field>
                  <Field label="Mezzanine (m²)"><Input type="number" value={atts.mezzanine ?? ""} onChange={(e) => setA("mezzanine", e.target.value)} /></Field>
                  <Field label="Terraza (m²)"><Input type="number" value={atts.terraza ?? ""} onChange={(e) => setA("terraza", e.target.value)} /></Field>
                  <Field label="Frente exhibición (m)"><Input type="number" value={atts.frente_exhibicion ?? ""} onChange={(e) => setA("frente_exhibicion", e.target.value)} /></Field>
                  <Field label="Fondo (m)"><Input type="number" value={atts.fondo ?? ""} onChange={(e) => setA("fondo", e.target.value)} /></Field>
                  <Field label="Altura libre (m)"><Input type="number" value={atts.altura_libre ?? ""} onChange={(e) => setA("altura_libre", e.target.value)} /></Field>
                  <Field label="Visibilidad"><Input value={atts.visibilidad ?? ""} onChange={(e) => setA("visibilidad", e.target.value)} /></Field>
                  <Field label="Aforo vehicular"><Input type="number" value={atts.aforo_vehicular ?? ""} onChange={(e) => setA("aforo_vehicular", e.target.value)} /></Field>
                  <Field label="Foot traffic"><Input type="number" value={atts.foot_traffic ?? ""} onChange={(e) => setA("foot_traffic", e.target.value)} /></Field>
                  <Field label="Cajones estacionamiento"><Input type="number" value={atts.cajones_estacionamiento ?? ""} onChange={(e) => setA("cajones_estacionamiento", e.target.value)} /></Field>
                  <Field label="Capacidad carga piso"><Input type="number" value={atts.capacidad_carga_piso ?? ""} onChange={(e) => setA("capacidad_carga_piso", e.target.value)} /></Field>
                  <Field label="Andenes de carga"><Input type="number" value={atts.andenes_carga ?? ""} onChange={(e) => setA("andenes_carga", e.target.value)} /></Field>
                  <Field label="Patio maniobras (m²)"><Input type="number" value={atts.patio_maniobras ?? ""} onChange={(e) => setA("patio_maniobras", e.target.value)} /></Field>
                  <Field label="kVA energía"><Input type="number" value={atts.kva_energia ?? ""} onChange={(e) => setA("kva_energia", e.target.value)} /></Field>
                  <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SwitchRow label="Esquina" value={!!atts.esquina} onChange={(v) => setA("esquina", v)} />
                    <SwitchRow label="Licencia funcionamiento" value={!!atts.licencia_funcionamiento} onChange={(v) => setA("licencia_funcionamiento", v)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENTA */}
        {showVenta && (
          <TabsContent value="venta">
            <Card>
              <CardHeader><CardTitle>Condiciones de venta</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Precio de lista *">
                  <Input type="number" value={prop.precio_lista} onChange={(e) => setP("precio_lista", e.target.value)} />
                </Field>
                <Field label="Moneda">
                  <Select value={venta.moneda} onValueChange={(v) => setV("moneda", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notas">
                  <Input value={venta.notas ?? ""} onChange={(e) => setV("notas", e.target.value)} />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* RENTA */}
        {showRenta && (
          <TabsContent value="renta">
            <Card>
              <CardHeader><CardTitle>Condiciones de renta</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Renta mensual *">
                  <Input type="number" value={renta.renta_mensual ?? ""} onChange={(e) => setR("renta_mensual", e.target.value)} />
                </Field>
                <Field label="Precio m²/mes">
                  <Input type="number" value={renta.precio_m2_mes ?? ""} onChange={(e) => setR("precio_m2_mes", e.target.value)} />
                </Field>
                <Field label="Moneda">
                  <Select value={renta.moneda} onValueChange={(v) => setR("moneda", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo de contrato">
                  <CatalogSelect table="tipos_contrato_renta" value={renta.id_tipo_contrato} onChange={(v) => setR("id_tipo_contrato", v)} />
                </Field>
                <Field label="Plazo forzoso (meses)">
                  <Input type="number" value={renta.plazo_forzoso_meses ?? ""} onChange={(e) => setR("plazo_forzoso_meses", e.target.value)} />
                </Field>
                <Field label="Depósito (meses)">
                  <Input type="number" value={renta.deposito_meses ?? ""} onChange={(e) => setR("deposito_meses", e.target.value)} />
                </Field>
                <Field label="Meses de gracia">
                  <Input type="number" value={renta.meses_gracia ?? ""} onChange={(e) => setR("meses_gracia", e.target.value)} />
                </Field>
                <Field label="Escalación anual (%)">
                  <Input type="number" value={renta.escalacion_anual ?? ""} onChange={(e) => setR("escalacion_anual", e.target.value)} />
                </Field>
                <Field label="Indexación">
                  <CatalogSelect table="indexaciones_renta" value={renta.id_indexacion} onChange={(v) => setR("id_indexacion", v)} />
                </Field>
                <Field label="CAM">
                  <Input type="number" value={renta.cam ?? ""} onChange={(e) => setR("cam", e.target.value)} />
                </Field>
                <Field label="Cuota publicidad">
                  <Input type="number" value={renta.cuota_publicidad ?? ""} onChange={(e) => setR("cuota_publicidad", e.target.value)} />
                </Field>
                <Field label="Giro permitido">
                  <CatalogSelect table="giros_comerciales" value={renta.id_giro_permitido} onChange={(v) => setR("id_giro_permitido", v)} />
                </Field>
                <Field label="Tipo de garantía">
                  <CatalogSelect table="tipos_garantia_renta" value={renta.id_tipo_garantia} onChange={(v) => setR("id_tipo_garantia", v)} />
                </Field>
                <Field label="Exclusividad">
                  <Input value={renta.exclusividad ?? ""} onChange={(e) => setR("exclusividad", e.target.value)} />
                </Field>
                <Field label="Comisión corretaje">
                  <Input type="number" value={renta.comision_corretaje ?? ""} onChange={(e) => setR("comision_corretaje", e.target.value)} />
                </Field>
                <Field label="Disponible desde">
                  <Input type="date" value={renta.disponible_desde ?? ""} onChange={(e) => setR("disponible_desde", e.target.value)} />
                </Field>
                <Field label="Fin contrato actual">
                  <Input type="date" value={renta.fecha_fin_contrato_actual ?? ""} onChange={(e) => setR("fecha_fin_contrato_actual", e.target.value)} />
                </Field>
                <Field label="Inquilino actual">
                  <Input value={renta.inquilino_actual ?? ""} onChange={(e) => setR("inquilino_actual", e.target.value)} />
                </Field>
                <Field label="% Ocupación">
                  <Input type="number" value={renta.porcentaje_ocupacion ?? ""} onChange={(e) => setR("porcentaje_ocupacion", e.target.value)} />
                </Field>
                <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SwitchRow label="IVA aplica" value={!!renta.iva_aplica} onChange={(v) => setR("iva_aplica", v)} />
                  <SwitchRow label="CAM es %" value={!!renta.cam_es_porcentaje} onChange={(v) => setR("cam_es_porcentaje", v)} />
                  <SwitchRow label="Comisión es %" value={!!renta.comision_es_porcentaje} onChange={(v) => setR("comision_es_porcentaje", v)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave || saving} size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar activo
        </Button>
      </div>
    </div>
  );
}