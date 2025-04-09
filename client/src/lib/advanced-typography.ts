// Advanced Typography system for slides based on detailed specifications
// Implements responsive text scaling based on content length and hierarchical level

// Font definitions - matching exact specs from requirements
export const FONTS = {
  display: '"Roboto", sans-serif',      // Display font for headlines and start/end slides
  body: '"Times New Roman", serif',     // Primary font for all other text
};

// Font weight definitions - matches Roboto weights
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
  // Additional style properties for enhanced visual hierarchy
  padding?: string;
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
  border?: string;
  borderLeft?: string;
  borderRight?: string;
  borderTop?: string;
  borderBottom?: string;
  borderRadius?: string;
  background?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  opacity?: number;
  boxShadow?: string;
}

/**
 * Get typography styles based on content type, hierarchical level, and content length
 * Uses consistent sizing with visual design elements to differentiate hierarchy
 */
export function getAdvancedTypographyStyles(
  contentType: SlideContentType,
  level: number,
  textLength: number = 0,
  hasMedia: boolean = false
): TypographyStyles {
  // Set high contrast universal defaults for professional appearance
  const defaults: TypographyStyles = {
    fontFamily: FONTS.body,
    fontSize: '2.2rem', // Larger consistent base font size
    fontWeight: WEIGHTS.regular,
    letterSpacing: 'normal',
    lineHeight: '1.5',
    textTransform: 'none',
    textAlign: 'left',
    hyphens: 'auto',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line', // Preserves line breaks from source content
    textShadow: '-1px 1px 1px rgba(0,0,0,0.25)', // Subtle depth effect
    transition: 'all 250ms ease-in-out', // Smooth transitions
    margin: '0',
    maxWidth: '100%'
  };

  // Only extremely long content needs adaptive sizing
  const needsAdaptiveSize = textLength > 300;
  const isLongContent = textLength > 100;

  // Start/End Slides - Special case that should stand out
  if (contentType === SlideContentType.StartEndSlide) {
    return {
      ...defaults,
      fontFamily: FONTS.display, // Roboto
      fontSize: needsAdaptiveSize ? 'clamp(3.5rem, 8vw, 7rem)' : '7rem',
      fontWeight: WEIGHTS.bold, // Using bold weight for emphasis
      letterSpacing: '-0.025em',
      lineHeight: '1.1',
      textTransform: 'uppercase',
      textAlign: 'center',
      textShadow: '-2px 2px 4px rgba(0,0,0,0.3)',
      maxWidth: '90%',
      margin: '0 auto',
    };
  }

  // Root Level Bullets for Start Slide
  if (contentType === SlideContentType.Overview && level <= 1) {
    return {
      ...defaults,
      fontFamily: FONTS.body, // Times New Roman
      fontSize: '2rem',
      fontWeight: WEIGHTS.regular,
      lineHeight: '1.625',
      textAlign: 'left'
    };
  }

  // Headlines with consistent sizing but different visual treatments by level
  if (contentType === SlideContentType.Headline) {
    // Base style for all headlines
    const headlineBase = {
      ...defaults,
      fontSize: needsAdaptiveSize ? 'clamp(2.5rem, 6vw, 3.5rem)' : '3.5rem',
      fontWeight: WEIGHTS.bold,
      lineHeight: '1.1',
      letterSpacing: '-0.01em',
      maxWidth: '90%',
      transition: 'all 300ms ease-in-out'
    };

    // Apply level-specific visual treatments while keeping size consistent
    switch (level) {
      // Level 0-1: Most prominent, centered, display font with gradient background
      case 0:
      case 1:
        return {
          ...headlineBase,
          fontFamily: FONTS.display,
          textAlign: 'center',
          textTransform: 'uppercase',
          textShadow: '-2px 2px 3px rgba(0,0,0,0.4)',
          margin: '0 auto 1.5rem auto',
          letterSpacing: '0.01em',
          padding: '0.5rem 1.5rem',
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        };

      // Level 2: Still centered but with body font and subtle gradient
      case 2:
        return {
          ...headlineBase,
          textAlign: 'center',
          fontFamily: FONTS.body,
          textShadow: '-1.5px 1.5px 2px rgba(0,0,0,0.35)',
          margin: '0 auto 1rem auto',
          padding: '0.3rem 1rem',
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0) 100%)',
          borderRadius: '4px',
        };

      // Level 3: Left-aligned with decorative left border and background
      case 3:
        return {
          ...headlineBase,
          textAlign: 'left',
          fontFamily: FONTS.body,
          fontWeight: WEIGHTS.semibold,
          // Add decorative left border to distinguish level
          margin: '0 0 1rem 0',
          padding: '0.4rem 0.8rem 0.4rem 1rem',
          borderLeft: '4px solid rgba(255,255,255,0.6)',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: '0 4px 4px 0',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.15)',
        };

      // Level 4: Left-aligned with underline and subtle background
      case 4:
        return {
          ...headlineBase,
          textAlign: 'left',
          fontSize: needsAdaptiveSize ? 'clamp(2.2rem, 5vw, 3.2rem)' : '3.2rem',
          fontWeight: WEIGHTS.medium,
          fontStyle: 'italic',
          // Add decorative underline to distinguish level
          borderBottom: '2px solid rgba(255,255,255,0.4)',
          paddingBottom: '0.5rem',
          padding: '0.3rem 0.8rem 0.5rem 0.8rem',
          margin: '0 0 1rem 0',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '4px 4px 0 0',
        };

      // Level 5+: Left-aligned with distinct visual treatment
      default:
        return {
          ...headlineBase,
          textAlign: 'left',
          fontSize: needsAdaptiveSize ? 'clamp(2rem, 4vw, 3rem)' : '3rem',
          fontWeight: WEIGHTS.regular,
          letterSpacing: '0.02em',
          fontStyle: 'italic',
          // Add decorative box to distinguish deeper levels
          padding: '0.5rem 1rem',
          background: 'rgba(255,255,255,0.08)',
          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, transparent 75%, transparent)',
          backgroundSize: '4px 4px',
          borderRadius: '4px',
          boxShadow: 'inset 0 0 8px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.08)',
          margin: '0 0 1rem 0'
        };
    }
  }

  // For non-headline content types, keep size consistent but vary other properties
  switch (contentType) {
    case SlideContentType.Subheading:
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: '2.4rem', // Consistent size
        fontWeight: WEIGHTS.semibold,
        lineHeight: '1.3',
        // Enhanced styling with subtle gradient and indent
        paddingLeft: level > 2 ? `${level * 0.5}rem` : '0.5rem',
        padding: '0.3rem 0.7rem',
        margin: '0 0 1rem 0',
        borderBottom: level > 2 ? '1px dotted rgba(255,255,255,0.3)' : 'none',
        // Add subtle background for visual distinction
        backgroundImage: level > 1 ? 
            'linear-gradient(to right, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)' : 
            'none',
        borderRadius: '2px',
      };

    case SlideContentType.Body:
      // Body text with consistent size but enhanced styling by level
      const sizeAdjustment = hasMedia ? 0.9 : 1; // Slight reduction for media slides
      
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: `${2.2 * sizeAdjustment}rem`, // Fixed size with slight media adjustment
        fontWeight: level % 2 === 0 ? WEIGHTS.regular : WEIGHTS.light, // Alternate weights by level
        lineHeight: '1.5',
        fontStyle: level > 3 ? 'italic' : 'normal', // Italic for deeper levels
        // Add visual cues based on level
        paddingLeft: level > 1 ? `${level * 0.5}rem` : '0',
        padding: level > 2 ? '0.3rem 0.6rem' : '0',
        margin: '0 0 1rem 0',
        // Enhanced border and background effects
        borderLeft: level > 2 ? `${Math.min(level-2, 3)}px solid rgba(255,255,255,${0.1 * level})` : 'none',
        // Apply subtle gradient based on level
        backgroundImage: level > 3 ? 
            `linear-gradient(to right, rgba(255,255,255,${0.02 * level}) 0%, transparent 100%)` : 
            'none',
        backgroundColor: level > 4 ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderRadius: level > 3 ? '4px' : '0',
        boxShadow: level > 4 ? 'inset 0 0 5px rgba(0,0,0,0.1)' : 'none'
      };

    case SlideContentType.List:
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: '2.2rem', // Fixed consistent size
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.6',
        textAlign: 'left',
        // Enhanced list styling with background effects
        paddingLeft: level > 1 ? `${level * 0.5}rem` : '0',
        padding: level > 1 ? '0.3rem 0.6rem' : '0',
        margin: '0 0 1rem 0',
        // Add visual distinction for deeper level lists
        backgroundColor: level > 2 ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderRadius: level > 2 ? '4px' : '0',
        // Add subtle left border for list items at deeper levels
        borderLeft: level > 2 ? `2px solid rgba(255,255,255,${0.05 * level})` : 'none',
      };

    case SlideContentType.Overview:
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: '2.2rem', // Fixed consistent size
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.4',
        textAlign: 'left',
        // Enhanced styling for overview items
        textShadow: '-1px 1px 2px rgba(0,0,0,0.3)',
        margin: '0 0 1rem 0',
        padding: '0.3rem 0.8rem',
        // Add subtle background and border effects for overview items
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '4px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.05)',
      };

    case SlideContentType.Code:
      return {
        ...defaults,
        fontFamily: 'monospace',
        fontSize: '1.8rem', // Fixed size that's slightly smaller for code
        fontWeight: WEIGHTS.regular,
        lineHeight: '1.6',
        textAlign: 'left',
        letterSpacing: '-0.02em',
        whiteSpace: 'pre', // Preserves all whitespace for code
        // Enhanced code block styling with gradient background
        background: 'rgba(0,0,0,0.2)',
        backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 100%)',
        padding: '1.2rem',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.1)',
        margin: '0.5rem 0 1.5rem 0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.1)',
      };

    case SlideContentType.Quote:
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: '2.2rem', // Fixed consistent size
        fontWeight: WEIGHTS.light,
        fontStyle: 'italic',
        lineHeight: '1.6',
        letterSpacing: '0.01em',
        // Enhanced quote styling with subtle background
        borderLeft: '4px solid rgba(255,255,255,0.4)',
        paddingLeft: '1.5rem',
        padding: '0.5rem 1rem 0.5rem 1.5rem',
        margin: '1.2rem 0',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '0 4px 4px 0',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
      };

    case SlideContentType.Caption:
      return {
        ...defaults,
        fontFamily: FONTS.body,
        fontSize: '1.6rem', // Slightly smaller for captions
        fontWeight: WEIGHTS.light,
        fontStyle: 'italic',
        lineHeight: '1.4',
        letterSpacing: '0.03em',
        // Enhanced caption styling
        opacity: 0.8,
        margin: '0.8rem 0',
        padding: '0.2rem 0.5rem',
        textAlign: 'center',
        maxWidth: '80%',
        // Add subtle visual treatment
        borderTop: '1px solid rgba(255,255,255,0.1)',
        backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)',
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
    // Additional style properties
    padding: settings.padding,
    paddingLeft: settings.paddingLeft,
    paddingRight: settings.paddingRight,
    paddingTop: settings.paddingTop,
    paddingBottom: settings.paddingBottom,
    border: settings.border,
    borderLeft: settings.borderLeft,
    borderRight: settings.borderRight,
    borderTop: settings.borderTop,
    borderBottom: settings.borderBottom,
    borderRadius: settings.borderRadius,
    background: settings.background,
    backgroundColor: settings.backgroundColor,
    backgroundImage: settings.backgroundImage,
    backgroundSize: settings.backgroundSize,
    backgroundPosition: settings.backgroundPosition,
    backgroundRepeat: settings.backgroundRepeat,
    opacity: settings.opacity,
    boxShadow: settings.boxShadow,
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