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
import '@fontsource/raleway';
import '@fontsource/bebas-neue';
import { motion, AnimatePresence } from "framer-motion";
import { useFullScreenToggle } from "@/components/ui/fullscreen-toggle";
import { isMobileDevice } from "@/lib/utils";
import { TimeDisplay } from "@/components/ui/time-display";
import { TimeDebugPanel } from "@/components/ui/time-debug-panel";
import { OverviewSlide } from "@/components/ui/overview-slide";

// Import types for content recognition
type ContentType = "text" | "markdown" | "image" | "code" | "video" | "slide";

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

interface PacingInfo {
  previousTimedNote: PresentationNote | null;
  nextTimedNote: PresentationNote | null;
}

interface TimeSegment {
  lastPassedSlideIndex: number; // Index of the slide with the last passed time marker
  nextUpcomingSlideIndex: number | null; // Index of the slide with the next upcoming time marker
  lastPassedTime: string; // The time marker of the last passed slide
  nextUpcomingTime: string | null; // The time marker of the next upcoming slide
  currentProgress: number; // Progress between 0-1 indicating position between time points
}

// Helper function to convert time string (e.g., "09:30") to minutes
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to calculate time info for a segment
const calculateTimeInfo = (
  notes: PresentationNote[],
  currentNoteId: number,
  slideIdSequence: number[]
): { slideCount: number; totalMinutes: number; formattedPerSlide: string } | null => {
  try {
    // Find current note and next timed note
    const currentNote = notes.find(n => n.id === currentNoteId);
    if (!currentNote?.time) return null;
    
    const currentIndex = slideIdSequence.indexOf(currentNoteId);
    if (currentIndex < 0) return null;
    
    // Find the next timed note
    let nextTimedNoteIndex = -1;
    
    for (let i = currentIndex + 1; i < slideIdSequence.length; i++) {
      const noteId = slideIdSequence[i];
      const note = notes.find(n => n.id === noteId);
      if (note?.time) {
        nextTimedNoteIndex = i;
        break;
      }
    }
    
    if (nextTimedNoteIndex < 0) return null;
    
    const nextTimedNote = notes.find(n => n.id === slideIdSequence[nextTimedNoteIndex]);
    if (!nextTimedNote?.time) return null;
    
    // Calculate slide count in this segment
    const slideCount = nextTimedNoteIndex - currentIndex;
    
    // Calculate minutes between start and end time
    const startMin = timeToMinutes(currentNote.time);
    const endMin = timeToMinutes(nextTimedNote.time);
    
    // Handle crossing midnight
    let totalMin = endMin - startMin;
    if (totalMin < 0) totalMin += 24 * 60;
    
    // Calculate minutes per slide
    const minutesPerSlide = totalMin / slideCount;
    
    // Format per slide time
    const minutesWhole = Math.floor(minutesPerSlide);
    const seconds = Math.round((minutesPerSlide - minutesWhole) * 60);
    
    const formattedPerSlide = seconds > 0 
      ? `${minutesWhole}:${seconds.toString().padStart(2, '0')}`
      : `${minutesWhole} min`;
    
    return {
      slideCount,
      totalMinutes: Math.round(totalMin),
      formattedPerSlide
    };
  } catch (err) {
    console.error("Error calculating time info:", err);
    return null;
  }
};

/**
 * Determine the content type based on the content string.
 */
function determineContentType(content: string): ContentType {
  if (!content) return "text";
  
  // Check for Markdown code blocks (```code```)
  if (content.match(/```[\s\S]*?```/)) return "markdown";
  
  // Check for Markdown links with image extensions
  if (content.match(/!\[.*?\]\(.*?\.(jpg|jpeg|png|gif|webp|svg).*?\)/i)) return "markdown";
  
  // Check for HTML image tags
  if (content.match(/<img.*?src=["'].*?["'].*?>/i)) return "markdown";
  
  // Check for Markdown headings, lists, etc.
  if (content.match(/^(#+\s|\*\s|-\s|\d+\.\s)/m)) return "markdown";
  
  // Check for Markdown links
  if (content.match(/\[.*?\]\(.*?\)/)) return "markdown";
  
  // Check for Markdown emphasis
  if (content.match(/(\*\*.*?\*\*|__.*?__|_.*?_|\*.*?\*)/)) return "markdown";
  
  // Check if it looks like an image URL
  if (content.match(/^https?:\/\/.*?\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) return "image";
  
  return "text";
}

// Format time difference in human-readable form
const formatTimeDifferenceHuman = (
  diffMinutes: number, 
  currentTimeInMinutes: number, 
  expectedTimeInMinutes: number
): string => {
  try {
    // Format times for display
    const currentHour = Math.floor(currentTimeInMinutes / 60) % 24;
    const currentMinute = Math.floor(currentTimeInMinutes % 60);
    const currentFormatted = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    const expectedHour = Math.floor(expectedTimeInMinutes / 60) % 24;
    const expectedMinute = Math.floor(expectedTimeInMinutes % 60);
    const expectedFormatted = `${expectedHour.toString().padStart(2, '0')}:${expectedMinute.toString().padStart(2, '0')}`;
    
    if (Math.abs(diffMinutes) >= 60) {
      const hours = Math.floor(Math.abs(diffMinutes) / 60);
      const mins = Math.abs(diffMinutes) % 60;
      
      if (diffMinutes > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} behind (Current: ${currentFormatted}, Should view at: ${expectedFormatted})`;
      } else {
        return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ahead (Current: ${currentFormatted}, Should view at: ${expectedFormatted})`;
      }
    } else {
      // Less than an hour difference
      if (diffMinutes > 1) {
        return `${Math.round(diffMinutes)} minutes behind (Current: ${currentFormatted}, Should view at: ${expectedFormatted})`;
      } else if (diffMinutes < -1) {
        return `${Math.abs(Math.round(diffMinutes))} minutes ahead (Current: ${currentFormatted}, Should view at: ${expectedFormatted})`;
      } else {
        return `Right on time (Current: ${currentFormatted})`;
      }
    }
  } catch (err) {
    console.error("Error formatting time difference:", err);
    return "Time calculation error";
  }
};

export default function PresentMode() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toggleFullScreen, isFullScreen } = useFullScreenToggle();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [themeNotes, setThemeNotes] = useState<PresentationNote[]>([]);
  const [currentNoteTimeBorrowed, setCurrentNoteTimeBorrowed] = useState<boolean>(false);
  const [pacingInfo, setPacingInfo] = useState<PacingInfo>({
    previousTimedNote: null,
    nextTimedNote: null
  });
  const [timeSegment, setTimeSegment] = useState<TimeSegment | null>(null);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showTimeDisplay, setShowTimeDisplay] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showCenterDot, setShowCenterDot] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  
  // Get notes and projects from context
  const { notes, getDescendants, getNote, isLoading: notesLoading } = useNotes();
  const { getProject, isLoading: projectLoading } = useProjects();
  
  const isLoading = notesLoading || projectLoading;

  // Current project data
  const project = projectId ? getProject(parseInt(projectId)) : undefined;
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        if (currentSlideIndex < flattenedNotes.length - 1) {
          setCurrentSlideIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        if (currentSlideIndex > 0) {
          setCurrentSlideIndex(prev => prev - 1);
        }
      } else if (e.key === 'Home') {
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        setCurrentSlideIndex(flattenedNotes.length - 1);
      } else if (e.key === 'o') {
        setShowOverview(prev => !prev);
      } else if (e.key === 'f') {
        toggleFullScreen();
      } else if (e.key === 'p') {
        setShowProgressBar(prev => !prev);
      } else if (e.key === 't') {
        setShowTimeDisplay(prev => !prev);
      } else if (e.key === 'd') {
        setShowDebugPanel(prev => !prev);
      } else if (e.key === 'Escape') {
        if (showOverview) {
          setShowOverview(false);
        } else if (isFullScreen) {
          toggleFullScreen();
        } else {
          setLocation(`/projects/${projectId}`);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, projectId, setLocation, isFullScreen, toggleFullScreen, showOverview]);
  
  // Process notes to create a presentation structure
  const flattenedNotes = useMemo(() => {
    if (!notes || !projectId) return [];
    
    // Current project notes
    const projectNotes = notes.filter(note => note.projectId === parseInt(projectId));
    
    // Create the start slide
    const startSlide: PresentationNote = {
      id: -1,
      projectId: parseInt(projectId),
      content: project?.name || "Presentation",
      order: -1000,
      parentId: null,
      isStartSlide: true,
      rootIndex: -1,
    };
    
    // Keep track of presentation notes
    const presentationNotes: PresentationNote[] = [startSlide];
    const rootNotes: PresentationNote[] = [];
    
    // Get all root (parentId = null) notes
    const rootProjectNotes = projectNotes.filter(note => note.parentId === null)
      .sort((a, b) => {
        if (typeof a.order === 'string' && typeof b.order === 'string') {
          return a.order.localeCompare(b.order);
        } else if (typeof a.order === 'number' && typeof b.order === 'number') {
          return a.order - b.order;
        } else return 0;
      });
    
    // Function to process a note and its children
    const addNoteAndChildren = (note: PresentationNote, currentRootIndex: number) => {
      const level = note.level || 0;
      
      // Get children of this note
      const children = getDescendants(note.id, true);
      note.hasChildren = children.length > 0;
      
      // If this note has children, create an overview slide first
      if (children.length > 0) {
        const overviewSlide: PresentationNote = {
          ...note,
          id: -2 - presentationNotes.length, // Generate a unique negative ID
          content: note.content,
          level: level,
          rootIndex: currentRootIndex,
          isOverviewSlide: true,
          childNotes: [note, ...children.map(child => ({ 
            ...child, 
            level: level + 1,
            rootIndex: currentRootIndex 
          }))],
        };
        
        presentationNotes.push(overviewSlide);
      }
      
      // Add the current note
      presentationNotes.push({
        ...note,
        level: level,
        rootIndex: currentRootIndex
      });
      
      // Add all children
      children.forEach(child => {
        addNoteAndChildren({
          ...child,
          level: level + 1,
          rootIndex: currentRootIndex
        }, currentRootIndex);
      });
    };
    
    // Process all root notes
    rootProjectNotes.forEach((rootNote, index) => {
      rootNotes.push({
        ...rootNote,
        level: 0,
        rootIndex: index
      });
      
      addNoteAndChildren({
        ...rootNote,
        level: 0,
        rootIndex: index
      }, index);
    });
    
    // Create the end slide
    const endSlide: PresentationNote = {
      id: -1000, // Use a very negative ID to avoid conflicts
      projectId: parseInt(projectId),
      content: "Thank you!",
      order: 1000,
      parentId: null,
      isEndSlide: true,
      author: project?.name,
      rootIndex: -1,
    };
    
    // Add the end slide
    presentationNotes.push(endSlide);
    
    // Update theming information
    setThemeNotes(rootNotes);
    
    return presentationNotes;
  }, [notes, projectId, project, getDescendants]);
  
  // Set initial slide index from project.lastViewedSlideIndex
  useEffect(() => {
    if (project?.lastViewedSlideIndex !== undefined && project.lastViewedSlideIndex !== null) {
      if (project.lastViewedSlideIndex >= 0 && project.lastViewedSlideIndex < flattenedNotes.length) {
        setCurrentSlideIndex(project.lastViewedSlideIndex);
      }
    }
  }, [project, flattenedNotes]);
  
  // Current note data
  const currentNote = flattenedNotes[currentSlideIndex];
  const isMajorSlide = (note: PresentationNote): boolean => 
    note.isStartSlide || note.isEndSlide || note.isOverviewSlide || note.parentId === null;
  
  // Process notes with time markers for pacing
  useEffect(() => {
    const notesWithTime = flattenedNotes.filter(note => note.time);
    
    // Find previous and next slides that have time markers
    let previousTimedNote: PresentationNote | null = null;
    let nextTimedNote: PresentationNote | null = null;
    
    // Find previous timed note
    for (let i = currentSlideIndex - 1; i >= 0; i--) {
      if (flattenedNotes[i].time) {
        previousTimedNote = flattenedNotes[i];
        break;
      }
    }
    
    // Find next timed note
    for (let i = currentSlideIndex + 1; i < flattenedNotes.length; i++) {
      if (flattenedNotes[i].time) {
        nextTimedNote = flattenedNotes[i];
        break;
      }
    }
    
    setPacingInfo({
      previousTimedNote,
      nextTimedNote
    });
    
    // Check if the current note might be using a borrowed time marker
    setCurrentNoteTimeBorrowed(!!currentNote?.time && !notesWithTime.find(n => n.id === currentNote.id));
    
  }, [currentSlideIndex, flattenedNotes, currentNote]);
  
  // Function to get time segment information
  const findTimeSegment = (): TimeSegment | null => {
    try {
      // Get all notes with time markers
      const timedSlides = flattenedNotes.filter(note => note.time).map((note, index) => ({
        note,
        index: flattenedNotes.findIndex(n => n.id === note.id)
      }));
      
      if (timedSlides.length < 1) return null;
      
      // Calculate current real time
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      
      // Find the last passed slide
      let lastPassedSlide = timedSlides[0];
      let nextUpcomingSlide = timedSlides.length > 1 ? timedSlides[1] : null;
      
      for (let i = 0; i < timedSlides.length; i++) {
        const slideTimeMinutes = timeToMinutes(timedSlides[i].note.time!);
        
        // Handle crossing midnight (assume no presentation spans more than 12 hours)
        let timeDiff = currentTimeMinutes - slideTimeMinutes;
        if (timeDiff < -12 * 60) timeDiff += 24 * 60;
        else if (timeDiff > 12 * 60) timeDiff -= 24 * 60;
        
        if (timeDiff >= 0) {
          lastPassedSlide = timedSlides[i];
          nextUpcomingSlide = i < timedSlides.length - 1 ? timedSlides[i + 1] : null;
        } else {
          break;
        }
      }
      
      // Calculate progress between time points
      let progress = 0;
      if (nextUpcomingSlide) {
        const lastTime = timeToMinutes(lastPassedSlide.note.time!);
        const nextTime = timeToMinutes(nextUpcomingSlide.note.time!);
        
        // Handle crossing midnight
        let totalTimeSpan = nextTime - lastTime;
        if (totalTimeSpan < 0) totalTimeSpan += 24 * 60;
        
        // Calculate elapsed time
        let elapsedTime = currentTimeMinutes - lastTime;
        if (elapsedTime < 0) elapsedTime += 24 * 60;
        
        progress = Math.min(1, Math.max(0, elapsedTime / totalTimeSpan));
      }
      
      return {
        lastPassedSlideIndex: lastPassedSlide.index,
        nextUpcomingSlideIndex: nextUpcomingSlide?.index ?? null,
        lastPassedTime: lastPassedSlide.note.time!,
        nextUpcomingTime: nextUpcomingSlide?.note.time ?? null,
        currentProgress: progress
      };
    } catch (err) {
      console.error("Error calculating time segment:", err);
      return null;
    }
  };
  
  // Update time segment on an interval
  useEffect(() => {
    const updateTimeSegment = () => {
      setTimeSegment(findTimeSegment());
      
      // Also flash the center dot if we're on a timed slide
      if (currentNote?.time) {
        setShowCenterDot(true);
        setTimeout(() => setShowCenterDot(false), 200);
      }
    };
    
    // Initial update
    updateTimeSegment();
    
    // Set interval for updates
    const intervalId = setInterval(updateTimeSegment, 10000); // Update every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [currentNote]);
  
  // Get next timed slide
  const getNextTimedSlide = (): PresentationNote | null => {
    if (!pacingInfo.nextTimedNote) return null;
    return pacingInfo.nextTimedNote;
  };
  
  // Get the breadcrumb path for a note
  const findAncestorPath = (note: PresentationNote, notesMap: Map<number, PresentationNote>): React.ReactNode => {
    if (!note || note.isStartSlide || note.isEndSlide) return null;
    
    const path: React.ReactNode[] = [];
    
    // Add the current note
    path.unshift(
      <span key={note.id} className="text-white/80">{note.content}</span>
    );
    
    // Recursively add parent notes
    let parent = note.parentId ? notesMap.get(note.parentId) : null;
    while (parent) {
      path.unshift(
        <React.Fragment key={parent.id}>
          <span className="text-white/50 mx-1">›</span>
          <span className="text-white/50">{parent.content}</span>
        </React.Fragment>
      );
      parent = parent.parentId ? notesMap.get(parent.parentId) : null;
    }
    
    return <div className="flex items-center text-xs overflow-hidden whitespace-nowrap">{path}</div>;
  };

  // Helper to find the root index of a note
  const findRootIndex = (note: PresentationNote): number => {
    if (note.rootIndex !== undefined) return note.rootIndex;
    if (note.isStartSlide || note.isEndSlide) return -1;
    
    // Scan through the notes to find this note's root ancestor
    let currentNote = note;
    let parent = note.parentId ? flattenedNotes.find(n => n.id === note.parentId) : null;
    
    while (parent) {
      currentNote = parent;
      parent = parent.parentId ? flattenedNotes.find(n => n.id === parent.parentId) : null;
    }
    
    // Find the root index
    const rootIndex = themeNotes.findIndex(n => n.id === currentNote.id);
    return rootIndex >= 0 ? rootIndex : 0;
  };
  
  // Create a map of note id -> note for quick lookups
  const notesMap = useMemo(() => {
    const map = new Map<number, PresentationNote>();
    flattenedNotes.forEach(note => map.set(note.id, note));
    return map;
  }, [flattenedNotes]);
  
  // Determine the theme for the current slide
  const currentTheme = useMemo(() => {
    if (!currentNote) return getPresentationTheme(0);
    
    if (currentNote.isStartSlide || currentNote.isEndSlide) {
      return START_END_THEME;
    }
    
    const rootIndex = findRootIndex(currentNote);
    return getPresentationTheme(rootIndex);
  }, [currentNote]);
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!project) {
    return <div className="flex items-center justify-center h-screen">Project not found</div>;
  }
  
  return (
    <div 
      className="h-screen w-screen overflow-hidden bg-gray-900 flex items-center justify-center relative" 
      style={{ ...getThemeBackgroundStyle(currentTheme) }}
    >
      {flattenedNotes.length > 0 ? (
        <>
          {/* Main slide container */}
          <AnimatePresence mode="wait">
            {/* Overview Mode */}
            {showOverview ? (
              <motion.div 
                key="overview" 
                className="w-full h-full p-4 md:p-8 flex flex-col gap-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl md:text-4xl font-bold text-white/80">Overview</h1>
                  <button 
                    className="text-white/60 hover:text-white"
                    onClick={() => setShowOverview(false)}
                  >
                    Close [ESC]
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto flex-grow">
                  {flattenedNotes.map((note, index) => (
                    <div 
                      key={note.id}
                      className={`relative rounded-lg border-2 p-4 cursor-pointer hover:bg-white/10 
                        flex flex-col transition-all ${index === currentSlideIndex ? 'border-white/80' : 'border-transparent'}`}
                      onClick={() => {
                        setCurrentSlideIndex(index);
                        setShowOverview(false);
                      }}
                    >
                      <div className="text-xs text-white/60 mb-1">Slide {index + 1}</div>
                      <div className="text-white font-semibold truncate">
                        {note.isStartSlide ? 'Start' : 
                         note.isEndSlide ? 'End' : 
                         note.isOverviewSlide ? `Overview: ${note.content}` : 
                         note.content}
                      </div>
                      {note.time && (
                        <div className="mt-auto text-xs text-white/80 pt-2">
                          Time: {note.time}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={`slide-${currentSlideIndex}`}
                className="relative w-full h-full flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {/* Slide content */}
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Start slide */}
                  {currentNote?.isStartSlide && (
                    <div className="flex flex-col items-center text-center p-12 max-w-4xl">
                      <motion.h1 
                        className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 text-white"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {currentNote.content}
                      </motion.h1>
                      <motion.div 
                        className="text-xl text-white/80"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Press <kbd className="px-2 py-1 bg-white/20 rounded">→</kbd> to begin
                      </motion.div>
                    </div>
                  )}
                  
                  {/* End slide */}
                  {currentNote?.isEndSlide && (
                    <div className="flex flex-col items-center text-center p-12 max-w-4xl">
                      <motion.h1 
                        className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 text-white"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {currentNote.content}
                      </motion.h1>
                      {currentNote.author && (
                        <motion.div 
                          className="flex items-center gap-2 text-xl text-white/80 mt-4"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Users size={20} />
                          <span>{currentNote.author}</span>
                        </motion.div>
                      )}
                    </div>
                  )}
                  
                  {/* Overview slide */}
                  {currentNote?.isOverviewSlide && currentNote.childNotes && (
                    <OverviewSlide 
                      title={currentNote.content} 
                      theme={currentTheme} 
                      childNotes={currentNote.childNotes}
                    />
                  )}
                  
                  {/* Regular slide */}
                  {!currentNote?.isStartSlide && !currentNote?.isEndSlide && !currentNote?.isOverviewSlide && (
                    <div className="w-full h-full flex flex-col relative overflow-hidden">
                      {/* Chapter/note title header */}
                      <div className="w-full p-4 md:p-8 lg:p-12 flex flex-col">
                        {/* Breadcrumb navigation */}
                        <div className="text-white/50 text-sm mb-2 overflow-x-auto no-scrollbar">
                          {findAncestorPath(currentNote, notesMap)}
                        </div>
                        
                        {/* Title of the current note */}
                        <h1 className={`text-2xl md:text-4xl lg:text-5xl text-white ${isMajorSlide(currentNote) ? 'font-bold' : 'font-normal'}`}>
                          {currentNote?.content || 'Untitled'}
                        </h1>
                      </div>
                      
                      {/* Content area */}
                      <div className="flex-grow p-4 md:p-8 lg:p-12 pt-0 flex items-center justify-center relative">
                        <div 
                          className={`max-w-5xl mx-auto ${
                            isMobileDevice() ? 'text-xl md:text-2xl' : 'text-xl md:text-2xl lg:text-3xl'
                          } 
                          text-white/80 leading-relaxed overflow-auto no-scrollbar`}
                        >
                          {/* Note content */}
                          {currentNote?.url && (
                            <div className="mb-6">
                              <a 
                                href={currentNote.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:text-blue-200 underline inline-flex items-center gap-2"
                              >
                                {currentNote.linkText || currentNote.url}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M7 17L17 7M17 7H7M17 7V17"/>
                                </svg>
                              </a>
                            </div>
                          )}
                          
                          {/* YouTube embed */}
                          {currentNote?.youtubeLink && (
                            <div className="relative w-full pb-[56.25%] mb-6">
                              <iframe
                                className="absolute top-0 left-0 w-full h-full rounded-lg"
                                src={`https://www.youtube.com/embed/${new URL(currentNote.youtubeLink).searchParams.get('v') || currentNote.youtubeLink.split('/').pop()}`}
                                title="YouTube video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                            </div>
                          )}
                          
                          {/* Content display based on type */}
                          {(() => {
                            const contentType = determineContentType(currentNote?.content || '');
                            
                            switch (contentType) {
                              case "image":
                                return (
                                  <div className="flex justify-center">
                                    <ImageWithFallback
                                      src={currentNote?.content || ''}
                                      alt="Slide image"
                                      className="max-w-full max-h-[70vh] object-contain rounded-lg"
                                    />
                                  </div>
                                );
                                
                              case "markdown":
                                // Render using a markdown renderer
                                return (
                                  <div className="prose prose-invert max-w-full" dangerouslySetInnerHTML={{
                                    __html: "Markdown rendering would go here"
                                  }} />
                                );
                                
                              default:
                                return currentNote?.content || 'No content';
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Slide indicators and navigation */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col">
                  {/* Progress bar */}
                  {showProgressBar && (
                    <div className="w-full h-1 bg-gray-800/40">
                      <div 
                        className="h-full bg-white transition-all duration-300 ease-out"
                        style={{ 
                          width: `${Math.max(0, Math.min(100, (currentSlideIndex / (flattenedNotes.length - 1)) * 100))}%`
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Time indicator - shown if the slide is part of a timed segment */}
                  {showTimeDisplay && (
                    <TimeDisplay 
                      timeSegment={timeSegment}
                      currentNote={currentNote}
                      pacingInfo={pacingInfo}
                      flattenedNotes={flattenedNotes}
                      currentSlideIndex={currentSlideIndex}
                    />
                  )}
                  
                  {/* Debug panel */}
                  {showDebugPanel && (
                    <TimeDebugPanel 
                      currentNote={currentNote}
                      pacingInfo={pacingInfo}
                      flattenedNotes={flattenedNotes}
                      currentSlideIndex={currentSlideIndex}
                      getNextTimedSlide={getNextTimedSlide}
                      timeToMinutes={timeToMinutes}
                      calculateTimeInfo={calculateTimeInfo}
                    />
                  )}
                  
                  {/* Bottom toolbar */}
                  <div className="p-2 md:p-4 flex justify-between items-center text-white/60 bg-gradient-to-t from-black/20 to-transparent">
                    <div className="text-sm">
                      Slide {currentSlideIndex + 1} of {flattenedNotes.length}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-1 hover:text-white"
                        onClick={() => setShowTimeDisplay(prev => !prev)}
                        title="Toggle Time Display (T)"
                      >
                        Time: {showTimeDisplay ? 'On' : 'Off'}
                      </button>
                      <button 
                        className="p-1 hover:text-white"
                        onClick={() => setShowDebugPanel(prev => !prev)}
                        title="Toggle Debug Panel (D)"
                      >
                        Debug: {showDebugPanel ? 'On' : 'Off'}
                      </button>
                      <button 
                        className="p-1 hover:text-white"
                        onClick={() => setShowOverview(true)}
                        title="Overview (O)"
                      >
                        Overview
                      </button>
                      <button 
                        className="p-1 hover:text-white"
                        onClick={toggleFullScreen}
                        title="Toggle Fullscreen (F)"
                      >
                        {isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      </button>
                      <button 
                        className="p-1 hover:text-white"
                        onClick={() => setLocation(`/projects/${projectId}`)}
                        title="Exit Presentation (ESC)"
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Navigation arrows */}
                <button 
                  className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-black/20 ${currentSlideIndex === 0 ? 'opacity-20 pointer-events-none' : ''}`}
                  onClick={() => setCurrentSlideIndex(prev => prev > 0 ? prev - 1 : prev)}
                  disabled={currentSlideIndex === 0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                
                <button 
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-black/20 ${currentSlideIndex === flattenedNotes.length - 1 ? 'opacity-20 pointer-events-none' : ''}`}
                  onClick={() => setCurrentSlideIndex(prev => prev < flattenedNotes.length - 1 ? prev + 1 : prev)}
                  disabled={currentSlideIndex === flattenedNotes.length - 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
                        <div 
                          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-yellow-500 shadow-glow-yellow ${showCenterDot ? 'opacity-100' : 'opacity-0'}`} 
                          style={{
                            transition: 'opacity 0.3s ease', 
                          }}
                        />
                        <div 
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 border-yellow-500"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            transform: 'translateX(-50%)',
                            boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                          }}
                        />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black/90 text-white text-sm p-2 sm:p-3">
                    <div className="text-center font-sans">
                      {(() => {
                        // Get the current time
                        const now = new Date();
                        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
                        const currentTimeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        
                        // Default status
                        let status = `Current: ${currentTimeFormatted}`;
                        
                        try {
                          // If we're on a timed slide
                          if (currentNote?.time) {
                            const slideTimeInMinutes = timeToMinutes(currentNote.time);
                            let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                            
                            // Handle crossing midnight
                            if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                            else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                            
                            // Format as human-readable time difference
                            if (Math.abs(diffMinutes) >= 60) {
                              const hours = Math.floor(Math.abs(diffMinutes) / 60);
                              const mins = Math.abs(diffMinutes) % 60;
                              
                              if (diffMinutes > 0) {
                                status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} behind (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else {
                                status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ahead (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              }
                            } else {
                              // Less than an hour difference
                              if (diffMinutes > 1) {
                                status = `${diffMinutes} minutes behind (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else if (diffMinutes < -1) {
                                status = `${Math.abs(diffMinutes)} minutes ahead (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else {
                                status = `Right on time (Current: ${currentTimeFormatted})`;
                              }
                            }
                          }
                          // Between two timed notes (interpolation)
                          else if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                            const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                            const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                            const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                            const nextIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                            
                            if (prevIndex >= 0 && nextIndex >= 0) {
                              // Calculate total time span
                              let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                              if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                              
                              // Calculate total slides and our position
                              const totalSlides = nextIndex - prevIndex;
                              if (totalSlides > 1) { // Avoid division by zero
                                // Calculate our position (fraction) between the two timed slides
                                const slideProgress = (currentSlideIndex - prevIndex) / totalSlides;
                                
                                // Calculate the expected time at our position using linear interpolation
                                const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                                
                                // Format the expected time
                                const expectedHours = Math.floor(expectedTimeInMinutes / 60) % 24;
                                const expectedMinutes = Math.floor(expectedTimeInMinutes % 60);
                                const expectedTimeFormatted = `${String(expectedHours).padStart(2, '0')}:${String(expectedMinutes).padStart(2, '0')}`;
                                
                                // Calculate difference between current time and expected time
                                let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                                
                                // Handle crossing midnight
                                if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                                else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                                
                                // Format as human-readable time difference
                                if (Math.abs(diffMinutes) >= 60) {
                                  const hours = Math.floor(Math.abs(diffMinutes) / 60);
                                  const mins = Math.abs(diffMinutes) % 60;
                                  
                                  if (diffMinutes > 0) {
                                    status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} behind (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else {
                                    status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ahead (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  }
                                } else {
                                  // Less than an hour difference
                                  if (diffMinutes > 1) {
                                    status = `${Math.round(diffMinutes)} minutes behind (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else if (diffMinutes < -1) {
                                    status = `${Math.abs(Math.round(diffMinutes))} minutes ahead (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else {
                                    status = `Right on time (Current: ${currentTimeFormatted})`;
                                  }
                                }
                              }
                            }
                          }
                        } catch (err) {
                          console.error("Error calculating status:", err);
                        }
                        
                        return status;
                      })()}
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