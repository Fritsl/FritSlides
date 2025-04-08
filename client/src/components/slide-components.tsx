import React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Content types for typography
export enum ContentType {
  Title = 'title',
  Subtitle = 'subtitle',
  Heading = 'heading',
  Subheading = 'subheading',
  Regular = 'regular',
  Quote = 'quote',
  List = 'list',
  Code = 'code',
}

// Formats the note content with basic Markdown support
export function formatContent(content: string): React.ReactNode {
  if (!content) return null;
  
  // Sanitize and convert Markdown to HTML
  const sanitized = DOMPurify.sanitize(content);
  const html = marked(sanitized);
  
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// Function to construct a YouTube embed URL
export function getYoutubeEmbedUrl(url: string, time: string): string {
  // Extract video ID
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return url;

  // Convert time string to seconds if present (e.g., "1:30" => "90")
  let timeParam = '';
  if (time && time.trim()) {
    const timeParts = time.split(':').map(Number);
    if (timeParts.length === 2) {
      const seconds = (timeParts[0] * 60) + timeParts[1];
      timeParam = `?start=${seconds}`;
    }
  }

  return `https://www.youtube.com/embed/${videoId}${timeParam}`;
}

// Extract video ID from various YouTube URL formats
function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // Match various YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11) ? match[2] : null;
}

// Calculate the hierarchical level for a note (for typography and theming)
export function calculateLevel(parentId: number | null, notesMap: Map<number, any>): number {
  if (parentId === null) return 0;
  
  const parent = notesMap.get(parentId);
  if (!parent) return 0;
  
  return 1 + calculateLevel(parent.parentId, notesMap);
}

// Get typography styles based on content type and hierarchy level
export function getTypographyStyles(contentType: ContentType, level: number, textLength: number = 0): any {
  // Base sizes for different content types (in rem)
  const baseSizes = {
    [ContentType.Title]: 3.5,
    [ContentType.Subtitle]: 2.5,
    [ContentType.Heading]: 2.2,
    [ContentType.Subheading]: 1.8,
    [ContentType.Regular]: 1.5,
    [ContentType.Quote]: 1.6,
    [ContentType.List]: 1.4,
    [ContentType.Code]: 1.2,
  };
  
  // Scale down slightly based on hierarchical level
  const levelScaleFactor = Math.max(0.8, 1 - (level * 0.1));
  
  // Scale down based on text length for better readability
  const lengthScaleFactor = textLength > 100 
    ? 0.8 
    : textLength > 50 
      ? 0.9 
      : 1;
  
  const fontSize = baseSizes[contentType] * levelScaleFactor * lengthScaleFactor;
  
  // Return style object
  return {
    fontSize: `${fontSize}rem`,
    fontWeight: contentType.includes('title') || contentType.includes('heading') ? 'bold' : 'normal',
    fontStyle: contentType === ContentType.Quote ? 'italic' : 'normal',
    lineHeight: contentType === ContentType.Code ? 1.4 : 1.6,
    letterSpacing: contentType.includes('title') ? '0.04em' : 'normal',
  };
}

// Generate CSS style object from typography configuration
export function generateTypographyStyles(styles: any): React.CSSProperties {
  return {
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    fontStyle: styles.fontStyle,
    lineHeight: styles.lineHeight,
    letterSpacing: styles.letterSpacing,
  };
}