import React from 'react';
import { Note } from '@shared/schema';
import { timeToMinutes } from '@/lib/time-utils';

interface TimeDebugPanelProps {
  currentNote: Note | null;
  nextTimedSlide: Note | null;
  flattenedNotes: Note[];
  currentSlideIndex: number;
}

export function TimeDebugPanel({ 
  currentNote, 
  nextTimedSlide, 
  flattenedNotes, 
  currentSlideIndex 
}: TimeDebugPanelProps) {
  
  const startTime = currentNote?.time || '—';
  const endTime = nextTimedSlide?.time || '—';
  
  // Calculate total time between current note and next timed note
  const totalTime = React.useMemo(() => {
    if (!currentNote?.time || !nextTimedSlide?.time) return '—';
    
    const startMin = timeToMinutes(currentNote.time);
    const endMin = timeToMinutes(nextTimedSlide.time);
    let totalMin = endMin - startMin;
    
    // Adjust for time wrapping to next day
    if (totalMin < 0) totalMin += 24 * 60; 
    
    const hours = Math.floor(totalMin / 60);
    const mins = Math.floor(totalMin % 60);
    const secs = Math.round((totalMin % 1) * 60);
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [currentNote?.time, nextTimedSlide?.time]);
  
  // Calculate notes to spend time on
  const notesToSpend = React.useMemo(() => {
    if (currentNote?.time && nextTimedSlide) {
      const nextIndex = flattenedNotes.findIndex(n => n.id === nextTimedSlide.id);
      if (nextIndex < 0) return '—';
      return nextIndex - currentSlideIndex;
    }
    return '—';
  }, [currentNote, nextTimedSlide, flattenedNotes, currentSlideIndex]);
  
  // Current note position (always 1 if we're on a timed note)
  const currentNoteOfThese = React.useMemo(() => {
    if (currentNote?.time) {
      return '1'; // We're the first note in the range (position 1, not 0)
    }
    return '—';
  }, [currentNote]);
  
  // Calculate result (time difference for display)
  const result = React.useMemo(() => {
    if (currentNote?.time && nextTimedSlide?.time) {
      const startMin = timeToMinutes(currentNote.time);
      const endMin = timeToMinutes(nextTimedSlide.time);
      let totalMin = endMin - startMin;
      if (totalMin < 0) totalMin += 24 * 60;
      
      const hours = Math.floor(totalMin / 60);
      const mins = Math.floor(totalMin % 60);
      const secs = Math.round((totalMin % 1) * 60);
      
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return '—';
  }, [currentNote, nextTimedSlide]);
  
  return (
    <div className="bg-gray-800 p-2 rounded text-[9px] sm:text-xs">
      <div className="grid grid-cols-2 gap-x-1 font-mono text-white">
        <div className="text-green-400 font-semibold whitespace-nowrap">Start Time:</div>
        <div>{startTime}</div>
        
        <div className="text-green-400 font-semibold whitespace-nowrap">End Time:</div>
        <div>{endTime}</div>
        
        <div className="text-green-400 font-semibold whitespace-nowrap">Total Time to spend:</div>
        <div>{totalTime}</div>
        
        <div className="text-green-400 font-semibold whitespace-nowrap">Notes to spend on time:</div>
        <div>{notesToSpend}</div>
        
        <div className="text-green-400 font-semibold whitespace-nowrap">Current Note of these:</div>
        <div>{currentNoteOfThese}</div>
        
        <div className="text-green-400 font-semibold whitespace-nowrap">Result is:</div>
        <div>{result}</div>
      </div>
    </div>
  );
}