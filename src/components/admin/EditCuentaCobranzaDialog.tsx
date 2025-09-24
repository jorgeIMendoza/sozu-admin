import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { PersonForm } from "@/components/admin/PersonForm";

interface Comprador {
  nombre_legal: string;
  rfc: string | null;
  porcentaje_copropiedad: number;
}

interface CuentaCobranza {
  id: number;
  clabe_stp: string | null;
  precio_final: number;
  compradores: Comprador[];
  dueno: string;
  proyecto: string;
  edificio: string;
  numero_propiedad: string;
  modelo: string;
  activo: boolean;
}

interface EditCuentaCobranzaDialogProps {
  cuenta: CuentaCobranza;
  onClose: () => void;
  onUpdate: () => void;
}

interface Persona {
  id: number;
  nombre_legal: string;
  rfc: string | null;
  email: string;
  telefono: string | null;
  tipo_persona: string;
}

interface AcuerdoPago {
  id: number;
  orden: number;
  monto: number;
  fecha_pago: string | null;
  id_concepto: number;
  concepto_nombre?: string;
}

interface EsquemaPago {
  id: number;
  nombre: string;
  porcentaje_enganche: number;
  porcentaje_mensualidades: number;
  porcentaje_entrega: number;
  numero_mensualidades: number;
}

export function EditCuentaCobranzaDialog({ cuenta, onClose, onUpdate }: EditCuentaCobranzaDialogProps) {
  const [activeTab, setActiveTab] = useState("propiedad");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [porcentaje, setPorcentaje] = useState("100");
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [acuerdos, setAcuerdos] = useState<AcuerdoPago[]>([]);
  const [selectedEsquema, setSelectedEsquema] = useState<string>("");
  
  const { toast } = useToast();

  // Get detailed account data
  const { data: cuentaDetalle } = useQuery({
    queryKey: ["cuenta_detalle", cuenta.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cuentas_cobranza')
        .select(`
          id,
          clabe_stp,
          precio_final,
          es_aprobado,
          fecha_compra,
          id_oferta,
          porcentaje_comision_venta
        `)
        .eq('id', cuenta.id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Get property details
  const { data: propiedadDetalle } = useQuery({
    queryKey: ["propiedad_detalle", cuenta.id],
    queryFn: async () => {
      if (!cuentaDetalle?.id_oferta) return null;
      
      const { data: oferta } = await supabase
        .from('ofertas')
        .select(`
          id,
          id_propiedad,
          propiedades!ofertas_id_propiedad_fkey(
            id,
            numero_propiedad,
            numero_piso,
            m2_reales,
            precio_lista,
            descripcion,
            id_entidad_relacionada_dueno,
            id_edificio_modelo
          )
        `)
        .eq('id', cuentaDetalle.id_oferta)
        .single();

      return oferta?.propiedades;
    },
    enabled: !!cuentaDetalle?.id_oferta
  });

  // Get seller details
  const { data: vendedorDetalle } = useQuery({
    queryKey: ["vendedor_detalle", propiedadDetalle?.id_entidad_relacionada_dueno],
    queryFn: async () => {
      if (!propiedadDetalle?.id_entidad_relacionada_dueno) return null;
      
      const { data } = await supabase
        .from('entidades_relacionadas')
        .select(`
          personas!entidades_relacionadas_id_persona_fkey(*)
        `)
        .eq('id', propiedadDetalle.id_entidad_relacionada_dueno)
        .single();

      return data?.personas;
    },
    enabled: !!propiedadDetalle?.id_entidad_relacionada_dueno
  });

  // Get existing buyers
  const { data: compradoresExistentes } = useQuery({
    queryKey: ["compradores_existentes", cuenta.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('compradores')
        .select(`
          porcentaje_copropiedad,
          personas!compradores_id_persona_fkey(*)
        `)
        .eq('id_cuenta_cobranza', cuenta.id)
        .eq('activo', true);

      return data || [];
    }
  });

  // Get payment agreements
  const { data: acuerdosPago } = useQuery({
    queryKey: ["acuerdos_pago", cuenta.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('acuerdos_pago')
        .select(`
          id,
          orden,
          monto,
          fecha_pago,
          id_concepto
        `)
        .eq('id_cuenta_cobranza', cuenta.id)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (data && data.length > 0) {
        const conceptoIds = [...new Set(data.map(a => a.id_concepto))];
        const { data: conceptos } = await supabase
          .from('conceptos_pago')
          .select('id, nombre')
          .in('id', conceptoIds);

        return data.map(acuerdo => ({
          ...acuerdo,
          concepto_nombre: conceptos?.find(c => c.id === acuerdo.id_concepto)?.nombre || 'Sin concepto'
        }));
      }
      
      return [];
    }
  });

  // Get payment schemes
  const { data: esquemasPago } = useQuery({
    queryKey: ["esquemas_pago"],
    queryFn: async () => {
      if (!propiedadDetalle) return [];
      
      const { data: entidad } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id', propiedadDetalle.id_entidad_relacionada_dueno)
        .single();
        
      if (!entidad?.id_proyecto) return [];

      const { data } = await supabase
        .from('esquemas_pago')
        .select('id, nombre, porcentaje_enganche, porcentaje_mensualidades, porcentaje_entrega, numero_mensualidades')
        .eq('id_proyecto', entidad.id_proyecto)
        .eq('es_manual', false)
        .eq('activo', true)
        .order('nombre', { ascending: true });

      return data || [];
    },
    enabled: !!propiedadDetalle
  });

  // Search for persons (buyers/leads)
  const { data: personasBusqueda } = useQuery({
    queryKey: ["personas_busqueda", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      const { data } = await supabase
        .from('personas')
        .select('id, nombre_legal, rfc, email, telefono, tipo_persona')
        .ilike('nombre_legal', `%${searchTerm}%`)
        .eq('activo', true)
        .limit(10);

      return data || [];
    },
    enabled: searchTerm.length >= 2
  });

  useEffect(() => {
    if (acuerdosPago) {
      setAcuerdos(acuerdosPago);
    }
  }, [acuerdosPago]);

  const totalPorcentajes = compradoresExistentes?.reduce((sum, c) => sum + (c.porcentaje_copropiedad || 0), 0) || 0;
  const porcentajeDisponible = 100 - totalPorcentajes;

  // Mutation to add new buyer
  const addCompradorMutation = useMutation({
    mutationFn: async ({ personaId, porcentaje }: { personaId: number; porcentaje: number }) => {
      const { error } = await supabase
        .from('compradores')
        .insert({
          id_cuenta_cobranza: cuenta.id,
          id_persona: personaId,
          porcentaje_copropiedad: porcentaje,
          activo: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Comprador agregado",
        description: "El comprador ha sido agregado exitosamente",
      });
      onUpdate();
    }
  });

  // Mutation to create payment agreement
  const createAcuerdoMutation = useMutation({
    mutationFn: async (esquemaId: number) => {
      // Simulate API call - in real implementation this would call an endpoint
      const { data: esquema } = await supabase
        .from('esquemas_pago')
        .select('*')
        .eq('id', esquemaId)
        .single();
      
      if (!esquema || !cuentaDetalle) throw new Error('Esquema o cuenta no encontrada');
      
      const precioFinal = cuentaDetalle.precio_final;
      
      // Calculate payment amounts
      const montoApartado = 20000; // Fixed amount
      const montoEnganche = (precioFinal * esquema.porcentaje_enganche / 100) - montoApartado;
      const montoMensualidad = (precioFinal * esquema.porcentaje_mensualidades / 100) / esquema.numero_mensualidades;
      const montoEntrega = precioFinal * esquema.porcentaje_entrega / 100;
      
      // Create payment agreements
      const acuerdos = [];
      
      // Apartado
      acuerdos.push({
        id_cuenta_cobranza: cuenta.id,
        orden: 1,
        monto: montoApartado,
        id_concepto: 1, // Apartado
        activo: true
      });
      
      // Enganche
      if (montoEnganche > 0) {
        acuerdos.push({
          id_cuenta_cobranza: cuenta.id,
          orden: 2,
          monto: montoEnganche,
          id_concepto: 2, // Enganche
          activo: true
        });
      }
      
      // Mensualidades
      for (let i = 0; i < esquema.numero_mensualidades; i++) {
        acuerdos.push({
          id_cuenta_cobranza: cuenta.id,
          orden: (montoEnganche > 0 ? 3 : 2) + i,
          monto: montoMensualidad,
          id_concepto: 5, // Parcialidad
          activo: true
        });
      }
      
      // Entrega
      if (montoEntrega > 0) {
        acuerdos.push({
          id_cuenta_cobranza: cuenta.id,
          orden: (montoEnganche > 0 ? 3 : 2) + esquema.numero_mensualidades,
          monto: montoEntrega,
          id_concepto: 3, // Pago a contra entrega
          activo: true
        });
      }
      
      const { error } = await supabase
        .from('acuerdos_pago')
        .insert(acuerdos);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Acuerdo creado",
        description: "El acuerdo de pago ha sido creado exitosamente",
      });
      onUpdate();
    }
  });

  const handleAddComprador = () => {
    if (!selectedPersona || !porcentaje) return;
    
    const porcentajeNum = parseFloat(porcentaje);
    if (porcentajeNum <= 0 || porcentajeNum > porcentajeDisponible) {
      toast({
        title: "Error",
        description: `El porcentaje debe estar entre 1 y ${porcentajeDisponible}%`,
        variant: "destructive",
      });
      return;
    }

    addCompradorMutation.mutate({ 
      personaId: selectedPersona.id, 
      porcentaje: porcentajeNum 
    });
    
    setSelectedPersona(null);
    setPorcentaje("100");
  };

  const handleCreateAcuerdo = () => {
    if (!selectedEsquema) return;
    createAcuerdoMutation.mutate(parseInt(selectedEsquema));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cuenta de Cobranza - CC-{String(cuenta.id).padStart(6, '0')}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="propiedad">Datos de la Propiedad</TabsTrigger>
            <TabsTrigger value="vendedor">Datos del Vendedor</TabsTrigger>
            <TabsTrigger value="compradores">Datos del Comprador</TabsTrigger>
            <TabsTrigger value="acuerdo">Acuerdo de Pago</TabsTrigger>
            <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
          </TabsList>

          <TabsContent value="propiedad" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Propiedad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {propiedadDetalle ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número de Propiedad</Label>
                      <Input value={propiedadDetalle.numero_propiedad || ''} readOnly />
                    </div>
                    <div>
                      <Label>Piso</Label>
                      <Input value={propiedadDetalle.numero_piso || ''} readOnly />
                    </div>
                    <div>
                      <Label>Metros Cuadrados</Label>
                      <Input value={`${propiedadDetalle.m2_reales || 0} m²`} readOnly />
                    </div>
                    <div>
                      <Label>Precio de Lista</Label>
                      <Input value={new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(propiedadDetalle.precio_lista || 0)} readOnly />
                    </div>
                    <div className="col-span-2">
                      <Label>Descripción</Label>
                      <Textarea value={propiedadDetalle.descripcion || 'Sin descripción'} readOnly />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">Cargando información de la propiedad...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendedor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información del Vendedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendedorDetalle ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre Legal</Label>
                      <Input value={vendedorDetalle.nombre_legal || ''} readOnly />
                    </div>
                    <div>
                      <Label>RFC</Label>
                      <Input value={vendedorDetalle.rfc || ''} readOnly />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={vendedorDetalle.email || ''} readOnly />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input value={vendedorDetalle.telefono || ''} readOnly />
                    </div>
                    <div>
                      <Label>Tipo de Persona</Label>
                      <Input value={vendedorDetalle.tipo_persona || ''} readOnly />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">Cargando información del vendedor...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compradores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compradores Actuales</CardTitle>
              </CardHeader>
              <CardContent>
                {compradoresExistentes && compradoresExistentes.length > 0 ? (
                  <div className="space-y-4">
                    {compradoresExistentes.map((comprador, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded">
                        <div>
                          <p className="font-medium">{comprador.personas?.nombre_legal}</p>
                          <p className="text-sm text-muted-foreground">
                            RFC: {comprador.personas?.rfc || 'N/A'} | 
                            Email: {comprador.personas?.email} | 
                            {comprador.porcentaje_copropiedad}% de copropiedad
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 p-4 bg-muted rounded">
                      <p className="text-sm">
                        <strong>Porcentajes asignados:</strong> {totalPorcentajes.toFixed(2)}%
                      </p>
                      <p className="text-sm">
                        <strong>Porcentaje disponible:</strong> {porcentajeDisponible.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hay compradores registrados</p>
                )}
              </CardContent>
            </Card>

            {porcentajeDisponible > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Agregar Nuevo Comprador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Buscar Persona</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setShowPersonForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Lead
                      </Button>
                    </div>
                    
                    {personasBusqueda && personasBusqueda.length > 0 && (
                      <div className="mt-2 border rounded max-h-48 overflow-y-auto">
                        {personasBusqueda.map((persona) => (
                          <div
                            key={persona.id}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              setSelectedPersona(persona);
                              setSearchTerm('');
                            }}
                          >
                            <p className="font-medium">{persona.nombre_legal}</p>
                            <p className="text-sm text-muted-foreground">
                              RFC: {persona.rfc || 'N/A'} | Email: {persona.email}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedPersona && (
                    <div className="p-4 border rounded bg-muted">
                      <p className="font-medium mb-2">Persona Seleccionada:</p>
                      <p>{selectedPersona.nombre_legal}</p>
                      <p className="text-sm text-muted-foreground">
                        RFC: {selectedPersona.rfc || 'N/A'} | Email: {selectedPersona.email}
                      </p>
                      
                      <div className="mt-4 flex items-end gap-2">
                        <div className="flex-1">
                          <Label>Porcentaje de Copropiedad (%)</Label>
                          <Input
                            type="number"
                            value={porcentaje}
                            onChange={(e) => setPorcentaje(e.target.value)}
                            min="1"
                            max={porcentajeDisponible}
                          />
                        </div>
                        <Button onClick={handleAddComprador} disabled={addCompradorMutation.isPending}>
                          Agregar Comprador
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="acuerdo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Acuerdo de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                {acuerdos && acuerdos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Porcentaje</TableHead>
                        <TableHead>Fecha de Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acuerdos.map((acuerdo) => (
                        <TableRow key={acuerdo.id}>
                          <TableCell>{acuerdo.orden}</TableCell>
                          <TableCell>{acuerdo.concepto_nombre}</TableCell>
                          <TableCell>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(acuerdo.monto)}</TableCell>
                          <TableCell>{cuentaDetalle?.precio_final ? ((acuerdo.monto / cuentaDetalle.precio_final) * 100).toFixed(2) : 0}%</TableCell>
                          <TableCell>
                            {acuerdo.fecha_pago ? format(new Date(acuerdo.fecha_pago), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">No hay acuerdo de pago configurado</p>
                    
                    <div className="space-y-2">
                      <Label>Seleccionar Plan de Pago</Label>
                      <Select value={selectedEsquema} onValueChange={setSelectedEsquema}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un plan de pago" />
                        </SelectTrigger>
                        <SelectContent>
                          {esquemasPago?.map((esquema) => (
                            <SelectItem key={esquema.id} value={esquema.id.toString()}>
                              {esquema.nombre} - Enganche: {esquema.porcentaje_enganche}% | 
                              Mensualidades: {esquema.numero_mensualidades} pagos de {esquema.porcentaje_mensualidades}% | 
                              Entrega: {esquema.porcentaje_entrega}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        onClick={handleCreateAcuerdo} 
                        disabled={!selectedEsquema || createAcuerdoMutation.isPending}
                      >
                        Crear Acuerdo de Pago
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comisiones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información de Comisiones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Porcentaje de Comisión por Venta</Label>
                    <Input 
                      value={`${cuentaDetalle?.porcentaje_comision_venta || 0}%`} 
                      readOnly 
                    />
                  </div>
                  {cuentaDetalle?.precio_final && cuentaDetalle.porcentaje_comision_venta && (
                    <div>
                      <Label>Monto de Comisión</Label>
                      <Input 
                        value={new Intl.NumberFormat('es-MX', { 
                          style: 'currency', 
                          currency: 'MXN' 
                        }).format((cuentaDetalle.precio_final * cuentaDetalle.porcentaje_comision_venta) / 100)} 
                        readOnly 
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showPersonForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-background rounded-lg shadow-lg max-w-4xl max-h-[90vh] overflow-y-auto">
              <PersonForm
                onCancel={() => setShowPersonForm(false)}
                onSubmit={(persona) => {
                  setSelectedPersona({
                    id: persona.id,
                    nombre_legal: persona.nombre_legal || persona.nombre,
                    rfc: persona.rfc,
                    email: persona.email,
                    telefono: persona.telefono,
                    tipo_persona: persona.tipo_persona
                  });
                  setShowPersonForm(false);
                }}
                initialData={{ tipo_persona: 'pf' }}
                entityType="comprador"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}