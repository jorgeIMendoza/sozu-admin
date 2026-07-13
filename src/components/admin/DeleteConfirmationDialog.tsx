import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  actionType?: 'delete' | 'restore';
  warningMessage?: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  isLoading = false,
  actionType = 'delete',
  warningMessage,
}: DeleteConfirmationDialogProps) {
  const isRestore = actionType === 'restore';
  const buttonText = isRestore ? 'Confirmar' : 'Eliminar';
  const loadingText = isRestore ? 'Restaurando...' : 'Eliminando...';
  const buttonClass = isRestore 
    ? 'bg-green-600 text-white hover:bg-green-700' 
    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
          {warningMessage && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
              <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
                {warningMessage}
              </p>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isLoading}
            className={buttonClass}
          >
            {isLoading ? loadingText : buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}