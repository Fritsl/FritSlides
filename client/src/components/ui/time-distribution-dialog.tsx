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
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p className="mb-2">Tips:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hover over chart segments to see detailed timing information</li>
            <li>Add time markers to notes to track presentation pace</li>
            <li>The chart shows time between consecutive time markers</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};