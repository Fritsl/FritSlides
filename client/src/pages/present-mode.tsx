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
  nextUpcomingTime: string | null; // The time marker of the next upcoming time marker
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
    
    // Check for special slides first
    if (isStartSlide || isEndSlide) {
      return START_END_THEME;
    }
    
    // Use root index for theming
    const rootIdx = currentNote.rootIndex || 0;
    const themeIndex = rootIdx % 5; // Cycle through 5 distinct themes
    
    // Root note overview slides (chapter slides) get a neutral variant of their theme
    // All other slides get the full theme
    return getPresentationTheme(themeIndex, isOverviewSlide ? 0 : 1);
  }, [currentNote, isStartSlide, isEndSlide, isOverviewSlide]);
  
  // Collect all time info for current progress calculation
  const pacingInfo = useMemo(() => {
    // Default empty state
    const defaultPacing: PacingInfo = {
      previousTimedNote: null,
      nextTimedNote: null, 
      percentComplete: 0,
      slideDifference: 0
    };
    
    // Calculate pacing only if we have notes
    if (!flattenedNotes.length) return defaultPacing;
    
    // Get pacing information for the current position
    return calculatePacingInfo(
      flattenedNotes, 
      currentSlideIndex
    );
  }, [flattenedNotes, currentSlideIndex]);
  
  // Get the next timed slide for display in tooltip
  const getNextTimedSlide = () => {
    if (!currentNote || currentSlideIndex >= flattenedNotes.length - 1) {
      return null;
    }
    
    // First see if pacingInfo already has the next timed note
    if (pacingInfo.nextTimedNote) {
      return pacingInfo.nextTimedNote;
    }
    
    // Otherwise look for the next slide with time data starting from current+1
    for (let i = currentSlideIndex + 1; i < flattenedNotes.length; i++) {
      const nextNote = flattenedNotes[i];
      if (nextNote.time) {
        return nextNote;
      }
    }
    
    return null;
  };
  
  // Function to find the major slide that contains this one
  const isMajorSlide = (note: PresentationNote): boolean => 
    note.level === 0 || note.isOverviewSlide || note.isStartSlide || note.isEndSlide;
  
  // Find parent's path for navigation
  const findAncestorPath = (note: PresentationNote, notesMap: Map<number, PresentationNote>): React.ReactNode => {
    if (!note.parentId) {
      return null;
    }
    
    // Get the direct parent
    const parent = notesMap.get(note.parentId);
    if (!parent) {
      return null;
    }
    
    // If parent content is longer than 15 chars, truncate it
    const displayText = parent.content && parent.content.length > 15 ? 
      parent.content.substring(0, 12) + '...' : 
      parent.content;
    
    // Recurse for grandparent path
    const parentPath = findAncestorPath(parent, notesMap);
    
    return (
      <>
        {parentPath}
        {parentPath && <span className="opacity-60 mx-1">›</span>}
        <span>{displayText}</span>
      </>
    );
  };
  
  // Find root index for a slide - used for theming
  const findRootIndex = (note: PresentationNote): number => {
    if (note.rootIndex !== undefined) {
      return note.rootIndex;
    }
    
    if (!note.parentId) {
      return 0; // Root note default
    }
    
    // Look up the parent
    const parent = notesMap.get(note.parentId);
    if (!parent) {
      return 0;
    }
    
    // Recursively get rootIndex from parent
    return findRootIndex(parent);
  };
  
  // Effect to initialize with default starting slide or last viewed slide
  useEffect(() => {
    if (isLoading || initializedFromStored || !flattenedNotes.length) {
      return;
    }
    
    // Find the starting slide based on parameters or last viewed slide
    if (startNoteId > 0) {
      // Find the slide index for the specific note ID
      const index = flattenedNotes.findIndex(note => note.id === startNoteId);
      if (index >= 0) {
        setCurrentSlideIndex(index);
        setInitializedFromStored(true);
        return;
      }
    }
    
    // If no specific note ID was provided, use the stored lastViewedSlideIndex
    // from the project data, but only if we're continuing the presentation
    if (shouldContinue && currentProject?.lastViewedSlideIndex !== null && 
        currentProject?.lastViewedSlideIndex !== undefined && 
        currentProject.lastViewedSlideIndex < flattenedNotes.length) {
      setCurrentSlideIndex(currentProject.lastViewedSlideIndex);
    }
    
    setInitializedFromStored(true);
  }, [isLoading, flattenedNotes, initializedFromStored, currentProject, startNoteId, shouldContinue]);
  
  // Save position when slide changes
  useEffect(() => {
    if (currentSlideIndex >= 0 && !isLoading && flattenedNotes.length) {
      saveLastViewedSlideIndex(currentSlideIndex);
    }
  }, [currentSlideIndex, isLoading, flattenedNotes]);
  
  // Handle keyboard navigation
  useEffect(() => {
    // Skip if we're still loading
    if (isLoading) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space' || e.key === 'ArrowDown') {
        e.preventDefault();
        // Go to next slide if not at the end
        if (currentSlideIndex < flattenedNotes.length - 1) {
          setCurrentSlideIndex(currentSlideIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') {
        e.preventDefault();
        // Go to previous slide if not at the beginning
        if (currentSlideIndex > 0) {
          setCurrentSlideIndex(currentSlideIndex - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        // Go to first slide
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        // Go to last slide
        setCurrentSlideIndex(flattenedNotes.length - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Exit presentation mode
        handleExitPresentation();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        // Toggle fullscreen
        toggleFullscreen();
      }
    };
    
    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentSlideIndex, flattenedNotes, isLoading]);
  
  // Handle fullscreen toggling
  const toggleFullscreen = () => {
    if (screenfull.isEnabled) {
      if (screenfull.isFullscreen) {
        screenfull.exit();
        setIsFullscreen(false);
      } else {
        screenfull.request();
        setIsFullscreen(true);
      }
    }
  };
  
  // Listen for fullscreen change from browser controls
  useEffect(() => {
    if (screenfull.isEnabled) {
      const onFullscreenChange = () => {
        setIsFullscreen(screenfull.isFullscreen);
      };
      
      screenfull.on('change', onFullscreenChange);
      
      return () => {
        screenfull.off('change', onFullscreenChange);
      };
    }
  }, []);
  
  // Handle exiting presentation mode
  const handleExitPresentation = () => {
    // Navigation back to the main note view for the project
    if (projectId) {
      setLocation(`/projects/${projectId}`);
    } else {
      // If no project ID (shouldn't happen), just go home
      setLocation('/');
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Loading presentation...</p>
        </div>
      </div>
    );
  }
  
  // If no slides are found, show an error
  if (!flattenedNotes.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-800 text-white">
        <div className="text-center max-w-md mx-auto p-6 bg-slate-900 rounded-lg shadow-xl">
          <h2 className="text-xl font-bold mb-4">No slides available</h2>
          <p className="mb-6">This project doesn't have any notes to present.</p>
          <button 
            onClick={handleExitPresentation}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Return to Project
          </button>
        </div>
      </div>
    );
  }
  
  // Get the background style for the current slide
  const backgroundStyle = getThemeBackgroundStyle(theme);
  
  return (
    <div 
      className="min-h-screen w-full overflow-hidden text-white flex flex-col"
      style={backgroundStyle}
    >
      {/* Presentation content */}
      {currentNote && (
        <>
          {/* Header with title and breadcrumb navigation */}
          <div className="flex justify-between items-center p-2 md:p-3 lg:p-4 text-xs md:text-sm">
            <div className="flex-1 text-left truncate">
              {findAncestorPath(currentNote, notesMap)}
            </div>
            <div className="flex-1 text-center font-medium tracking-wide">
              {isStartSlide ? (
                currentProject?.name || "Project"
              ) : isEndSlide ? (
                "End"
              ) : isOverviewSlide ? (
                "Overview"
              ) : null}
            </div>
            <div className="flex-1 text-right">
              <span className="opacity-70">{currentSlideIndex + 1}</span>
              <span className="mx-1 opacity-40">/</span>
              <span className="opacity-70">{flattenedNotes.length}</span>
            </div>
          </div>
          
          {/* Main slide content */}
          <div className="flex-1 flex items-center justify-center w-full overflow-hidden p-8 md:p-12 lg:p-16 relative">
            {/* Render different slide types */}
            {isStartSlide ? (
              // Project start slide
              <div className="max-w-4xl w-full text-center">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8">
                  {currentNote.content}
                </h1>
                {rootNotes.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {rootNotes.map((rootNote, index) => (
                      <div 
                        key={rootNote.id}
                        className="bg-white/10 p-4 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                        onClick={() => {
                          // Find the index of this root note's first slide or overview
                          const targetIndex = flattenedNotes.findIndex(note => 
                            note.id === rootNote.id || 
                            (note.isOverviewSlide && note.content === rootNote.content)
                          );
                          if (targetIndex > 0) {
                            setCurrentSlideIndex(targetIndex);
                          }
                        }}
                      >
                        <h3 className="font-medium mb-1 text-lg">{rootNote.content}</h3>
                        {rootNote.childNotes && rootNote.childNotes.length > 0 && (
                          <div className="text-sm opacity-70">
                            {rootNote.childNotes.length} note{rootNote.childNotes.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {currentProject?.author && (
                  <div className="mt-12 flex items-center justify-center text-sm opacity-80">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{currentProject.author}</span>
                  </div>
                )}
              </div>
            ) : isEndSlide ? (
              // Project end slide
              <div className="max-w-3xl text-center">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                  {currentNote.content}
                </h1>
                {currentNote.author && (
                  <div className="mt-12 flex items-center justify-center text-sm opacity-80">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{currentNote.author}</span>
                  </div>
                )}
              </div>
            ) : isOverviewSlide && currentNote.childNotes ? (
              // Chapter overview slide
              <OverviewSlide 
                title={currentNote.content} 
                notes={currentNote.childNotes}
                theme={theme.colors}
                onNoteClick={(noteId) => {
                  // Find the note in the flattened array and navigate to it
                  const targetIndex = flattenedNotes.findIndex(note => note.id === noteId);
                  if (targetIndex >= 0) {
                    setCurrentSlideIndex(targetIndex);
                  }
                }}
              />
            ) : (
              // Regular content slide
              <div className="w-full max-w-7xl">
                {/* Determine content type and apply appropriate formatting */}
                <div className={`slide-content relative ${currentNote.isDiscussion ? "discussion-marker" : ""}`}>
                  {/* Main content */}
                  {currentNote.content && (
                    <div 
                      className={`content-block ${currentNote.url || currentNote.youtubeLink ? 'mb-4' : ''}`}
                      style={generateTypographyStyles(
                        getTypographyStyles(
                          determineContentType(currentNote.content), 
                          currentNote.level || 0,
                          currentNote.content.length
                        )
                      )}
                    >
                      {formatContent(currentNote.content)}
                    </div>
                  )}
                  
                  {/* External URL link */}
                  {currentNote.url && (
                    <div className="mb-4">
                      <a 
                        href={currentNote.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block text-blue-300 hover:text-blue-100 underline transition-colors"
                      >
                        {currentNote.linkText || currentNote.url}
                      </a>
                    </div>
                  )}
                  
                  {/* YouTube embed */}
                  {currentNote.youtubeLink && (
                    <div className="w-full aspect-video max-w-3xl mx-auto mb-4">
                      <iframe
                        src={getYoutubeEmbedUrl(currentNote.youtubeLink, currentNote.time || '')}
                        className="w-full h-full rounded-md"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}
                  
                  {/* Images display */}
                  {currentNote.images && currentNote.images.length > 0 && (
                    <div className={`mt-4 grid grid-cols-1 ${
                      currentNote.images.length === 1 ? 'md:grid-cols-1' :
                      currentNote.images.length === 2 ? 'md:grid-cols-2' :
                      currentNote.images.length === 3 ? 'md:grid-cols-3' :
                      currentNote.images.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''
                    } gap-4`}>
                      {currentNote.images.map((imgSrc, index) => (
                        <div key={index} className="relative overflow-hidden rounded-lg">
                          <ImageWithFallback
                            src={imgSrc}
                            alt={`Slide image ${index + 1}`}
                            className="w-full h-auto max-h-[400px] object-contain bg-black/20 rounded-lg"
                            onError={() => console.error(`Failed to load image: ${imgSrc}`)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Time tracking dots - Always show on all slides except overview slides and end slide */}
          {(!isOverviewSlide || currentNote?.time || isStartSlide) && !isEndSlide && (
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
                      {/* White dot (current position) - always centered with 35% opacity */}
                      <div 
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/35 transition-all duration-300"
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)',
                          boxShadow: '0 0 4px rgba(255,255,255,0.3)'
                        }}
                      />
                      
                      {/* Black dot (schedule position) - position based on timing */}
                      <div 
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black transition-all duration-300"
                        style={{
                          left: (() => {
                            try {
                              // Get the current time
                              const now = new Date();
                              const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
                              
                              // Position depends on schedule status
                              if (currentNote?.time) {
                                // For slides with a direct time marker
                                const timeDiffMinutes = currentTimeInMinutes - timeToMinutes(currentNote.time);
                                
                                // Handle crossing midnight
                                let adjustedDiffMinutes = timeDiffMinutes;
                                if (timeDiffMinutes < -12 * 60) adjustedDiffMinutes += 24 * 60;
                                else if (timeDiffMinutes > 12 * 60) adjustedDiffMinutes -= 24 * 60;
                                
                                // Calculate left position
                                // negative means ahead (dot to the left), positive means behind (dot to the right)
                                // Cap at +/- 50px to keep within container bounds
                                const maxOffset = 50; // Maximum pixels from center
                                
                                // Non-linear scaling for better visual indication:
                                // 5 minutes = 25px, 10 minutes = 40px, 15+ minutes = 50px
                                let offsetPixels = 0;
                                const absDiff = Math.abs(adjustedDiffMinutes);
                                
                                if (absDiff < 5) {
                                  // Linear from 0-25px for first 5 minutes
                                  offsetPixels = (absDiff / 5) * 25;
                                } else if (absDiff < 10) {
                                  // Linear from 25-40px for 5-10 minutes
                                  offsetPixels = 25 + ((absDiff - 5) / 5) * 15;
                                } else if (absDiff < 15) {
                                  // Linear from 40-50px for 10-15 minutes
                                  offsetPixels = 40 + ((absDiff - 10) / 5) * 10;
                                } else {
                                  // Maximum offset for 15+ minutes
                                  offsetPixels = 50;
                                }
                                
                                // Apply sign based on whether ahead or behind
                                offsetPixels = adjustedDiffMinutes >= 0 ? offsetPixels : -offsetPixels;
                                
                                // Calculate position: 50% (center) + offset
                                return `calc(50% + ${offsetPixels}px)`;
                              } else if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                                // For slides between two timed slides, calculate the expected time
                                const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                                const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                                
                                // Calculate total time span, handling day boundaries
                                let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                                if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                                
                                // Find slide positions
                                const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                                const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                                
                                if (prevSlideIndex < 0 || nextSlideIndex < 0 || prevSlideIndex >= nextSlideIndex) {
                                  return "50%"; // Center position as fallback
                                }
                                
                                // Calculate slides between the time points
                                const totalSlides = nextSlideIndex - prevSlideIndex;
                                
                                // Calculate our position (fraction) between the two timed slides
                                const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;
                                
                                // Calculate the expected time at our position
                                const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                                
                                // Calculate time difference between current time and expected time
                                let timeDiffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                                
                                // Handle crossing midnight
                                if (timeDiffMinutes < -12 * 60) timeDiffMinutes += 24 * 60;
                                else if (timeDiffMinutes > 12 * 60) timeDiffMinutes -= 24 * 60;
                                
                                // Calculate left position
                                // negative means ahead (dot to the left), positive means behind (dot to the right)
                                // Cap at +/- 50px to keep within container bounds
                                const maxOffset = 50; // Maximum pixels from center
                                
                                // Non-linear scaling for better visual indication:
                                // 5 minutes = 25px, 10 minutes = 40px, 15+ minutes = 50px
                                let offsetPixels = 0;
                                const absDiff = Math.abs(timeDiffMinutes);
                                
                                if (absDiff < 5) {
                                  // Linear from 0-25px for first 5 minutes
                                  offsetPixels = (absDiff / 5) * 25;
                                } else if (absDiff < 10) {
                                  // Linear from 25-40px for 5-10 minutes
                                  offsetPixels = 25 + ((absDiff - 5) / 5) * 15;
                                } else if (absDiff < 15) {
                                  // Linear from 40-50px for 10-15 minutes
                                  offsetPixels = 40 + ((absDiff - 10) / 5) * 10;
                                } else {
                                  // Maximum offset for 15+ minutes
                                  offsetPixels = 50;
                                }
                                
                                // Apply sign based on whether ahead or behind
                                offsetPixels = timeDiffMinutes >= 0 ? offsetPixels : -offsetPixels;
                                
                                // Calculate position: 50% (center) + offset
                                return `calc(50% + ${offsetPixels}px)`;
                              }
                              
                              // Default: If we can't calculate, use center position
                              return "50%";
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
                  <TooltipContent side="top" className="bg-black/90 text-white text-sm p-3">
                    <div className="text-center">
                      {(() => {
                        // Get the current time
                        const now = new Date();
                        const currentHour = now.getHours();
                        const currentMinute = now.getMinutes();
                        
                        // Format current time
                        const formattedCurrentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                        
                        // Calculate current time in minutes
                        const currentTimeInMinutes = currentHour * 60 + currentMinute + (now.getSeconds() / 60);
                        
                        // If we're on a timed slide
                        if (currentNote?.time) {
                          // For timed slides, the result is the difference between current time and the slide's time
                          const slideTimeInMinutes = timeToMinutes(currentNote.time);
                          
                          // Calculate difference
                          let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                          
                          // Handle crossing midnight
                          if (diffMinutes < -12 * 60) {
                            diffMinutes += 24 * 60;
                          } else if (diffMinutes > 12 * 60) {
                            diffMinutes -= 24 * 60;
                          }
                          
                          // Format for human readability
                          const isAhead = diffMinutes < 0;
                          const absDiff = Math.abs(diffMinutes);
                          
                          // Format time components
                          const hours = Math.floor(absDiff / 60);
                          const mins = Math.floor(absDiff % 60);
                          
                          let timeText = '';
                          if (hours > 0) {
                            timeText += `${hours} hour${hours !== 1 ? 's' : ''}`;
                            if (mins > 0) {
                              timeText += ` ${mins} minute${mins !== 1 ? 's' : ''}`;
                            }
                          } else {
                            timeText += `${mins} minute${mins !== 1 ? 's' : ''}`;
                          }
                          
                          return (
                            <div className="flex flex-col space-y-2">
                              <div className={`text-lg font-medium ${isAhead ? 'text-green-400' : 'text-yellow-400'}`}>
                                {Math.abs(diffMinutes) < 0.5 ? 'Right on time' : `${timeText} ${isAhead ? 'ahead' : 'behind'}`}
                              </div>
                              <div className="text-white/80">
                                Current: {formattedCurrentTime}
                                <br />
                                Should view at: {currentNote.time}
                              </div>
                            </div>
                          );
                        }
                        
                        // Between two timed notes
                        if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                          const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                          const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                          
                          // Calculate total time span
                          let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                          if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                          
                          // Find slide positions for interpolation
                          const prevSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                          const nextSlideIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                          
                          // Only proceed if we can find both slides
                          if (prevSlideIndex < 0 || nextSlideIndex < 0) {
                            return <div>Slide position information not available</div>;
                          }
                          
                          // Calculate progress through the slides between time points
                          const totalSlides = nextSlideIndex - prevSlideIndex;
                          const slideProgress = (currentSlideIndex - prevSlideIndex) / totalSlides;
                          
                          // Calculate expected time at this position using linear interpolation
                          const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                          const formattedExpectedTime = `${Math.floor(expectedTimeInMinutes / 60).toString().padStart(2, '0')}:${Math.floor(expectedTimeInMinutes % 60).toString().padStart(2, '0')}`;
                          
                          // Calculate difference between current time and expected time
                          let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                          
                          // Handle crossing midnight
                          if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                          else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                          
                          // Format for human readability
                          const isAhead = diffMinutes < 0;
                          const absDiff = Math.abs(diffMinutes);
                          
                          // Format time components
                          const hours = Math.floor(absDiff / 60);
                          const mins = Math.floor(absDiff % 60);
                          
                          let timeText = '';
                          if (hours > 0) {
                            timeText += `${hours} hour${hours !== 1 ? 's' : ''}`;
                            if (mins > 0) {
                              timeText += ` ${mins} minute${mins !== 1 ? 's' : ''}`;
                            }
                          } else {
                            timeText += `${mins} minute${mins !== 1 ? 's' : ''}`;
                          }
                          
                          return (
                            <div className="flex flex-col space-y-2">
                              <div className={`text-lg font-medium ${isAhead ? 'text-green-400' : 'text-yellow-400'}`}>
                                {Math.abs(diffMinutes) < 0.5 ? 'Right on time' : `${timeText} ${isAhead ? 'ahead' : 'behind'}`}
                              </div>
                              <div className="text-white/80">
                                Current: {formattedCurrentTime}
                                <br />
                                Expected: {formattedExpectedTime}
                              </div>
                            </div>
                          );
                        }
                        
                        // No timed slides available
                        return <div>Add time markers to track presentation pacing</div>;
                      })()}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </>
      )}
      
      {/* Navigation and Controls */}
      <div className="px-4 py-2 flex justify-between items-center">
        <button 
          onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
          disabled={currentSlideIndex <= 0}
          className={`px-3 py-1 rounded transition-colors 
            ${currentSlideIndex <= 0 ? 'text-white/20 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
        >
          Previous
        </button>
        
        <FullscreenToggle 
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
        />
        
        <button 
          onClick={handleExitPresentation}
          className="px-3 py-1 rounded hover:bg-white/10 transition-colors"
        >
          Exit
        </button>
        
        <button 
          onClick={() => setCurrentSlideIndex(Math.min(flattenedNotes.length - 1, currentSlideIndex + 1))}
          disabled={currentSlideIndex >= flattenedNotes.length - 1}
          className={`px-3 py-1 rounded transition-colors
            ${currentSlideIndex >= flattenedNotes.length - 1 ? 'text-white/20 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}