// This file contains the updates for the present-mode.tsx file
// First, update the formatTimeDifferenceHuman function as follows:

  // Format time in HH:MM format
  const formatTimeHHMM = (minutes: number): string => {
    // Normalize to 24 hour format
    const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    
    const hours = Math.floor(normalizedMinutes / 60);
    const mins = Math.floor(normalizedMinutes % 60);
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Format time difference as a human-readable string with additional information
  const formatTimeDifferenceHuman = (
    diffMinutes: number, 
    currentTimeInMinutes: number, 
    expectedTimeInMinutes?: number
  ): string => {
    // Format current system time
    const currentTimeFormatted = formatTimeHHMM(currentTimeInMinutes);
    
    // Format expected time for this slide (if provided)
    const expectedTimeFormatted = expectedTimeInMinutes !== undefined ? 
      formatTimeHHMM(expectedTimeInMinutes) : 'N/A';
    
    // If very close to zero (within 30 seconds), consider it "on time"
    let statusText;
    if (Math.abs(diffMinutes) < 0.5) {
      statusText = 'Right on time';
    } else {
      // Remember: positive value means the user is behind schedule (current time > expected time)
      // Negative value means the user is ahead of schedule (current time < expected time)
      const isAhead = diffMinutes < 0;
      const absDiff = Math.abs(diffMinutes);
      
      // Format the time components
      const hours = Math.floor(absDiff / 60);
      const mins = Math.floor(absDiff % 60);
      const secs = Math.round((absDiff % 1) * 60);
      
      let timeText = '';
      
      if (hours > 0) {
        timeText += `${hours} hour${hours !== 1 ? 's' : ''}`;
        if (mins > 0) {
          timeText += ` ${mins} minute${mins !== 1 ? 's' : ''}`;
        }
      } else if (mins > 0) {
        timeText += `${mins} minute${mins !== 1 ? 's' : ''}`;
        if (secs > 0 && mins < 2) {  // Only add seconds for precision when under 2 minutes
          timeText += ` ${secs} second${secs !== 1 ? 's' : ''}`;
        }
      } else {
        timeText += `${secs} second${secs !== 1 ? 's' : ''}`;
      }
      
      statusText = `${timeText} ${isAhead ? 'ahead' : 'behind'}`;
    }
    
    // Combine all information
    return `${statusText} (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
  };

// Then, update the status display section as follows:

// Update #1: For a timed slide
if (currentNote?.time) {
  // For timed slides, calculate difference between current time and slide's time
  const slideTimeInMinutes = timeToMinutes(currentNote.time);
  let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
  
  // Handle crossing midnight
  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
  
  // Format as human-readable time difference
  return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, slideTimeInMinutes);
}

// Update #2: For a slide between timed slides (linear interpolation)
// Calculate our position (fraction) between the two timed slides
const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;

// Calculate the expected time at our position using linear interpolation
const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);

// Calculate difference between current time and expected time
let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;

// Handle crossing midnight
if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;

// Format as human-readable time difference
return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, expectedTimeInMinutes);