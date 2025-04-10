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
  getTypographyStyles, 
  getAdvancedTypographyStyles,
  generateTypographyStyles,
} from '@/lib/presentation-typography';
import { OverviewSlide } from "@/components/ui/overview-slide";
import { formatPerSlideTime, timeToMinutes } from "@/lib/time-utils";
import { TimeDisplay } from "@/components/ui/time-display";
import { TimeDebugPanel } from "@/components/ui/time-debug-panel";

export default function PresentMode() {
  // Routing params
  const params = useParams<{ projectId?: string, noteId?: string }>();
  const [, setLocation] = useLocation();
  const projectId = params?.projectId ? parseInt(params.projectId) : undefined;
  const startNoteId = params?.noteId ? parseInt(params.noteId) : undefined;
  
  // State for the presentation
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [flattenedNotes, setFlattenedNotes] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [pacingInfo, setPacingInfo] = useState({
    shouldShow: false,
    slideDifference: 0,
    percentComplete: 0,
    currenSlideIndex: 0,
    previousTimedNote: undefined,
    nextTimedNote: undefined
  });
  
  // Fetch data
  const projectsData = useProjects();
  const notesData = useNotes();
  const currentProject = projectId ? projectsData.projects?.find(p => p.id === projectId) : undefined;
  const projectNotes = projectId ? notesData.notes?.filter(n => n.projectId === projectId) : [];
  
  // Current note is the active slide
  const currentNote = flattenedNotes[currentSlideIndex];
  const isOverviewSlide = currentNote?.isOverviewSlide;
  const isStartSlide = currentNote?.isStartSlide;
  const isEndSlide = currentNote?.isEndSlide;
  
  // Level determines the theme (inheritance from parent headings)
  const level = currentNote?.level || 0;
  
  // Loading state
  const isLoading = !currentProject || !projectNotes || projectNotes.length === 0;
  
  // Function to navigate to a specific slide
  const navigateToSlide = (index: number) => {
    if (index >= 0 && index < flattenedNotes.length) {
      setCurrentSlideIndex(index);
    }
  };
  
  return (
    <div className="bg-black text-white h-screen w-full flex flex-col">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-2xl">Loading presentation...</div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-full h-full relative">
              <div className="w-full h-full flex items-center justify-center p-8">
                <div className="text-4xl">
                  {currentNote?.content || "Empty slide"}
                </div>
              </div>
              
              {/* Debug overlay - ALWAYS VISIBLE regardless of pacing state */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/95 p-2 rounded border border-gray-600 z-20 text-[9px] sm:text-[11px] font-mono w-[240px] sm:w-[300px]">
                <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                  <div className="text-green-400 font-semibold whitespace-nowrap">Start Time:</div>
                  <div className="text-white">{pacingInfo.previousTimedNote?.time || currentNote?.time || '—'}</div>
                  
                  <div className="text-green-400 font-semibold whitespace-nowrap">End Time:</div>
                  <div className="text-white">{pacingInfo.nextTimedNote?.time || '—'}</div>
                  
                  <div className="text-green-400 font-semibold whitespace-nowrap">Slide:</div>
                  <div className="text-white">{currentSlideIndex + 1} / {flattenedNotes.length}</div>
                </div>
              </div>
              
              {/* Time tracking dots - Always show on all slides except overview slides and end slide */}
              {(!isOverviewSlide || currentNote?.time || isStartSlide) && !isEndSlide && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
                  <div 
                    className="relative h-8 sm:h-10 flex items-center justify-center"
                    style={{ width: '140px' }}
                  >
                    {/* White dot (current position) */}
                    <div 
                      className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/35"
                      style={{
                        left: '50%',
                        transform: 'translateX(-50%)',
                        boxShadow: '0 0 4px rgba(255,255,255,0.3)'
                      }}
                    />
                    
                    {/* Black dot (time adherence) */}
                    <div 
                      className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black/35"
                      style={{
                        left: '50%',
                        transform: 'translateX(-50%)',
                        boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer navigation */}
          <div className="p-2 text-center text-sm">
            Slide {currentSlideIndex + 1} of {flattenedNotes.length}
          </div>
        </>
      )}
    </div>
  );
}
