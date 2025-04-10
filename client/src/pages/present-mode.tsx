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
    
    // Sort root notes by order
    rootNotesArray.sort((a, b) => String(a.order).localeCompare(String(b.order)));
    
    // Set the root notes for use in the start slide
    setRootNotes(rootNotesArray);
    
    // Use a rootIndex to keep track of which root note each slide belongs to
    // This is used for consistent theming of related slides
    let rootIndex = 0;
    
    // Helper function to recursively add all levels of notes
    const addNoteAndChildren = (note: PresentationNote, currentRootIndex: number) => {
      // Check if this note has children
      const hasChildren = note.childNotes && note.childNotes.length > 0;
      
      // Sort children by order if any exist
      const sortedChildren = hasChildren 
        ? [...note.childNotes!].sort((a, b) => String(a.order).localeCompare(String(b.order)))
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
    return flattenedNotes[currentSlideIndex];
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
                                    <img 
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
          
          {/* Debug overlay - ALWAYS VISIBLE regardless of pacing state */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/95 p-2 rounded border border-gray-600 z-20 text-[9px] sm:text-[11px] font-mono w-[240px] sm:w-[300px]">
            <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <div className="text-green-400 font-semibold whitespace-nowrap">Start Time:</div>
              <div className="text-white">{(() => {
                // If we're on a timed note with a next timed note, this note is the start time
                if (currentNote?.time && pacingInfo.nextTimedNote) {
                  return currentNote.time;
                }
                // If we're on a timed note without a next timed note, we use previous timed note (if exists)
                // or the current note's time
                if (currentNote?.time && !pacingInfo.nextTimedNote) {
                  return pacingInfo.previousTimedNote?.time || currentNote.time;
                }
                // If we're between timed notes
                return pacingInfo.previousTimedNote?.time || '—';
              })()}</div>
              
              <div className="text-green-400 font-semibold whitespace-nowrap">End Time:</div>
              <div className="text-white">{(() => {
                // If we're on a timed note, find the next timed note directly
                if (currentNote?.time) {
                  // Get the next timed slide directly regardless of what pacingInfo has
                  const nextTimedSlide = getNextTimedSlide();
                  if (nextTimedSlide) {
                    return nextTimedSlide.time;
                  }
                  // If there's no next timed slide, use the current note's time
                  return currentNote.time;
                }
                // If we're between timed notes
                return pacingInfo.nextTimedNote?.time || '—';
              })()}</div>
              
              <div className="text-green-400 font-semibold whitespace-nowrap">Total Time to spend:</div>
              <div className="text-white">{(() => {
                // If we're on a timed note, directly check for the next timed note
                if (currentNote?.time) {
                  // Get the next timed slide directly
                  const nextTimedSlide = getNextTimedSlide();
                  if (nextTimedSlide) {
                    const startMin = timeToMinutes(currentNote.time || '');
                    const endMin = timeToMinutes(nextTimedSlide.time || '');
                    let totalMin = endMin - startMin;
                    if (totalMin < 0) totalMin += 24 * 60; // Adjust for time wrapping to next day
                    const hours = Math.floor(totalMin / 60);
                    const mins = Math.floor(totalMin % 60);
                    const secs = Math.round((totalMin % 1) * 60);
                    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  }
                  
                  // If there's no next timed slide, this is the last/only one
                  return '00:00:00'; // No time to spend
                }
                  
                // If we're between two timed notes (not on either one)
                if (pacingInfo.previousTimedNote && pacingInfo.nextTimedNote) {
                  const startMin = timeToMinutes(pacingInfo.previousTimedNote.time || '');
                  const endMin = timeToMinutes(pacingInfo.nextTimedNote.time || '');
                  let totalMin = endMin - startMin;
                  if (totalMin < 0) totalMin += 24 * 60; // Adjust for time wrapping to next day
                  const hours = Math.floor(totalMin / 60);
                  const mins = Math.floor(totalMin % 60);
                  const secs = Math.round((totalMin % 1) * 60);
                  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                  
                return '—';
              })()}</div>
              
              <div className="text-green-400 font-semibold whitespace-nowrap">Notes to spend on time:</div>
              <div className="text-white">{(() => {
                // We're on a timed slide - use direct check for next timed slide
                if (currentNote?.time) {
                  // Get next timed slide directly
                  const nextTimedSlide = getNextTimedSlide();
                  if (nextTimedSlide) {
                    const currentIndex = currentSlideIndex;
                    const nextIndex = flattenedNotes.findIndex(n => n.id === nextTimedSlide.id);
                    if (nextIndex < 0) return '—';
                    return nextIndex - currentIndex;
                  }
                  return '1'; // This is the only timed slide, count it as 1
                }
                
                // Between two timed slides
                if (pacingInfo.previousTimedNote && pacingInfo.nextTimedNote) {
                  const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                  const nextIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                  if (prevIndex < 0 || nextIndex < 0) return '—';
                  return nextIndex - prevIndex;
                }
                
                return '—';
              })()}</div>
              
              <div className="text-green-400 font-semibold whitespace-nowrap">Current Note of these:</div>
              <div className="text-white">{(() => {
                // We're on a timed slide
                if (currentNote?.time) {
                  if (pacingInfo.nextTimedNote) {
                    // We're on a timed note with a next timed note
                    return '1'; // We're at the start (position 1, not 0)
                  }
                  // If we're on the last timed note with no next timed note
                  return '1'; // Consider it the first/only note in the range (position 1, not 0)
                }
                
                // Between two timed slides
                if (pacingInfo.previousTimedNote) {
                  const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                  const currIndex = currentSlideIndex;
                  if (prevIndex < 0) return '—';
                  // Add 1 to convert from 0-based to 1-based position
                  return (currIndex - prevIndex + 1).toString();
                }
                
                return '—';
              })()}</div>
              
              <div className="text-green-400 font-semibold whitespace-nowrap">Result is:</div>
              <div className="text-white">{(() => {
                // Get the current time
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentSeconds = now.getSeconds();
                
                // Calculate current time in minutes
                const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSeconds / 60);
                
                // If we're on a timed slide
                if (currentNote?.time) {
                  // For timed slides, the result is the difference between current time and the slide's time
                  const slideTimeInMinutes = timeToMinutes(currentNote.time);
                  
                  // Calculate difference
                  let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                  
                  // Handle crossing midnight
                  if (diffMinutes < -12 * 60) { // If negative and more than 12 hours, assume we crossed midnight
                    diffMinutes += 24 * 60;
                  } else if (diffMinutes > 12 * 60) { // If positive and more than 12 hours, assume we crossed midnight backwards
                    diffMinutes -= 24 * 60;
                  }
                  
                  // Format the time difference
                  const sign = diffMinutes >= 0 ? '+' : '-';
                  const absDiff = Math.abs(diffMinutes);
                  const hours = Math.floor(absDiff / 60);
                  const mins = Math.floor(absDiff % 60);
                  const secs = Math.round((absDiff % 1) * 60);
                  
                  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                
                // Between two timed notes
                if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                  const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                  const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                  
                  // Calculate total time span
                  let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                  if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                  
                  // Find slide positions
                  const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                  const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                  
                  if (prevSlideIndex < 0 || nextSlideIndex < 0) return '—';
                  
                  // Calculate total slides and our position
                  const totalSlides = nextSlideIndex - prevSlideIndex;
                  if (totalSlides <= 1) return '00:00:00'; // Avoid division by zero
                  
                  // Calculate our position (fraction) between the two timed slides
                  const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;
                  
                  // Calculate the expected time at our position using linear interpolation
                  const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                  
                  // Calculate difference between current time and expected time
                  let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                  
                  // Handle crossing midnight
                  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                  
                  // Format the time difference
                  const sign = diffMinutes >= 0 ? '+' : '-';
                  const absDiff = Math.abs(diffMinutes);
                  const hours = Math.floor(absDiff / 60);
                  const mins = Math.floor(absDiff % 60);
                  const secs = Math.round((absDiff % 1) * 60);
                  
                  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                
                // No timed slides available for calculation
                return '00:00:00';
              })()}</div>

              {/* Human-readable time display */}
              <div className="text-green-400 font-semibold whitespace-nowrap mt-1">Status:</div>
              <div className="text-white">{(() => {
                // Get the current time
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentSeconds = now.getSeconds();
                
                // Calculate current time in minutes
                const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSeconds / 60);
                
                // If we're on a timed slide
                if (currentNote?.time) {
                  // For timed slides, calculate difference between current time and slide's time
                  const slideTimeInMinutes = timeToMinutes(currentNote.time);
                  let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                  
                  // Handle crossing midnight
                  if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                  else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                  
                  // Format as human-readable time difference
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
                  
                  if (prevSlideIndex < 0 || nextSlideIndex < 0) return 'Time data unavailable';
                  
                  // Calculate total slides and our position
                  const totalSlides = nextSlideIndex - prevSlideIndex;
                  if (totalSlides <= 1) return 'Right on time'; // Avoid division by zero
                  
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
                }
                
                // No timed slides available for calculation
                return 'Time data unavailable';
              })()}</div>
            </div>
          </div>
          
          {/* Time tracking dots - Modified to always show for timed slides */}
          {(pacingInfo.shouldShow || currentNote?.time) && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="relative h-8 sm:h-10 flex items-center justify-center"
                      style={{ 
                        // Calculate width based on maximum potential offset
                        width: '140px', // 25 slides * 4px + center area
                      }}
                    >
                      {/* White dot (current position) - always centered */}
                      <div 
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/80 transition-all duration-300"
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)',
                          boxShadow: '0 0 4px rgba(255,255,255,0.5)'
                        }}
                      />
                      
                      {/* Grey dot (time adherence) - position shows ahead/behind schedule */}
                      {pacingInfo.shouldShow && (
                        <div 
                          className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-400 transition-all duration-300"
                          style={{
                            // Position the grey dot on a scale from 25% to 75% width:
                            // 25% = maximum ahead (1 hour ahead)
                            // 50% = on time
                            // 75% = maximum behind (1 hour behind)
                            left: (() => {
                              // Cap timePositionInMinutes to -60..60 range
                              const timePosition = Math.max(-60, Math.min(60, pacingInfo.timePositionInMinutes));
                              // Map from -60..60 to 25%..75% (with 0 = 50%)
                              const percentPosition = 50 + ((timePosition / 60) * 25);
                              return `${percentPosition}%`;
                            })(),
                            transform: 'translateX(-50%)',
                            boxShadow: '0 0 4px rgba(200,200,200,0.5)'
                          }}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black/90 text-white text-[10px] sm:text-xs p-2 sm:p-3">
                    <div className="text-center">
                      <div>
                        <span className="opacity-80">Current:</span> {currentNote?.time ? `${currentNote.time}` : 'No time marker'} 
                      </div>
                      {(() => {
                        // Store the value to avoid multiple calls
                        const nextSlide = getNextTimedSlide();
                        return nextSlide ? (
                          <div>
                            <span className="opacity-80">Next time point:</span> {nextSlide.content?.slice(0, 20) || ''}
                            {nextSlide.content && nextSlide.content.length > 20 ? '...' : ''} 
                            {nextSlide.time ? `@ ${nextSlide.time}` : ''}
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Debug information - ALWAYS VISIBLE */}
                      <div className="mt-2 p-1 bg-slate-900 rounded text-[9px] text-left border border-slate-700">
                        <div className="grid grid-cols-2 gap-x-1 font-mono">
                          <div className="text-slate-400">Start:</div>
                          <div>{pacingInfo.previousTimedNote?.time || '—'}</div>
                          <div className="text-slate-400">End:</div>
                          <div>{pacingInfo.nextTimedNote?.time || '—'}</div>
                          <div className="text-slate-400">Total Time:</div>
                          <div>{(() => {
                            if (!pacingInfo.previousTimedNote || !pacingInfo.nextTimedNote) return '—';
                            const startMin = timeToMinutes(pacingInfo.previousTimedNote.time || '');
                            const endMin = timeToMinutes(pacingInfo.nextTimedNote.time || '');
                            let totalMin = endMin - startMin;
                            if (totalMin < 0) totalMin += 24 * 60; // Adjust for time wrapping to next day
                            const hours = Math.floor(totalMin / 60);
                            const mins = Math.floor(totalMin % 60);
                            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                          })()}</div>
                          <div className="text-slate-400">Notes:</div>
                          <div>{(() => {
                            if (!pacingInfo.previousTimedNote || !pacingInfo.nextTimedNote) return '—';
                            const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                            const nextIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                            const currIndex = currentSlideIndex;
                            if (prevIndex < 0 || nextIndex < 0) return '—';
                            // Add 1 to convert from 0-based to 1-based position
                            return `${currIndex - prevIndex + 1}/${nextIndex - prevIndex}`;
                          })()}</div>
                        </div>
                      </div>
                      
                      <div className="mt-1 text-[9px] sm:text-xs">
                        <span className="text-white/80">White dot:</span> Your current position
                        <br />
                        <span className="text-gray-400">Grey dot:</span> Schedule status - 
                        {pacingInfo.timePositionInMinutes > 0
                          ? `${Math.abs(Math.round(pacingInfo.timePositionInMinutes))} min behind`
                          : pacingInfo.timePositionInMinutes < 0 
                            ? `${Math.abs(Math.round(pacingInfo.timePositionInMinutes))} min ahead` 
                            : "right on time"}
                      </div>
                      
                      {/* Time allocation info */}
                      {(() => {
                        // Store the value to avoid multiple calls
                        const nextSlide = getNextTimedSlide();
                        return currentNote?.time && nextSlide?.time ? (
                          <div className="mt-1 border-t border-gray-700 pt-1 text-[9px] sm:text-xs">
                            {(() => {
                              try {
                                const timeInfo = calculateTimeInfo(
                                  flattenedNotes, 
                                  currentNote.id,
                                  flattenedNotes.map(note => note.id)
                                );
                                
                                return timeInfo ? (
                                  <div className="grid grid-cols-2 gap-x-2 text-left">
                                    <span className="opacity-70">Slides:</span>
                                    <span>{timeInfo.slideCount}</span>
                                    <span className="opacity-70">Total time:</span>
                                    <span>{timeInfo.totalMinutes} min</span>
                                    <span className="opacity-70">Per slide:</span>
                                    <span>{timeInfo.formattedPerSlide} per slide</span>
                                  </div>
                                ) : null;
                              } catch (err) {
                                console.error('Error calculating time info:', err);
                                return null;
                              }
                            })()}
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Debug timing information - always visible */}
                      <div className="mt-2 pt-1 border-t border-gray-700 bg-gray-800 p-1 rounded text-[9px] sm:text-xs">
                        <div className="grid grid-cols-2 gap-x-1 font-mono text-white">
                          <div className="text-green-400 font-semibold whitespace-nowrap">Start Time:</div>
                          <div>{currentNote?.time || '—'}</div>
                          
                          <div className="text-green-400 font-semibold whitespace-nowrap">End Time:</div>
                          <div>{getNextTimedSlide()?.time || '—'}</div>
                          
                          <div className="text-green-400 font-semibold whitespace-nowrap">Total Time to spend:</div>
                          <div>{(() => {
                            if (currentNote?.time) {
                              const nextTimedSlide = getNextTimedSlide();
                              if (nextTimedSlide?.time) {
                                const startMin = timeToMinutes(currentNote.time);
                                const endMin = timeToMinutes(nextTimedSlide.time);
                                let totalMin = endMin - startMin;
                                if (totalMin < 0) totalMin += 24 * 60;
                                const hours = Math.floor(totalMin / 60);
                                const mins = Math.floor(totalMin % 60);
                                const secs = Math.round((totalMin % 1) * 60);
                                return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                              }
                            }
                            return '—';
                          })()}</div>
                          
                          <div className="text-green-400 font-semibold whitespace-nowrap">Notes to spend on time:</div>
                          <div>{(() => {
                            if (currentNote?.time) {
                              const nextTimedSlide = getNextTimedSlide();
                              if (nextTimedSlide) {
                                const nextIndex = flattenedNotes.findIndex(n => n.id === nextTimedSlide.id);
                                if (nextIndex < 0) return '—';
                                return nextIndex - currentSlideIndex;
                              }
                              return '1';
                            }
                            return '—';
                          })()}</div>
                          
                          <div className="text-green-400 font-semibold whitespace-nowrap">Current Note of these:</div>
                          <div>{(() => {
                            if (currentNote?.time) {
                              return '1'; // First note in the time span
                            } else if (pacingInfo.previousTimedNote) {
                              const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                              if (prevIndex >= 0) {
                                // Return 1-based position (not 0-based)
                                return (currentSlideIndex - prevIndex + 1).toString();
                              }
                            }
                            return '—';
                          })()}</div>
                          
                          <div className="text-green-400 font-semibold whitespace-nowrap">Result is:</div>
                          <div>{(() => {
                            // Get the current time
                            const now = new Date();
                            const currentHour = now.getHours();
                            const currentMinute = now.getMinutes();
                            const currentSeconds = now.getSeconds();
                            
                            // Calculate current time in minutes
                            const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSeconds / 60);
                            
                            // If we're on a timed slide
                            if (currentNote?.time) {
                              // For timed slides, the result is the difference between current time and the slide's time
                              const slideTimeInMinutes = timeToMinutes(currentNote.time);
                              
                              // Calculate difference
                              let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                              
                              // Handle crossing midnight
                              if (diffMinutes < -12 * 60) { // If negative and more than 12 hours, assume we crossed midnight
                                diffMinutes += 24 * 60;
                              } else if (diffMinutes > 12 * 60) { // If positive and more than 12 hours, assume we crossed midnight backwards
                                diffMinutes -= 24 * 60;
                              }
                              
                              // Format the time difference
                              const sign = diffMinutes >= 0 ? '+' : '-';
                              const absDiff = Math.abs(diffMinutes);
                              const hours = Math.floor(absDiff / 60);
                              const mins = Math.floor(absDiff % 60);
                              const secs = Math.round((absDiff % 1) * 60);
                              
                              return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                            }
                            
                            // Between two timed notes
                            if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                              const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                              const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                              
                              // Calculate total time span
                              let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                              if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                              
                              // Find slide positions
                              const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                              const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                              
                              if (prevSlideIndex < 0 || nextSlideIndex < 0) return '—';
                              
                              // Calculate total slides and our position
                              const totalSlides = nextSlideIndex - prevSlideIndex;
                              if (totalSlides <= 1) return '00:00:00'; // Avoid division by zero
                              
                              // Calculate our position (fraction) between the two timed slides
                              const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;
                              
                              // Calculate the expected time at our position using linear interpolation
                              const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                              
                              // Calculate difference between current time and expected time
                              let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                              
                              // Handle crossing midnight
                              if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                              else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                              
                              // Format the time difference
                              const sign = diffMinutes >= 0 ? '+' : '-';
                              const absDiff = Math.abs(diffMinutes);
                              const hours = Math.floor(absDiff / 60);
                              const mins = Math.floor(absDiff % 60);
                              const secs = Math.round((absDiff % 1) * 60);
                              
                              return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                            }
                            
                            // No timed slides available for calculation
                            return '00:00:00';
                          })()}</div>
                          
                          {/* Human-readable time display */}
                          <div className="text-green-400 font-semibold whitespace-nowrap mt-1">Status:</div>
                          <div>{(() => {
                            // Get the current time
                            const now = new Date();
                            const currentHour = now.getHours();
                            const currentMinute = now.getMinutes();
                            const currentSeconds = now.getSeconds();
                            
                            // Calculate current time in minutes
                            const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSeconds / 60);
                            
                            // If we're on a timed slide
                            if (currentNote?.time) {
                              // For timed slides, calculate difference between current time and slide's time
                              const slideTimeInMinutes = timeToMinutes(currentNote.time);
                              let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                              
                              // Handle crossing midnight
                              if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                              else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                              
                              // Format as human-readable time difference
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
                              
                              if (prevSlideIndex < 0 || nextSlideIndex < 0) return 'Time data unavailable';
                              
                              // Calculate total slides and our position
                              const totalSlides = nextSlideIndex - prevSlideIndex;
                              if (totalSlides <= 1) return 'Right on time'; // Avoid division by zero
                              
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
                            }
                            
                            // No timed slides available for calculation
                            return 'Time data unavailable';
                          })()}</div>
                        </div>
                      </div>

                      {/* Pacing information - only show if both timing markers are available */}
                      {pacingInfo.previousTimedNote || pacingInfo.nextTimedNote ? (
                        <div className="mt-1 pt-1 border-t border-gray-700">
                          <div className="flex justify-between text-[9px] sm:text-xs">
                            <span className={pacingInfo.slideDifference > 0 ? "text-green-400" : 
                                            pacingInfo.slideDifference < 0 ? "text-orange-400" : "text-blue-400"}>
                              {pacingInfo.slideDifference > 0 ? `${pacingInfo.slideDifference} slides ahead` :
                              pacingInfo.slideDifference < 0 ? `${Math.abs(pacingInfo.slideDifference)} slides behind` :
                              'On schedule'}
                            </span>
                            <span className="opacity-70">
                              {pacingInfo.previousTimedNote && pacingInfo.nextTimedNote ? 
                                `${Math.round(pacingInfo.percentComplete * 100)}% between time points` :
                                pacingInfo.nextTimedNote ? 'Starting segment' : 'Ending segment'}
                            </span>
                          </div>
                          
                          {/* Time markers */}
                          <div className="flex justify-between mt-1 text-[8px] sm:text-[10px] opacity-60">
                            <span>{pacingInfo.previousTimedNote?.time || '—'}</span>
                            <span>{pacingInfo.previousTimedNote && pacingInfo.nextTimedNote ? 
                              `${Math.floor(pacingInfo.percentComplete * 100)}%` : 
                              currentNote?.time || 'Current'}</span>
                            <span>{pacingInfo.nextTimedNote?.time || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 pt-1 border-t border-gray-700">
                          <div className="text-[9px] sm:text-xs text-yellow-300">
                            {pacingInfo.previousTimedNote ? 
                              'Add time to upcoming slides to track pacing' : 
                              pacingInfo.nextTimedNote ?
                              'The progress indicator shows your position between timed slides' :
                              'Add time markers to track presentation pacing'}
                          </div>
                          
                          {/* Simple time markers */}
                          <div className="flex justify-between mt-1 text-[8px] sm:text-[10px] opacity-60">
                            <span>{pacingInfo.previousTimedNote ? (pacingInfo.previousTimedNote as Note).time || '—' : '—'}</span>
                            <span>{currentNote?.time || 'No time set'}</span>
                            <span>{pacingInfo.nextTimedNote ? (pacingInfo.nextTimedNote as Note).time || '—' : '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </>
      )}
    </div>
  );
}