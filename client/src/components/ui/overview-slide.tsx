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
  
  // Format the parent note content as title using typography system
  const formatTitle = () => {
    // Split by newlines and use first line as title
    const lines = parentNote.content.split('\\n');
    const titleText = lines[0];
    
    // Determine the content type (should be Section for overview slides)
    const contentType = ContentType.Section;
    
    // Get font settings based on the level and content length
    const typography = getTypographyStyles(
      contentType, 
      0, // Level is usually 0 for section headers
      titleText.length
    );
    
    // Generate CSS styles
    const styles = generateTypographyStyles(typography);
    
    return (
      <h1 style={styles} className="mb-10 drop-shadow-md text-center">
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
  
  // Two-column layout for slides with media
  if (mediaLayout !== 'none') {
    const mediaColumnClass = 
      mediaLayout === 'portrait' || mediaLayout === 'shorts' 
        ? 'w-[350px]' 
        : 'w-1/2';
    
    return (
      <div className="flex flex-row h-full w-full">
        {/* Media column */}
        <div className={`${mediaColumnClass} p-6 flex items-center justify-center`}>
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
            <div className="rounded-lg overflow-hidden shadow-xl">
              <img 
                src={parentNote.images[0]} 
                alt="Slide image"
                className="w-full h-auto object-contain" 
              />
            </div>
          ) : null}
        </div>
        
        {/* Content column */}
        <div className={`flex-1 p-6 flex flex-col`}>
          {formatTitle()}
          
          <div className="flex flex-col space-y-6">
            {limitedChildNotes.map((note, index) => (
              <div key={note.id} className="flex items-start">
                <div 
                  className="w-3 h-3 rounded-full mt-2 mr-4 flex-shrink-0" 
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex-1">
                  {/* Use typography system for child item content */}
                  <p style={generateTypographyStyles(getTypographyStyles(
                    ContentType.Regular,
                    1, // Level 1 for child items in overview
                    note.content.split('\\n')[0].length
                  ))}>
                    {note.content.split('\\n')[0]}
                  </p>
                  <div className="flex mt-1 space-x-2">
                    {note.url && (
                      <div className="text-white/70">
                        <Link size={16} />
                      </div>
                    )}
                    {(note.content.toLowerCase().includes('discuss') || 
                      note.content.toLowerCase().includes('discussion')) && (
                      <div className="text-white/70">
                        <MessageCircle size={16} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {hasMoreChildren && (
              <div className="flex items-center mt-2">
                <div 
                  className="w-3 h-3 opacity-0 mr-4 flex-shrink-0" 
                />
                <p className="text-2xl text-white/70">...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Single column layout for slides without media
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-6">
      {formatTitle()}
      
      <div className="flex flex-col space-y-6 mt-8">
        {limitedChildNotes.map((note, index) => (
          <div key={note.id} className="flex items-start">
            <div 
              className="w-3 h-3 rounded-full mt-2 mr-4 flex-shrink-0" 
              style={{ backgroundColor: accentColor }}
            />
            <div className="flex-1">
              {/* Use typography system for child item content in single column layout */}
              <p style={generateTypographyStyles(getTypographyStyles(
                ContentType.Regular,
                1, // Level 1 for child items in overview
                note.content.split('\\n')[0].length
              ))}>
                {note.content.split('\\n')[0]}
              </p>
              <div className="flex mt-1 space-x-2">
                {note.url && (
                  <div className="text-white/70">
                    <Link size={16} />
                  </div>
                )}
                {(note.content.toLowerCase().includes('discuss') || 
                  note.content.toLowerCase().includes('discussion')) && (
                  <div className="text-white/70">
                    <MessageCircle size={16} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {hasMoreChildren && (
          <div className="flex items-center mt-2">
            <div 
              className="w-3 h-3 opacity-0 mr-4 flex-shrink-0" 
            />
            <p className="text-2xl text-white/70">...</p>
          </div>
        )}
      </div>
    </div>
  );
}