import { ArrowLeft } from "lucide-react";

interface PropertyDetailHeaderProps {
  projectName: string;
  unitNumber: string;
  statusLabel: string;
  statusColor: "warning" | "primary" | "success" | "destructive";
  onBack: () => void;
}

const dotColor: Record<string, string> = {
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
};

const textColor: Record<string, string> = {
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
  destructive: "text-destructive",
};

const bgColor: Record<string, string> = {
  warning: "bg-warning/10",
  primary: "bg-primary/10",
  success: "bg-success/10",
  destructive: "bg-destructive/10",
};

const PropertyDetailHeader = ({
  projectName,
  unitNumber,
  statusLabel,
  statusColor,
  onBack,
}: PropertyDetailHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-foreground" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm text-foreground truncate">
              {projectName}
            </h1>
            <p className="text-[11px] text-muted-foreground">Unidad {unitNumber}</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgColor[statusColor]}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor[statusColor]}`} />
          <span className={`text-[10px] font-semibold ${textColor[statusColor]}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </header>
  );
};

export default PropertyDetailHeader;
