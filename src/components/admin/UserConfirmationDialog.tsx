import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Building, Briefcase, FileText, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserToCreate {
  email: string;
  nombre: string;
  rol: string;
  tipo: 'inmobiliaria' | 'rep_legal' | 'rep_comercial';
}

interface UserConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  usersToCreate: UserToCreate[];
  isLoading: boolean;
  inmobiliariaNombre: string;
}

export function UserConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  usersToCreate,
  isLoading,
  inmobiliariaNombre
}: UserConfirmationDialogProps) {
  const getIconForType = (tipo: UserToCreate['tipo']) => {
    switch (tipo) {
      case 'inmobiliaria':
        return <Building className="h-5 w-5 text-primary" />;
      case 'rep_legal':
        return <FileText className="h-5 w-5 text-amber-500" />;
      case 'rep_comercial':
        return <Briefcase className="h-5 w-5 text-emerald-500" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getLabelForType = (tipo: UserToCreate['tipo']) => {
    switch (tipo) {
      case 'inmobiliaria':
        return 'Usuario Inmobiliaria';
      case 'rep_legal':
        return 'Representante Legal';
      case 'rep_comercial':
        return 'Representante Comercial';
      default:
        return 'Usuario';
    }
  };

  const getBadgeVariant = (tipo: UserToCreate['tipo']) => {
    switch (tipo) {
      case 'inmobiliaria':
        return 'default';
      case 'rep_legal':
        return 'secondary';
      case 'rep_comercial':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Confirmar Creación de Usuarios
          </DialogTitle>
          <DialogDescription>
            Al crear la inmobiliaria <strong>"{inmobiliariaNombre}"</strong>, se generarán automáticamente los siguientes usuarios:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {usersToCreate.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No se crearán usuarios adicionales
            </div>
          ) : (
            usersToCreate.map((user, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIconForType(user.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {user.nombre}
                    </span>
                    <Badge variant={getBadgeVariant(user.tipo)} className="text-xs">
                      {getLabelForType(user.tipo)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Rol: {user.rol}
                  </div>
                </div>
              </div>
            ))
          )}

          {usersToCreate.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Contraseña temporal:</strong> Temporal123!
                  <p className="text-xs mt-1 text-amber-700/80 dark:text-amber-300/80">
                    Los usuarios deberán cambiar su contraseña en el primer inicio de sesión.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar y Crear
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
