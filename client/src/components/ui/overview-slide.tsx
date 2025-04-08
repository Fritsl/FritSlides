import React, { useState, useEffect } from 'react';
import { Note } from '@shared/schema';
import { PresentationTheme, getAccentColor, isPortraitImage, isYoutubeShorts } from '@/lib/presentation-themes';
import { Link, MessageCircle } from 'lucide-react';
import { 
  getTypographyStyles, 
  generateTypographyStyles, 
  ContentType, 
  determineContentType 
} from '@/lib/presentation-typography';

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
    
    // Use responsive classes instead of dynamic typography
    return (
      <h1 
        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl mb-4 sm:mb-6 drop-shadow-md font-semibold"
        style={{
          fontFamily: '"Roboto", sans-serif',
          lineHeight: 1.2,
          letterSpacing: '0.02em',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          maxWidth: '100%'
        }}
      >
        {titleText}
      </h1>
    );
  };
  
  // Limit child notes to first 6 for preview
  const limitedChildNotes = childNotes.slice(0, 6);
  const hasMoreChildren = childNotes.length > 6;
  
  // Accent color for markers and icons
  const accentColor = getAccentColor(theme);
  
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
        ? 'w-full sm:w-[280px] md:w-[350px]' 
        : 'w-full sm:w-1/2';
    
    return (
      <div className="flex flex-col sm:flex-row h-full w-full overflow-hidden">
        {/* Media column - full width on mobile, sized appropriately on larger screens */}
        <div className={`${mediaColumnClass} p-3 sm:p-6 flex items-center justify-center ${mediaLayout === 'portrait' || mediaLayout === 'shorts' ? 'max-h-[30vh] sm:max-h-none' : ''}`}>
          {mediaLayout === 'video' || mediaLayout === 'shorts' ? (
            <div className="w-full h-auto aspect-video rounded-lg overflow-hidden shadow-xl">
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
            <div className="rounded-lg overflow-hidden shadow-xl max-h-[20vh] sm:max-h-none">
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
          <div className="text-center sm:text-left">
            {formatTitle()}
          </div>
          
          <div className="flex flex-col space-y-2 sm:space-y-4 overflow-y-auto">
            {limitedChildNotes.map((note, index) => (
              <div key={note.id} className="flex items-start">
                <div 
                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mt-1.5 sm:mt-2 mr-2 sm:mr-4 flex-shrink-0" 
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex-1">
                  {/* Use typography system with smaller text on mobile */}
                  <p 
                    className="text-sm sm:text-base md:text-lg lg:text-xl"
                    style={{
                      fontFamily: '"Roboto", sans-serif',
                      fontWeight: 400,
                      lineHeight: 1.4,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {note.content.split('\\n')[0]}
                  </p>
                  <div className="flex mt-1 space-x-2">
                    {note.url && (
                      <div className="text-white/70">
                        <Link size={12} className="w-3 h-3 sm:w-4 sm:h-4" />
                      </div>
                    )}
                    {(note.content.toLowerCase().includes('discuss') || 
                      note.content.toLowerCase().includes('discussion')) && (
                      <div className="text-white/70">
                        <MessageCircle size={12} className="w-3 h-3 sm:w-4 sm:h-4" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {hasMoreChildren && (
              <div className="flex items-center mt-2">
                <div 
                  className="w-2 h-2 sm:w-3 sm:h-3 opacity-0 mr-2 sm:mr-4 flex-shrink-0" 
                />
                <p className="text-xl sm:text-2xl text-white/70">...</p>
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
      <div className="text-center mb-3 sm:mb-6">
        {formatTitle()}
      </div>
      
      <div className="flex flex-col space-y-2 sm:space-y-4 overflow-y-auto">
        {limitedChildNotes.map((note, index) => (
          <div key={note.id} className="flex items-start">
            <div 
              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mt-1.5 sm:mt-2 mr-2 sm:mr-4 flex-shrink-0" 
              style={{ backgroundColor: accentColor }}
            />
            <div className="flex-1">
              {/* Use responsive sizing with direct CSS rather than dynamic typography */}
              <p 
                className="text-sm sm:text-base md:text-lg lg:text-xl"
                style={{
                  fontFamily: '"Roboto", sans-serif',
                  fontWeight: 400,
                  lineHeight: 1.4,
                  letterSpacing: '0.01em',
                }}
              >
                {note.content.split('\\n')[0]}
              </p>
              <div className="flex mt-1 space-x-2">
                {note.url && (
                  <div className="text-white/70">
                    <Link size={12} className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                )}
                {(note.content.toLowerCase().includes('discuss') || 
                  note.content.toLowerCase().includes('discussion')) && (
                  <div className="text-white/70">
                    <MessageCircle size={12} className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {hasMoreChildren && (
          <div className="flex items-center mt-2">
            <div 
              className="w-2 h-2 sm:w-3 sm:h-3 opacity-0 mr-2 sm:mr-4 flex-shrink-0" 
            />
            <p className="text-xl sm:text-2xl text-white/70">...</p>
          </div>
        )}
      </div>
    </div>
  );
}