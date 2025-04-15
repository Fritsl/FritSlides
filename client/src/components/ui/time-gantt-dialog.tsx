import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Note } from '@shared/schema';
import TimeGanttChart from './time-gantt-chart';

interface TimeGanttDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  projectName: string;
}

export default function TimeGanttDialog({ isOpen, onClose, notes, projectName }: TimeGanttDialogProps) {
  // Filter notes to only include those with time values
  const timedNotes = notes.filter(note => note.time);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Timeline View: {projectName}</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Visualizes your timed notes in a timeline (Gantt) chart.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-[400px] w-full">
          {timedNotes.length > 0 ? (
            <div className="w-full">
              <TimeGanttChart 
                notes={notes} 
                projectName={projectName} 
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-80 text-slate-500">
              No timed notes found in this project. Add time values to your notes to see them in the timeline.
            </div>
          )}
        </div>
        
        <DialogFooter className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {timedNotes.length} timed notes in this project
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}