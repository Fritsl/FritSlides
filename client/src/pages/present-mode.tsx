import React, { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { Note, Project } from "@shared/schema";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import { getThemeBackgroundStyle, getPresentationTheme, ThemeColors, PresentationTheme, START_END_THEME } from "@/lib/presentation-themes";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
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
import TimeGanttDialog from "@/components/ui/time-gantt-dialog";

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
  timeBorrowed?: boolean; // Flag to indicate time data was borrowed from another slide
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
  const [showGanttDialog, setShowGanttDialog] = useState(false);
  
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
    currentTimeInMinutes?: number, 
    expectedTimeInMinutes?: number
  ): string => {
    // Basic time difference format when no current/expected times are provided
    if (currentTimeInMinutes === undefined) {
      // If very close to zero (within 30 seconds), consider it "on time"
      if (Math.abs(diffMinutes) < 0.5) {
        return 'Right on time';
      }
      
      // Remember: positive means behind, negative means ahead
      const isAhead = diffMinutes < 0;
      const absDiff = Math.abs(diffMinutes);
      
      // Format time components
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
      
      return `${timeText} ${isAhead ? 'ahead' : 'behind'}`;
    }
    
    // Extended format with current time and expected time
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
  
  // Process notes into presentation format
  const flattenedNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    
    // First pass: calculate levels and identify parent-child relationships
    const rootNotesArray: PresentationNote[] = [];
    notes.forEach(note => {
      const presentationNote = notesMap.get(note.id)!;
      if (note.parentId === null) {
        // This is a root-level note
        presentationNote.level = 0;
        rootNotesArray.push(presentationNote);
      } else {
        // This is a child note, find its parent and update it
        const parent = notesMap.get(note.parentId);
        if (parent) {
          presentationNote.level = (parent.level || 0) + 1;
          if (!parent.childNotes) parent.childNotes = [];
          parent.childNotes.push(presentationNote);
          parent.hasChildren = true;
        } else {
          // If parent not found (data inconsistency), treat as root
          presentationNote.level = 0;
          rootNotesArray.push(presentationNote);
        }
      }
    });
    
    // Sort child notes by order for proper presentation
    notesMap.forEach(note => {
      if (note.childNotes && note.childNotes.length > 0) {
        // Consistent numeric sorting to match the Notes view
        note.childNotes.sort((a, b) => Number(a.order) - Number(b.order));
      }
    });
    
    // Build the flattened presentation structure
    const result: PresentationNote[] = [];
    
    // Add a start slide for the project
    const project = projects?.find((p) => p.id === projectId);
    if (project) {
      const startSlide: PresentationNote = {
        id: -1, // Use negative ID to avoid conflicts
        projectId: projectId ?? 0,
        content: project.startSlogan || project.name.toUpperCase(), // Use startSlogan if available, otherwise use uppercase project name
        createdAt: new Date(),
        updatedAt: new Date(),
        order: "",
        parentId: null,
        url: null,
        linkText: null,
        youtubeLink: null,
        time: null,
        isDiscussion: null,
        images: null,
        level: 0,
        isStartSlide: true
      };
      result.push(startSlide);
    }
    
    // Sort root notes by order - using numeric sorting to match Notes view
    rootNotesArray.sort((a, b) => Number(a.order) - Number(b.order));
    
    // Set the root notes for use in the start slide
    setRootNotes(rootNotesArray);
    
    // Use a rootIndex to keep track of which root note each slide belongs to
    // This is used for consistent theming of related slides
    let rootIndex = 0;
    
    // Helper function to recursively add all levels of notes
    const addNoteAndChildren = (note: PresentationNote, currentRootIndex: number) => {
      // Check if this note has children
      const hasChildren = note.childNotes && note.childNotes.length > 0;
      
      // Sort children by order if any exist - using numeric sorting to match Notes view
      const sortedChildren = hasChildren 
        ? [...note.childNotes!].sort((a, b) => Number(a.order) - Number(b.order))
        : [];
      
      // Process based on note level and whether it has children
      if (note.level === 0 && hasChildren) {
        // Root note with children - ONLY create an overview slide, not a regular slide
        const overviewSlide: PresentationNote = {
          ...note,
          id: -100 - result.length, // Use a unique negative ID
          isOverviewSlide: true,
          childNotes: sortedChildren,
          rootIndex: currentRootIndex
        };
        result.push(overviewSlide);
      } else if (note.level !== 0 || !hasChildren) {
        // Either a non-root note OR a root note WITHOUT children - add as regular slide
        const noteWithIndex = { 
          ...note, 
          rootIndex: currentRootIndex
        };
        result.push(noteWithIndex);
      }
      
      // Process all children recursively
      if (hasChildren) {
        sortedChildren.forEach(childNote => {
          addNoteAndChildren(childNote, currentRootIndex);
        });
      }
    };
    
    // Process each root note and all its descendants
    rootNotesArray.forEach(rootNote => {
      addNoteAndChildren(rootNote, rootIndex);
      rootIndex++; // Increment for the next root branch
    });
    
    // Add an end slide for the project
    if (project) {
      const endSlide: PresentationNote = {
        id: -2, // Use negative ID to avoid conflicts
        projectId: projectId ?? 0,
        content: project.endSlogan || "End of presentation",
        createdAt: new Date(),
        updatedAt: new Date(),
        order: "",
        parentId: null,
        url: null,
        linkText: null,
        youtubeLink: null,
        time: null,
        isDiscussion: null,
        images: null,
        level: 0,
        isEndSlide: true,
        author: project.author
      };
      result.push(endSlide);
    }
    
    return result;
  }, [notes, projectId, projects, notesMap]);
  
  // Get the current note
  const currentNote = useMemo(() => {
    if (!flattenedNotes.length || currentSlideIndex >= flattenedNotes.length) {
      return null;
    }
    
    // Get the base note
    const note = flattenedNotes[currentSlideIndex];
    
    // If it's a start slide, try to "borrow" time data from the first real timed note
    if (note.isStartSlide) {
      // Find the first real note with time data
      const firstTimedNote = flattenedNotes.find(n => 
        !n.isStartSlide && !n.isEndSlide && !n.isOverviewSlide && n.time && n.time.trim() !== ''
      );
      
      if (firstTimedNote) {
        // Create a new object with the first timed note's time data
        return {
          ...note,
          time: firstTimedNote.time,
          // Mark it as borrowed data
          timeBorrowed: true
        };
      }
    }
    
    // If it's an end slide, try to "borrow" time data from the last real timed note
    if (note.isEndSlide) {
      // Find the last real note with time data (search in reverse)
      const lastTimedNote = [...flattenedNotes].reverse().find(n => 
        !n.isStartSlide && !n.isEndSlide && !n.isOverviewSlide && n.time && n.time.trim() !== ''
      );
      
      if (lastTimedNote) {
        // Create a new object with the last timed note's time data
        return {
          ...note,
          time: lastTimedNote.time,
          // Mark it as borrowed data
          timeBorrowed: true
        };
      }
    }
    
    return note;
  }, [flattenedNotes, currentSlideIndex]);
  
  // Extract type flags
  const isOverviewSlide = !!currentNote?.isOverviewSlide;
  const isStartSlide = !!currentNote?.isStartSlide;
  const isEndSlide = !!currentNote?.isEndSlide;
  
  // Get the theme for the current slide based on its type and rootIndex
  const theme = useMemo(() => {
    if (!currentNote) return getPresentationTheme(0, 0);
    
    // Use special theme for start and end slides
    if (currentNote.isStartSlide || currentNote.isEndSlide) {
      return START_END_THEME;
    }
    
    // Use regular theme for other slides based on rootIndex
    return getPresentationTheme(
      currentNote.level || 0,
      currentNote.rootIndex !== undefined ? currentNote.rootIndex : 0
    );
  }, [currentNote]);
  
  // Get the level for styling
  const level = currentNote?.level || 0;
  
  // Generate background style based on theme
  const themeStyles = useMemo(() => {
    if (!theme) return {};
    return getThemeBackgroundStyle(theme);
  }, [theme]);
  
  // Navigation functions
  const goToNextSlide = () => {
    if (currentSlideIndex < flattenedNotes.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };
  
  const exitPresentation = () => {
    // If we're viewing a regular slide (not start/end/overview), navigate back to that specific note
    if (currentNote && currentNote.id > 0) {
      console.log(`Exiting presentation to noteId: ${currentNote.id}`);
      
      // Navigate directly to the home page with both query parameters
      // Need to force a hard navigation since the wouter router doesn't properly handle query params
      // Add fromPresent=true to indicate we're coming from presentation mode (should not start editing)
      window.location.href = `/?projectId=${projectId}&noteId=${currentNote.id}&fromPresent=true`;
    } else {
      // If it's a special slide or we can't determine the note, just go to home
      console.log("Exiting presentation to home (no specific note)");
      setLocation('/');
    }
  };
  
  // Function to find the index of the next/previous root note or start/end slide
  const findRootNoteIndex = (direction: 'next' | 'prev'): number => {
    if (!flattenedNotes.length) return currentSlideIndex;
    
    // Define what we consider "major slides" - includes Start, End and Overview slides
    const isMajorSlide = (note: PresentationNote): boolean => 
      Boolean(note.isStartSlide || note.isEndSlide || note.isOverviewSlide);
    
    // Find all major slide indexes
    const majorSlideIndexes = flattenedNotes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => isMajorSlide(note))
      .map(({ index }) => index);
    
    // If no special slides found, return current index
    if (majorSlideIndexes.length === 0) return currentSlideIndex;
    
    if (direction === 'next') {
      // Find the next major slide after current position
      const nextIndex = majorSlideIndexes.find(index => index > currentSlideIndex);
      // If found, return it. Otherwise return the first major slide (loop around)
      return nextIndex !== undefined ? nextIndex : majorSlideIndexes[0];
    } else {
      // Find the previous major slides before current position (in reverse order)
      const prevIndexes = majorSlideIndexes.filter(index => index < currentSlideIndex).reverse();
      // If found, return the first previous. Otherwise return the last major slide (loop around)
      return prevIndexes.length > 0 ? prevIndexes[0] : majorSlideIndexes[majorSlideIndexes.length - 1];
    }
  };
  
  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          goToNextSlide();
          break;
        case "ArrowLeft":
          goToPrevSlide();
          break;
        case "ArrowUp":
          // Jump to next root note or special slide
          setCurrentSlideIndex(findRootNoteIndex('next'));
          break;
        case "ArrowDown":
          // Jump to previous root note or special slide
          setCurrentSlideIndex(findRootNoteIndex('prev'));
          break;
        case "Escape":
          exitPresentation();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSlideIndex, flattenedNotes.length, projectId]);
  
  // State to hold calculated pacing info
  const [pacingInfo, setPacingInfo] = useState<PacingInfo>({
    previousTimedNote: null,
    nextTimedNote: null,
    percentComplete: 0,
    expectedSlideIndex: 0,
    slideDifference: 0,
    shouldShow: false,
    timePositionInMinutes: 0
  });
  
  // Initialize from the project's last viewed slide index or specified start note
  useEffect(() => {
    if (!flattenedNotes.length || !currentProject || initializedFromStored) return;
    
    // Find the starting position based on requested startNoteId if provided
    if (startNoteId > 0) {
      // Find index of the specified note in flattenedNotes
      const noteIndex = flattenedNotes.findIndex(note => note.id === startNoteId);
      if (noteIndex >= 0) {
        // Found the requested note
        // If continue=true or shouldContinue=true, use the stored position
        // Otherwise, start from the requested note
        if (shouldContinue && currentProject.lastViewedSlideIndex !== null && currentProject.lastViewedSlideIndex >= 0) {
          const validIndex = Math.min(currentProject.lastViewedSlideIndex, flattenedNotes.length - 1);
          console.log(`Continuing from last viewed slide index: ${validIndex}`);
          setCurrentSlideIndex(validIndex);
        } else {
          console.log(`Starting from specified note at index: ${noteIndex}`);
          setCurrentSlideIndex(noteIndex);
        }
      } else {
        // Requested note not found, start from beginning
        console.log(`Specified note ${startNoteId} not found, starting from beginning`);
        setCurrentSlideIndex(0);
      }
    } else {
      // No specific note requested, check if we should continue from last position
      if (shouldContinue && currentProject.lastViewedSlideIndex !== null && currentProject.lastViewedSlideIndex >= 0) {
        const validIndex = Math.min(currentProject.lastViewedSlideIndex, flattenedNotes.length - 1);
        console.log(`Continuing from last viewed slide index: ${validIndex}`);
        setCurrentSlideIndex(validIndex);
      } else {
        // Start from beginning
        console.log("Starting presentation from beginning");
        setCurrentSlideIndex(0);
      }
    }
    
    // Mark as initialized
    setInitializedFromStored(true);
  }, [flattenedNotes, currentProject, initializedFromStored, startNoteId, shouldContinue]);
  
  // Save the current slide index when it changes
  useEffect(() => {
    // Don't save during initial load or if no notes yet
    if (!initializedFromStored || !flattenedNotes.length) return;
    
    // Save the current slide index
    saveLastViewedSlideIndex(currentSlideIndex);
  }, [currentSlideIndex, initializedFromStored, flattenedNotes]);
  
  // Update pacing info every second
  useEffect(() => {
    if (!flattenedNotes.length) return;
    
    // Create a flat list of note IDs for the pacing calculation
    const noteIds = flattenedNotes.map(note => note.id);
    
    // Debug all timed notes in the presentation
    const timedNotes = flattenedNotes.filter(note => note.time && note.time.trim() !== '');
    console.log(`Found ${timedNotes.length} timed notes in presentation:`, 
      timedNotes.map(note => ({ 
        id: note.id, 
        time: note.time, 
        content: note.content?.substring(0, 15) + '...',
        index: flattenedNotes.indexOf(note)
      }))
    );
    
    // Function to update pacing
    const updatePacing = () => {
      const currentTime = new Date();
      console.log(`Updating pacing info at ${currentTime.toISOString()}`);
      
      // Ensure we're working with the complete set of notes
      const info = calculatePacingInfo(
        // Convert presentation notes back to regular note format
        flattenedNotes.map(n => ({
          id: n.id,
          projectId: n.projectId,
          parentId: n.parentId,
          content: n.content || '',
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          order: n.order || '',
          time: n.time || null,
          url: n.url || null,
          linkText: n.linkText || null,
          youtubeLink: n.youtubeLink || null,
          isDiscussion: n.isDiscussion,
          images: n.images
        })),
        noteIds,
        currentSlideIndex
      );
      
      console.log('New pacing info:', {
        shouldShow: info.shouldShow,
        slideDifference: info.slideDifference,
        previousTimedNote: info.previousTimedNote?.id,
        nextTimedNote: info.nextTimedNote?.id,
        percentComplete: info.percentComplete,
        currenSlideIndex: currentSlideIndex
      });
      
      setPacingInfo(info);
    };
    
    console.log('Setting up pacing interval timer');
    
    // Initial calculation
    updatePacing();
    
    // Set up interval to update every second
    const intervalId = setInterval(updatePacing, 1000);
    
    // Clean up interval on unmount
    return () => {
      console.log('Cleaning up pacing interval timer');
      clearInterval(intervalId);
    };
  }, [notes, flattenedNotes, currentSlideIndex]);
  
  // Legacy time tracking function (keeping for compatibility)
  const getSlideDifference = () => {
    // Now we get the slide difference from the pacing info
    return pacingInfo.slideDifference;
  };
  
  // Function to find ancestor path for breadcrumb navigation
  const findAncestorPath = (note: PresentationNote, notesMap: Map<number, PresentationNote>): React.ReactNode => {
    const ancestors: PresentationNote[] = [];
    let currentParentId = note.parentId;
    
    // Find all ancestors by traversing up the hierarchy
    while (currentParentId !== null) {
      const parent = notesMap.get(currentParentId);
      if (parent) {
        ancestors.unshift(parent); // Add at the beginning to maintain hierarchy order
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    
    // Only show the most relevant parts of the hierarchy (last 2-3 levels)
    const relevantAncestors = ancestors.length > 2 ? ancestors.slice(-2) : ancestors;
    
    return (
      <div className="flex items-center space-x-1">
        {relevantAncestors.map((ancestor, index) => (
          <div key={ancestor.id} className="flex items-center">
            <span className="max-w-[240px] truncate">{ancestor.content.split('\n')[0]}</span>
            {index < relevantAncestors.length - 1 && <span className="mx-1">›</span>}
          </div>
        ))}
        {ancestors.length > 2 && relevantAncestors.length < ancestors.length && (
          <span className="mx-1">...</span>
        )}
      </div>
    );
  };
  
  // Find the next slide with a time marker
  const getNextTimedSlide = () => {
    if (!flattenedNotes.length || currentSlideIndex >= flattenedNotes.length) {
      return null;
    }
    
    // Find the next note with a time, starting from the current slide index
    const nextTimed = flattenedNotes
      .slice(currentSlideIndex + 1)
      .find(note => note.time && note.time.trim() !== '');
      
    return nextTimed;
  };
  
  // Find out which root a note belongs to (for theming consistency)
  const findRootIndex = (note: PresentationNote): number => {
    if (note.rootIndex !== undefined) return note.rootIndex;
    if (!note.parentId) return 0; // Default to 0 for notes without parents
    
    // Search through the notes to find the root node
    const parentNote = flattenedNotes.find(n => n.id === note.parentId);
    if (parentNote) {
      return findRootIndex(parentNote);
    }
    
    return 0; // Default if we can't determine the root
  };
  
  // Render the presentation
  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col bg-black overflow-hidden">
      {isLoading || !flattenedNotes.length ? (
        // Loading screen
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin h-12 w-12 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg">Loading presentation...</p>
          </div>
        </div>
      ) : (
        // Main presentation content
        <>
          {/* Slide content area */}
          <div 
            className="flex-1 flex flex-col items-center justify-center w-full h-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              // Check if the click was on an interactive element
              const target = e.target as HTMLElement;
              const isLink = target.tagName === 'A' || 
                            target.closest('a') || 
                            target.tagName === 'IFRAME' || 
                            target.closest('iframe') || 
                            target.tagName === 'IMG' || 
                            target.closest('img');
                            
              // Only proceed to next slide if not clicking on interactive elements
              if (!isLink) {
                goToNextSlide();
              }
            }}
            style={themeStyles}
          >
            {currentNote && (
              <div className="flex flex-col h-full w-full">
                {/* Breadcrumb Navigation - Show when level > 1 or not the first slide */}
                {!isStartSlide && !isEndSlide && !isOverviewSlide && 
                  (currentSlideIndex > 0 || (currentNote.level && currentNote.level > 1)) && (
                  <div 
                    className="absolute top-2 left-2 z-10 text-white/40 text-[10px] px-2 py-1 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {findAncestorPath(currentNote, notesMap)}
                  </div>
                )}
                <div className="flex-grow flex items-center justify-center">
                  {isOverviewSlide ? (
                    // Overview slide with chapter markers
                    <OverviewSlide 
                      parentNote={currentNote} 
                      childNotes={currentNote.childNotes || []}
                      theme={theme}
                    />
                  ) : isStartSlide ? (
                    // Start slide with project start slogan and root notes
                    <div className="max-w-[90vw] md:max-w-[80vw] w-full h-full flex flex-col items-center justify-center">
                      <div className="w-full text-white">
                        {/* Title using advanced typography system */}
                        <div className="slide-content flex flex-col items-center justify-center mb-12">
                          <div 
                            className="text-center"
                            style={generateTypographyStyles(getAdvancedTypographyStyles(
                              SlideContentType.StartEndSlide,
                              0,
                              0 // Fixed size for all slides regardless of content length
                            ))}
                          >
                            {currentNote.content}
                          </div>
                        </div>
                        
                        {/* Root notes with bullets and numbers - same color for all bullets */}
                        {rootNotes && rootNotes.length > 0 && (
                          <div className="flex flex-col items-center mt-8 space-y-6">
                            <div className="flex flex-col space-y-4 items-start">
                              {rootNotes.map((rootNote, index) => {
                                // Use a vibrant orange color from Sand theme to make bullets stand out more
                                const accentColor = "#F97316"; // Orange 500 from Sand theme
                                
                                return (
                                  <div key={rootNote.id} className="flex items-center group">
                                    <div className="relative mr-4">
                                      {/* Numbered bullet with theme color */}
                                      <div 
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                                        style={{ 
                                          backgroundColor: accentColor,
                                          boxShadow: "0 0 10px rgba(255, 255, 255, 0.5)"
                                        }}
                                      >
                                        <span className="text-white font-bold">{index + 1}</span>
                                      </div>
                                      {/* Pulse effect on hover */}
                                      <div 
                                        className="absolute top-0 left-0 w-10 h-10 rounded-full opacity-0 group-hover:opacity-40 animate-ping"
                                        style={{ backgroundColor: accentColor }}
                                      ></div>
                                    </div>
                                    
                                    {/* Root note title */}
                                    <div 
                                      className="text-white text-xl md:text-2xl font-medium"
                                      style={{
                                        fontFamily: FONTS.body,
                                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                      }}
                                    >
                                      {rootNote.content.split('\n')[0]}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isEndSlide ? (
                    // End slide with project end slogan
                    <div className="max-w-[90vw] md:max-w-[80vw] w-full h-full flex flex-col items-center justify-center">
                      <div className="w-full text-white">
                        {/* Title using advanced typography system - matching Start Slide style */}
                        <div className="slide-content flex flex-col items-center justify-center">
                          <div 
                            className="text-center"
                            style={generateTypographyStyles(getAdvancedTypographyStyles(
                              SlideContentType.StartEndSlide,
                              0,
                              0 // Fixed size for all slides regardless of content length
                            ))}
                          >
                            {currentNote.content}
                          </div>
                        </div>
                        
                        {/* Author attribution if available */}
                        {currentNote.author && (
                          <div 
                            className="mt-12 text-center opacity-80"
                            style={generateTypographyStyles(getAdvancedTypographyStyles(
                              SlideContentType.Caption,
                              0,
                              0 // Fixed size for caption text
                            ))}
                          >
                            {currentNote.author}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Regular slide with content - smart layout based on content type
                    <div className="max-w-[90vw] md:max-w-[80vw] w-full h-full flex flex-col items-center justify-center relative">
                      {/* Discussion icon overlay */}
                      {currentNote.isDiscussion && (
                        <div className="absolute top-4 right-4 text-white opacity-80 transition-opacity animate-pulse">
                          <Users className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />
                        </div>
                      )}
                      
                      {/* Determine if slide has media */}
                      {(currentNote.youtubeLink || (currentNote.images && currentNote.images.length > 0)) ? (
                        // Slide with media - adapt layout based on content
                        <div className="w-full h-full flex flex-col md:flex-row md:justify-between items-center text-white">
                          {/* Content column - sized based on media presence */}
                          <div className="w-full md:w-2/5 flex flex-col items-center justify-center md:pr-8 order-2 md:order-1">
                            <div 
                              className="slide-content w-full"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: determineContentType(currentNote.content) === ContentType.List 
                                  ? 'flex-start' 
                                  : 'center',
                              }}
                            >
                              <div
                                style={{
                                  ...generateTypographyStyles(getTypographyStyles(
                                    determineContentType(currentNote.content),
                                    level,
                                    0 // Fixed size for all content regardless of length
                                  ))
                                }}
                              >
                                {formatContent(currentNote.content)}
                              </div>
                              
                              {/* URL link if present */}
                              {currentNote.url && (
                                <div className="mt-4 self-start">
                                  <a
                                    href={currentNote.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      ...generateTypographyStyles(getTypographyStyles(
                                        ContentType.Regular,
                                        level,
                                        0 // Fixed size for links too
                                      )),
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      // Using text decoration instead of border to avoid conflicts
                                      textDecoration: 'underline',
                                      textDecorationColor: 'rgba(255, 255, 255, 0.3)',
                                      textDecorationThickness: '1px',
                                      paddingBottom: '0.5rem',
                                      width: 'fit-content'
                                    }}
                                    className="hover:text-white transition-colors"
                                  >
                                    <span className="mr-2">🔗</span>
                                    {currentNote.linkText || currentNote.url}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Media column */}
                          <div className="w-full md:w-3/5 flex flex-col items-center justify-center md:pl-8 mb-6 md:mb-0 order-1 md:order-2">
                            {/* YouTube embed if present */}
                            {currentNote.youtubeLink && (
                              <div className="rounded-lg overflow-hidden aspect-video bg-black/20 shadow-2xl w-full max-w-full max-h-[75vh]">
                                <iframe
                                  className="w-full h-full"
                                  src={getYoutubeEmbedUrl(currentNote.youtubeLink, currentNote.time || '')}
                                  title="YouTube video"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                ></iframe>
                              </div>
                            )}
                            
                            {/* Images if present and no YouTube */}
                            {!currentNote.youtubeLink && currentNote.images && currentNote.images.length > 0 && (
                              <div className="w-full grid grid-cols-1 gap-4">
                                {currentNote.images.slice(0, 2).map((image: string, idx: number) => (
                                  <div key={idx} className={`rounded-lg overflow-hidden shadow-xl ${currentNote.images!.length === 1 ? 'aspect-[16/10] max-h-[75vh]' : 'aspect-[16/9] max-h-[40vh]'}`}>
                                    <ImageWithFallback 
                                      src={image} 
                                      alt={`Slide image ${idx + 1}`} 
                                      className="w-full h-full object-contain" 
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Slide with text only - center content
                        <div className="w-full h-full flex flex-col items-center justify-center text-white">
                          <div 
                            className="slide-content w-full"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: determineContentType(currentNote.content) === ContentType.List 
                                ? 'flex-start' 
                                : 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {/* Auto-detect content type and apply appropriate styling */}
                            <div
                              className="text-content"
                              style={{
                                ...generateTypographyStyles(getTypographyStyles(
                                  determineContentType(currentNote.content),
                                  level,
                                  0 // Fixed size for all content regardless of length
                                )),
                                // No longer scaling font size to ensure consistency between slides
                                margin: determineContentType(currentNote.content) === ContentType.List 
                                  ? '0 auto 0 15%' 
                                  : '0 auto',
                              }}
                            >
                              {formatContent(currentNote.content)}
                            </div>
                            
                            {/* URL link if present */}
                            {currentNote.url && (
                              <div className="mt-6 self-center">
                                <a
                                  href={currentNote.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    ...generateTypographyStyles(getTypographyStyles(
                                      ContentType.Regular,
                                      level,
                                      0 // Fixed size for links too
                                    )),
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    // Using text decoration instead of border to avoid conflicts
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(255, 255, 255, 0.3)',
                                    textDecorationThickness: '1px',
                                    paddingBottom: '0.5rem',
                                  }}
                                  className="hover:text-white transition-colors"
                                >
                                  <span className="mr-2">🔗</span>
                                  {currentNote.linkText || currentNote.url}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Minimal footer with navigation hints */}
          <div className="absolute bottom-0 left-0 right-0 text-center p-1 px-2 flex justify-between items-center bg-black/30 backdrop-blur-sm">
            <div className="w-4 sm:w-8"></div>
            <p className="text-white/40 text-[8px] sm:text-[10px] whitespace-nowrap overflow-hidden overflow-ellipsis">
              <span className="hidden sm:inline">{currentProject?.startSlogan || currentProject?.name} • </span>
              {currentSlideIndex + 1}/{flattenedNotes.length}
              <span className="hidden xs:inline"> • {isStartSlide ? 'Start' : isEndSlide ? 'End' : isOverviewSlide ? 'Overview' : ''}</span> • 
              <span className="hidden sm:inline">Click or → to advance • ← back • ↑↓ jump between sections • ESC to exit</span>
              <span className="inline sm:hidden">Tap to advance • ↑↓ jump sections</span>
            </p>
            <div className="flex items-center">
              {/* Author button - make it always visible */}
              <button 
                className="text-white/70 hover:text-white/30 opacity-100 hover:opacity-70 mr-2 text-[10px] cursor-pointer"
                onClick={() => {
                  console.log("AUTHOR BUTTON CLICKED");
                  // Navigate back to note editor
                  exitPresentation();
                }}
              >
                {currentProject?.author || "AUTHOR"}
              </button>
              <FullscreenToggle 
                buttonClassName="text-white/30 hover:text-white/70 opacity-70 hover:opacity-100"
                iconClassName="w-4 h-4"
                showTooltip={false}
              />
            </div>
          </div>
          
          {/* Debug overlay has been removed */}
          
          {/* Time tracking dots - Always show on all slides except overview slides and end slide */}
          {(!isOverviewSlide || currentNote?.time || isStartSlide) && !isEndSlide && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="relative h-8 sm:h-10 flex items-center justify-center cursor-pointer"
                      style={{ 
                        width: '140px', 
                      }}
                      onClick={() => setShowGanttDialog(true)}
                    >
                      {/* White dot (current position) - always centered with 35% opacity */}
                      <div 
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/35 transition-all duration-300"
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)',
                          boxShadow: '0 0 4px rgba(255,255,255,0.3)'
                        }}
                      />
                      
                      {/* Black dot (time adherence) - position shows ahead/behind schedule - 35% opacity */}
                      <div 
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black/35 transition-all duration-300"
                        style={{
                          // Position the black dot on a smaller scale within the container
                          // 40% = maximum ahead (1 hour ahead)
                          // 50% = on time
                          // 60% = maximum behind (1 hour behind)
                          left: (() => {
                              try {
                                // Get the current time
                                const now = new Date();
                                const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
                                
                                let diffMinutes = 0;
                                
                                // If we're on a timed slide, use that calculation
                                if (currentNote?.time) {
                                  const slideTimeInMinutes = timeToMinutes(currentNote.time);
                                  diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                                  
                                  // Handle crossing midnight
                                  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                                  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                                } 
                                // Between two timed notes, use interpolation calculation 
                                else if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                                  const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                                  const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                                  
                                  // Calculate total time span
                                  let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                                  if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                                  
                                  // Find slide positions
                                  const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                                  const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                                  
                                  if (prevSlideIndex < 0 || nextSlideIndex < 0) return "50%";
                                  
                                  // Calculate total slides and our position
                                  const totalSlides = nextSlideIndex - prevSlideIndex;
                                  if (totalSlides <= 1) return "50%"; // Avoid division by zero
                                  
                                  // Calculate our position (fraction) between the two timed slides
                                  const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;
                                  
                                  // Calculate the expected time at our position using linear interpolation
                                  const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                                  
                                  // Calculate difference between current time and expected time
                                  diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                                  
                                  // Handle crossing midnight
                                  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                                  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                                }
                                
                                // Cap diffMinutes to -60..60 range
                                const timePosition = Math.max(-60, Math.min(60, diffMinutes));
                                // Map from -60..60 to 40%..60% (with 0 = 50%)
                                const percentPosition = 50 + ((timePosition / 60) * 10);
                                return `${percentPosition}%`;
                              } catch (err) {
                                console.error("Error calculating dot position:", err);
                                return "50%"; // Default to center in case of error
                              }
                            })(),
                          transform: 'translateX(-50%)',
                          boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black/90 text-white text-xs p-2 sm:p-3 max-w-[280px]">
                    <div>
                      {(() => {
                        // Get the current time
                        const now = new Date();
                        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
                        
                        // Calculate time difference based on note positions
                        if (currentNote?.time) {
                          // On a note with a time marker - directly calculate from note
                          const slideTimeInMinutes = timeToMinutes(currentNote.time);
                          const diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                          return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, slideTimeInMinutes);
                        } else if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                          // If between timed slides, use linear interpolation
                          const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                          const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                          
                          // Calculate total time span
                          let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                          if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                          
                          // Find slide positions
                          const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                          const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                          
                          if (prevSlideIndex < 0 || nextSlideIndex < 0) {
                            return 'Time data unavailable';
                          }
                          
                          // Calculate slide progress based on position between timed slides
                          const slideProgress = (currentSlideIndex - prevSlideIndex) / (nextSlideIndex - prevSlideIndex);
                          
                          // Calculate expected time at current position using linear interpolation
                          const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                          
                          // Calculate difference between current time and expected time
                          let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                          
                          // Handle crossing midnight
                          if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                          else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                          
                          // Format as human-readable time difference
                          return formatTimeDifferenceHuman(diffMinutes, currentTimeInMinutes, expectedTimeInMinutes);
                        }
                        
                        // No timed slides available for calculation
                        return 'Time data unavailable';
                      })()}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Gantt chart dialog */}
          {showGanttDialog && notes && currentProject && (
            <TimeGanttDialog
              isOpen={showGanttDialog}
              onClose={() => setShowGanttDialog(false)}
              projectId={projectId ?? 0}
              projectName={currentProject.name}
              notes={notes}
            />
          )}
        </>
      )}
    </div>
  );
}