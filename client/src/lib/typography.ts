// Unified Typography System for FritSlides
// Provides consistent styling across all presentation modes
// with visual hierarchy cues that maintain consistent base sizes

// Import fonts
import '@fontsource/mulish';
import '@fontsource/roboto';

// Font definitions
export const FONTS = {
  display: '"Roboto", sans-serif',     // Display font for headlines and start/end slides
  body: '"Mulish", sans-serif',        // Primary font for all other text
  monospace: 'monospace',              // Font for code blocks
};

// Font weight definitions - matches Roboto weights
export const WEIGHTS = {
  light: 300,    // Light weight
  regular: 400,  // Regular weight
  medium: 500,   // Medium weight
  semibold: 600, // Semibold weight
  bold: 700,     // Bold weight
};

// Content types for regular slides
export enum ContentType {
  Title = 'title',           // Main slide titles
  Subtitle = 'subtitle',     // Slide subtitles
  Heading = 'heading',       // Major section headers
  Subheading = 'subheading', // Secondary headers
  Regular = 'regular',       // Regular content
  Quote = 'quote',           // Quotations
  List = 'list',             // Bullet points
  Code = 'code',             // Code blocks
}

// Content types for special slides (start/end/overview)
export enum SlideContentType {
  StartEndSlide = 'startEndSlide',  // Start/End slide content
  Headline = 'headline',            // Major section headers
  Subheading = 'subheading',        // Secondary headers
  Body = 'body',                    // Regular content
  List = 'list',                    // Bullet points
  Code = 'code',                    // Code blocks
  Quote = 'quote',                  // Quotations
  Caption = 'caption',              // Smaller supplementary text
  Overview = 'overview'             // Overview slide bullets
}

// Define interface for typography styles to improve type safety
export interface TypographyStyle {
  fontSize: string;
  fontWeight: string | number;
  fontStyle: "normal" | "italic" | "oblique";
  lineHeight: number;
  letterSpacing: string;
  fontFamily?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  
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
  margin?: string;
  textShadow?: string;
}

/**
 * Get typography styles based on content type and hierarchy level for regular slides
 * Using consistent sizing with visual design elements to differentiate hierarchy
 * Avoids CSS conflicts by not mixing shorthand and non-shorthand properties
 */
export function getTypographyStyles(contentType: ContentType, level: number, textLength: number = 0): TypographyStyle {
  // CRITICAL FIX: Enforce 100% consistent font sizes across slides
  // This is a deliberate decision to prioritize visual consistency between slides
  // with the same hierarchical level, even if the content length varies
  
  // Fixed sizes for all content types regardless of content length
  // These values will not be scaled by text length at all
  const fixedSizes = {
    [ContentType.Title]: 3.6, // Consistent size for all titles
    [ContentType.Subtitle]: 3.0,
    [ContentType.Heading]: 2.8,
    [ContentType.Subheading]: 2.4,
    [ContentType.Regular]: 2.2,
    [ContentType.Quote]: 2.2,
    [ContentType.List]: 2.2,
    [ContentType.Code]: 1.8,
  };
  
  // Remove all level and length scaling - complete consistency
  const fontSize = fixedSizes[contentType];
  
  // Base style for all types
  const baseStyle: TypographyStyle = {
    fontSize: `${fontSize}rem`,
    fontWeight: contentType.includes('title') || contentType.includes('heading') ? 'bold' : 'normal',
    fontStyle: contentType === ContentType.Quote ? 'italic' : 'normal',
    lineHeight: contentType === ContentType.Code ? 1.4 : 1.6,
    letterSpacing: contentType.includes('title') ? '0.04em' : 'normal',
    textShadow: '-1px 1px 1px rgba(0,0,0,0.15)', // Subtle depth effect
  };
  
  // Set appropriate font family
  if (contentType === ContentType.Code) {
    baseStyle.fontFamily = FONTS.monospace;
  } else if (contentType === ContentType.Title || contentType === ContentType.Subtitle) {
    baseStyle.fontFamily = FONTS.display;
  } else {
    baseStyle.fontFamily = FONTS.body;
  }
  
  // Create a result object starting with base styles
  const result: TypographyStyle = { ...baseStyle };
  
  // Apply level-specific visual treatments using font variations instead of borders
  if (level > 1) {
    if (level === 2) {
      if (contentType.includes('heading')) {
        // Instead of bottom border, use more spacing and letter spacing
        result.letterSpacing = '0.04em';
        result.paddingBottom = '0.3rem';
        result.fontWeight = WEIGHTS.bold;
      }
    } else if (level === 3) {
      // Instead of left border, use different font weight and letter spacing
      result.paddingLeft = '0.4rem';
      result.fontWeight = WEIGHTS.medium;
      result.letterSpacing = '0.02em';
      
      if (contentType.includes('regular')) {
        result.fontStyle = 'italic';
      }
    } else if (level >= 4) {
      // Keep the subtle background but enhance with font variations
      result.background = 'rgba(255,255,255,0.05)';
      result.paddingTop = '0.4rem';
      result.paddingRight = '0.8rem';
      result.paddingBottom = '0.4rem';
      result.paddingLeft = '0.8rem';
      result.borderRadius = '4px';
      result.boxShadow = '1px 1px 3px rgba(0,0,0,0.1)';
      result.letterSpacing = '-0.01em';
      result.fontWeight = level % 2 === 0 ? WEIGHTS.medium : WEIGHTS.light;
    }
  }
  
  // Content-type specific treatments - using font variations instead of borders
  if (contentType === ContentType.Code) {
    result.background = 'rgba(0,0,0,0.2)';
    result.paddingTop = '0.8rem';
    result.paddingRight = '0.8rem';
    result.paddingBottom = '0.8rem';
    result.paddingLeft = '0.8rem';
    result.borderRadius = '4px';
    // Use box-shadow instead of borders
    result.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    // Use font variations for code
    result.fontWeight = WEIGHTS.medium;
    result.letterSpacing = '0.01em';
  } else if (contentType === ContentType.Quote) {
    // Use padding and font variations instead of left border
    result.paddingLeft = '1.2rem';
    result.background = 'rgba(255,255,255,0.02)';
    result.borderRadius = '4px';
    // Enhanced italic style with different font weight
    result.fontStyle = 'italic';
    result.fontWeight = WEIGHTS.light;
    result.letterSpacing = '0.02em';
  } else if (contentType === ContentType.List) {
    if (level > 1) {
      result.paddingLeft = `${level * 0.4}rem`;
      // Add font variations for nested lists
      result.letterSpacing = level % 2 === 0 ? '0.01em' : 'normal';
      result.fontWeight = level % 2 === 0 ? WEIGHTS.medium : WEIGHTS.regular;
    }
  }
  
  return result;
}

/**
 * Get typography styles for special slides like Start/End slides
 */
export function getAdvancedTypographyStyles(
  contentType: SlideContentType,
  level: number,
  textLength: number = 0,
  hasMedia: boolean = false
): TypographyStyle {
  // Base style for all special slide types
  const baseStyle: TypographyStyle = {
    fontSize: '2.2rem',
    fontWeight: WEIGHTS.regular,
    fontStyle: 'normal',
    lineHeight: 1.5,
    letterSpacing: 'normal',
    textShadow: '-1px 1px 1px rgba(0,0,0,0.25)', // Subtle depth effect
  };
  
  // CRITICAL FIX: No scaling based on text length or media presence
  // This ensures 100% consistent font sizes regardless of slide content
  
  // Apply specialized styling based on content type
  switch(contentType) {
    case SlideContentType.StartEndSlide:
      // Special styling for start/end slides - fixed size
      // Absolute fixed size for perfect consistency
      return {
        ...baseStyle,
        fontFamily: FONTS.display,
        fontSize: '4.0rem', // IMPORTANT: Fixed exact size for all start/end slides
        fontWeight: WEIGHTS.bold,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        lineHeight: 1.2,
        textAlign: 'center',
      };
      
    case SlideContentType.Headline:
      // Major section headers - using font variations instead of border
      return {
        ...baseStyle,
        fontFamily: FONTS.display,
        fontSize: '3.2rem',
        fontWeight: WEIGHTS.bold,
        letterSpacing: '0.04em',  // More letter spacing instead of border
        lineHeight: 1.2,          // Tighter line height
        paddingBottom: '0.5rem',
        textTransform: 'uppercase', // Add text transform for visual distinction
        textShadow: '0 1px 2px rgba(0,0,0,0.2)'  // Enhanced text shadow
      };
      
    case SlideContentType.Subheading:
      // Secondary headers - using font variations instead of left border
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '2.6rem',
        fontWeight: WEIGHTS.semibold,
        letterSpacing: '0.02em',   // Slight letter spacing
        paddingLeft: '0.4rem',     // Reduced padding
        textShadow: '0 1px 1px rgba(0,0,0,0.15)'  // Subtle text shadow
      };
      
    case SlideContentType.Body:
      // Regular content text with font variations instead of borders
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '2.2rem', // Fixed size for all body text
        // Use more font variations based on level
        fontWeight: level % 2 === 0 ? WEIGHTS.regular : WEIGHTS.light,
        fontStyle: level > 2 ? 'italic' : 'normal',  // Lower threshold for italic
        letterSpacing: level > 2 ? '0.01em' : 'normal',
        paddingLeft: level > 1 ? `${level * 0.3}rem` : undefined,  // Reduced padding
        // Use background and box shadow for deeper levels instead of borders
        background: level > 3 ? 'rgba(255,255,255,0.03)' : undefined,
        borderRadius: level > 3 ? '4px' : undefined,
        boxShadow: level > 3 ? 'inset 0 0 5px rgba(0,0,0,0.1)' : undefined,
      };
      
    case SlideContentType.List:
      // Bullet points with padding based on level
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '2.0rem',
        paddingLeft: level > 0 ? `${level * 0.8}rem` : undefined,
      };
      
    case SlideContentType.Code:
      // Code blocks with monospace font - using font variations instead of borders
      return {
        ...baseStyle,
        fontFamily: FONTS.monospace,
        fontSize: '1.8rem',
        fontWeight: WEIGHTS.medium,
        lineHeight: 1.4,
        letterSpacing: '0.02em', // Slightly increased letter spacing for code
        background: 'rgba(0,0,0,0.2)',
        paddingTop: '0.8rem',
        paddingRight: '0.8rem',
        paddingBottom: '0.8rem',
        paddingLeft: '0.8rem',
        borderRadius: '4px',
        boxShadow: '0 0 8px rgba(0,0,0,0.3), inset 0 0 2px rgba(255,255,255,0.1)', // Enhanced shadow instead of border
      };
      
    case SlideContentType.Quote:
      // Quote styling - using font variations instead of left border
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '2.2rem',
        fontStyle: 'italic',
        fontWeight: WEIGHTS.light, // Lighter weight for quotes
        letterSpacing: '0.02em',  // Slight letter spacing
        lineHeight: 1.7,          // Increased line height
        paddingLeft: '1.2rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '4px',
        textShadow: '0 1px 1px rgba(0,0,0,0.1)' // Subtle text shadow
      };
      
    case SlideContentType.Caption:
      // Smaller caption text
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '1.6rem',
        fontWeight: WEIGHTS.light,
        fontStyle: 'italic',
        lineHeight: 1.3,
      };
      
    case SlideContentType.Overview:
      // Overview slides with different styling
      return {
        ...baseStyle,
        fontFamily: FONTS.body,
        fontSize: '1.8rem',
        fontWeight: WEIGHTS.medium,
      };
      
    default:
      return baseStyle;
  }
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
    fontFamily: styles.fontFamily,
    textTransform: styles.textTransform,
    textAlign: styles.textAlign,
    
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
    margin: styles.margin,
    textShadow: styles.textShadow,
  };
}

/**
 * Helper function to determine content type based on content text
 */
export function determineContentType(content: string): ContentType {
  if (!content || content.trim() === '') {
    return ContentType.Regular;
  }
  
  const trimmedContent = content.trim();
  
  // Title and subtitle detection
  if (trimmedContent.length < 60) {
    if (trimmedContent.startsWith('# ')) {
      return ContentType.Title;
    }
    if (trimmedContent.startsWith('## ')) {
      return ContentType.Subtitle;
    }
  }
  
  // Heading detection
  if (trimmedContent.startsWith('### ')) {
    return ContentType.Heading;
  }
  
  // Subheading detection
  if (trimmedContent.startsWith('#### ')) {
    return ContentType.Subheading;
  }
  
  // Quote detection
  if (trimmedContent.startsWith('> ')) {
    return ContentType.Quote;
  }
  
  // Code block detection
  if (trimmedContent.startsWith('```') || trimmedContent.startsWith('    ')) {
    return ContentType.Code;
  }
  
  // List detection
  const hasListMarkers = /^[ \t]*[-*•][ \t]/.test(trimmedContent) || 
                         /^[ \t]*\d+\.[ \t]/.test(trimmedContent);
  if (hasListMarkers || trimmedContent.includes('\n- ') || trimmedContent.includes('\n* ')) {
    return ContentType.List;
  }
  
  // Default to regular
  return ContentType.Regular;
}

/**
 * Format content based on content type detection
 */
export function formatContent(content: string): string {
  if (!content) return '';
  
  // Prepare content by trimming and handling special prefixes
  let formattedContent = content.trim();
  
  // Remove heading markers
  if (formattedContent.startsWith('# ')) {
    formattedContent = formattedContent.substring(2);
  } else if (formattedContent.startsWith('## ')) {
    formattedContent = formattedContent.substring(3);
  } else if (formattedContent.startsWith('### ')) {
    formattedContent = formattedContent.substring(4);
  } else if (formattedContent.startsWith('#### ')) {
    formattedContent = formattedContent.substring(5);
  }
  
  // Remove quote markers
  if (formattedContent.startsWith('> ')) {
    formattedContent = formattedContent.substring(2);
  }
  
  // Return the processed content
  return formattedContent;
}

/**
 * Convert YouTube URL to embed format with optional timestamp
 */
export function getYoutubeEmbedUrl(url: string, time: string): string {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return '';
  
  let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  
  // Add time parameter if provided
  if (time) {
    // Convert HH:MM:SS or MM:SS to seconds
    const timeParts = time.split(':').map(Number);
    let seconds = 0;
    
    if (timeParts.length === 3) {
      // HH:MM:SS format
      seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
    } else if (timeParts.length === 2) {
      // MM:SS format
      seconds = timeParts[0] * 60 + timeParts[1];
    } else if (timeParts.length === 1) {
      // SS format
      seconds = timeParts[0];
    }
    
    if (seconds > 0) {
      embedUrl += `&start=${seconds}`;
    }
  }
  
  return embedUrl;
}

/**
 * Extract YouTube video ID from different URL formats
 */
function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // Handle youtu.be format
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^?&]+)/);
    return match ? match[1] : null;
  }
  
  // Handle youtube.com format
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

/**
 * Calculate hierarchical level of a note based on its parent chain
 */
export function calculateLevel(parentId: number | null, notesMap: Map<number, any>): number {
  if (parentId === null) return 1;
  
  const parent = notesMap.get(parentId);
  if (!parent) return 1;
  
  return 1 + calculateLevel(parent.parentId, notesMap);
}