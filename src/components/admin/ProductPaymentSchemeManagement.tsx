import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreditCard, Eye, Edit, Trash2, GripVertical } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewProductPaymentSchemeDialog } from "./NewProductPaymentSchemeDialog";
import { EditProductPaymentSchemeDialog } from "./EditProductPaymentSchemeDialog";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProductPaymentSchemeManagementProps {
  productId: number;
  productName: string;
}

export const ProductPaymentSchemeManagement = ({ productId, productName }: ProductPaymentSchemeManagementProps) => {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [orderedSchemes, setOrderedSchemes] = useState<any[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Always fetch count for display in the button
  const { data: schemeCount = 0 } = useQuery({
    queryKey: ["product-payment-schemes-count", productId, refreshKey],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("esquemas_pago")
        .select("id", { count: 'exact', head: true })
        .match({ 
          id_producto: productId,
          activo: true,
          es_manual: false 
        });
      
      if (error) {
        console.error("Error fetching product payment schemes count:", error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!productId && productId > 0,
  });

  // Fetch full schemes data when dialog is open
  const { data: schemes, isLoading, refetch } = useQuery({
    queryKey: ["product-payment-schemes", productId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("esquemas_pago")
        .select("*")
        .match({ 
          id_producto: productId,
          activo: true,
          es_manual: false 
        })
        .order("orden", { ascending: true })
        .order("id", { ascending: true });
      
      if (error) {
        console.error("Error fetching product payment schemes:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!productId && productId > 0 && open,
  });

  useEffect(() => {
    if (schemes) setOrderedSchemes(schemes);
  }, [schemes]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedSchemes.findIndex((s) => s.id === active.id);
    const newIndex = orderedSchemes.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedSchemes, oldIndex, newIndex);
    setOrderedSchemes(reordered);

    setIsSavingOrder(true);
    try {
      const updates = reordered.map((s, idx) =>
        supabase
          .from("esquemas_pago")
          .update({ orden: idx + 1 })
          .eq("id", s.id)
      );
      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;

      toast({
        title: "Orden actualizado",
        description: "El orden de los esquemas se guardó correctamente.",
      });
      refetch();
    } catch (error) {
      console.error("Error saving order:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el nuevo orden.",
        variant: "destructive",
      });
      if (schemes) setOrderedSchemes(schemes);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSchemeAdded = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const queryClient = useQueryClient();

  const handleDeleteScheme = async (schemeId: number) => {
    try {
      const { error } = await supabase
        .from("esquemas_pago")
        .update({ activo: false })
        .eq("id", schemeId);

      if (error) throw error;

      toast({
        title: "Esquema eliminado",
        description: "El esquema de pago se ha eliminado exitosamente.",
      });

      handleSchemeAdded();
    } catch (error) {
      console.error("Error deleting payment scheme:", error);
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el esquema de pago.",
        variant: "destructive",
      });
    }
  };

  const DeletePaymentSchemeDialog = ({ scheme }: { scheme: any }) => {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esquema de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el esquema de pago "<strong>{scheme.nombre}</strong>"? 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteScheme(scheme.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const PaymentSchemeDetailsDialog = ({ scheme }: { scheme: any }) => {
    const adjustmentAmount = scheme.porcentaje_descuento_aumento || 0;
    const isIncrement = adjustmentAmount > 0;
    const hasAdjustment = adjustmentAmount !== 0;

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-1" />
            Ver Detalles
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de {scheme.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Enganche:</span> {scheme.porcentaje_enganche}%
              </div>
              <div>
                <span className="font-medium">Mensualidades:</span> {scheme.porcentaje_mensualidades}%
              </div>
              <div>
                <span className="font-medium">Entrega:</span> {scheme.porcentaje_entrega}%
              </div>
              <div>
                <span className="font-medium">No. Mensualidades:</span> {scheme.numero_mensualidades}
              </div>
            </div>
            {hasAdjustment && (
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {isIncrement ? "Incremento:" : "Descuento:"}
                  </span>
                  <Badge 
                    variant="outline"
                    className={`font-medium ${
                      isIncrement 
                        ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700" 
                        : "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700"
                    }`}
                  >
                    {Math.abs(adjustmentAmount)}%
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-3 gap-1.5 hover:bg-primary/10"
        >
          <CreditCard className="h-4 w-4" />
          <Badge 
            variant="secondary" 
            className={`h-5 min-w-[20px] px-1.5 text-xs font-medium ${
              schemeCount > 0 
                ? "bg-primary/20 text-primary" 
                : "bg-muted text-muted-foreground"
            }`}
          >
            {schemeCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Esquemas de Pago - {productName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Gestiona los esquemas de pago para este producto
            </p>
            <NewProductPaymentSchemeDialog 
              productId={productId} 
              onSchemeAdded={handleSchemeAdded} 
            />
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Cargando esquemas de pago...
            </div>
          ) : orderedSchemes && orderedSchemes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {orderedSchemes.length} esquema{orderedSchemes.length !== 1 ? 's' : ''} encontrado{orderedSchemes.length !== 1 ? 's' : ''}
                  <span className="ml-2 text-xs italic">(arrastra para reordenar)</span>
                </p>
                {isSavingOrder && (
                  <span className="text-xs text-muted-foreground">Guardando…</span>
                )}
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedSchemes.map((s) => s.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 gap-4">
                    {orderedSchemes.map((scheme, idx) => (
                      <SortableProductSchemeCard
                        key={scheme.id}
                        scheme={scheme}
                        displayOrder={idx + 1}
                        onUpdated={handleSchemeAdded}
                        DetailsDialog={PaymentSchemeDetailsDialog}
                        DeleteDialog={DeletePaymentSchemeDialog}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay esquemas de pago creados para este producto</p>
                <p className="text-sm text-muted-foreground mt-1">Agrega esquemas de pago para poder generar ofertas precargadas</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ----------------------------------------------------------------------------
// Sortable card component
// ----------------------------------------------------------------------------
interface SortableProductSchemeCardProps {
  scheme: any;
  displayOrder: number;
  onUpdated: () => void;
  DetailsDialog: React.ComponentType<{ scheme: any }>;
  DeleteDialog: React.ComponentType<{ scheme: any }>;
}

const SortableProductSchemeCard = ({
  scheme,
  displayOrder,
  onUpdated,
  DetailsDialog,
  DeleteDialog,
}: SortableProductSchemeCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scheme.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="relative">
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 h-6 min-w-6 px-2 flex items-center justify-center text-xs font-semibold"
        >
          #{displayOrder}
        </Badge>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between pr-10">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Arrastrar para reordenar"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <CreditCard className="h-4 w-4" />
              <span>{scheme.nombre}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex space-x-2">
            <DetailsDialog scheme={scheme} />
            <EditProductPaymentSchemeDialog
              scheme={scheme}
              onSchemeUpdated={onUpdated}
            />
            <DeleteDialog scheme={scheme} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
