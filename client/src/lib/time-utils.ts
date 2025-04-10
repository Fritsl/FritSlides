import { Note } from "@shared/schema";

/**
 * Interface for tracking position between timed slides
 */
export interface PacingInfo {
  previousTimedNote: Note | null;
  nextTimedNote: Note | null;
  percentComplete: number;  // 0-1 progress between time markers
  expectedSlideIndex: number;  // Estimated slide we should be on
  slideDifference: number;  // How many slides ahead/behind we are
  shouldShow: boolean;  // Whether we have enough info to show the indicator
}

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
 * This is critical for time calculations - it returns a decimal number of minutes
 */
export function timeToMinutes(time: string): number {
  if (!time || typeof time !== 'string' || time.trim() === '') return 0;
  
  try {
    // If time doesn't have a colon, format it
    if (!time.includes(':')) {
      time = formatTimeString(time);
    }
    
    const parts = time.split(':').map(part => {
      const parsedValue = parseInt(part.trim(), 10);
      return isNaN(parsedValue) ? 0 : parsedValue; // Ensure we only use valid numbers
    });
    
    if (parts.length === 1) return parts[0]; // Just minutes
    if (parts.length === 2) {
      const hours = parts[0];
      const minutes = parts[1];
      
      // Validate the parts to ensure they're in a reasonable range
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 60 + minutes; // Convert hours to minutes and add minutes
      } else {
        console.warn('Invalid time format (out of range):', time);
      }
    }
  } catch (err) {
    console.warn('Error converting time to minutes:', time, err);
  }
  
  return 0; // Invalid format or error occurred
}

/**
 * Convert minutes to a human-readable format with appropriate units
 * For per-slide time display
 */
export function minutesToTime(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) {
    return "0 min"; // Return a valid default for invalid inputs
  }
  
  // If the value is very large (more than 60 minutes), display just minutes
  if (minutes > 60) {
    return Math.round(minutes) + " min"; // Just show minutes for very large values
  }
  
  // Extract whole minutes and decimal part
  const totalSeconds = Math.round(minutes * 60);
  
  // Format with explicit units
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  
  // Return with explicit units to avoid confusion (MM:SS could be misinterpreted as hours:minutes)
  if (mins > 0 && secs > 0) {
    return `${mins}m ${secs}s`; // Example: "22m 30s"
  } else if (mins > 0) {
    return `${mins} min`; // Example: "22 min"
  } else {
    return `${secs} sec`; // Example: "45 sec"
  }
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
  
  // We already have a check above for nextTimedNote

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
  
  // Ensure we have a minimum time difference (at least 1 minute) to avoid division by zero issues
  if (totalMinutes < 1) {
    totalMinutes = 1;
  }
  
  // Calculate time per slide - ensure at least 1 second per slide
  let minutesPerSlide = calculateTimePerSlide(totalMinutes, slideCount);
  if (minutesPerSlide < 1/60) {
    minutesPerSlide = 1/60; // Minimum of 1 second per slide
  }
  
  const formattedPerSlide = minutesToTime(minutesPerSlide);
  
  // Create a human-readable average time format
  const minutes = Math.floor(minutesPerSlide);
  const seconds = Math.round((minutesPerSlide - minutes) * 60);
  
  // Handle case where seconds round up to 60
  let displayMinutes = minutes;
  let displaySeconds = seconds;
  if (seconds === 60) {
    displayMinutes += 1;
    displaySeconds = 0;
  }
  
  const averageTimePerSlide = displayMinutes > 0 
    ? `${displayMinutes} min${displayMinutes > 1 ? 's' : ''} ${displaySeconds > 0 ? displaySeconds + ' sec' : ''}` 
    : `${displaySeconds} second${displaySeconds !== 1 ? 's' : ''}`;
  
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

/**
 * Find the previous timed note in the fully expanded hierarchy
 * 
 * @param notes All notes
 * @param noteOrder Ordering of notes in presentation
 * @param currentSlideIndex The current slide index in the presentation
 */
export function findPreviousTimedNote(
  notes: Note[],
  noteOrder: number[],
  currentSlideIndex: number
): Note | null {
  if (!noteOrder.length || currentSlideIndex <= 0 || currentSlideIndex >= noteOrder.length) {
    return null;
  }
  
  // Look backward from current index for a note with a time
  for (let i = currentSlideIndex - 1; i >= 0; i--) {
    const noteId = noteOrder[i];
    const note = notes.find(n => n.id === noteId);
    
    if (note && note.time && typeof note.time === 'string' && note.time.trim() !== '') {
      return note;
    }
  }
  
  return null; // No previous timed note found
}

/**
 * Calculate the slide pacing information based on position between timed notes
 * 
 * @param notes All available notes
 * @param presentationOrder Array of note IDs in presentation order
 * @param currentSlideIndex Current slide index in presentation
 * @returns Pacing information for rendering the indicator
 */
export function calculatePacingInfo(
  notes: Note[],
  presentationOrder: number[],
  currentSlideIndex: number
): PacingInfo {
  // Initialize default result - no indicators shown
  const defaultResult: PacingInfo = {
    previousTimedNote: null,
    nextTimedNote: null,
    percentComplete: 0,
    expectedSlideIndex: currentSlideIndex,
    slideDifference: 0,
    shouldShow: false
  };
  
  // Safety check for invalid inputs
  if (!notes || !Array.isArray(notes) || notes.length === 0 || 
      !presentationOrder || !Array.isArray(presentationOrder) || presentationOrder.length === 0 ||
      typeof currentSlideIndex !== 'number' || currentSlideIndex < 0 || 
      currentSlideIndex >= presentationOrder.length) {
    console.warn('Pacing info calculation skipped due to invalid inputs');
    return defaultResult;
  }
  
  // Get the current note
  const currentNoteId = presentationOrder[currentSlideIndex];
  const currentNote = notes.find(n => n.id === currentNoteId);
  
  // Find the previous timed note (note with time before current slide)
  const previousTimedNote = findPreviousTimedNote(notes, presentationOrder, currentSlideIndex);
  
  // Find the next timed note (note with time after current slide)
  let nextTimedNote: Note | null = null;
  
  // Look forward in the presentation order to find a note with a time marker
  for (let i = currentSlideIndex + 1; i < presentationOrder.length; i++) {
    const noteId = presentationOrder[i];
    const note = notes.find(n => n.id === noteId);
    
    if (note && note.time && note.time.trim() !== '') {
      nextTimedNote = note;
      break;
    }
  }
  
  // Determine whether to show the time indicator dots
  let shouldShow = false;
  
  // We should only show time indicators:
  // 1. When we're between timed slides (in progress between start/end time points)
  // 2. When we're on a slide that has a time marker (except for the first and last slides)
  
  // CASE 1: We're between two timed notes - ALWAYS show
  if (previousTimedNote && nextTimedNote) {
    shouldShow = true;
  }
  // CASE 2: Current slide has time and it's not the first or last timed slide
  else if (currentNote && currentNote.time && currentNote.time.trim() !== '') {
    // Count how many timed notes we have in total
    const timedNotes = notes.filter(n => n.time && n.time.trim() !== '');
    // Don't show dots on the first or last timed slide
    if (timedNotes.length >= 3) {
      // Find this note's position in the timed notes sequence
      const position = timedNotes.findIndex(n => n.id === currentNote.id);
      // Only show if it's not the first or last position
      if (position > 0 && position < timedNotes.length - 1) {
        shouldShow = true;
      }
    }
  }
  // All other slides (non-timed slides not between timed points) - don't show indicators
  
  // If we shouldn't show indicators, return early
  if (!shouldShow) {
    return {
      ...defaultResult,
      shouldShow: false
    };
  }
  
  // CASE: We're on a timed note (dot should never appear exactly on the timed slide)
  // Only handle special cases if we should show dots - otherwise we already returned early
  
  // CASE: Single Timed Note - Current note has time but no next timed note
  if (currentNote && currentNote.time && currentNote.time.trim() !== '' && !nextTimedNote) {
    // We shouldn't be showing dots for this case based on our criteria above,
    // but just in case this logic changes in the future, we'll still handle it
    return {
      previousTimedNote: currentNote,
      nextTimedNote: null,
      percentComplete: 0,
      expectedSlideIndex: currentSlideIndex,
      slideDifference: 0,
      shouldShow: false // Never show for the last timed slide
    };
  }
  
  // CASE: Only have a next timed note but no previous one
  if (!previousTimedNote && nextTimedNote) {
    return {
      previousTimedNote: null,
      nextTimedNote,
      percentComplete: 0,
      expectedSlideIndex: currentSlideIndex,
      slideDifference: 0,
      shouldShow: false // Never show for the first timed slide
    };
  }
  
  // CASE: Only have a previous timed note but no next one
  if (previousTimedNote && !nextTimedNote) {
    return {
      previousTimedNote,
      nextTimedNote: null,
      percentComplete: 1, // We've completed all timed notes
      expectedSlideIndex: currentSlideIndex,
      slideDifference: 0,
      shouldShow: false // Never show for the last timed slide
    };
  }
  
  // MAIN CASE: We're between two timed notes - calculate position using linear interpolation
  
  // Find the previous and next note indices in the presentation order
  const prevIndex = presentationOrder.indexOf(previousTimedNote!.id);
  const nextIndex = presentationOrder.indexOf(nextTimedNote!.id);
  
  // Calculate how many slides are between the timed notes
  const slidesBetween = nextIndex - prevIndex;
  
  if (slidesBetween <= 0) {
    // Invalid sequence - shouldn't happen but defend against it
    return defaultResult;
  }
  
  // Calculate how far along we are between the timed notes (0-1)
  const progress = (currentSlideIndex - prevIndex) / slidesBetween;
  
  // Simple, straightforward approach: position is directly proportional to progress
  // Progress goes from 0 to 1 as we move through slides between timed markers
  const timePosition = progress;
  
  // Determine our position information for the UI
  return {
    previousTimedNote,
    nextTimedNote,
    percentComplete: progress,
    expectedSlideIndex: currentSlideIndex, // We're exactly where we should be
    slideDifference: 0, // No slide difference since we're not comparing to wall clock
    shouldShow: true
  };
}
