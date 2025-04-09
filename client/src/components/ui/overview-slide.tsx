import React, { useState, useEffect } from 'react';
import { Note } from '@shared/schema';
import { 
  PresentationTheme, 
  getAccentColor, 
  isPortraitImage, 
  isYoutubeShorts,
  PRESENTATION_THEMES
} from '@/lib/presentation-themes';
import { Link, MessageCircle, ArrowRight } from 'lucide-react';
import { 
  getTypographyStyles, 
  generateTypographyStyles, 
  ContentType, 
  determineContentType 
} from '@/lib/typography';
// Time display is only used in notes view, not in slides view

interface OverviewSlideProps {
  parentNote: Note;
  childNotes: Note[];
  theme: PresentationTheme;
}

export function OverviewSlide({ parentNote, childNotes, theme }: OverviewSlideProps) {
  const [mediaLayout, setMediaLayout] = useState<'none' | 'portrait' | 'landscape' | 'shorts' | 'video'>('none');
  const [isLoading, setIsLoading] = useState(true);
  
  // Determine layout based on media availability
  useEffect(() => {
    const determineLayout = async () => {
      setIsLoading(true);
      
      // Check if there's a YouTube video
      if (parentNote.youtubeLink) {
        if (isYoutubeShorts(parentNote.youtubeLink)) {
          setMediaLayout('shorts');
        } else {
          setMediaLayout('video');
        }
      } 
      // Check if there are images
      else if (parentNote.images && parentNote.images.length > 0) {
        // Check orientation of first image
        const isPortrait = await isPortraitImage(parentNote.images[0]);
        setMediaLayout(isPortrait ? 'portrait' : 'landscape');
      } else {
        setMediaLayout('none');
      }
      
      setIsLoading(false);
    };
    
    determineLayout();
  }, [parentNote]);
  
  // Convert YouTube URL to embed URL
  const getYoutubeEmbedUrl = (url: string, time?: string | null): string => {
    if (!url) return '';
    
    // Extract YouTube video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube.com\/shorts\/)([^"&?\/\s]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    
    if (!videoId) return '';
    
    // Function to convert time string (e.g. "1:30") to seconds
    const convertTimeToSeconds = (timeStr?: string | null): number => {
      if (!timeStr) return 0;
      
      const parts = timeStr.split(':').reverse();
      let seconds = 0;
      
      for (let i = 0; i < parts.length; i++) {
        seconds += parseInt(parts[i]) * Math.pow(60, i);
      }
      
      return seconds;
    };
    
    // Create embed URL with start time if provided
    const startTime = time ? `&start=${convertTimeToSeconds(time)}` : '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=0${startTime}`;
  };
  
  // Format the parent note content as title using responsive classes instead of typography system
  const formatTitle = () => {
    // Split by newlines and use first line as title
    const lines = parentNote.content.split('\\n');
    const titleText = lines[0];
    
    // Use the same typography system as the presentation for consistency
    return (
      <h1 
        style={{
          ...generateTypographyStyles(getTypographyStyles(ContentType.Title, 0)),
          // No scaling based on content length - ensure consistent size
          margin: '0 0 1.5rem 0',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          maxWidth: '100%',
        }}
      >
        {titleText}
      </h1>
    );
  };
  
  // Limit child notes to first 6 for preview
  const limitedChildNotes = childNotes.slice(0, 6);
  const hasMoreChildren = childNotes.length > 6;
  
  // Get the next color theme for bullets to make them stand out
  const getNextThemeColor = (currentTheme: PresentationTheme): string => {
    // Find the current theme index in the presentation themes array
    const currentIndex = PRESENTATION_THEMES.findIndex(t => t.name === currentTheme.name);
    
    // If we can't find the theme or it's the START_END_THEME, use a default contrasting color
    if (currentIndex === -1) {
      // For START_END_THEME (blue), use the Sand theme's orange color for contrast
      return "#F97316"; // Orange 500
    }
    
    // Get the next theme in the array (with wraparound)
    const nextIndex = (currentIndex + 1) % PRESENTATION_THEMES.length;
    return PRESENTATION_THEMES[nextIndex].colors.base;
  };
  
  // Accent color for markers and icons - use next theme color for better contrast
  const accentColor = getNextThemeColor(theme);
  
  // If still determining layout, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  // Responsive layout for slides with media - stacked on mobile, side-by-side on larger screens
  if (mediaLayout !== 'none') {
    const mediaColumnClass = 
      mediaLayout === 'portrait' || mediaLayout === 'shorts' 
        ? 'w-full sm:w-[380px] md:w-[450px]' 
        : 'w-full sm:w-1/2';
    
    return (
      <div className="flex flex-col sm:flex-row h-full w-full overflow-hidden">
        {/* Media column - full width on mobile, sized appropriately on larger screens */}
        <div className={`${mediaColumnClass} p-3 sm:p-6 flex items-center justify-center ${mediaLayout === 'portrait' || mediaLayout === 'shorts' ? 'max-h-[45vh] sm:max-h-none' : ''}`}>
          {mediaLayout === 'video' || mediaLayout === 'shorts' ? (
            <div className="w-full h-auto aspect-video rounded-xl overflow-hidden shadow-2xl bg-black/30 border border-white/10">
              <iframe
                className="w-full h-full"
                src={getYoutubeEmbedUrl(parentNote.youtubeLink || '', parentNote.time)}
                title="YouTube video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : parentNote.images && parentNote.images.length > 0 ? (
            <div className="rounded-xl overflow-hidden shadow-2xl max-h-[50vh] sm:max-h-none border border-white/20">
              <img 
                src={parentNote.images[0]} 
                alt="Slide image"
                className="w-full h-full object-contain" 
              />
            </div>
          ) : null}
        </div>
        
        {/* Content column */}
        <div className="flex-1 p-3 sm:p-6 flex flex-col overflow-hidden">
          <div className="text-center sm:text-left mb-4 sm:mb-6">
            {formatTitle()}
          </div>
          
          <div className="flex flex-col space-y-3 sm:space-y-4 overflow-y-auto">
            {limitedChildNotes.map((note, index) => {
              // Check if note has time marker
              const hasTimeMarker = note.time && note.time.trim().length > 0;
              
              return (
                <div key={note.id} className="flex items-start cursor-default">
                  {/* Simple white bullet, properly aligned */}
                  <div className="relative flex">
                    <div 
                      className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mt-3 mr-4 sm:mr-6 flex-shrink-0" 
                      style={{ 
                        backgroundColor: "white"
                      }}
                    />
                  </div>
                  
                  <div className="flex-1 p-1">
                    {/* Child note content */}
                    <p 
                      style={{
                        ...generateTypographyStyles(getTypographyStyles(ContentType.List, 1)),
                        // No scaling based on content length - ensure consistent size
                        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                      }}
                    >
                      {note.content.split('\\n')[0]}
                    </p>
                    
                    {/* Icons for additional features */}
                    <div className="flex mt-2 space-x-3 text-white/80 flex-wrap">
                      {note.url && (
                        <div className="flex items-center text-white/80">
                          <Link size={14} className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                          <span className="text-xs">Link</span>
                        </div>
                      )}
                      
                      {(note.content.toLowerCase().includes('discuss') || 
                        note.content.toLowerCase().includes('discussion')) && (
                        <div className="flex items-center text-white/80">
                          <MessageCircle size={14} className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                          <span className="text-xs">Discussion</span>
                        </div>
                      )}
                      
                      {/* Time markers are not shown in slides view */}
                      
                      {note.youtubeLink && (
                        <div className="flex items-center text-white/80 ml-auto">
                          <div className="text-xs bg-red-600/80 px-1.5 py-0.5 rounded">YouTube</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasMoreChildren && (
              <div className="flex items-center justify-center mt-3">
                <div className="flex items-center space-x-1">
                  <p className="text-xs sm:text-sm text-white/90 font-medium">
                    +{childNotes.length - limitedChildNotes.length} more slides
                  </p>
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Single column layout for slides without media - fully responsive
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-3 sm:p-6 overflow-hidden">
      <div className="text-center mb-6 sm:mb-10">
        {formatTitle()}
      </div>
      
      <div className="flex flex-col space-y-3 sm:space-y-5 overflow-y-auto max-w-3xl mx-auto">
        {limitedChildNotes.map((note, index) => {
          // Check if note has time marker
          const hasTimeMarker = note.time && note.time.trim().length > 0;
          
          return (
            <div key={note.id} className="flex items-start cursor-default">
              {/* Simple white bullet point, properly aligned with text */}
              <div className="relative flex">
                <div 
                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mt-3 mr-4 sm:mr-6 flex-shrink-0" 
                  style={{ 
                    backgroundColor: "white",
                  }}
                />
              </div>
              
              <div className="flex-1 p-1">
                {/* Child note content */}
                <p 
                  style={{
                    ...generateTypographyStyles(getTypographyStyles(ContentType.List, 1)),
                    // No scaling based on content length - ensure consistent size
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                >
                  {note.content.split('\\n')[0]}
                </p>
                
                {/* Icons for additional features */}
                <div className="flex mt-2 space-x-3 text-white/80">
                  {note.url && (
                    <div className="flex items-center text-white/80">
                      <Link size={14} className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                      <span className="text-xs sm:text-sm">Link</span>
                    </div>
                  )}
                  
                  {(note.content.toLowerCase().includes('discuss') || 
                    note.content.toLowerCase().includes('discussion')) && (
                    <div className="flex items-center text-white/80">
                      <MessageCircle size={14} className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                      <span className="text-xs sm:text-sm">Discussion</span>
                    </div>
                  )}
                  
                  {/* Time markers are not shown in slides view */}
                  
                  {note.youtubeLink && (
                    <div className="flex items-center text-white/80 ml-auto">
                      <div className="text-xs sm:text-sm bg-red-600/80 px-2 py-0.5 rounded">YouTube</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {hasMoreChildren && (
          <div className="flex items-center justify-center mt-4 mx-auto">
            <div className="flex items-center space-x-2">
              <p className="text-sm sm:text-base text-white/90 font-medium">
                +{childNotes.length - limitedChildNotes.length} more slides
              </p>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}