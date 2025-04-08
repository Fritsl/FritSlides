import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Edit, X, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPresentationTheme, getThemeBackgroundStyle, PresentationTheme } from "@/lib/presentation-themes";
import { OverviewSlide } from "@/components/ui/overview-slide";
import { Note, Project } from "@shared/schema";
import { 
  getTypographyStyles, 
  generateTypographyStyles, 
  ContentType, 
  determineContentType 
} from "@/lib/presentation-typography";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Extended note type with level, theme, and child information for presentation
interface PresentationNote extends Note {
  level?: number;
  rootIndex?: number; // Index of the root note this belongs to - for theming
  childNotes?: PresentationNote[]; // Direct child notes for overview slides
  hasChildren?: boolean; // Flag to indicate this note has children
  isOverviewSlide?: boolean; // Flag for chapter overview slides
  isStartSlide?: boolean; // Flag for project start slide
  isEndSlide?: boolean; // Flag for project end slide
  author?: string | null; // Author for end slides
}

// Interface for time tracking segment
interface TimeSegment {
  lastPassedSlideIndex: number; // Index of the slide with the last passed time marker
  nextUpcomingSlideIndex: number | null; // Index of the slide with the next upcoming time marker
  lastPassedTime: string; // The time marker of the last passed slide
  nextUpcomingTime: string | null; // The time marker of the next upcoming slide
  currentProgress: number; // Progress between 0-1 indicating position between time points
}

// Function to parse HH:MM format to minutes
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  return hours * 60 + minutes;
};

export default function PresentMode() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Extract project ID from URL
  const projectId = Number(location.split("/present/")[1]);
  
  const { projects } = useProjects();
  const { notes, isLoading } = useNotes(projectId);
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [flattenedNotes, setFlattenedNotes] = useState<PresentationNote[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [timeSegment, setTimeSegment] = useState<TimeSegment | null>(null);
  const [timeDotsVisible, setTimeDotsVisible] = useState(false);
  
  // Find the current project by ID
  useEffect(() => {
    if (projects && projectId) {
      const project = projects.find((p: Project) => p.id === projectId);
      setCurrentProject(project || null);
    }
  }, [projects, projectId]);
  
  // Convert hierarchical notes to a flattened array for presentation
  useEffect(() => {
    if (!notes || !currentProject) return;
    
    // Find all root notes (parent is null)
    const rootNotes = [...notes]
      .filter(note => note.parentId === null)
      .sort((a, b) => Number(a.order) - Number(b.order));
    
    // Helper function to get direct children of a note
    const getDirectChildren = (noteId: number): Note[] => {
      return [...notes]
        .filter(note => note.parentId === noteId)
        .sort((a, b) => Number(a.order) - Number(b.order));
    };
    
    // Helper function to flatten notes recursively in a depth-first manner
    const flattenNotes = (
      notesList: Note[], 
      parentId: number | null = null, 
      level = 0, 
      rootIndex = 0
    ): PresentationNote[] => {
      const result: PresentationNote[] = [];
      
      // Sort notes by their order field
      const sortedNotes = [...notesList]
        .filter(note => String(note.parentId) === String(parentId))
        .sort((a, b) => Number(a.order) - Number(b.order));
      
      // Add each note and then its children
      for (const note of sortedNotes) {
        // Get direct children for this note
        const directChildren = getDirectChildren(note.id);
        const hasChildren = directChildren.length > 0;
        
        // Add the current note with its level, root index, and children information
        const noteWithLevel: PresentationNote = { 
          ...note, 
          level, 
          rootIndex: parentId === null ? rootIndex : undefined,
          hasChildren,
          childNotes: hasChildren ? directChildren as PresentationNote[] : undefined
        };
        result.push(noteWithLevel);
        
        // Recursively add children - they inherit the root index for theming
        const children = flattenNotes(notesList, note.id, level + 1, rootIndex);
        result.push(...children);
      }
      
      return result;
    };
    
    // Process each root note with its own index
    let flattened: PresentationNote[] = [];
    
    // Add start slide if we have a start slogan
    if (currentProject.startSlogan) {
      const startSlide: PresentationNote = {
        id: -1, // Unique negative ID for the start slide
        projectId: currentProject.id,
        content: currentProject.startSlogan,
        order: "-999",
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        level: 0,
        rootIndex: 0,
        time: null,
        url: null,
        linkText: null,
        youtubeLink: null,
        images: null,
        isDiscussion: false,
        isStartSlide: true,
      };
      flattened.push(startSlide);
    }
    
    // Add regular notes
    rootNotes.forEach((rootNote, index) => {
      // Add the root note and its children with its index
      const rootAndChildren = flattenNotes(notes, null, 0, index);
      
      // Only add the current root note and its children
      const thisRootAndChildren = rootAndChildren.filter(
        note => note.id === rootNote.id || 
                notes.some(n => n.id === note.id && 
                             (n.parentId === rootNote.id || 
                              notes.some(p => p.id === n.parentId && p.parentId === rootNote.id)))
      );
      
      flattened = [...flattened, ...thisRootAndChildren];
    });
    
    // Add end slide if we have an end slogan
    if (currentProject.endSlogan) {
      const endSlide: PresentationNote = {
        id: -2, // Unique negative ID for the end slide
        projectId: currentProject.id,
        content: currentProject.endSlogan,
        order: "999",
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        level: 0,
        rootIndex: Math.max(rootNotes.length - 1, 0), // Use last used index or 0
        time: null,
        url: null,
        linkText: null,
        youtubeLink: null,
        images: null,
        isDiscussion: false,
        isEndSlide: true,
        author: currentProject.author,
      };
      flattened.push(endSlide);
    }
    
    setFlattenedNotes(flattened);
    
    // Reset current slide to beginning when notes change
    setCurrentSlideIndex(0);
  }, [notes, currentProject]);
  
  // Navigation handlers
  const goToNextSlide = () => {
    if (currentSlideIndex < flattenedNotes.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };
  
  // Function to request fullscreen
  const requestFullscreen = () => {
    try {
      // Only try to request fullscreen in response to a user gesture (like a click)
      // to avoid browser security errors
      const element = document.documentElement;
      
      // Use the appropriate method based on browser
      const requestMethod = element.requestFullscreen || 
                           (element as any).webkitRequestFullscreen || 
                           (element as any).mozRequestFullscreen || 
                           (element as any).msRequestFullscreen;
                           
      if (requestMethod) {
        // We need to handle the promise rejection that might happen if not triggered by user gesture
        requestMethod.call(element).catch((err: any) => {
          // Silently handle the error - this is expected in some browsers
          // where fullscreen can only be requested from a user gesture
          console.log('Fullscreen request was rejected:', err.message);
        });
      }
    } catch (error) {
      // Catch any other errors
      console.log('Fullscreen API not supported');
    }
  };

  // Handle keyboard navigation and request fullscreen on mount
  useEffect(() => {
    // Request fullscreen when the component mounts
    requestFullscreen();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft") {
        goToPrevSlide();
      } else if (e.key === "Escape") {
        // If we're already out of fullscreen, then navigate away
        if (!document.fullscreenElement) {
          setLocation(`/`);
        }
      } else if (e.key === "f") {
        // Also allow 'f' key to toggle fullscreen
        requestFullscreen();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, flattenedNotes.length, setLocation]);
  
  // Render loading state
  if (isLoading || !flattenedNotes.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="animate-spin h-12 w-12 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg">Loading presentation...</p>
        </div>
      </div>
    );
  }
  
  // Get the current note to display
  const currentNote = flattenedNotes[currentSlideIndex];
  const level = currentNote.level || 0;
  
  // Get the root index for theme (if it's null, use parent's rootIndex or default to 0)
  const findRootIndex = (note: PresentationNote): number => {
    if (note.rootIndex !== undefined) return note.rootIndex;
    
    // If note is a child, find its parent to get root index
    if (note.parentId) {
      // First try to find parent in already flattened notes (faster)
      const parentInFlattened = flattenedNotes.find(n => n.id === note.parentId);
      if (parentInFlattened && parentInFlattened.rootIndex !== undefined) {
        return parentInFlattened.rootIndex;
      }
      
      // Otherwise, try to find the root ancestor if notes are available
      // By this point we know notes are available since we are rendering a note
      let currentParentId = note.parentId;
      let currentNote = notes!.find(n => n.id === currentParentId);
      
      while (currentNote && currentNote.parentId) {
        currentParentId = currentNote.parentId;
        currentNote = notes!.find(n => n.id === currentParentId);
      }
      
      // Find index of this root note
      if (currentNote) {
        const rootNotes = notes!.filter(n => n.parentId === null)
          .sort((a, b) => Number(a.order) - Number(b.order));
        return rootNotes.findIndex(n => n.id === currentNote!.id);
      }
    }
    
    // Default to 0 if we can't determine
    return 0;
  };
  
  const rootIndex = findRootIndex(currentNote);
  const theme = getPresentationTheme(level, rootIndex);
  const themeStyles = getThemeBackgroundStyle(theme);
  
  // Helper functions for content display using typography system
  const formatContent = (content: string) => {
    const lines = content.split('\\n');
    
    // Determine if this is a root level note (level 0)
    const isRootNote = level === 0;
    const hasChildren = currentNote.hasChildren || false;
    
    // Determine content type based on note level and if it has children
    const contentType = determineContentType(isRootNote, hasChildren);
    
    return lines.map((line, i) => {
      // First line uses heading typography, subsequent lines use body typography
      const lineContentType = i === 0 ? contentType : ContentType.Regular;
      
      // Get typography settings based on content type, level, and text length
      const typography = getTypographyStyles(
        lineContentType,
        level, 
        line.length
      );
      
      // Generate the CSS styles
      const styles = generateTypographyStyles(typography);
      
      // Add margins and drop shadow
      const combinedStyles = {
        ...styles,
        marginBottom: i === 0 ? '2rem' : '1.25rem',
        textShadow: i === 0 ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
      };
      
      return (
        <p key={i} style={combinedStyles}>
          {line}
        </p>
      );
    });
  };
  
  // Convert YouTube time to seconds for embedding
  const convertTimeToSeconds = (timeStr: string) => {
    if (!timeStr) return 0;
    
    const parts = timeStr.split(':').reverse();
    let seconds = 0;
    
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i]) * Math.pow(60, i);
    }
    
    return seconds;
  };
  
  // Function to generate YouTube embed URL
  const getYoutubeEmbedUrl = (url: string, time: string) => {
    if (!url) return '';
    
    // Extract YouTube video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    
    if (!videoId) return '';
    
    // Create embed URL with start time if provided
    const startTime = time ? `&start=${convertTimeToSeconds(time)}` : '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=0${startTime}`;
  };

  // Check if this is an overview slide (a note with children)
  const isOverviewSlide = currentNote.hasChildren && currentNote.childNotes && currentNote.childNotes.length > 0;
  const isStartSlide = currentNote.isStartSlide === true;
  const isEndSlide = currentNote.isEndSlide === true;
  
  // Find time markers in the presentation and calculate current position
  useEffect(() => {
    // Always initialize with timer cleanup function
    const timer = setInterval(() => {
      // Just trigger a re-run of this effect every minute
      setTimeDotsVisible(currentValue => currentValue);
    }, 60000); // Update every 1 minute
    
    if (!flattenedNotes.length) {
      // Even if we return early, we still need to set up the timer and clean it
      return () => clearInterval(timer);
    }
    
    // Find all slides with time markers
    const timedSlides = flattenedNotes
      .map((note, index) => ({note, index}))
      .filter(({note}) => note.time && note.time.trim() !== '')
      .sort((a, b) => {
        const timeA = parseTimeToMinutes(a.note.time || '');
        const timeB = parseTimeToMinutes(b.note.time || '');
        return timeA - timeB;
      });
    
    // If there are no timed slides, hide the timing indicators
    if (timedSlides.length === 0) {
      setTimeDotsVisible(false);
      setTimeSegment(null);
      return () => clearInterval(timer);
    }
    
    // Get the current time
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Find the last passed time marker and the next upcoming one
    let lastPassedIndex = -1;
    for (let i = 0; i < timedSlides.length; i++) {
      const slideTime = parseTimeToMinutes(timedSlides[i].note.time || '');
      if (slideTime <= currentTimeInMinutes) {
        lastPassedIndex = i;
      } else {
        break;
      }
    }
    
    // If we haven't reached the first timed slide yet, use the first one as next
    if (lastPassedIndex === -1) {
      setTimeSegment({
        lastPassedSlideIndex: currentSlideIndex,
        nextUpcomingSlideIndex: timedSlides[0]?.index || null,
        lastPassedTime: '',
        nextUpcomingTime: timedSlides[0]?.note.time || null,
        currentProgress: 0
      });
    } 
    // If we've passed all timed slides, use the last one as reference
    else if (lastPassedIndex === timedSlides.length - 1) {
      setTimeSegment({
        lastPassedSlideIndex: timedSlides[lastPassedIndex]?.index || 0,
        nextUpcomingSlideIndex: null,
        lastPassedTime: timedSlides[lastPassedIndex]?.note.time || '',
        nextUpcomingTime: null,
        currentProgress: 1
      });
    }
    // Normal case: we're between two timed slides
    else {
      const lastPassed = timedSlides[lastPassedIndex];
      const nextUpcoming = timedSlides[lastPassedIndex + 1];
      
      const lastPassedTime = parseTimeToMinutes(lastPassed.note.time || '');
      const nextUpcomingTime = parseTimeToMinutes(nextUpcoming.note.time || '');
      const totalTimeSpan = nextUpcomingTime - lastPassedTime;
      const timeElapsed = currentTimeInMinutes - lastPassedTime;
      
      // Calculate progress between the two time points (0-1)
      const progress = totalTimeSpan > 0 ? timeElapsed / totalTimeSpan : 0;
      
      setTimeSegment({
        lastPassedSlideIndex: lastPassed.index,
        nextUpcomingSlideIndex: nextUpcoming.index,
        lastPassedTime: lastPassed.note.time || '',
        nextUpcomingTime: nextUpcoming.note.time || null,
        currentProgress: Math.max(0, Math.min(1, progress))
      });
    }
    
    // Show the timing indicators if we have time markers
    setTimeDotsVisible(true);
    
    return () => clearInterval(timer);
  }, [flattenedNotes, currentSlideIndex]);
  
  // Calculate expected slide position based on time progress
  const getExpectedSlidePosition = () => {
    if (!timeSegment) return null;
    
    // If we only have a next upcoming slide (we're before all time markers)
    if (timeSegment.lastPassedSlideIndex === currentSlideIndex && timeSegment.nextUpcomingSlideIndex !== null) {
      return timeSegment.nextUpcomingSlideIndex;
    }
    
    // If we only have a last passed slide (we're after all time markers)
    if (timeSegment.nextUpcomingSlideIndex === null) {
      return timeSegment.lastPassedSlideIndex;
    }
    
    // Calculate expected position between the two time markers
    const totalSlides = timeSegment.nextUpcomingSlideIndex - timeSegment.lastPassedSlideIndex;
    const expectedOffset = Math.round(totalSlides * timeSegment.currentProgress);
    const expectedPosition = timeSegment.lastPassedSlideIndex + expectedOffset;
    
    return expectedPosition;
  };
  
  // Calculate slide difference between current and expected positions
  const getSlideDifference = () => {
    const expectedPosition = getExpectedSlidePosition();
    if (expectedPosition === null) return 0;
    
    // Positive: ahead of schedule, Negative: behind schedule
    const difference = currentSlideIndex - expectedPosition;
    
    // Cap at maximum of 25 slides in either direction
    return Math.max(-25, Math.min(25, difference));
  };
  
  // Find the next timed slide from current position
  const getNextTimedSlide = () => {
    if (!flattenedNotes.length) return null;
    
    const nextTimed = flattenedNotes
      .slice(currentSlideIndex + 1)
      .find(note => note.time && note.time.trim() !== '');
      
    return nextTimed;
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Slide content - Full screen with no UI */}
      <div 
        className="flex-1 flex flex-col items-center justify-center w-full h-full cursor-pointer"
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
        {/* Render appropriate slide based on type */}
        {isOverviewSlide ? (
          // Overview slide with chapter markers
          <OverviewSlide 
            parentNote={currentNote} 
            childNotes={currentNote.childNotes!}
            theme={theme}
          />
        ) : isStartSlide ? (
          // Start slide with project start slogan
          <div className="max-w-6xl w-full h-full flex flex-col items-center justify-center p-10">
            <div className="w-full text-white text-center">
              <div className="content mb-10">
                {formatContent(currentNote.content)}
              </div>
              <div className="mt-16 opacity-70 text-sm">
                {currentProject?.name}
              </div>
            </div>
          </div>
        ) : isEndSlide ? (
          // End slide with project end slogan and author
          <div className="max-w-6xl w-full h-full flex flex-col items-center justify-center p-10">
            <div className="w-full text-white text-center">
              <div className="content mb-10">
                {formatContent(currentNote.content)}
              </div>
              {currentNote.author && (
                <div className="mt-8 opacity-80 text-lg">
                  {currentNote.author}
                </div>
              )}
              <div className="mt-16 opacity-70 text-sm">
                {currentProject?.name}
              </div>
            </div>
          </div>
        ) : (
          // Regular slide with content
          <div className="max-w-6xl w-full h-full flex flex-col items-center justify-center p-10 relative">
            {/* Discussion icon overlay */}
            {currentNote.isDiscussion && (
              <div className="absolute top-4 right-4 text-white opacity-80 transition-opacity animate-pulse">
                <Users className="h-12 w-12 sm:h-12 sm:w-12 md:h-16 md:w-16" />
              </div>
            )}
            <div className="w-full text-white">
              <div className="content mb-10">
                {formatContent(currentNote.content)}
              </div>
              
              {/* URL link if present - with typography styling */}
              {currentNote.url && (
                <div className="mt-8">
                  <a
                    href={currentNote.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...generateTypographyStyles(getTypographyStyles(
                        ContentType.Regular,
                        level + 1,
                        (currentNote.linkText || currentNote.url).length
                      )),
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
                      paddingBottom: '0.5rem',
                      width: 'fit-content'
                    }}
                    className="hover:text-white"
                  >
                    <span className="mr-2">🔗</span>
                    {currentNote.linkText || currentNote.url}
                  </a>
                </div>
              )}
              
              {/* YouTube embed if present */}
              {currentNote.youtubeLink && (
                <div className="mt-8 rounded overflow-hidden aspect-video bg-black/20 shadow-xl">
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
              
              {/* Images if present */}
              {currentNote.images && currentNote.images.length > 0 && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {currentNote.images.map((image: string, idx: number) => (
                    <div key={idx} className="rounded overflow-hidden shadow-xl">
                      <img 
                        src={image} 
                        alt={`Note image ${idx + 1}`} 
                        className="w-full h-auto object-cover" 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Minimal footer with navigation hints */}
      <div className="absolute bottom-0 left-0 right-0 text-center p-1 flex justify-between items-center">
        <div className="w-8"></div>
        <p className="text-white/30 text-[10px]">
          {currentProject?.name} • {currentSlideIndex + 1}/{flattenedNotes.length} • 
          {isStartSlide ? 'Start' : isEndSlide ? 'End' : isOverviewSlide ? 'Chapter overview' : ''} • 
          Click or → to advance • ← back • ESC to exit
        </p>
        <button 
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering next slide
            requestFullscreen();
          }}
          className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/60 opacity-60 hover:opacity-100 transition-opacity"
          title="Enter fullscreen (F)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>
      
      {/* Time tracking dots */}
      {timeDotsVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="relative h-8 flex items-center justify-center"
                  style={{ 
                    // Calculate width based on maximum potential offset
                    width: '250px' // 25 slides * 5px + center area
                  }}
                >
                  {/* Black dot (target position) */}
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-black/50 transition-all duration-300"
                    style={{
                      transform: `translateX(${getSlideDifference() * -5}px)`,
                      left: '50%'
                    }}
                  />
                  
                  {/* White dot (current position) */}
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-white/50 transition-all duration-300"
                    style={{
                      left: '50%',
                      transform: 'translateX(-50%)'
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-black/80 text-white text-xs">
                <div className="text-center">
                  <div>
                    <span className="opacity-80">Now:</span> {currentNote.time ? `${currentNote.time}` : 'No time marker'} 
                  </div>
                  {getNextTimedSlide() && (
                    <div>
                      <span className="opacity-80">Next:</span> {getNextTimedSlide()?.content.slice(0, 20)}
                      {getNextTimedSlide()?.content.length! > 20 ? '...' : ''} @ {getNextTimedSlide()?.time}
                    </div>
                  )}
                  <div className="mt-1 text-xs opacity-70">
                    {getSlideDifference() > 0 ? `${getSlideDifference()} slides ahead of schedule` :
                     getSlideDifference() < 0 ? `${Math.abs(getSlideDifference())} slides behind schedule` :
                     'On schedule'}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}