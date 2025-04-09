import { Note } from "@shared/schema";

/**
 * Convert HH:MM time format to minutes
 */
export function timeToMinutes(time: string): number {
  if (!time || time.trim() === '') return 0;
  const parts = time.split(':').map(part => parseInt(part.trim(), 10));
  if (parts.length === 1) return parts[0]; // Just minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // Hours and minutes
  return 0; // Invalid format
}

/**
 * Convert minutes to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate time per slide in minutes
 */
export function calculateTimePerSlide(totalTimeInMinutes: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  return totalTimeInMinutes / slideCount;
}

interface TimeInfo {
  slideCount: number;
  totalMinutes: number;
  minutesPerSlide: number;
  formattedPerSlide: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Find the next timed note in the hierarchy
 * @param notes All notes
 * @param currentNoteId ID of the current note
 * @param noteOrder Ordering of notes (if any)
 */
export function findNextTimedNote(
  notes: Note[],
  currentNoteId: number,
  noteOrder: number[] | null = null
): Note | null {
  // Get the current note
  const currentNote = notes.find(note => note.id === currentNoteId);
  if (!currentNote) return null;

  // If we have an explicit note order, use it
  if (noteOrder && noteOrder.length > 0) {
    const currentIndex = noteOrder.findIndex(id => id === currentNoteId);
    if (currentIndex === -1 || currentIndex === noteOrder.length - 1) return null;
    
    // Look for the next timed note in the order
    for (let i = currentIndex + 1; i < noteOrder.length; i++) {
      const nextNote = notes.find(note => note.id === noteOrder[i]);
      if (nextNote && nextNote.time && typeof nextNote.time === 'string' && nextNote.time.trim() !== '') {
        return nextNote;
      }
    }
    return null;
  }
  
  // Otherwise, we need to do a tree traversal
  // Create a map of notes by their parent IDs
  const notesByParent = new Map<number | null, Note[]>();
  notes.forEach(note => {
    const parentId = note.parentId;
    if (!notesByParent.has(parentId)) {
      notesByParent.set(parentId, []);
    }
    notesByParent.get(parentId)!.push(note);
  });
  
  // Order notes within each parent by their order property
  notesByParent.forEach(childNotes => {
    childNotes.sort((a, b) => Number(a.order) - Number(b.order));
  });
  
  // Function to find the next timed note in a depth-first traversal
  const findNextTimed = (
    noteId: number,
    visitedIds = new Set<number>()
  ): Note | null => {
    visitedIds.add(noteId);
    
    // Get the parent of the current note
    const note = notes.find(n => n.id === noteId);
    if (!note) return null;
    
    const parentId = note.parentId;
    const siblings = notesByParent.get(parentId) || [];
    
    // Find the current note's position among its siblings
    const siblingIndex = siblings.findIndex(n => n.id === noteId);
    
    // Look at the next siblings first
    for (let i = siblingIndex + 1; i < siblings.length; i++) {
      const sibling = siblings[i];
      
      // Check if this sibling has a time marker
      if (sibling.time && typeof sibling.time === 'string' && sibling.time.trim() !== '') {
        return sibling;
      }
      
      // Otherwise, check this sibling's children depth-first
      const siblingChildren = notesByParent.get(sibling.id) || [];
      for (const child of siblingChildren) {
        if (visitedIds.has(child.id)) continue;
        
        // Depth-first: check this child and all its descendants
        if (child.time && typeof child.time === 'string' && child.time.trim() !== '') {
          return child;
        }
        
        const foundInDescendants = findNextTimed(child.id, visitedIds);
        if (foundInDescendants) return foundInDescendants;
      }
    }
    
    // If no next timed note found among siblings, go up to the parent's next sibling
    if (parentId !== null && !visitedIds.has(parentId)) {
      return findNextTimed(parentId, visitedIds);
    }
    
    return null;
  };
  
  // Start the search from the current note
  return findNextTimed(currentNoteId);
}

/**
 * Count notes between two timed notes (inclusive of start, exclusive of end)
 */
export function countNotesBetween(
  notes: Note[],
  startNoteId: number,
  endNoteId: number,
  noteOrder: number[] | null = null
): number {
  // If we have an explicit note order, use it
  if (noteOrder && noteOrder.length > 0) {
    const startIndex = noteOrder.findIndex(id => id === startNoteId);
    const endIndex = noteOrder.findIndex(id => id === endNoteId);
    
    if (startIndex === -1 || endIndex === -1) return 0;
    return endIndex - startIndex;
  }
  
  // Otherwise, we need to do a tree traversal to count nodes
  // Build note tree structure
  const notesByParent = new Map<number | null, Note[]>();
  notes.forEach(note => {
    const parentId = note.parentId;
    if (!notesByParent.has(parentId)) {
      notesByParent.set(parentId, []);
    }
    notesByParent.get(parentId)!.push(note);
  });
  
  // Order notes within each parent
  notesByParent.forEach(childNotes => {
    childNotes.sort((a, b) => Number(a.order) - Number(b.order));
  });
  
  let count = 0;
  let foundStart = false;
  let foundEnd = false;
  
  // Traverse the tree in depth-first order
  const traverse = (noteId: number | null = null): boolean => {
    const children = notesByParent.get(noteId) || [];
    
    for (const child of children) {
      // Check if this is the starting note
      if (child.id === startNoteId) {
        foundStart = true;
        count = 1; // Include the start note
      }
      
      // Check if this is the ending note
      else if (child.id === endNoteId) {
        foundEnd = true;
        return true; // Stop traversal
      }
      
      // If we've found the start but not the end, increment count
      else if (foundStart && !foundEnd) {
        count++;
      }
      
      // Traverse this child's descendants
      if (traverse(child.id)) {
        return true; // Stop if we found the end
      }
    }
    
    return false;
  };
  
  // Start traversal from root
  traverse(null);
  
  return count;
}

/**
 * Calculate time information for a note with time markers
 */
export function calculateTimeInfo(
  notes: Note[],
  noteId: number,
  noteOrder: number[] | null = null
): TimeInfo | null {
  const currentNote = notes.find(note => note.id === noteId);
  if (!currentNote || !currentNote.time || typeof currentNote.time !== 'string' || currentNote.time.trim() === '') {
    return null;
  }
  
  // Find the next timed note
  const nextTimedNote = findNextTimedNote(notes, noteId, noteOrder);
  if (!nextTimedNote) {
    return null; // No next timed note found
  }
  
  // Count slides between the two time points
  const slideCount = countNotesBetween(notes, noteId, nextTimedNote.id, noteOrder);
  if (slideCount <= 0) {
    return null; // No slides between time points
  }
  
  // Calculate time difference
  const startTimeMinutes = timeToMinutes(currentNote.time || '');
  const endTimeMinutes = timeToMinutes(nextTimedNote.time || '');
  let totalMinutes = endTimeMinutes - startTimeMinutes;
  
  // Handle cases where end time is on the next day (e.g., start at 23:00, end at 01:00)
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // Add a full day
  }
  
  // Calculate time per slide
  const minutesPerSlide = calculateTimePerSlide(totalMinutes, slideCount);
  const formattedPerSlide = minutesToTime(minutesPerSlide);
  
  return {
    slideCount,
    totalMinutes,
    minutesPerSlide,
    formattedPerSlide,
    startTime: currentNote.time || '',
    endTime: nextTimedNote.time || ''
  };
}