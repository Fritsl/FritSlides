import React, { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { Note, Project } from "@shared/schema";
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
} from '@/lib/presentation-typography';
import { OverviewSlide } from "@/components/ui/overview-slide";
import { formatMinutesToHumanReadable, minutesToString, timeToMinutes } from "@/lib/time-utils";
import { TimeDisplay } from "@/components/ui/time-display";
import { TimeDebugPanel } from "@/components/ui/time-debug-panel";

interface PacingInfo {
  shouldShow: boolean;
  slideDifference: number;
  percentComplete: number;
  currenSlideIndex: number;
  previousTimedNote?: Note;
  nextTimedNote?: Note;
}

export interface ProgressInfo {
  totalSlideCount: number;
  currentSlideIndex: number;
  percentComplete: number;
  elapsedTime: number;
  remainingTime: number | null;
  timePerSlide: number | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  debugging?: boolean;
}

export default function PresentMode() {
  // Routing
  const params = useParams<{ projectId?: string; noteId?: string }>();
  const [, setLocation] = useLocation();
  const projectId = params?.projectId ? parseInt(params.projectId) : undefined;
  const startNoteId = params?.noteId ? parseInt(params.noteId) : undefined;
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [slideViewMode, setSlideViewMode] = useState<"standard" | "compact" | "notes" | "edit">("standard");
  const [slideScaleFactor, setSlideScaleFactor] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [pacingInfo, setPacingInfo] = useState<PacingInfo>({
    shouldShow: false,
    slideDifference: 0,
    percentComplete: 0,
    currenSlideIndex: 0,
  });

  // Fetch data
  const { getProject, updateLastViewedSlideIndex } = useProjects();
  const { getNotes } = useNotes();
  const currentProject = projectId ? getProject(projectId) : undefined;
  
  // Get raw notes and sort them
  const rawProjectNotes = projectId ? getNotes(projectId) : [];
  const projectNotes = useMemo(() => {
    return [...rawProjectNotes].sort((a, b) => {
      // Sort by parentId (null first)
      if (a.parentId === null && b.parentId !== null) return -1;
      if (a.parentId !== null && b.parentId === null) return 1;
      
      // If same parent, sort by order
      if (a.parentId === b.parentId) {
        const orderA = parseFloat(String(a.order));
        const orderB = parseFloat(String(b.order));
        return orderA - orderB;
      }
      
      // Final fallback sort by id
      return a.id - b.id;
    });
  }, [rawProjectNotes]);
  
  // Initialize notes as array to create a flattened structure for presentation
  const [flattenedNotes, setFlattenedNotes] = useState<Array<Note & { 
    level?: number;
    isStartSlide?: boolean;
    isEndSlide?: boolean;
    isOverviewSlide?: boolean;
    childNotes?: Note[];
    timeBorrowed?: boolean;
  }>>([]);
  
  // Current note is the active slide
  const currentNote = flattenedNotes[currentSlideIndex];
  const isOverviewSlide = currentNote?.isOverviewSlide;
  const isStartSlide = currentNote?.isStartSlide;
  const isEndSlide = currentNote?.isEndSlide;
  
  // Get level (for theme) from the note or default to 0
  const level = currentNote?.level || 0;
  
  // useEffect to build presentation structure
  useEffect(() => {
    if (!projectId || !projectNotes || projectNotes.length === 0) return;
    
    // Build a flattened structure for presentation
    const formattedNotes: Array<Note & { 
      level?: number;
      isStartSlide?: boolean;
      isEndSlide?: boolean;
      isOverviewSlide?: boolean;
      childNotes?: Note[];
      timeBorrowed?: boolean;
    }> = [];
    
    // Create start/title slide
    const startSlide = {
      id: -100, // Use negative ID to avoid conflicts
      content: currentProject?.name || "Project",
      projectId: projectId,
      parentId: null,
      order: "-1", // Always first
      level: 0,
      isStartSlide: true,
      time: null, // Will be borrowed from the first timed slide
      images: [] as string[],
      timeBorrowed: true,
    };
    
    // Add project info slide
    formattedNotes.push(startSlide);
    
    // Create a mapping of parents to children
    const parentToChildren = new Map<number | null, Note[]>();
    
    // Group children by parent
    projectNotes.forEach(note => {
      const parentId = note.parentId;
      if (!parentToChildren.has(parentId)) {
        parentToChildren.set(parentId, []);
      }
      parentToChildren.get(parentId)?.push({...note});
    });
    
    // Calculate levels through traversing the tree
    const processNote = (note: Note, level: number) => {
      // Add the note with its level
      const enrichedNote = {
        ...note,
        level,
      };
      
      const children = parentToChildren.get(note.id) || [];
      
      // If this is a root node with children, add an overview slide
      if (note.parentId === null && children.length > 0) {
        // Sort children by order
        const sortedChildren = [...children].sort((a, b) => {
          return parseFloat(String(a.order)) - parseFloat(String(b.order));
        });
        
        // Create an overview slide showing the section title + children as list
        const overviewSlide = {
          id: -200 - formattedNotes.length, // Use negative ID to avoid conflicts
          content: `# ${note.content}`,
          projectId: projectId,
          parentId: null,
          images: [] as string[],
          order: String(parseFloat(String(note.order)) - 0.5), // Just before the section
          level: 0,
          isOverviewSlide: true,
          childNotes: sortedChildren,
          time: note.time, // Borrow time from the section heading if available
          timeBorrowed: !!note.time,
        };
        
        // Add overview slide before the section
        formattedNotes.push(overviewSlide);
      }
      
      // Add the current note
      formattedNotes.push(enrichedNote);
      
      // Process all children
      if (children.length > 0) {
        // Sort children by order before processing
        const sortedChildren = [...children].sort((a, b) => {
          return parseFloat(String(a.order)) - parseFloat(String(b.order));
        });
        
        // Process each child with increased level
        sortedChildren.forEach(child => {
          processNote(child, level + 1);
        });
      }
    };
    
    // Get root notes
    const rootNotes = parentToChildren.get(null) || [];
    
    // Sort root notes by order and process each
    rootNotes
      .sort((a, b) => parseFloat(String(a.order)) - parseFloat(String(b.order)))
      .forEach(note => {
        processNote(note, 0);
      });
    
    // Add an end slide
    const endSlide = {
      id: -101, // Use negative ID to avoid conflicts
      content: "Thank You!",
      projectId: projectId,
      parentId: null,
      images: [] as string[],
      order: "999999", // Always last
      level: 0,
      isEndSlide: true,
      time: null, // Will be borrowed in a later step
      timeBorrowed: true,
    };
    
    // Add end slide
    formattedNotes.push(endSlide);
    
    // Borrow time values for start/end slides
    // Find first slide with time value
    const firstTimedSlide = formattedNotes.find(note => note.time && !note.timeBorrowed);
    const lastTimedSlide = [...formattedNotes].reverse().find(note => note.time && !note.timeBorrowed);
    
    // If start slide doesn't have time but there's a first timed slide, borrow its time
    if (startSlide.timeBorrowed && firstTimedSlide?.time) {
      const startSlideIndex = formattedNotes.findIndex(n => n.id === startSlide.id);
      if (startSlideIndex >= 0) {
        formattedNotes[startSlideIndex].time = firstTimedSlide.time;
        formattedNotes[startSlideIndex].timeBorrowed = true;
      }
    }
    
    // If end slide doesn't have time but there's a last timed slide, borrow its time
    if (endSlide.timeBorrowed && lastTimedSlide?.time) {
      const endSlideIndex = formattedNotes.findIndex(n => n.id === endSlide.id);
      if (endSlideIndex >= 0) {
        formattedNotes[endSlideIndex].time = lastTimedSlide.time;
        formattedNotes[endSlideIndex].timeBorrowed = true;
      }
    }
    
    // Set the flattened notes
    setFlattenedNotes(formattedNotes);
    
    // Set the initial slide index
    if (startNoteId) {
      const startIndex = formattedNotes.findIndex(note => note.id === startNoteId);
      if (startIndex >= 0) {
        setCurrentSlideIndex(startIndex);
      } else {
        setCurrentSlideIndex(0);
      }
    } else if (currentProject?.lastViewedSlideIndex !== undefined && currentProject.lastViewedSlideIndex < formattedNotes.length) {
      setCurrentSlideIndex(currentProject.lastViewedSlideIndex);
    } else {
      setCurrentSlideIndex(0);
    }
  }, [projectId, projectNotes, currentProject, startNoteId]);
  
  // Function to calculate the pacing info
  const updatePacingInfo = () => {
    if (!currentNote || flattenedNotes.length === 0) {
      return;
    }
    
    // Find previous and next timed notes
    let previousTimedNote: Note | undefined;
    let nextTimedNote: Note | undefined;
    
    // Find previous timed note
    for (let i = currentSlideIndex; i >= 0; i--) {
      if (flattenedNotes[i].time && !flattenedNotes[i].timeBorrowed) {
        previousTimedNote = flattenedNotes[i];
        break;
      }
    }
    
    // Find next timed note
    for (let i = currentSlideIndex + 1; i < flattenedNotes.length; i++) {
      if (flattenedNotes[i].time && !flattenedNotes[i].timeBorrowed) {
        nextTimedNote = flattenedNotes[i];
        break;
      }
    }
    
    // Calculate pacing info only if we have both prev and next
    if (previousTimedNote && nextTimedNote) {
      // Get indices to calculate slide difference
      const prevIndex = flattenedNotes.findIndex(n => n.id === previousTimedNote?.id);
      const nextIndex = flattenedNotes.findIndex(n => n.id === nextTimedNote?.id);
      
      if (prevIndex >= 0 && nextIndex >= 0) {
        // Calculate total slides between time points and our progress
        const totalSlides = nextIndex - prevIndex;
        const slidesFromPrev = currentSlideIndex - prevIndex;
        const percentComplete = totalSlides > 0 ? slidesFromPrev / totalSlides : 0;
        
        // Calculate where we "should" be based on current time
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        const prevTimeInMinutes = timeToMinutes(previousTimedNote.time || '');
        const nextTimeInMinutes = timeToMinutes(nextTimedNote.time || '');
        
        // Calculate total time span
        let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
        if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
        
        // Calculate where we should be
        const timeProgress = (currentTimeInMinutes - prevTimeInMinutes) / totalTimeSpan;
        const expectedSlidePosition = prevIndex + Math.round(timeProgress * totalSlides);
        
        // Calculate slide difference (positive = ahead, negative = behind)
        const slideDifference = currentSlideIndex - expectedSlidePosition;
        
        // Update pacing info
        setPacingInfo({
          shouldShow: true,
          slideDifference,
          percentComplete,
          currenSlideIndex: currentSlideIndex,
          previousTimedNote,
          nextTimedNote,
        });
        
        return;
      }
    }
    
    // If we don't have both prev and next, show simpler info
    setPacingInfo({
      shouldShow: false,
      slideDifference: 0,
      percentComplete: 0,
      currenSlideIndex: currentSlideIndex,
      previousTimedNote,
      nextTimedNote,
    });
  };
  
  // Update pacing info when the slide changes
  useEffect(() => {
    updatePacingInfo();
    
    // Set up interval to update pacing regularly
    const interval = setInterval(updatePacingInfo, 10000); // Every 10 seconds
    
    // Update last viewed slide index on the server
    if (projectId) {
      updateLastViewedSlideIndex(projectId, currentSlideIndex).catch(console.error);
    }
    
    return () => clearInterval(interval);
  }, [currentSlideIndex, flattenedNotes.length, projectId]);
  
  // Function to navigate to a specific slide
  const navigateToSlide = (index: number) => {
    if (index >= 0 && index < flattenedNotes.length) {
      setCurrentSlideIndex(index);
    }
  };
  
  // Function to go to the next slide
  const goToNextSlide = () => {
    navigateToSlide(currentSlideIndex + 1);
  };
  
  // Function to go to the previous slide
  const goToPrevSlide = () => {
    navigateToSlide(currentSlideIndex - 1);
  };
  
  // Function to go to the next section (parent note)
  const goToNextSection = () => {
    for (let i = currentSlideIndex + 1; i < flattenedNotes.length; i++) {
      if (flattenedNotes[i].parentId === null) {
        navigateToSlide(i);
        return;
      }
    }
    // If no next section, go to the end slide
    navigateToSlide(flattenedNotes.length - 1);
  };
  
  // Function to go to the previous section (parent note)
  const goToPrevSection = () => {
    for (let i = currentSlideIndex - 1; i >= 0; i--) {
      if (flattenedNotes[i].parentId === null) {
        navigateToSlide(i);
        return;
      }
    }
    // If no previous section, go to the start slide
    navigateToSlide(0);
  };
  
  // Function to exit presentation
  const exitPresentation = () => {
    // Navigate back to project view
    if (projectId) {
      if (currentNote && currentNote.id > 0) {
        setLocation(`/project/${projectId}/note/${currentNote.id}`);
      } else {
        setLocation(`/project/${projectId}`);
      }
    } else {
      setLocation('/');
    }
  };
  
  // Get the next timed slide (if any)
  const getNextTimedSlide = (): (Note & { level?: number }) | null => {
    for (let i = currentSlideIndex + 1; i < flattenedNotes.length; i++) {
      if (flattenedNotes[i].time && !flattenedNotes[i].timeBorrowed) {
        return flattenedNotes[i];
      }
    }
    return null;
  };
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key presses when modal dialogs are open
      const modalOpen = document.querySelector('[role="dialog"]');
      if (modalOpen) return;
      
      // Ignore key presses in input fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      
      switch (e.key) {
        case ' ':
        case 'ArrowRight':
        case 'PageDown':
          if (currentSlideIndex < flattenedNotes.length - 1) {
            goToNextSlide();
          }
          break;
        case 'Backspace':
        case 'ArrowLeft':
        case 'PageUp':
          if (currentSlideIndex > 0) {
            goToPrevSlide();
          }
          break;
        case 'ArrowUp':
        case 'Home':
          goToPrevSection();
          break;
        case 'ArrowDown':
        case 'End':
          goToNextSection();
          break;
        case 'Escape':
          exitPresentation();
          break;
        case 'f':
          // Toggle fullscreen
          const el = document.documentElement;
          if (!document.fullscreenElement) {
            el.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
          } else {
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
        case 'm':
          // Toggle mute
          setIsMuted(prev => !prev);
          break;
        case 'g':
          // Toggle grid
          setShowGrid(prev => !prev);
          break;
        case 'd':
          // Toggle debug mode
          setDebugMode(prev => !prev);
          break;
      }
    };
    
    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentSlideIndex, flattenedNotes.length]);
  
  // Function to get the theme for the current slide
  const getThemeForCurrentSlide = () => {
    // For special slides, use the start/end theme
    if (isStartSlide || isEndSlide) {
      return START_END_THEME;
    }
    
    // For regular slides, get theme based on level
    return getPresentationTheme(level);
  };

  // Loading state
  if (!currentProject || flattenedNotes.length === 0) {
    return (
      <div className="bg-black text-white h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Loading presentation...</h2>
          <p>Preparing your slides, please wait.</p>
        </div>
      </div>
    );
  }
  
  // Current theme based on slide level
  const currentTheme = getThemeForCurrentSlide();
  
  // Calculate ContentType for styling
  const slideContentType = (() => {
    if (!currentNote) return SlideContentType.Regular;
    if (isStartSlide) return SlideContentType.Title;
    if (isEndSlide) return SlideContentType.Title;
    if (isOverviewSlide) return SlideContentType.Heading;
    
    if (currentNote.content?.length < 50 && !currentNote.content.includes('\n')) 
      return SlideContentType.Heading;
    if (currentNote.content?.length < 100 && !currentNote.content.includes('\n')) 
      return SlideContentType.Subheading;
    
    // Check for lists
    if (currentNote.content?.split('\n').some(line => 
        line.trim().startsWith('-') || 
        line.trim().startsWith('•') || 
        line.trim().startsWith('*'))) {
      return SlideContentType.List;
    }
    
    return SlideContentType.Regular;
  })();
  
  return (
    <div className="bg-black text-white h-screen w-full overflow-hidden relative" 
         onClick={() => currentSlideIndex < flattenedNotes.length - 1 && goToNextSlide()}>
      
      <div className="relative w-full h-full" style={{ ...getThemeBackgroundStyle(currentTheme) }}>
        {/* Optional grid overlay for debugging */}
        {showGrid && (
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 bg-transparent pointer-events-none z-10"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '100px 100px',
            }}
          />
        )}
        
        {/* Slide content */}
        <div className="w-full h-full p-4 sm:p-8 md:p-12 flex items-center justify-center">
          <div className="max-w-7xl w-full relative">
            {isOverviewSlide ? (
              <OverviewSlide 
                slide={currentNote} 
                navigateToSlide={navigateToSlide}
                flattenedNotes={flattenedNotes}
              />
            ) : isStartSlide ? (
              <div className="flex flex-col items-center justify-center text-center">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8">
                  {currentNote.content}
                </h1>
                {currentProject.author && (
                  <div className="mt-4 text-xl opacity-80">
                    By {currentProject.author}
                  </div>
                )}
                {currentNote.time && (
                  <div className="mt-8 opacity-70 font-mono">
                    {currentNote.time}
                    {currentNote.timeBorrowed && (
                      <span className="ml-1 text-yellow-400 text-sm">(borrowed)</span>
                    )}
                  </div>
                )}
              </div>
            ) : isEndSlide ? (
              <div className="flex flex-col items-center justify-center text-center">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8">
                  Thank You!
                </h1>
                <h2 className="text-2xl sm:text-3xl opacity-80 mb-6">
                  {currentProject.name}
                </h2>
                {currentProject.author && (
                  <div className="mt-4 text-xl opacity-80">
                    By {currentProject.author}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full">
                {/* Main slide content */}
                <div 
                  className="slide-content" 
                  style={generateTypographyStyles(getTypographyStyles(slideContentType, level))}
                >
                  {currentNote.content && formatContent(currentNote.content)}
                </div>
                
                {/* Images */}
                {currentNote.images && currentNote.images.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4 justify-center">
                    {currentNote.images.map((image, idx) => (
                      <div key={idx} className="max-w-full overflow-hidden rounded-lg shadow-lg">
                        <ImageWithFallback 
                          src={image} 
                          alt={`Slide image ${idx + 1}`}
                          className="max-h-[50vh] w-auto object-contain"
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* YouTube video */}
                {currentNote.youtubeLink && (
                  <div className="mt-4 flex justify-center">
                    <div className="max-w-full w-full aspect-video rounded-lg overflow-hidden shadow-lg">
                      <iframe
                        src={getYoutubeEmbedUrl(currentNote.youtubeLink, currentNote.time || '')}
                        title="YouTube video"
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
                
                {/* URL link */}
                {currentNote.url && (
                  <div className="mt-4 flex justify-center">
                    <a 
                      href={currentNote.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-white transition-colors border border-white/20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {currentNote.linkText || currentNote.url}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Debug overlay - ALWAYS VISIBLE regardless of pacing state */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/95 p-2 rounded border border-gray-600 z-20 text-[9px] sm:text-[11px] font-mono w-[240px] sm:w-[300px]">
          <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
            <div className="text-green-400 font-semibold whitespace-nowrap">Start Time:</div>
            <div className="text-white">{pacingInfo.previousTimedNote?.time || currentNote?.time || '—'}</div>
            
            <div className="text-green-400 font-semibold whitespace-nowrap">End Time:</div>
            <div className="text-white">{pacingInfo.nextTimedNote?.time || '—'}</div>
            
            <div className="text-green-400 font-semibold whitespace-nowrap">Total Time:</div>
            <div className="text-white">{(() => {
              if (!pacingInfo.previousTimedNote?.time || !pacingInfo.nextTimedNote?.time) return '—';
              const startMin = timeToMinutes(pacingInfo.previousTimedNote?.time);
              const endMin = timeToMinutes(pacingInfo.nextTimedNote?.time);
              let totalMin = endMin - startMin;
              if (totalMin < 0) totalMin += 24 * 60; // Adjust for time wrapping to next day
              const hours = Math.floor(totalMin / 60);
              const mins = Math.floor(totalMin % 60);
              return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            })()}</div>
            
            <div className="text-green-400 font-semibold whitespace-nowrap">Notes:</div>
            <div className="text-white">{(() => {
              if (!pacingInfo.previousTimedNote || !pacingInfo.nextTimedNote) return '—';
              const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
              const nextIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
              const currIndex = currentSlideIndex;
              if (prevIndex < 0 || nextIndex < 0) return '—';
              // Add 1 to convert from 0-based to 1-based position
              return `${currIndex - prevIndex + 1}/${nextIndex - prevIndex}`;
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
                const currIndex = currentSlideIndex;
                
                if (prevSlideIndex < 0 || nextSlideIndex < 0) return "unknown";
                
                // Calculate total slides and our position
                const totalSlides = nextSlideIndex - prevSlideIndex;
                if (totalSlides <= 0) return "unknown"; // Avoid division by zero
                
                // Calculate our position (fraction) between the two timed slides
                const slideProgress = (currIndex - prevSlideIndex) / totalSlides;
                
                // Calculate the expected time at our position
                const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                
                // Calculate difference between current time and expected time
                let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                
                // Handle crossing midnight
                if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                
                // Format as human-readable time difference
                const sign = diffMinutes >= 0 ? '+' : '-';
                const absDiff = Math.abs(diffMinutes);
                const hours = Math.floor(absDiff / 60);
                const mins = Math.floor(absDiff % 60);
                const secs = Math.round((absDiff % 1) * 60);
                
                return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              }
              
              // No timed slides available for calculation
              return 'Time data unavailable';
            })()}</div>
          </div>
        </div>
        
        {/* Time tracking dots - Always show on all slides except overview slides and end slide */}
        {(!isOverviewSlide || currentNote?.time || isStartSlide) && !isEndSlide && (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
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
              
              {/* Black dot (time adherence) - position shows ahead/behind schedule - 35% opacity 
                  Always shows on all slides, not just on timed slides */}
              <div 
                className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black/35 transition-all duration-300"
                style={{
                  // Position the black dot on a smaller scale within the container
                  // 40% = maximum ahead (1 hour ahead)
                  // 50% = on time
                  // 60% = maximum behind (1 hour behind)
                  left: (() => {
                      try {
                        // Get values directly from the "Result is" field in the debug overlay
                        // This is the most reliable calculation
                        
                        // Get the current time
                        const now = new Date();
                        const currentHour = now.getHours();
                        const currentMinute = now.getMinutes();
                        const currentSeconds = now.getSeconds();
                        
                        // Calculate current time in minutes
                        const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSeconds / 60);
                        
                        // If we're on a timed slide (Current Note of these: 1)
                        if (currentNote?.time) {
                          // For timed slides, the result is the difference between current time and the slide's time
                          const slideTimeInMinutes = timeToMinutes(currentNote.time);
                          
                          // Calculate difference
                          let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                          
                          // Handle crossing midnight
                          if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                          else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                          
                          // Cap diffMinutes to -60..60 range
                          const timePosition = Math.max(-60, Math.min(60, diffMinutes));
                          // Map from -60..60 to 40%..60% (with 0 = 50%)
                          const percentPosition = 50 + ((timePosition / 60) * 10);
                          return `${percentPosition}%`;
                        }
                        
                        // Between two timed notes (exactly same calculation from the debug "Result is" field)
                        if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
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
                          let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                          
                          // Handle crossing midnight
                          if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                          else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                          
                          // Cap diffMinutes to -60..60 range
                          const timePosition = Math.max(-60, Math.min(60, diffMinutes));
                          // Map from -60..60 to 40%..60% (with 0 = 50%)
                          const percentPosition = 50 + ((timePosition / 60) * 10);
                          return `${percentPosition}%`;
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
          </div>
        )}
        
        {/* Footer navigation */}
        <div className="absolute bottom-0 left-0 right-0 text-center p-1 px-2 flex justify-between items-center bg-black/30 backdrop-blur-sm">
          <div className="w-4 sm:w-8"></div>
          <p className="text-white/40 text-[8px] sm:text-[10px] whitespace-nowrap overflow-hidden overflow-ellipsis">
            <span className="hidden sm:inline">{currentProject.name} • </span>
            {currentSlideIndex + 1}/{flattenedNotes.length}
            <span className="hidden xs:inline"> • {isStartSlide ? 'Start' : isEndSlide ? 'End' : isOverviewSlide ? 'Overview' : ''}</span>
            <span className="hidden sm:inline"> • Click for next slide • Arrow keys to navigate • ESC to exit</span>
          </p>
          <div className="flex items-center">
            <button 
              className="text-white/70 hover:text-white text-[10px] cursor-pointer mr-2"
              onClick={(e) => {
                e.stopPropagation();
                exitPresentation();
              }}
            >
              {currentProject.author || "Exit"}
            </button>
            <button
              className="text-white/30 hover:text-white/70 w-4 h-4"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle fullscreen
                const el = document.documentElement;
                if (!document.fullscreenElement) {
                  el.requestFullscreen().catch(console.error);
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen();
                  setIsFullscreen(false);
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isFullscreen ? (
                  <>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </>
                ) : (
                  <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
