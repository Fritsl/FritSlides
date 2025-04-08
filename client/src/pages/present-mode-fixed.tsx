import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { Note, Project } from "@shared/schema";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import { getThemeBackgroundStyle, getPresentationTheme, ThemeColors, PresentationTheme } from "@/lib/presentation-themes";
import { formatContent, ContentType, getYoutubeEmbedUrl, calculateLevel, getTypographyStyles, generateTypographyStyles } from "@/components/slide-components";
import { OverviewSlide } from "@/components/ui/overview-slide";

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
}

// Define the TimeSegment interface for tracking time
interface TimeSegment {
  lastPassedSlideIndex: number; // Index of the slide with the last passed time marker
  nextUpcomingSlideIndex: number | null; // Index of the slide with the next upcoming time marker
  lastPassedTime: string; // The time marker of the last passed slide
  nextUpcomingTime: string | null; // The time marker of the next upcoming slide
  currentProgress: number; // Progress between 0-1 indicating position between time points
}

export default function PresentModeFixed() {
  const [, setLocation] = useLocation();
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;
  
  // Get projects and notes data
  const { projects, isLoading: projectsLoading } = useProjects();
  const { notes, isLoading: notesLoading } = useNotes(projectId);
  
  // States for presentation
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeDotsVisible, setTimeDotsVisible] = useState(true);
  
  // Compute loading state
  const isLoading = projectsLoading || notesLoading;
  
  // Find current project
  const currentProject = useMemo(() => {
    if (!projects || !projectId) return null;
    return projects.find((p) => p.id === projectId) || null;
  }, [projects, projectId]);
  
  // Process notes into presentation format
  const flattenedNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    
    // Create a map of notes by their IDs for quick access
    const notesMap = new Map<number, PresentationNote>();
    notes.forEach(note => {
      notesMap.set(note.id, { ...note, childNotes: [] });
    });
    
    // First pass: calculate levels and identify parent-child relationships
    const rootNotes: PresentationNote[] = [];
    notes.forEach(note => {
      const presentationNote = notesMap.get(note.id)!;
      if (note.parentId === null) {
        // This is a root-level note
        presentationNote.level = 0;
        rootNotes.push(presentationNote);
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
          rootNotes.push(presentationNote);
        }
      }
    });
    
    // Sort child notes by order for proper presentation
    notesMap.forEach(note => {
      if (note.childNotes && note.childNotes.length > 0) {
        note.childNotes.sort((a, b) => String(a.order).localeCompare(String(b.order)));
      }
    });
    
    // Build the flattened presentation structure
    const result: PresentationNote[] = [];
    
    // Add a start slide for the project
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      const startSlide: PresentationNote = {
        id: -1, // Use negative ID to avoid conflicts
        projectId,
        content: `${project.name}`,
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
    rootNotes.sort((a, b) => String(a.order).localeCompare(String(b.order)));
    
    // Use a rootIndex to keep track of which root note each slide belongs to
    // This is used for consistent theming of related slides
    let rootIndex = 0;
    
    // Helper function to recursively add all levels of notes
    const addNoteAndChildren = (note: PresentationNote, currentRootIndex: number) => {
      // Add the note itself with the root index
      const noteWithIndex = { ...note, rootIndex: currentRootIndex };
      result.push(noteWithIndex);
      
      // Recursively add all children if any
      if (note.childNotes && note.childNotes.length > 0) {
        // Sort children by order
        const sortedChildren = [...note.childNotes].sort((a, b) => 
          String(a.order).localeCompare(String(b.order))
        );
        
        // For root notes, add an overview slide showing all direct children
        if (note.level === 0) {
          const overviewSlide: PresentationNote = {
            ...note,
            id: -100 - result.length, // Use a unique negative ID
            isOverviewSlide: true,
            childNotes: sortedChildren,
            rootIndex: currentRootIndex
          };
          result.push(overviewSlide);
        }
        
        // Add each child recursively
        sortedChildren.forEach(childNote => {
          addNoteAndChildren(childNote, currentRootIndex);
        });
      }
    };
    
    // Process each root note and all its descendants
    rootNotes.forEach(rootNote => {
      addNoteAndChildren(rootNote, rootIndex);
      rootIndex++; // Increment for the next root branch
    });
    
    // Add an end slide for the project
    if (project) {
      const endSlide: PresentationNote = {
        id: -2, // Use negative ID to avoid conflicts
        projectId,
        content: `End of presentation`,
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
  }, [notes, projectId, projects]);
  
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
  
  // Get the theme for the current slide based on its rootIndex
  const theme = useMemo(() => {
    if (!currentNote) return getPresentationTheme(0, 0);
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
  
  const requestFullscreen = () => {
    const docElement = document.documentElement;
    if (docElement.requestFullscreen) {
      docElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen request was rejected:", err));
    } else {
      console.warn("Fullscreen API is not supported");
    }
  };
  
  const exitPresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error("Error exiting fullscreen:", err));
    }
    
    // Navigate back to the project page
    if (projectId) {
      setLocation(`/project/${projectId}`);
    } else {
      setLocation('/');
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
        case "Escape":
          exitPresentation();
          break;
        case "f":
        case "F":
          requestFullscreen();
          break;
        case "t":
        case "T":
          setTimeDotsVisible(prev => !prev);
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
  
  // Time tracking calculations
  const getSlideDifference = () => {
    if (!currentNote || !currentNote.time || currentNote.time.trim() === '') {
      return 0; // No time marker on current slide
    }
    
    // Convert time string to minutes past midnight
    const parseTimeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const currentTime = new Date();
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const targetMinutes = parseTimeToMinutes(currentNote.time);
    
    // Calculate how many minutes ahead or behind we are
    const minutesDifference = targetMinutes - currentMinutes;
    
    // Estimate how many slides this represents (assume 1 minute per slide)
    // Limit the maximum difference to prevent extreme visual offsets
    return Math.min(Math.max(minutesDifference, -25), 25);
  };
  
  // Find the next slide with a time marker
  const getNextTimedSlide = () => {
    if (!flattenedNotes.length || currentSlideIndex >= flattenedNotes.length) {
      return null;
    }
    
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
    <div className="min-h-screen flex flex-col bg-black">
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
                        <span className="opacity-80">Now:</span> {currentNote?.time ? `${currentNote.time}` : 'No time marker'} 
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
        </>
      )}
    </div>
  );
}