import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, FileText, Loader2, Upload } from "lucide-react";
import { SubirDocumentosCuentaDialog } from "@/components/admin/SubirDocumentosCuentaDialog";

/**
 * Listado + carga de documentos de una cuenta de cobranza que NO es de propiedad
 * (productos y servicios). Las cuentas de propiedad usan `DocumentsTab`, que además
 * maneja escrituración y facturación; aquí solo se necesita ver y subir el juego de
 * documentos de la cuenta (nota de crédito, evidencia de devolución, comprobante de
 * transferencia al cliente y facturas XML/PDF).
 */

// Corrige URLs guardadas con path duplicado o relativas (bucket público `documentos`).
function fixUrl(raw: string): string {
  let u = raw;
  if (u && u.includes("/documentos/documentos/")) u = u.replace("/documentos/documentos/", "/documentos/");
  if (u && !u.startsWith("https://")) {
    const fileName = u.startsWith("documentos/") ? u.replace("documentos/", "") : u;
    u = supabase.storage.from("documentos").getPublicUrl(fileName).data.publicUrl;
  }
  return u;
}

function EstatusBadge({ id }: { id: number | null }) {
  const label = id === 2 ? "Validado" : id === 3 ? "Rechazado" : id === 4 ? "Expirado" : "Pendiente";
  const variant = id === 2 ? "default" : id === 3 ? "destructive" : "secondary";
  return <Badge variant={variant as "default" | "destructive" | "secondary"}>{label}</Badge>;
}

interface Props {
  cuentaId: number;
  productoId?: number | null;
  canUpload?: boolean;
}

export function DocumentosCuentaSimple({ cuentaId, productoId, canUpload = false }: Props) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewer, setViewer] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: "",
    title: "",
  });

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos_cuenta_cobranza", cuentaId, null, productoId, ""],
    enabled: !!cuentaId,
    queryFn: async () => {
      const orParts: string[] = [`id_cuenta_cobranza.eq.${cuentaId}`];
      if (productoId) orParts.push(`id_producto.eq.${productoId}`);

      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("id, numero, url, fecha_creacion, id_estatus_verificacion, id_tipo_documento, tipos_documento:id_tipo_documento(nombre)")
        .or(orParts.join(","))
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((d: any) => ({
        id: d.id as number,
        numero: (d.numero ?? "") as string,
        url: fixUrl(d.url),
        fecha: d.fecha_creacion as string | null,
        tipoNombre: (d.tipos_documento?.nombre ?? "Sin tipo") as string,
        estatusId: (d.id_estatus_verificacion ?? null) as number | null,
      }));
    },
  });

  const docs = documentos ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {isLoading ? "Cargando..." : `${docs.length} documento${docs.length !== 1 ? "s" : ""}`}
        </p>
        {canUpload && (
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Agregar documentos
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <FileText className="h-7 w-7 text-muted-foreground/30 mx-auto" />
          <p className="text-[13px] text-muted-foreground">Sin documentos registrados en esta cuenta.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Verificado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.tipoNombre}</TableCell>
                <TableCell>{doc.numero}</TableCell>
                <TableCell>
                  {doc.fecha ? new Date(doc.fecha).toLocaleDateString("es-MX") : "-"}
                </TableCell>
                <TableCell>
                  <EstatusBadge id={doc.estatusId} />
                </TableCell>
                <TableCell className="text-right">
                  {doc.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewer({ open: true, url: doc.url, title: doc.tipoNombre })}
                      title="Ver documento"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SubirDocumentosCuentaDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        cuentaId={cuentaId}
        productoId={productoId ?? null}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["documentos_cuenta_cobranza"] });
        }}
      />

      <Dialog open={viewer.open} onOpenChange={(open) => setViewer((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-3 border-b shrink-0">
            <DialogTitle>{viewer.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={`${viewer.url}#page=1&view=FitH`}
              className="w-full h-full border-0"
              title={viewer.title}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DocumentosCuentaSimple;
