import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, RotateCcw, Landmark, AlertCircle } from "lucide-react";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivityLogger } from "@/hooks/useActivityLogger";

type CuentaSozu = {
  id: number;
  id_banco: number;
  alias: string;
  numero_cuenta?: string | null;
  clabe?: string | null;
  activo: boolean;
  banco_nombre?: string;
};

type Banco = {
  id: number;
  nombre: string;
};

type FormData = {
  bancoId: string;
  alias: string;
  numeroCuenta: string;
  clabe: string;
};

const EMPTY_FORM: FormData = { bancoId: "", alias: "", numeroCuenta: "", clabe: "" };

export default function CuentasSozu() {
  const { canCreate, canUpdate, canDelete, canApprove, isSuperAdmin } =
    usePagePermissions("/admin/cuentas-sozu");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaSozu | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cuentaToDelete, setCuentaToDelete] = useState<CuentaSozu | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [cuentaToRestore, setCuentaToRestore] = useState<CuentaSozu | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { registrarCreacion, registrarActualizacion, registrarEliminacion, registrarRestauracion } =
    useActivityLogger();

  const showDeletedTab = canDelete || isSuperAdmin;
  const itemsPerPage = 10;

  // DDL probe — tabla puede no existir todavia
  const { data: tableExists } = useQuery({
    queryKey: ["cuentas-sozu-ddl-probe"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const probe = await (supabase as any).from("cuentas_sozu").select("id").limit(0);
      return !probe.error;
    },
  });

  const { data: activeBancos = [] } = useQuery<Banco[]>({
    queryKey: ["bancos-activos-select"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase.from("bancos").select("id, nombre").eq("activo", true).order("nombre");
      return (data ?? []) as Banco[];
    },
  });

  const bancoNombreMap: Record<number, string> = Object.fromEntries(
    activeBancos.map((b) => [b.id, b.nombre])
  );

  const fetchCuentas = async (activo: boolean): Promise<CuentaSozu[]> => {
    if (!tableExists) return [];
    const { data, error } = await (supabase as any)
      .from("cuentas_sozu")
      .select("id, id_banco, alias, numero_cuenta, clabe, activo")
      .eq("activo", activo)
      .order("alias");
    if (error) return [];
    return (data ?? []).map((c: any) => ({
      ...c,
      banco_nombre: bancoNombreMap[c.id_banco] ?? "?",
    }));
  };

  const { data: activeCuentas = [], isLoading: loadingActive } = useQuery({
    queryKey: ["cuentas-sozu", "active", tableExists],
    enabled: tableExists === true,
    queryFn: () => fetchCuentas(true),
  });

  const { data: deletedCuentas = [], isLoading: loadingDeleted } = useQuery({
    queryKey: ["cuentas-sozu", "deleted", tableExists],
    enabled: tableExists === true,
    queryFn: () => fetchCuentas(false),
  });

  const cuentas = activeTab === "active" ? activeCuentas : deletedCuentas;
  const filteredCuentas = cuentas.filter(
    (c) =>
      c.alias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.banco_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numero_cuenta?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCuentas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCuentas = filteredCuentas.slice(startIndex, startIndex + itemsPerPage);

  const handleTabChange = (value: string) => { setActiveTab(value); setCurrentPage(1); };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value); setCurrentPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (d: FormData) => {
      const { error } = await (supabase as any).from("cuentas_sozu").insert([{
        id_banco: Number(d.bancoId),
        alias: d.alias.trim(),
        numero_cuenta: d.numeroCuenta.trim() || null,
        clabe: d.clabe.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu"] });
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu-activas"] });
      setIsNewDialogOpen(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Exito", description: "Cuenta creada correctamente." });
      registrarCreacion("cuenta_sozu", { alias: formData.alias });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: `No se pudo crear: ${e.message}`, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (d: FormData & { id: number }) => {
      const { error } = await (supabase as any).from("cuentas_sozu").update({
        id_banco: Number(d.bancoId),
        alias: d.alias.trim(),
        numero_cuenta: d.numeroCuenta.trim() || null,
        clabe: d.clabe.trim() || null,
        fecha_actualizacion: new Date().toISOString(),
      }).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu"] });
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu-activas"] });
      setIsEditDialogOpen(false);
      registrarActualizacion("cuenta_sozu",
        { id: editingCuenta?.id, alias: editingCuenta?.alias },
        { alias: formData.alias }
      );
      setEditingCuenta(null);
      setFormData(EMPTY_FORM);
      toast({ title: "Exito", description: "Cuenta actualizada correctamente." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: `No se pudo actualizar: ${e.message}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from("cuentas_sozu").update({ activo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu"] });
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu-activas"] });
      setDeleteDialogOpen(false);
      registrarEliminacion("cuenta_sozu", { id: cuentaToDelete?.id, alias: cuentaToDelete?.alias });
      setCuentaToDelete(null);
      toast({ title: "Exito", description: "Cuenta eliminada correctamente." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: `No se pudo eliminar: ${e.message}`, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from("cuentas_sozu").update({ activo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu"] });
      queryClient.invalidateQueries({ queryKey: ["cuentas-sozu-activas"] });
      setRestoreDialogOpen(false);
      registrarRestauracion("cuenta_sozu",
        { id: cuentaToRestore?.id, activo: false },
        { id: cuentaToRestore?.id, activo: true }
      );
      setCuentaToRestore(null);
      toast({ title: "Exito", description: "Cuenta restaurada correctamente." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: `No se pudo restaurar: ${e.message}`, variant: "destructive" });
    },
  });

  const handleEdit = (c: CuentaSozu) => {
    setEditingCuenta(c);
    setFormData({
      bancoId: String(c.id_banco),
      alias: c.alias,
      numeroCuenta: c.numero_cuenta ?? "",
      clabe: c.clabe ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.bancoId && formData.alias.trim()) createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCuenta && formData.bancoId && formData.alias.trim()) {
      updateMutation.mutate({ ...formData, id: editingCuenta.id });
    }
  };

  function renderTable() {
    if (loadingActive || loadingDeleted) {
      return (
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="text-lg mb-2">Cargando...</div>
            <div className="text-muted-foreground">Obteniendo cuentas</div>
          </div>
        </div>
      );
    }

    if (paginatedCuentas.length === 0) {
      return (
        <div className="text-center py-8">
          <Landmark className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="text-lg font-medium mb-2">
            {searchTerm ? "No se encontraron resultados" : "No hay cuentas"}
          </div>
          <p className="text-muted-foreground">
            {searchTerm
              ? "Intenta con otros terminos de busqueda"
              : "Agrega la primera cuenta bancaria de SOZU"}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Banco</TableHead>
              <TableHead className="font-semibold">Alias (slug)</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">No. Cuenta</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">CLABE</TableHead>
              <TableHead className="text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCuentas.map((c) => (
              <TableRow
                key={c.id}
                className={`hover:bg-muted/30 transition-colors ${!c.activo ? "opacity-60" : ""}`}
              >
                <TableCell className="text-muted-foreground">{c.banco_nombre}</TableCell>
                <TableCell className="font-mono text-sm">{c.alias}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-sm text-muted-foreground">
                  {c.numero_cuenta ?? "-"}
                </TableCell>
                <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                  {c.clabe ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    {c.activo ? (
                      <>
                        {(canUpdate || isSuperAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(c)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {(canDelete || isSuperAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setCuentaToDelete(c); setDeleteDialogOpen(true); }}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      (canApprove || isSuperAdmin) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setCuentaToRestore(c); setRestoreDialogOpen(true); }}
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderPagination() {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-6 flex justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage(pageNum); }}
                    isActive={currentPage === pageNum}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  }

  function renderForm(isNew: boolean) {
    return (
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Banco *</Label>
          <Select
            value={formData.bancoId}
            onValueChange={(v) => setFormData((f) => ({ ...f, bancoId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar banco" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto">
              {activeBancos.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Alias (slug) *</Label>
          <Input
            placeholder="ej. real_estate, cuenta_principal"
            value={formData.alias}
            onChange={(e) =>
              setFormData((f) => ({ ...f, alias: e.target.value.toLowerCase().replace(/\s+/g, "_") }))
            }
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Se usa como carpeta en Storage: estados_cuenta/.../alias/
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>No. de cuenta</Label>
            <Input
              placeholder="0123456789"
              value={formData.numeroCuenta}
              onChange={(e) => setFormData((f) => ({ ...f, numeroCuenta: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>CLABE</Label>
            <Input
              placeholder="18 digitos"
              value={formData.clabe}
              maxLength={18}
              onChange={(e) => setFormData((f) => ({ ...f, clabe: e.target.value }))}
              className="font-mono"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">

      {/* Banner DDL pendiente */}
      {tableExists === false && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La tabla <code className="font-mono">cuentas_sozu</code> no existe en la BD. Ejecuta el DDL en{" "}
            <span className="font-mono">Ejecuciones_manuales/20260617_02_estados_cuenta_schema.md</span> antes de continuar.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border shadow-lg">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Cuentas Bancarias SOZU
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Catalogo de cuentas propias de SOZU para estados de cuenta
              </p>
            </div>
            {(canCreate || isSuperAdmin) && tableExists && (
              <Button
                onClick={() => { setFormData(EMPTY_FORM); setIsNewDialogOpen(true); }}
                className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:scale-105 font-semibold px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs defaultValue="active" value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className={`grid w-full ${showDeletedTab ? "grid-cols-2" : "grid-cols-1"} mb-6`}>
              <TabsTrigger value="active">Activas ({activeCuentas.length})</TabsTrigger>
              {showDeletedTab && (
                <TabsTrigger value="deleted">Eliminadas ({deletedCuentas.length})</TabsTrigger>
              )}
            </TabsList>

            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Buscar por banco, alias o numero de cuenta..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 border-border focus:ring-primary/20"
                />
              </div>
            </div>

            <TabsContent value="active" className="mt-6">
              {renderTable()}
              {renderPagination()}
            </TabsContent>

            <TabsContent value="deleted" className="mt-6">
              {renderTable()}
              {renderPagination()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Nueva Cuenta Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            {renderForm(true)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsNewDialogOpen(false); setFormData(EMPTY_FORM); }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!formData.bancoId || !formData.alias.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar Cuenta Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            {renderForm(false)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEditDialogOpen(false); setFormData(EMPTY_FORM); setEditingCuenta(null); }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!formData.bancoId || !formData.alias.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => { if (cuentaToDelete) deleteMutation.mutate(cuentaToDelete.id); }}
        title="Eliminar cuenta"
        description={`Esta accion desactivara la cuenta "${cuentaToDelete?.alias}". Los estados de cuenta existentes no se veran afectados.`}
      />

      {/* Restaurar */}
      <DeleteConfirmationDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        onConfirm={() => { if (cuentaToRestore) restoreMutation.mutate(cuentaToRestore.id); }}
        title="Restaurar cuenta"
        description={`Restaurar la cuenta "${cuentaToRestore?.alias}" y hacerla disponible nuevamente.`}
      />
    </div>
  );
}
