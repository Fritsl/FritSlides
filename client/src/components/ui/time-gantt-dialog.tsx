import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Note } from "@shared/schema";
import { TimeGanttChart } from "./time-gantt-chart";

interface TimeGanttDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  projectName: string;
}

export const TimeGanttDialog: React.FC<TimeGanttDialogProps> = ({
  isOpen,
  onClose,
  notes,
  projectName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Timeline View - {projectName}</DialogTitle>
          <DialogDescription>
            This Gantt chart shows your presentation timeline with start and end times for each section.
            Each bar represents the time allocated to a specific content section.
          </DialogDescription>
        </DialogHeader>
        
        <TimeGanttChart notes={notes} />
      </DialogContent>
    </Dialog>
  );
};