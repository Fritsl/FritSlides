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
  expectedTimePosition: number; // Expected time progress between 0-1 used for gray dot
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
 * Calculate the slide pacing information based on current time and position
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
  // Initialize default result
  const defaultResult: PacingInfo = {
    previousTimedNote: null,
    nextTimedNote: null,
    percentComplete: 0,
    expectedSlideIndex: currentSlideIndex,
    slideDifference: 0,
    shouldShow: false,
    expectedTimePosition: 0.5 // Default to center
  };
  
  // Verify we have valid inputs
  if (!notes?.length || !presentationOrder?.length || currentSlideIndex < 0 || 
      currentSlideIndex >= presentationOrder.length) {
    return defaultResult;
  }
  
  // We no longer use the real-time clock for pacing
  // Instead, we calculate progress based on current slide position between time markers
  
  // Find the previous and next timed slides
  const previousTimedNote = findPreviousTimedNote(notes, presentationOrder, currentSlideIndex);
  const currentNoteId = presentationOrder[currentSlideIndex];
  const currentNote = notes.find(n => n.id === currentNoteId);
  
  // If current note has a time, use it as previous
  const effectivePreviousNote = 
    (currentNote && currentNote.time && currentNote.time.trim() !== '') 
      ? currentNote 
      : previousTimedNote;

  // Find next timed note
  let nextTimedNoteId: number | null = null;
  let nextTimedNote: Note | null = null;
  
  // Look forward in the presentation order to find a note with a time marker
  for (let i = currentSlideIndex + 1; i < presentationOrder.length; i++) {
    const noteId = presentationOrder[i];
    const note = notes.find(n => n.id === noteId);
    
    if (note && note.time && note.time.trim() !== '') {
      nextTimedNoteId = noteId;
      nextTimedNote = note;
      break;
    }
  }
  
  // Show time indicators if:
  // 1. The current slide has a time marker
  // 2. OR there's a next slide with a time marker
  
  // If current note has a time marker, we can already show basic pacing
  if (currentNote && currentNote.time && currentNote.time.trim() !== '') {
    // We can show indicators, but without certain features that need both previous and next markers
    if (!nextTimedNote) {
      return {
        previousTimedNote: currentNote,
        nextTimedNote: null,
        percentComplete: 0,
        expectedSlideIndex: currentSlideIndex,
        slideDifference: 0,
        shouldShow: true, // Show the indicator even without a next time marker
        expectedTimePosition: 0.5 // Default to center
      };
    }
  }
  
  // If there's a next note with time marker but no previous/current marker, show basic indicator
  if (!effectivePreviousNote && nextTimedNote) {
    return {
      previousTimedNote: null,
      nextTimedNote: nextTimedNote,
      percentComplete: 0,
      expectedSlideIndex: currentSlideIndex,
      slideDifference: 0,
      shouldShow: true, // Show the indicator even without a previous time marker
      expectedTimePosition: 0.5 // Default to center
    };
  }
  
  // If we don't have either a current/previous timed slide OR a next timed slide, don't show indicators
  if (!effectivePreviousNote && !nextTimedNote) {
    return defaultResult;
  }
  
  // At this point, we know both effectivePreviousNote and nextTimedNote are not null
  // Convert time strings to minutes
  const previousTimeMinutes = timeToMinutes(effectivePreviousNote!.time || '');
  const nextTimeMinutes = timeToMinutes(nextTimedNote!.time || '');
  
  // Handle time crossing midnight (e.g., prev=23:00, next=01:00)
  let timeSegmentDuration = nextTimeMinutes - previousTimeMinutes;
  if (timeSegmentDuration < 0) {
    timeSegmentDuration += 24 * 60; // Add a full day
  }
  
  // Find the previous note index in the presentation order
  const previousNoteIndex = effectivePreviousNote!.id === currentNoteId 
    ? currentSlideIndex 
    : presentationOrder.indexOf(effectivePreviousNote!.id);
    
  // Calculate the number of slides between previous and next timed notes
  const nextNoteIndex = presentationOrder.indexOf(nextTimedNoteId!);
  const slidesBetweenTimedNotes = nextNoteIndex - previousNoteIndex;
  
  if (slidesBetweenTimedNotes <= 0) {
    return defaultResult; // Invalid slide sequence
  }
  
  // Instead of using real-time clock, calculate progress based on current slide position
  // between the two time-marked slides
  
  // Calculate percentage of slides completed between the time markers (0-1)
  // If we're at the previous timed note, we're at 0%
  // If we're at the next timed note, we're at 100%
  // If we're somewhere in between, calculate based on position
  const slidesProgress = currentSlideIndex - previousNoteIndex;
  const percentComplete = Math.min(1, Math.max(0, slidesProgress / slidesBetweenTimedNotes));
  
  // Calculate which slide we should be on based on timing
  const slideProgress = slidesBetweenTimedNotes * percentComplete;
  const expectedSlideIndex = Math.round(previousNoteIndex + slideProgress);
  
  // How many slides ahead/behind we are
  const slideDifference = currentSlideIndex - expectedSlideIndex;
  
  // Calculate expected time position for visualization
  // Get the current time from the system
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  const currentTimeString = `${hours}:${mins}`;
  const currentTimeMinutes = timeToMinutes(currentTimeString);
  
  // 1. Time Segment Identification
  // We already have previousTimeMinutes and nextTimeMinutes
  // Start slide is the slide with the previous time marker
  const startSlide = previousNoteIndex;
  // End slide is the slide with the next time marker
  const endSlide = nextNoteIndex;
  
  // Default position is middle (0.5)
  let expectedTimePosition = 0.5;
  
  // Safety check - only calculate if we have valid time markers AND a valid segment
  if (previousTimeMinutes > 0 && nextTimeMinutes > 0 && timeSegmentDuration > 0 && slidesBetweenTimedNotes > 0) {
    try {
      // 2. Progress Calculation - Calculate what percentage through the time segment we are
      let timeProgress = (currentTimeMinutes - previousTimeMinutes) / timeSegmentDuration;
      
      // Handle overnight transitions (e.g., if segment goes from 23:30 to 00:30)
      if (timeProgress < 0) {
        timeProgress += 1; // Add a full day cycle
      }
      
      // Clamp to 0-1 range
      timeProgress = Math.max(0, Math.min(1, timeProgress));
      
      // 3. Expected Position - Calculate which slide we should be on based on time progress
      const expectedSlidePosition = startSlide + (timeProgress * slidesBetweenTimedNotes);
      
      // 4. Offset Calculation - Compare expected slide with actual slide
      // Calculate how many slides ahead/behind we are
      const slideDifference = currentSlideIndex - expectedSlidePosition;
      
      // Each slide difference moves the dot by 5 pixels (represented as a value between 0-1)
      // Cap at +/- 25 slides (125 pixels)
      const maxSlideDifference = 25;
      const cappedSlideDifference = Math.max(-maxSlideDifference, Math.min(maxSlideDifference, slideDifference));
      
      // Debug log to track the calculation
      console.log('Slide difference calculation:', {
        currentSlideIndex,
        expectedSlidePosition,
        slideDifference,
        cappedSlideDifference,
        amplifiedDifference: slideDifference * 20,
        finalPosition: 0.5 - ((slideDifference * 20) / (maxSlideDifference * 2))
      });
      
      // When ahead (positive difference), gray dot should move left (value < 0.5)
      // When behind (negative difference), gray dot should move right (value > 0.5)
      
      // Exaggerate small differences to make the effect more visible
      // Multiply the difference by 20 to amplify movement for small differences
      const amplifiedDifference = cappedSlideDifference * 20;
      
      // Apply a stronger cap after amplification
      const finalCappedDifference = Math.max(-maxSlideDifference, Math.min(maxSlideDifference, amplifiedDifference));
      
      // Convert to 0-1 scale where 0.5 is center
      // Divide by maxSlideDifference*2 to get a value between -0.5 and 0.5
      // Then subtract from 0.5 to get the final position
      expectedTimePosition = 0.5 - (finalCappedDifference / (maxSlideDifference * 2));
      
    } catch (err) {
      // If any calculation error occurs, use default position (centered)
      console.error('Error calculating time position:', err);
      expectedTimePosition = 0.5;
    }
  }
  
  // Prepare the result
  // Set shouldShow based on whether we have at least one time marker
  const shouldShow = !!(previousTimeMinutes > 0 || currentNote?.time);
  
  return {
    previousTimedNote: effectivePreviousNote,
    nextTimedNote: nextTimedNote,
    percentComplete,
    expectedSlideIndex,
    slideDifference: Math.min(Math.max(slideDifference, -25), 25), // Limit to ±25 slides
    shouldShow,
    expectedTimePosition
  };
}