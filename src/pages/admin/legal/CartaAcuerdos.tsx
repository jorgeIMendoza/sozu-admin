import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TemplateEditorWithPreview } from "@/components/admin/TemplateEditorWithPreview";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, Loader2, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PLACEHOLDERS = [
  { key: "nombre_agente", label: "Nombre completo del agente", editable: true },
  { key: "rfc_agente", label: "RFC del agente", editable: true },
  { key: "fecha_actual", label: "Fecha actual", editable: false },
  { key: "fecha_fin", label: "Fecha fin (+3 meses)", editable: false },
];

const ESTADO_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pendiente: { label: "Pendiente", variant: "secondary", icon: Clock },
  enviado: { label: "Enviado", variant: "outline", icon: Send },
  firmado_parcial: { label: "Firma parcial", variant: "default", icon: Clock },
  completado: { label: "Completado", variant: "default", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", variant: "destructive", icon: XCircle },
};

export default function CartaAcuerdos() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch template
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["carta-acuerdos-template"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("carta_acuerdos_template")
        .select("*")
        .order("id")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch firmas
  const { data: firmas = [], isLoading: firmasLoading } = useQuery({
    queryKey: ["firmas-digitales"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("firmas_digitales")
        .select("*")
        .eq("tipo_documento", "carta_acuerdos")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Save template
  const saveMutation = useMutation({
    mutationFn: async (html: string) => {
      const { error } = await (supabase as any)
        .from("carta_acuerdos_template")
        .update({ contenido_html: html, updated_by: profile?.email || "unknown" })
        .eq("id", template?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Template guardado", description: "La carta de acuerdos se guardó correctamente." });
      queryClient.invalidateQueries({ queryKey: ["carta-acuerdos-template"] });
    },
    onError: (err: any) => {
      toast({ title: "❌ Error", description: err.message, variant: "destructive" });
    },
  });

  const [editorHtml, setEditorHtml] = useState<string | null>(null);
  const currentHtml = editorHtml ?? template?.contenido_html ?? "";

  return (
    <div className="space-y-6">
      <Tabs defaultValue="editor">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Carta de Acuerdos
          </CardTitle>
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="firmas">Firmas ({firmas.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="editor" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Template de la Carta</CardTitle>
                <Button
                  onClick={() => saveMutation.mutate(currentHtml)}
                  disabled={saveMutation.isPending || templateLoading}
                  size="sm"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templateLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <TemplateEditorWithPreview
                  value={currentHtml}
                  onChange={setEditorHtml}
                  placeholders={PLACEHOLDERS}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firmas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de Firmas</CardTitle>
            </CardHeader>
            <CardContent>
              {firmasLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : firmas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay firmas digitales registradas
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Firmantes</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firmas.map((firma: any) => {
                      const config = ESTADO_CONFIG[firma.estado] || ESTADO_CONFIG.pendiente;
                      const Icon = config.icon;
                      return (
                        <TableRow key={firma.id}>
                          <TableCell className="font-mono text-xs">{firma.id}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {(firma.firmantes || []).map((f: any, i: number) => (
                                <div key={i} className="text-xs flex items-center gap-1">
                                  <span>{f.name || f.email}</span>
                                  {f.email && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-primary cursor-pointer underline decoration-dotted"
                                      title="Copiar correo"
                                      onClick={() => {
                                        navigator.clipboard.writeText(f.email);
                                        toast({ title: "Correo copiado", description: f.email });
                                      }}
                                    >
                                      {f.email}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(firma.created_at).toLocaleDateString("es-MX")}
                          </TableCell>
                          <TableCell>
                            {firma.pdf_firmado_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(firma.pdf_firmado_url, "_blank")}
                              >
                                Ver PDF
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
