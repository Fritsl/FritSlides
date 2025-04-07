import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReactNode } from "react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  isPending?: boolean;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  extraContent?: ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  isPending = false,
  confirmVariant = "default",
  extraContent,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        {extraContent && (
          <div className="mt-4">
            {extraContent}
          </div>
        )}
        
        <DialogFooter className="flex sm:justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelText}
          </Button>
          <Button 
            variant={confirmVariant} 
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
