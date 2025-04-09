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
        font-weight: 500;
        letter-spacing: 0.03em;
        padding: 0.8em 2em;
        background: rgba(255,255,255,0.02);
        border-radius: 4px;
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

// Define interface for typography styles to improve type safety
interface TypographyStyle {
  fontSize: string;
  fontWeight: string | number;
  fontStyle: "normal" | "italic" | "oblique";
  lineHeight: number;
  letterSpacing: string;
  // Borders
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  // Padding
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  // Visual styling
  borderRadius?: string;
  boxShadow?: string;
  background?: string;
  fontFamily?: string;
  margin?: string;
}

/**
 * Get typography styles based on content type and hierarchy level
 * Using consistent sizing with visual design elements to differentiate hierarchy
 * Avoids CSS conflicts by not mixing shorthand and non-shorthand properties
 */
export function getTypographyStyles(contentType: ContentType, level: number, textLength: number = 0): TypographyStyle {
  // Only extremely long content needs adaptive sizing
  const needsAdaptiveSize = textLength > 300;
  
  // Use consistent base sizes for most content types to make slides more uniform
  const baseSizes = {
    [ContentType.Title]: needsAdaptiveSize ? 3.8 : 4.2, // Slightly larger for titles
    [ContentType.Subtitle]: 3.0,
    [ContentType.Heading]: 2.8,
    [ContentType.Subheading]: 2.4,
    [ContentType.Regular]: 2.2, // More readable consistent size
    [ContentType.Quote]: 2.2,
    [ContentType.List]: 2.2,
    [ContentType.Code]: 1.8, // Slightly smaller for code readability
  };
  
  // Only slight adjustment based on level to maintain consistent sizing
  // Use visual styling for levels instead of size variations
  const levelScaleFactor = Math.max(0.9, 1 - (level * 0.05));
  
  // Scale down very long content but keep most content consistent
  let lengthScaleFactor = 1;
  if (textLength > 200) {
    lengthScaleFactor = 0.9;
  } else if (textLength > 300) {
    lengthScaleFactor = 0.85;
  }
  
  const fontSize = baseSizes[contentType] * levelScaleFactor * lengthScaleFactor;
  
  // Base style for all types
  const baseStyle: TypographyStyle = {
    fontSize: `${fontSize}rem`,
    fontWeight: contentType.includes('title') || contentType.includes('heading') ? 'bold' : 'normal',
    fontStyle: contentType === ContentType.Quote ? 'italic' : 'normal',
    lineHeight: contentType === ContentType.Code ? 1.4 : 1.6,
    letterSpacing: contentType.includes('title') ? '0.04em' : 'normal',
  };
  
  // Create a result object starting with base styles
  const result: TypographyStyle = { ...baseStyle };
  
  // Apply level-specific visual treatments using font variations instead of borders
  if (level >= 1) {
    if (level === 1) {
      if (contentType.includes('heading')) {
        // Use bold instead of bottom border
        result.fontWeight = 700;
        result.letterSpacing = '0.05em';
      }
    } else if (level === 2) {
      // Use semi-bold for level 2
      result.fontWeight = 600;
      result.letterSpacing = '0.03em';
    } else if (level === 3) {
      // Use medium-weight italic instead of left border
      result.fontWeight = 500;
      result.letterSpacing = '0.02em';
      
      if (contentType.includes('regular')) {
        result.fontStyle = 'italic';
      }
    } else if (level >= 4) {
      // Use lighter weight with background instead of box
      result.fontWeight = 400;
      result.letterSpacing = '0.01em';
      result.background = 'rgba(255,255,255,0.05)';
      result.paddingTop = '0.4rem';
      result.paddingRight = '0.8rem';
      result.paddingBottom = '0.4rem';
      result.paddingLeft = '0.8rem';
      result.borderRadius = '4px';
    }
  }
  
  // Content-type specific treatments
  if (contentType === ContentType.Code) {
    result.background = 'rgba(0,0,0,0.2)';
    result.paddingTop = '0.8rem';
    result.paddingRight = '0.8rem';
    result.paddingBottom = '0.8rem';
    result.paddingLeft = '0.8rem';
    result.borderRadius = '4px';
    result.borderTop = '1px solid rgba(255,255,255,0.1)';
    result.borderRight = '1px solid rgba(255,255,255,0.1)';
    result.borderBottom = '1px solid rgba(255,255,255,0.1)';
    result.borderLeft = '1px solid rgba(255,255,255,0.1)';
    result.fontFamily = 'monospace';
  } else if (contentType === ContentType.Quote) {
    // More elegant quote style with font variations instead of just left border
    result.fontStyle = 'italic';
    result.fontWeight = 500;
    result.letterSpacing = '0.03em';
    result.background = 'rgba(255,255,255,0.02)';
    result.borderRadius = '4px';
    result.paddingTop = '0.5rem';
    result.paddingRight = '1rem';
    result.paddingBottom = '0.5rem';
    result.paddingLeft = '1rem';
  } else if (contentType === ContentType.List) {
    if (level > 1) {
      result.paddingLeft = `${level * 0.4}rem`;
    }
  }
  
  return result;
}

/**
 * Generate CSS style object from typography configuration
 * Converts our TypographyStyle interface to React's CSSProperties
 * Avoids CSS conflicts by not including both shorthand and non-shorthand properties
 */
export function generateTypographyStyles(styles: TypographyStyle): React.CSSProperties {
  return {
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    fontStyle: styles.fontStyle,
    lineHeight: styles.lineHeight,
    letterSpacing: styles.letterSpacing,
    
    // Individual borders instead of using "border" shorthand
    borderTop: styles.borderTop,
    borderRight: styles.borderRight,
    borderBottom: styles.borderBottom,
    borderLeft: styles.borderLeft,
    
    // Individual padding instead of using "padding" shorthand
    paddingTop: styles.paddingTop,
    paddingRight: styles.paddingRight,
    paddingBottom: styles.paddingBottom,
    paddingLeft: styles.paddingLeft,
    
    // Other styling properties
    borderRadius: styles.borderRadius,
    boxShadow: styles.boxShadow,
    background: styles.background,
    fontFamily: styles.fontFamily,
    margin: styles.margin,
  };
}