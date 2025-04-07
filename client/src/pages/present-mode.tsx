import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Edit, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getLevelColor } from "@/lib/colors";
import { Note, Project } from "@shared/schema";

// Extended note type with level information for presentation
interface PresentationNote extends Note {
  level?: number;
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
    
    // Helper function to flatten notes recursively in a depth-first manner
    const flattenNotes = (notesList: Note[], parentId: number | null = null, level = 0): PresentationNote[] => {
      const result: PresentationNote[] = [];
      
      // Sort notes by their order field
      const sortedNotes = [...notesList]
        .filter(note => String(note.parentId) === String(parentId))
        .sort((a, b) => Number(a.order) - Number(b.order));
      
      // Add each note and then its children
      for (const note of sortedNotes) {
        // Add the current note with its level information
        const noteWithLevel: PresentationNote = { ...note, level };
        result.push(noteWithLevel);
        
        // Recursively add children
        const children = flattenNotes(notesList, note.id, level + 1);
        result.push(...children);
      }
      
      return result;
    };
    
    const flattened = flattenNotes(notes);
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
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft") {
        goToPrevSlide();
      } else if (e.key === "Escape") {
        // Return to the main editor view
        setLocation(`/`);
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
  const levelColor = getLevelColor(level);
  
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

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Slide content - Full screen with no UI */}
      <div 
        className="flex-1 flex flex-col items-center justify-center w-full h-full"
        style={{ 
          backgroundColor: levelColor.regular,
          backgroundImage: `linear-gradient(135deg, ${levelColor.regular} 0%, ${levelColor.light} 100%)` 
        }}
      >
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
      </div>
      
      {/* Minimal footer with navigation hints */}
      <div className="absolute bottom-0 left-0 right-0 text-center p-1">
        <p className="text-white/30 text-[10px]">
          {currentProject?.name} • {currentSlideIndex + 1}/{flattenedNotes.length} • ← → to navigate • ESC to exit
        </p>
      </div>
    </div>
  );
}