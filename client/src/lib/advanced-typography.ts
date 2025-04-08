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
 * Implements the comprehensive typography system with responsive scaling according to detailed specs
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
    transition: 'all 500ms ease-in-out' // Smooth transitions for all text changes
  };

  // Determine if content is "long" based on character count (>50 chars)
  const isLongContent = textLength > 50;

  // Start/End Slides - Use Bebas Neue at massive scales with uppercase treatment
  if (contentType === SlideContentType.StartEndSlide) {
    return {
      ...defaults,
      fontFamily: FONTS.display, // Bebas Neue
      // Size scaling: 5xl (mobile) → 7xl (tablet) → 9xl (desktop)
      fontSize: 'clamp(3rem, 8vw, 8rem)', 
      fontWeight: WEIGHTS.regular, // Bebas Neue is already bold by design
      letterSpacing: 'tracking-tight', // -0.025em
      lineHeight: '1', // Default line height
      textTransform: 'uppercase',
      textAlign: 'center',
      maxWidth: 'max-w-5xl',
      margin: 'mx-auto',
    };
  }

  // Root Level Bullets for Start Slide
  if (contentType === SlideContentType.Overview && level <= 1) {
    return {
      ...defaults,
      fontFamily: FONTS.body, // IBM Plex Sans
      fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', // text-xl -> text-2xl
      fontWeight: WEIGHTS.regular,
      lineHeight: '1.625', // leading-relaxed
      textAlign: 'left'
    };
  }

  // Apply styles based on hierarchical level
  switch (level) {
    // Root / Level 1 Slides
    case 0:
    case 1:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Long content: 5xl (mobile) → 8xl (desktop)
          // Short content: 6xl (mobile) → 9xl (desktop)
          fontSize: isLongContent 
            ? 'clamp(3rem, 7vw, 6rem)' 
            : 'clamp(3.75rem, 9vw, 8rem)',
          fontWeight: WEIGHTS.bold,
          letterSpacing: '-0.025em', // tracking-tight
          lineHeight: '1.1',
          textAlign: 'center',
          margin: 'mb-6',
        };
      }
      break;

    // Level 2 Slides
    case 2:
      if (contentType === SlideContentType.Headline) {
        return {
          ...defaults,
          fontFamily: FONTS.display, // Bebas Neue
          // Long content: 4xl (mobile) → 7xl (desktop)
          // Short content: 5xl (mobile) → 8xl (desktop)
          fontSize: isLongContent 
            ? 'clamp(2.25rem, 6vw, 4.5rem)' 
            : 'clamp(3rem, 7vw, 6rem)',
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
          // Long content: 3xl (mobile) → 6xl (desktop)
          // Short content: 4xl (mobile) → 7xl (desktop)
          fontSize: isLongContent 
            ? 'clamp(1.875rem, 5vw, 3.75rem)' 
            : 'clamp(2.25rem, 6vw, 4.5rem)',
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
          // Fixed scale: 2xl (mobile) → 5xl (desktop)
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
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
          // Fixed scale: xl (mobile) → 4xl (desktop)
          fontSize: 'clamp(1.25rem, 3vw, 2.25rem)',
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
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        fontWeight: WEIGHTS.semibold,
        lineHeight: '1.3',
      };

    case SlideContentType.Body:
      // Scale down text if has media to share the slide
      const sizeAdjustment = hasMedia ? 0.85 : 1;
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: `calc(clamp(1.25rem, 3vw, 2.25rem) * ${sizeAdjustment})`,
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.5',
      };

    case SlideContentType.List:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: 'clamp(1.25rem, 3vw, 2rem)',
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.6',
        textAlign: 'left',
      };

    case SlideContentType.Overview:
      // Overview slide bullets
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', // text-2xl -> text-4xl
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.4',
        textAlign: 'left',
      };

    case SlideContentType.Code:
      return {
        ...defaults,
        fontFamily: 'monospace',
        fontSize: 'clamp(1rem, 2.5vw, 1.75rem)',
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
        fontSize: 'clamp(1.25rem, 3vw, 2.25rem)',
        fontWeight: WEIGHTS.light,
        fontStyle: 'italic',
        lineHeight: '1.6',
        letterSpacing: '0.01em',
      };

    case SlideContentType.Caption:
      return {
        ...defaults,
        fontFamily: FONTS.body, // IBM Plex Sans
        fontSize: 'clamp(0.875rem, 2vw, 1.5rem)',
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