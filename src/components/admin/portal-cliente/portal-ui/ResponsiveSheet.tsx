import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  maxWidth?: "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

const ResponsiveSheet = ({
  open,
  onOpenChange,
  children,
  maxWidth = "2xl",
  className = "",
}: ResponsiveSheetProps) => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const maxWClass = {
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  }[maxWidth];

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`p-0 ${maxWClass} max-h-[75dvh] overflow-y-auto rounded-2xl border-border-soft shadow-xl ${className}`}
        >
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`p-0 max-h-[75dvh] overflow-y-auto rounded-t-3xl ${className}`}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
};

export default ResponsiveSheet;
