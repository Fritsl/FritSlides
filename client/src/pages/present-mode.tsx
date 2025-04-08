import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Edit, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPresentationTheme, getThemeBackgroundStyle, PresentationTheme } from "@/lib/presentation-themes";
import { OverviewSlide } from "@/components/ui/overview-slide";
import { Note, Project } from "@shared/schema";

// Extended note type with level, theme, and child information for presentation
interface PresentationNote extends Note {
  level?: number;
  rootIndex?: number; // Index of the root note this belongs to - for theming
  childNotes?: PresentationNote[]; // Direct child notes for overview slides
  hasChildren?: boolean; // Flag to indicate this note has children
}

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
  
  // Find the current project by ID
  useEffect(() => {
    if (projects && projectId) {
      const project = projects.find((p: Project) => p.id === projectId);
      setCurrentProject(project || null);
    }
  }, [projects, projectId]);
  
  // Convert hierarchical notes to a flattened array for presentation
  useEffect(() => {
    if (!notes) return;
    
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
    
    setFlattenedNotes(flattened);
    
    // Reset current slide to beginning when notes change
    setCurrentSlideIndex(0);
  }, [notes]);
  
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
  
  // Helper functions for content display
  const formatContent = (content: string) => {
    return content.split('\\n').map((line, i) => (
      <p key={i} className={i === 0 
        ? "text-5xl font-bold mb-8 tracking-tight drop-shadow-md" 
        : "text-3xl mb-5 font-light tracking-wide"
      }>
        {line}
      </p>
    ));
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
        {/* Render appropriate slide based on if it's an overview slide or regular slide */}
        {isOverviewSlide ? (
          // Overview slide with chapter markers
          <OverviewSlide 
            parentNote={currentNote} 
            childNotes={currentNote.childNotes!}
            theme={theme}
          />
        ) : (
          // Regular slide with content
          <div className="max-w-6xl w-full h-full flex flex-col items-center justify-center p-10">
            <div className="w-full text-white">
              <div className="content mb-10">
                {formatContent(currentNote.content)}
              </div>
              
              {/* URL link if present */}
              {currentNote.url && (
                <div className="mt-8">
                  <a
                    href={currentNote.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 hover:text-white flex items-center text-2xl border-b border-white/30 pb-2 w-fit"
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
                  {currentNote.images.map((image, idx) => (
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
          {isOverviewSlide ? 'Chapter overview' : ''} • 
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
    </div>
  );
}