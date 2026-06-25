import { Construction } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
}

const ComingSoon = ({ title = "Próximamente", description = "Esta vista del Portal de Productos se está construyendo." }: Props) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
    <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
      <Construction className="size-7" />
    </div>
    <div>
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>
    </div>
  </div>
);

export default ComingSoon;