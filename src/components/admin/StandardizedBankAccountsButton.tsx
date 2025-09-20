import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BankAccountsSection } from "./BankAccountsSection";
import { useState } from "react";

interface StandardizedBankAccountsButtonProps {
  personId: number;
  personName: string;
  projectId?: number;
  showStpCheckbox?: boolean;
}

export function StandardizedBankAccountsButton({ 
  personId, 
  personName, 
  projectId,
  showStpCheckbox = false 
}: StandardizedBankAccountsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsOpen(true)}
        className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
        title="Gestionar cuentas bancarias"
      >
        💳
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Cuentas Bancarias - {personName}
            </DialogTitle>
          </DialogHeader>
          <BankAccountsSection 
            personId={personId} 
            showStpCheckbox={showStpCheckbox}
            projectId={projectId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}