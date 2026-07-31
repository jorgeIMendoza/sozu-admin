import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export type CampoConfig = {
  key: string;
  label: string;
  tipo: "text" | "number" | "switch" | "select";
  opciones?: { value: string; label: string }[];
};

type Registro = Record<string, unknown> & { id: string };

export function CrudSection<T extends Registro>({
  titulo,
  descripcion,
  campos,
  items,
  nuevo,
  onGuardar,
  onEliminar,
  render,
  soloLectura = false,
}: {
  titulo: string;
  descripcion: string;
  campos: CampoConfig[];
  items: T[];
  nuevo: () => T;
  onGuardar: (item: T) => void;
  onEliminar: (id: string) => void;
  render?: (item: T, campo: CampoConfig) => React.ReactNode;
  soloLectura?: boolean;
}) {
  const [editando, setEditando] = useState<T | null>(null);

  const setCampo = (key: string, value: unknown) =>
    setEditando((e) => (e ? ({ ...e, [key]: value } as T) : e));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        {!soloLectura && (
          <Button onClick={() => setEditando(nuevo())}>
            <Plus className="size-4" /> Nuevo
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {campos.map((c) => (
                <TableHead
                  key={c.key}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {c.label}
                </TableHead>
              ))}
              {!soloLectura && <TableHead className="w-24 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={campos.length + 1}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Sin registros.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                {campos.map((c) => (
                  <TableCell key={c.key} className="text-sm">
                    {render
                      ? render(item, c)
                      : typeof item[c.key] === "boolean"
                        ? item[c.key]
                          ? "Sí"
                          : "No"
                        : String(item[c.key] ?? "")}
                  </TableCell>
                ))}
                {!soloLectura && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditando({ ...item })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        onEliminar(item.id);
                        toast.success("Registro eliminado");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-4">
              {campos.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label>{c.label}</Label>
                  {c.tipo === "switch" ? (
                    <div className="pt-1">
                      <Switch
                        checked={Boolean(editando[c.key])}
                        onCheckedChange={(v) => setCampo(c.key, v)}
                      />
                    </div>
                  ) : c.tipo === "select" ? (
                    <Select
                      value={String(editando[c.key] ?? "")}
                      onValueChange={(v) => setCampo(c.key, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {c.opciones?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={c.tipo === "number" ? "number" : "text"}
                      value={String(editando[c.key] ?? "")}
                      onChange={(e) =>
                        setCampo(
                          c.key,
                          c.tipo === "number" ? Number(e.target.value) : e.target.value,
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editando) onGuardar(editando);
                setEditando(null);
                toast.success("Cambios guardados");
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}