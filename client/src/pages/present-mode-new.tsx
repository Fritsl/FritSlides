import React, { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { Note, Project } from "@shared/schema";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import { getThemeBackgroundStyle, getPresentationTheme, ThemeColors, PresentationTheme, START_END_THEME } from "@/lib/presentation-themes";
import '@fontsource/mulish';
import '@fontsource/roboto';
import { 
  formatContent, 
  getYoutubeEmbedUrl, 
  calculateLevel, 
  ContentType, 
  SlideContentType,
  getTypographyStyles, 
  getAdvancedTypographyStyles,
  generateTypographyStyles,
  FONTS
} from "@/lib/typography";
import { 
  findNextTimedNote, 
  calculateTimeInfo, 
  calculatePacingInfo,
  timeToMinutes, 
  minutesToTime,
  PacingInfo
} from "@/lib/time-utils";
import { OverviewSlide } from "@/components/ui/overview-slide";
import { FullscreenToggle } from "@/components/ui/fullscreen-toggle";
import screenfull from "screenfull";

// Define the PresentationNote interface extending the Note interface
interface PresentationNote extends Note {
  level?: number;
  rootIndex?: number; // Index of the root note this belongs to - for theming
  childNotes?: PresentationNote[]; // Direct child notes for overview slides
  hasChildren?: boolean; // Flag to indicate this note has children
  isOverviewSlide?: boolean; // Flag for chapter overview slides
  isStartSlide?: boolean; // Flag for project start slide
  isEndSlide?: boolean; // Flag for project end slide
  author?: string | null; // Author for end slides
  debugInfo?: string; // Debug information for development
}

// Define the TimeSegment interface for tracking time
interface TimeSegment {
  lastPassedSlideIndex: number; // Index of the slide with the last passed time marker
  nextUpcomingSlideIndex: number | null; // Index of the slide with the next upcoming time marker
  lastPassedTime: string; // The time marker of the last passed slide
  nextUpcomingTime: string | null; // The time marker of the next upcoming slide
  currentProgress: number; // Progress between 0-1 indicating position between time points
}

// Determine content type based on content features
function determineContentType(content: string): ContentType {
  if (!content) return ContentType.Regular;
  
  // Check for code blocks with triple backticks
  if (content.includes("```")) return ContentType.Code;
  
  // Check for list items
  if (content.match(/^(\s*[-*+]|\s*\d+\.)\s/m)) return ContentType.List;
  
  // Check for block quotes
  if (content.match(/^>\s/m)) return ContentType.Quote;
  
  // Check for headings based on length only
  if (content.length < 30) {
    return ContentType.Heading;
  }
  
  // Check for subheadings
  if (content.length < 60) return ContentType.Subheading;
  
  // Default to regular content
  return ContentType.Regular;
}

export default function PresentMode() {
  console.log("PRESENT MODE COMPONENT LOADED");
  const [, setLocation] = useLocation();
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;
  
  // Parse URL parameters
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const startNoteId = searchParams ? parseInt(searchParams.get('startNoteId') || '0', 10) : 0;
  const continuePresentationParam = searchParams ? searchParams.get('continue') : null;
  const shouldContinue = continuePresentationParam === 'true';

  // Get projects and notes data
  const { projects, isLoading: projectsLoading } = useProjects();
  const { notes, isLoading: notesLoading } = useNotes(projectId);
  
  // States for presentation
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [initializedFromStored, setInitializedFromStored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Compute loading state
  const isLoading = projectsLoading || notesLoading;
  
  // Find current project
  const currentProject = useMemo(() => {
    if (!projects || !projectId) return null;
    return projects.find((p) => p.id === projectId) || null;
  }, [projects, projectId]);
  
  // Store root notes for display on the start slide
  const [rootNotes, setRootNotes] = useState<PresentationNote[]>([]);
  
  // Create a map of notes by their IDs for quick access - outside useMemo for breadcrumb navigation
  const notesMap = useMemo(() => {
    const map = new Map<number, PresentationNote>();
    if (notes && notes.length > 0) {
      notes.forEach(note => {
        map.set(note.id, { ...note, childNotes: [] });
      });
    }
    return map;
  }, [notes]);
  
  // Helper function to save the last viewed slide index
  const saveLastViewedSlideIndex = async (index: number) => {
    if (!projectId) return;
    
    try {
      await fetch(`/api/projects/${projectId}/lastViewedSlideIndex`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slideIndex: index }),
      });
    } catch (error) {
      console.error('Failed to save last viewed slide index:', error);
    }
  };

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

  // ... rest of the file remains the same

  // When displaying the status message in the template, make sure to update both instances like this:

  // First instance:
  /*
  if (currentNote?.time) {
    // For timed slides, calculate difference between current time and slide's time
    const slideTimeInMinutes = timeToMinutes(currentNote.time);
    let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
    
    // Handle crossing midnight
    if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
    else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
    
    // Format as human-readable time difference with additional info
    return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, slideTimeInMinutes);
  }
  */

  // Second instance:
  /*
  // Calculate the expected time at our position using linear interpolation
  const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
  
  // Calculate difference between current time and expected time
  let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
  
  // Handle crossing midnight
  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
  
  // Format as human-readable time difference with additional info
  return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, expectedTimeInMinutes);
  */

  return <div>See complete implementation in present-mode.tsx</div>;
}