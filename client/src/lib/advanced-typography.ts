// Advanced Typography system for slides based on detailed specifications
// Implements responsive text scaling based on content length and hierarchical level

// Font definitions - matching exact specs from requirements
export const FONTS = {
  display: '"Bebas Neue", sans-serif',  // Display font for headlines and start/end slides
  body: '"IBM Plex Sans", sans-serif',  // Primary font for all other text
};

// Font weight definitions - matches IBM Plex Sans weights
export const WEIGHTS = {
  light: 300,    // Light weight
  regular: 400,  // Regular weight
  medium: 500,   // Medium weight
  semibold: 600, // Semibold weight
  bold: 700,     // Bold weight
};

// Content types for appropriate styling
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

// Interface for typography styles
export interface TypographyStyles {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  hyphens?: 'auto' | 'none' | 'manual';
  wordBreak?: 'normal' | 'break-all' | 'break-word';
  overflowWrap?: 'normal' | 'break-word';
  whiteSpace?: 'normal' | 'pre' | 'pre-line' | 'pre-wrap' | 'nowrap';
  textShadow?: string;
  transition?: string;
  maxWidth?: string;
  margin?: string;
}

/**
 * Get typography styles based on content type, hierarchical level, and content length
 * Uses fixed sizes by default and only adapts when necessary
 */
export function getAdvancedTypographyStyles(
  contentType: SlideContentType,
  level: number,
  textLength: number = 0,
  hasMedia: boolean = false
): TypographyStyles {
  // Universal defaults based on our specs
  const defaults: TypographyStyles = {
    fontFamily: FONTS.body,
    fontSize: '1.5rem',
    fontWeight: WEIGHTS.regular,
    letterSpacing: 'normal',
    lineHeight: '1.5',
    textTransform: 'none',
    textAlign: 'left',
    hyphens: 'auto',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line', // Preserves line breaks from source content
    textShadow: '-1.5px 1.5px 1.5px rgba(0,0,0,0.4)', // Universal depth effect
    transition: 'all 250ms ease-in-out' // Smooth transitions but shorter for better UX
  };

  // Check if content is extremely long - only these would need adaptive sizing
  const needsAdaptiveSize = textLength > 200;
  // Determine if content is "long" based on character count (>50 chars)
  const isLongContent = textLength > 50;
  // Check if content is very short
  const isVeryShortContent = textLength <= 15;

  // Start/End Slides - Use Bebas Neue at massive scales with uppercase treatment
  if (contentType === SlideContentType.StartEndSlide) {
    return {
      ...defaults,
      fontFamily: FONTS.display, // Bebas Neue
      // Use fixed size by default, but use adaptive sizing for very long content
      fontSize: needsAdaptiveSize ? 'clamp(3rem, 8vw, 8rem)' : '8rem',
      fontWeight: WEIGHTS.regular, // Bebas Neue is already bold by design
      letterSpacing: '-0.025em', // tracking-tight
      lineHeight: '1', // Default line height
      textTransform: 'uppercase',
      textAlign: 'center',
      maxWidth: '80%',
      margin: '0 auto',
    };
  }

  // Root Level Bullets for Start Slide
  if (contentType === SlideContentType.Overview && level <= 1) {
    return {
      ...defaults,
      fontFamily: FONTS.body, // IBM Plex Sans
      fontSize: '1.5rem', // fixed size
      fontWeight: WEIGHTS.regular,
      lineHeight: '1.625', // leading-relaxed
      textAlign: 'left'
    };
  }

  // Apply styles based on hierarchical level for headlines
  switch (level) {
    // Root / Level 1 Slides
    case 0:
    case 1:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Use fixed size by default, adapt only if needed
          fontSize: needsAdaptiveSize 
            ? (isLongContent ? 'clamp(3rem, 7vw, 6rem)' : 'clamp(3.75rem, 9vw, 8rem)')
            : (isLongContent ? '6rem' : '8rem'),
          fontWeight: WEIGHTS.bold,
          letterSpacing: '-0.025em', // tracking-tight
          lineHeight: '1.1',
          textAlign: 'center',
          margin: '0 0 1.5rem 0',
        };
      }
      break;

    // Level 2 Slides
    case 2:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Fixed sizes, adapt only if needed
          fontSize: needsAdaptiveSize
            ? (isLongContent ? 'clamp(2.25rem, 6vw, 4.5rem)' : 'clamp(3rem, 7vw, 6rem)')
            : (isLongContent ? '4.5rem' : '6rem'),
          fontWeight: WEIGHTS.semibold,
          letterSpacing: '0', // tracking-normal
          lineHeight: '1.15',
          textAlign: 'center'
        };
      }
      break;

    // Level 3 Slides
    case 3:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Fixed sizes, adapt only if needed
          fontSize: needsAdaptiveSize
            ? (isLongContent ? 'clamp(1.875rem, 5vw, 3.75rem)' : 'clamp(2.25rem, 6vw, 4.5rem)')
            : (isLongContent ? '3.75rem' : '4.5rem'),
          fontWeight: WEIGHTS.medium,
          letterSpacing: '0.025em', // tracking-wide
          lineHeight: '1.2',
          textAlign: 'left'
        };
      }
      break;

    // Level 4 Slides
    case 4:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Fixed size, adapt only if needed
          fontSize: needsAdaptiveSize ? 'clamp(1.5rem, 4vw, 3rem)' : '3rem',
          fontWeight: WEIGHTS.regular,
          letterSpacing: '0.025em', // tracking-wide
          lineHeight: '1.3',
          textAlign: 'left'
        };
      }
      break;

    // Deeper Levels (5+)
    default:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Fixed size, adapt only if needed
          fontSize: needsAdaptiveSize ? 'clamp(1.25rem, 3vw, 2.25rem)' : '2.25rem',
          fontWeight: WEIGHTS.regular,
          letterSpacing: 'normal',
          lineHeight: '1.4',
          textAlign: 'left'
        };
      }
      break;
  }

  // For non-headline content types
  switch (contentType) {
    case SlideContentType.Subheading:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: needsAdaptiveSize ? 'clamp(1.5rem, 4vw, 2.5rem)' : '2.5rem',
        fontWeight: WEIGHTS.semibold,
        lineHeight: '1.3',
      };

    case SlideContentType.Body:
      // Scale down text if has media to share the slide
      const sizeAdjustment = hasMedia ? 0.85 : 1;
      // For body text, we use a more aggressive threshold for adaptive sizing
      const bodyNeedsAdaptive = textLength > 150;
      
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: bodyNeedsAdaptive 
          ? `calc(clamp(1.25rem, 3vw, 2.25rem) * ${sizeAdjustment})`
          : `${2.25 * sizeAdjustment}rem`,
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.5',
      };

    case SlideContentType.List:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: needsAdaptiveSize ? 'clamp(1.25rem, 3vw, 2rem)' : '2rem',
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.6',
        textAlign: 'left',
      };

    case SlideContentType.Overview:
      // Overview slide bullets
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: needsAdaptiveSize ? 'clamp(1.5rem, 3.5vw, 2.25rem)' : '2.25rem',
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.4',
        textAlign: 'left',
      };

    case SlideContentType.Code:
      // Code blocks often need special handling
      const codeNeedsAdaptive = textLength > 100; // Code has different threshold
      
      return {
        ...defaults,
        fontFamily: 'monospace',
        fontSize: codeNeedsAdaptive ? 'clamp(1rem, 2.5vw, 1.75rem)' : '1.75rem',
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.6',
        textAlign: 'left',
        letterSpacing: '-0.02em',
        whiteSpace: 'pre', // Preserves all whitespace for code
      };

    case SlideContentType.Quote:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: needsAdaptiveSize ? 'clamp(1.25rem, 3vw, 2.25rem)' : '2.25rem',
        fontWeight: WEIGHTS.light,
        fontStyle: 'italic',
        lineHeight: '1.6',
        letterSpacing: '0.01em',
      };

    case SlideContentType.Caption:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: '1.5rem', // Captions should stay consistently sized
        fontWeight: WEIGHTS.light,
        lineHeight: '1.4',
        letterSpacing: '0.03em',
      };

    default:
      return defaults;
  }
}

// Calculate size for Start/End slides based on content length
function calculateStartEndSize(contentLength: number): string {
  if (contentLength > 100) {
    return 'clamp(2.5rem, 6vw, 4.5rem)';  // Very long content
  } else if (contentLength > 50) {
    return 'clamp(3rem, 7vw, 5rem)';      // Long content
  } else if (contentLength > 20) {
    return 'clamp(3.5rem, 8vw, 6rem)';    // Medium content
  } else {
    return 'clamp(4rem, 10vw, 8rem)';     // Short content
  }
}

/**
 * Generate CSS styles object from typography settings
 */
export function generateAdvancedStyles(settings: TypographyStyles): React.CSSProperties {
  return {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    fontStyle: settings.fontStyle,
    letterSpacing: settings.letterSpacing,
    lineHeight: settings.lineHeight,
    textTransform: settings.textTransform,
    textAlign: settings.textAlign,
    hyphens: settings.hyphens,
    wordBreak: settings.wordBreak,
    overflowWrap: settings.overflowWrap,
    whiteSpace: settings.whiteSpace,
    textShadow: settings.textShadow,
    transition: settings.transition,
    maxWidth: settings.maxWidth,
    margin: settings.margin,
  };
}

/**
 * Determine content type based on content and level
 */
export function determineSlideContentType(
  content: string,
  isStartOrEndSlide: boolean = false
): SlideContentType {
  if (isStartOrEndSlide) {
    return SlideContentType.StartEndSlide;
  }

  // Check for code blocks with triple backticks
  if (content.includes("```")) {
    return SlideContentType.Code;
  }
  
  // Check for list items
  if (content.match(/^(\s*[-*+]|\s*\d+\.)\s/m)) {
    return SlideContentType.List;
  }
  
  // Check for block quotes
  if (content.match(/^>\s/m)) {
    return SlideContentType.Quote;
  }
  
  // Check for what appears to be a headline
  if (content.length < 60) {
    if (content === content.toUpperCase() || content.match(/^#\s/)) {
      return SlideContentType.Headline;
    } else if (content.length < 100) {
      return SlideContentType.Subheading;
    }
  }
  
  // Default to regular body text
  return SlideContentType.Body;
}