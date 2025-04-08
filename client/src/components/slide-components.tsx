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

// Formats the note content with enhanced Markdown support
export function formatContent(content: string): React.ReactNode {
  if (!content) return null;
  
  // Configure Marked options for better slide formatting
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  
  // Apply custom styles using CSS to avoid TypeScript issues with the Marked renderer
  const customStyles = `
    <style>
      .markdown-content ul, .markdown-content ol {
        text-align: left;
        width: 100%;
        max-width: 40rem;
        margin: 0 auto;
      }
      .markdown-content li {
        margin-bottom: 0.5em;
      }
      .markdown-content p {
        margin-bottom: 1rem;
      }
      .markdown-content h1 { font-weight: 700; margin-bottom: 1rem; }
      .markdown-content h2 { font-weight: 600; margin-bottom: 1rem; }
      .markdown-content h3 { font-weight: 500; margin-bottom: 1rem; }
      .markdown-content h4 { font-weight: 500; margin-bottom: 1rem; }
      .markdown-content h5 { font-weight: 400; margin-bottom: 1rem; }
      .markdown-content h6 { font-weight: 400; margin-bottom: 1rem; }
      .markdown-content pre {
        text-align: left;
        padding: 1em;
        background: rgba(0,0,0,0.2);
        border-radius: 8px;
        max-width: 100%;
        overflow-x: auto;
      }
      .markdown-content blockquote {
        text-align: center;
        font-style: italic;
        padding: 0.5em 2em;
        border-left: 4px solid rgba(255,255,255,0.2);
        max-width: 40rem;
        margin: 1rem auto;
      }
    </style>
  `;
  
  // Sanitize and convert Markdown to HTML
  const sanitized = DOMPurify.sanitize(content);
  const htmlContent = marked(sanitized);
  
  // Combine custom styles with the parsed markdown
  const fullHtml = customStyles + htmlContent;
  
  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: fullHtml }} />;
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