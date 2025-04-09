import React from 'react';
import { Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Note } from '@shared/schema';
import { calculateTimeInfo } from '@/lib/time-utils';

interface TimeDisplayProps {
  note: Note;
  notes: Note[];
  className?: string;
  compact?: boolean;
}

export function TimeDisplay({ note, notes, className = '', compact = false }: TimeDisplayProps) {
  // Only process notes that have time set
  if (!note.time || note.time.trim() === '') {
    return null;
  }

  // Calculate time info
  const timeInfo = calculateTimeInfo(notes, note.id);
  
  // If we couldn't calculate time info (no next timed note), just show the clock
  if (!timeInfo) {
    return (
      <div className={`flex items-center ${className}`}>
        <Clock size={compact ? 14 : 16} className="text-yellow-300 mr-1" />
        <span className="text-yellow-200 text-xs">{note.time}</span>
      </div>
    );
  }

  // Full display with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center cursor-help ${className}`}>
            <Clock size={compact ? 14 : 16} className="text-yellow-300 mr-1" />
            {compact ? (
              // Compact view (just time and slide count)
              <span className="text-yellow-200 text-xs flex items-center">
                {note.time} · {timeInfo.slideCount} slides · Sausage · Sausage
              </span>
            ) : (
              // Full view
              <span className="text-yellow-200 text-xs flex items-center">
                {timeInfo.slideCount} slides, {timeInfo.totalMinutes} min
                <span className="mx-1">·</span>
                <span className="whitespace-nowrap">({timeInfo.formattedPerSlide} MM:SS per slide, {timeInfo.averageTimePerSlide})</span>
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-white border-slate-700">
          <div className="p-1">
            <div className="flex justify-between mb-1">
              <span className="font-semibold mr-4">Time allocation:</span>
              <span>{timeInfo.startTime} → {timeInfo.endTime}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-slate-300">Slides:</span>
              <span>{timeInfo.slideCount}</span>
              <span className="text-slate-300">Total time:</span>
              <span>{timeInfo.totalMinutes} minutes</span>
              <span className="text-slate-300">Per slide:</span>
              <span>{timeInfo.averageTimePerSlide}</span>
              <span className="text-slate-300">Time format:</span>
              <span>{timeInfo.formattedPerSlide}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}