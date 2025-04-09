import { Note } from "@shared/schema";

/**
 * Ensures time is in HH:MM format with colon
 * This function FORCES a colon into the time string regardless of input format
 */
export function formatTimeString(time: string): string {
  if (!time || time.trim() === '') return '';
  
  // First, check if there's already a colon
  if (time.includes(':')) {
    // Already has a colon, ensure proper formatting
    const parts = time.split(':');
    if (parts.length === 2) {
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  
  // Remove any non-digit characters
  const digitsOnly = time.replace(/[^\d]/g, '');
  
  if (digitsOnly.length <= 2) {
    // Just minutes, format as 00:MM
    return `00:${digitsOnly.padStart(2, '0')}`;
  } else if (digitsOnly.length <= 4) {
    // Format as HH:MM
    const minutes = digitsOnly.slice(-2).padStart(2, '0');
    const hours = digitsOnly.slice(0, digitsOnly.length - 2).padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    // More than 4 digits, truncate and format
    const minutes = digitsOnly.slice(-2).padStart(2, '0');
    const hours = digitsOnly.slice(-4, -2).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Convert HH:MM time format to minutes
 */
export function timeToMinutes(time: string): number {
  if (!time || time.trim() === '') return 0;
  
  // If time doesn't have a colon, format it
  if (!time.includes(':')) {
    time = formatTimeString(time);
  }
  
  const parts = time.split(':').map(part => parseInt(part.trim(), 10));
  if (parts.length === 1) return parts[0]; // Just minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // Hours and minutes
  return 0; // Invalid format
}

/**
 * Convert minutes to MM:SS format with seconds precision
 * For per-slide time display
 */
export function minutesToTime(minutes: number): string {
  // Extract whole minutes and decimal part
  const totalSeconds = Math.round(minutes * 60);
  
  // Format as MM:SS
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  
  // Return as MM:SS format - always include both minutes and seconds
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate time per slide in minutes
 */
export function calculateTimePerSlide(totalTimeInMinutes: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  return totalTimeInMinutes / slideCount;
}

export interface TimeInfo {
  slideCount: number;
  totalMinutes: number;
  minutesPerSlide: number;
  formattedPerSlide: string;
  averageTimePerSlide: string;  // Human-readable average time per slide
  startTime: string | null;
  endTime: string | null;
}

/**
 * Create a flattened list of note IDs that represents the fully expanded hierarchy
 * This is the order notes would appear in when all are expanded
 */
function createFlattenedNoteList(notes: Note[]): number[] {
  const flattenedNotes: number[] = [];
  
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
  
  // Function to flatten hierarchy in the correct viewing order
  const flattenHierarchy = (parentId: number | null): void => {
    const children = notesByParent.get(parentId) || [];
    
    for (const child of children) {
      flattenedNotes.push(child.id);
      // Recursively add all descendants immediately after their parent
      flattenHierarchy(child.id);
    }
  };
  
  // Flatten the entire hierarchy starting from root
  flattenHierarchy(null);
  
  return flattenedNotes;
}

/**
 * Find the next timed note in the fully expanded hierarchy
 * This considers all slides in a fully expanded view, including deep children.
 * The "next" slide is defined as the next slide that would appear when navigating
 * forwards in presentation mode, regardless of its position in the hierarchy.
 * 
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
  
  // Get flat order of expanded notes
  const flattenedNotes = createFlattenedNoteList(notes);
  
  // Find the current note's position in the flattened list
  const currentIndex = flattenedNotes.indexOf(currentNoteId);
  if (currentIndex === -1 || currentIndex === flattenedNotes.length - 1) {
    return null; // Not found or last note
  }
  
  // Look for the next timed note after the current position
  for (let i = currentIndex + 1; i < flattenedNotes.length; i++) {
    const nextNoteId = flattenedNotes[i];
    const nextNote = notes.find(note => note.id === nextNoteId);
    
    if (nextNote && nextNote.time && typeof nextNote.time === 'string' && nextNote.time.trim() !== '') {
      return nextNote;
    }
  }
  
  return null; // No next timed note found
}

/**
 * Count notes between two timed notes (inclusive of start, exclusive of end)
 * This counts all notes in the expanded hierarchy between the two points
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
  
  // Get flat order of expanded notes
  const flattenedNotes = createFlattenedNoteList(notes);
  
  // Find both notes in the flattened list
  const startIndex = flattenedNotes.indexOf(startNoteId);
  const endIndex = flattenedNotes.indexOf(endNoteId);
  
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return 0; // Not found or invalid order
  }
  
  // The count is simply the difference between the indices (including start, excluding end)
  return endIndex - startIndex;
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
  
  // Create a human-readable average time format
  const minutes = Math.floor(minutesPerSlide);
  const seconds = Math.round((minutesPerSlide - minutes) * 60);
  const averageTimePerSlide = minutes > 0 
    ? `${minutes} min${minutes > 1 ? 's' : ''} ${seconds > 0 ? seconds + ' sec' : ''}` 
    : `${seconds} second${seconds !== 1 ? 's' : ''}`;
  
  // Ensure both times are properly formatted with colons
  const formattedStartTime = formatTimeString(currentNote.time || '');
  const formattedEndTime = formatTimeString(nextTimedNote.time || '');
  
  return {
    slideCount,
    totalMinutes,
    minutesPerSlide,
    formattedPerSlide,
    averageTimePerSlide,
    startTime: formattedStartTime,
    endTime: formattedEndTime
  };
}