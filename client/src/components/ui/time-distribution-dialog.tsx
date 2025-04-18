import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Note } from "@shared/schema";
import { TimeDistributionChart } from "./time-distribution-chart";

interface TimeDistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  projectName: string;
}

export const TimeDistributionDialog: React.FC<TimeDistributionDialogProps> = ({
  isOpen,
  onClose,
  notes,
  projectName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Time Distribution - {projectName}</DialogTitle>
          <DialogDescription>
            This chart shows how presentation time is distributed across your content sections.
            Each segment represents the time allocated between consecutive time markers.
          </DialogDescription>
        </DialogHeader>
        
        <TimeDistributionChart notes={notes} />
      </DialogContent>
    </Dialog>
  );
};