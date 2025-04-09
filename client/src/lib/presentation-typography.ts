// Advanced Typography System for Presentation Mode
// Creates dynamic visual hierarchy with responsive sizing

// Font family definitions
export const FONTS = {
  primary: "'IBM Plex Sans', sans-serif",
  display: "'Bebas Neue', sans-serif",
  monospace: "'IBM Plex Mono', monospace"
};

// Font weight definitions
export const WEIGHTS = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

// Content type determines typography styling
export enum ContentType {
  Title = 'title',           // Main title slides (start/end/special)
  Heading = 'heading',       // High-level section headers
  Subheading = 'subheading', // Secondary headers
  Body = 'body',             // Regular content
  List = 'list',             // Bullet points
  Code = 'code',             // Code blocks
  Quote = 'quote',           // Quotations
  Caption = 'caption'        // Smaller supplementary text
}

// Font size scaling rules based on depth and content length
export interface FontSettings {
  family: string;
  weight: number;
  size: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none' | string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  maxWidth?: string;
  
  // Additional visual hierarchy properties
  fontStyle?: 'normal' | 'italic' | 'oblique';
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
 * Get font settings based on content type and depth level
 * Uses consistent font sizing with visual design elements to differentiate hierarchy
 */
export function getTypographyStyles(
  contentType: ContentType,
  level: number = 0,
  contentLength: number = 0,
  hasMedia: boolean = false
): FontSettings {
  // Only categorize content length for extremes
  const isVeryShort = contentLength <= 15;   // Single word or short phrase
  const isLong = contentLength > 100;        // Long form text
  const needsAdaptiveSize = contentLength > 300; // Only extreme length needs adaptive sizing
  
  // Base settings with consistent sizing across types
  const defaults: FontSettings = {
    family: FONTS.primary,
    weight: WEIGHTS.regular,
    size: '2.2rem', // Larger consistent base size
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: 'none',
    textAlign: 'left',
    maxWidth: '90%'
  };
  
  // Media presence only makes a slight adjustment
  const mediaFactor = hasMedia ? 0.9 : 1;
  
  // Title slides (start, end, special) - these are special cases that should stand out
  if (contentType === ContentType.Title) {
    return {
      family: FONTS.display,
      weight: WEIGHTS.bold,
      // Allow slightly larger size for titles only
      size: needsAdaptiveSize ? 'clamp(3.5rem, 8vw, 6.5rem)' : '6.5rem',
      lineHeight: '1.1',
      letterSpacing: '0.02em',
      textTransform: 'capitalize' as 'capitalize', // Type assertion
      textAlign: 'center' as 'center', // Type assertion
      maxWidth: '90%'
    };
  }
  
  // Headings with consistent sizing but different visual styles by level
  if (contentType === ContentType.Heading) {
    // Base heading styles
    const headingBase: FontSettings = {
      family: level <= 1 ? FONTS.display : FONTS.primary,
      weight: WEIGHTS.bold,
      size: '3.2rem',
      lineHeight: '1.2',
      letterSpacing: level <= 1 ? '0.02em' : '0.01em',
      textTransform: level <= 1 ? 'capitalize' as 'capitalize' : 'none',
      textAlign: level <= 2 ? 'center' as 'center' : 'left' as 'left',
      maxWidth: '90%'
    };
    
    // Apply level-specific modifications while keeping font size consistent
    switch (level) {
      // Level 0-1: Most prominent, centered, display font
      case 0:
      case 1:
        return {
          ...headingBase,
          // If needed, only extremely long headings get adaptive sizing
          size: needsAdaptiveSize ? 'clamp(2.5rem, 6vw, 3.2rem)' : '3.2rem'
        };
        
      // Level 2: Regular centered heading
      case 2:
        return {
          ...headingBase,
          weight: WEIGHTS.semibold
        };
        
      // Level 3: Left-aligned with decorative left border
      case 3:
        return {
          ...headingBase,
          textAlign: 'left',
          family: FONTS.primary,
          // Add decorative left border instead of size reduction
          borderLeft: '4px solid rgba(255,255,255,0.5)',
          paddingLeft: '1rem'
        };
        
      // Level 4: Left-aligned with underline
      case 4:
        return {
          ...headingBase,
          textAlign: 'left',
          weight: WEIGHTS.medium,
          // Add decorative underline to distinguish level
          borderBottom: '2px solid rgba(255,255,255,0.3)',
          paddingBottom: '0.4rem'
        };
        
      // Level 5+: Left-aligned with background for distinction
      default:
        return {
          ...headingBase,
          textAlign: 'left',
          weight: WEIGHTS.regular,
          fontStyle: 'italic',
          // Add background to distinguish deepest levels
          background: 'rgba(255,255,255,0.08)',
          padding: '0.5rem 1rem',
          borderRadius: '4px'
        };
    }
  }
  
  // Subheadings with consistent sizing
  if (contentType === ContentType.Subheading) {
    return {
      family: FONTS.primary,
      weight: WEIGHTS.semibold,
      size: '2.4rem', // Consistent size
      lineHeight: '1.3',
      letterSpacing: '0.01em',
      textTransform: 'none',
      textAlign: level <= 2 ? 'center' : 'left',
      maxWidth: '85%',
      // Add subtle indentation based on level
      paddingLeft: level > 2 ? `${level * 0.4}rem` : '0',
      // Add decorative elements based on level
      borderBottom: level > 2 ? '1px dotted rgba(255,255,255,0.2)' : 'none'
    };
  }
  
  // Regular content with consistent sizing
  if (contentType === ContentType.Body) {
    return {
      family: FONTS.primary,
      // Alternate font weights by level for visual distinction
      weight: level % 2 === 0 ? WEIGHTS.regular : WEIGHTS.light,
      size: `${2.2 * mediaFactor}rem`, // Consistent size with slight media adjustment
      lineHeight: '1.5',
      letterSpacing: 'normal',
      textTransform: 'none',
      textAlign: isLong ? 'left' : 'center',
      maxWidth: isLong ? '80%' : '85%',
      // Add visual distinction for deeper levels
      fontStyle: level > 3 ? 'italic' : 'normal',
      // Add indentation and decorative elements for deeper levels
      paddingLeft: level > 2 ? `${level * 0.5}rem` : '0',
      borderLeft: level > 3 ? `${Math.min(level-3, 2)}px solid rgba(255,255,255,0.15)` : 'none',
    };
  }
  
  // List items with consistent sizing
  if (contentType === ContentType.List) {
    return {
      family: FONTS.primary,
      weight: WEIGHTS.regular,
      size: '2.2rem', // Consistent size
      lineHeight: '1.4',
      letterSpacing: 'normal',
      textTransform: 'none',
      textAlign: 'left',
      maxWidth: '85%',
      // Add indentation based on level for visual distinction
      paddingLeft: level > 1 ? `${level * 0.4}rem` : '0'
    };
  }
  
  // Code blocks with special styling
  if (contentType === ContentType.Code) {
    return {
      family: FONTS.monospace,
      weight: WEIGHTS.regular,
      // Slightly smaller but still consistent for code readability
      size: '1.8rem',
      lineHeight: '1.5',
      letterSpacing: '-0.01em',
      textTransform: 'none',
      textAlign: 'left',
      maxWidth: '100%',
      // Add distinctive styling for code blocks
      background: 'rgba(0,0,0,0.2)',
      padding: '0.8rem',
      borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.1)'
    };
  }
  
  // Quotes with consistent styling and distinction
  if (contentType === ContentType.Quote) {
    return {
      family: FONTS.primary,
      weight: WEIGHTS.medium,
      size: '2.2rem', // Consistent size
      lineHeight: '1.4',
      letterSpacing: '0.01em',
      textTransform: 'none',
      textAlign: 'left',
      maxWidth: '85%',
      // Distinctive styles for quotes
      fontStyle: 'italic',
      borderLeft: '4px solid rgba(255,255,255,0.4)',
      paddingLeft: '1.5rem'
    };
  }
  
  // Captions with distinctive styling
  if (contentType === ContentType.Caption) {
    return {
      family: FONTS.primary,
      weight: WEIGHTS.light,
      // Slightly smaller for captions but still readable
      size: '1.6rem',
      lineHeight: '1.3',
      letterSpacing: '0.01em',
      textTransform: 'none',
      textAlign: 'center',
      maxWidth: '75%',
      // Distinct caption styling
      fontStyle: 'italic',
      opacity: 0.8
    };
  }
  
  // Default to regular body text if no match
  return defaults;
}

/**
 * Size calculators for each content type
 * These calculate ideal font sizes based on content length and hierarchy level
 */

// Title sizing (main titles, start/end slides)
function calculateTitleSize(contentLength: number, level: number): string {
  // Base sizes that will be adjusted
  let baseSize;
  
  // Check if content needs adaptive sizing (very long content)
  const needsAdaptive = contentLength > 100;
  
  if (contentLength <= 10) {
    baseSize = 7.5; // Very short titles get largest font
  } else if (contentLength <= 25) {
    baseSize = 6.5; // Short titles
  } else if (contentLength <= 50) {
    baseSize = 5.5; // Medium titles
  } else if (contentLength <= 100) {
    baseSize = 4.5; // Long titles
  } else {
    baseSize = 3.5; // Very long titles
  }
  
  // Scale down by 10% per level
  const scaleFactor = Math.max(0.6, 1 - (level * 0.1));
  const finalSize = baseSize * scaleFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(2.5, finalSize * 0.7);
    return `clamp(${minSize}rem, ${finalSize * 0.8}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

// Heading sizing (section headers, key points)
function calculateHeadingSize(contentLength: number, level: number): string {
  let baseSize;
  
  // Check if content needs adaptive sizing
  const needsAdaptive = contentLength > 80;
  
  if (contentLength <= 15) {
    baseSize = 4.5; // Very short headings
  } else if (contentLength <= 30) {
    baseSize = 3.8; // Short headings
  } else if (contentLength <= 60) {
    baseSize = 3.2; // Medium headings
  } else {
    baseSize = 2.8; // Long headings
  }
  
  // Scale down by 15% per level
  const scaleFactor = Math.max(0.55, 1 - (level * 0.15));
  const finalSize = baseSize * scaleFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(1.5, finalSize * 0.6);
    return `clamp(${minSize}rem, ${finalSize * 0.75}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

// Subheading sizing
function calculateSubheadingSize(contentLength: number, level: number): string {
  let baseSize;
  
  // Check if content needs adaptive sizing
  const needsAdaptive = contentLength > 70;
  
  if (contentLength <= 20) {
    baseSize = 3.2; // Short subheadings
  } else if (contentLength <= 50) {
    baseSize = 2.8; // Medium subheadings
  } else {
    baseSize = 2.4; // Long subheadings
  }
  
  // Scale down by 15% per level
  const scaleFactor = Math.max(0.5, 1 - (level * 0.15));
  const finalSize = baseSize * scaleFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(1.2, finalSize * 0.6);
    return `clamp(${minSize}rem, ${finalSize * 0.7}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

// Body text sizing
function calculateBodySize(contentLength: number, level: number, hasMedia: boolean): string {
  let baseSize;
  
  // Check if content needs adaptive sizing
  const needsAdaptive = contentLength > 150;
  
  if (contentLength <= 30) {
    baseSize = 2.6; // Very short content
  } else if (contentLength <= 80) {
    baseSize = 2.2; // Short content
  } else if (contentLength <= 160) {
    baseSize = 1.9; // Medium content
  } else if (contentLength <= 300) {
    baseSize = 1.7; // Long content
  } else {
    baseSize = 1.5; // Very long content
  }
  
  // Scale down by 12% per level
  const levelFactor = Math.max(0.65, 1 - (level * 0.12));
  
  // Reduce size further if we have media
  const mediaFactor = hasMedia ? 0.85 : 1;
  
  const finalSize = baseSize * levelFactor * mediaFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(1, finalSize * 0.6);
    return `clamp(${minSize}rem, ${finalSize * 0.7}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

// List item sizing
function calculateListSize(contentLength: number, level: number): string {
  let baseSize;
  
  // Check if content needs adaptive sizing
  const needsAdaptive = contentLength > 100;
  
  if (contentLength <= 30) {
    baseSize = 2.4; // Short list items
  } else if (contentLength <= 80) {
    baseSize = 2.0; // Medium list items
  } else {
    baseSize = 1.8; // Long list items
  }
  
  // Scale down by 10% per level
  const scaleFactor = Math.max(0.7, 1 - (level * 0.1));
  const finalSize = baseSize * scaleFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(1, finalSize * 0.7);
    return `clamp(${minSize}rem, ${finalSize * 0.65}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

// Code block sizing
function calculateCodeSize(contentLength: number): string {
  // Code blocks often benefit from adaptive sizing based on content length
  const needsAdaptive = contentLength > 120;
  
  if (contentLength <= 50) {
    const size = 1.8; // Short code snippets
    return needsAdaptive ? `clamp(1rem, 1.5vw, ${size}rem)` : `${size}rem`;
  } else if (contentLength <= 150) {
    const size = 1.5; // Medium code snippets
    return needsAdaptive ? `clamp(0.9rem, 1.3vw, ${size}rem)` : `${size}rem`;
  } else {
    const size = 1.3; // Long code blocks
    return needsAdaptive ? `clamp(0.8rem, 1.1vw, ${size}rem)` : `${size}rem`;
  }
}

// Quote sizing
function calculateQuoteSize(contentLength: number, level: number): string {
  let baseSize;
  
  // Check if content needs adaptive sizing
  const needsAdaptive = contentLength > 100;
  
  if (contentLength <= 50) {
    baseSize = 2.6; // Short quotes
  } else if (contentLength <= 120) {
    baseSize = 2.2; // Medium quotes
  } else {
    baseSize = 1.9; // Long quotes
  }
  
  // Scale down by 10% per level
  const scaleFactor = Math.max(0.6, 1 - (level * 0.1));
  const finalSize = baseSize * scaleFactor;
  
  // For very long content, use responsive sizing
  if (needsAdaptive) {
    const minSize = Math.max(1.2, finalSize * 0.7);
    return `clamp(${minSize}rem, ${finalSize * 0.7}vw, ${finalSize}rem)`;
  }
  
  // Otherwise use fixed sizing
  return `${finalSize}rem`;
}

/**
 * Generate CSS styles object for a text element
 */
export function generateTypographyStyles(settings: FontSettings): React.CSSProperties {
  return {
    fontFamily: settings.family,
    fontWeight: settings.weight,
    fontSize: settings.size,
    fontStyle: settings.fontStyle,
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    textTransform: settings.textTransform as any,
    textAlign: settings.textAlign,
    maxWidth: settings.maxWidth,
    margin: settings.textAlign === 'center' ? '0 auto' : undefined,
    
    // Additional visual style properties
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
 * Determine content type based on content and note properties
 * Analyzes content to choose the most appropriate typography
 */
export function determineContentType(
  content: string,
  isRootNote: boolean = false, 
  isStartOrEndSlide: boolean = false,
  hasChildren: boolean = false,
  level: number = 0
): ContentType {
  // Start/end slides or top-level roots are always titles
  if (isStartOrEndSlide || (isRootNote && level === 0)) {
    return ContentType.Title;
  }
  
  // Section headers (parents with children)
  if (hasChildren && level <= 3) {
    return ContentType.Heading;
  }
  
  // Check for code blocks
  if (content.includes('```') || content.includes('    ') || content.includes('\t')) {
    return ContentType.Code;
  }
  
  // Check for quotes
  if (content.includes('> ') || content.includes('"') && content.includes('"')) {
    return ContentType.Quote;
  }
  
  // Check for lists
  if (content.includes('- ') || content.includes('* ') || 
      content.includes('1. ') || /^\d+\.\s/.test(content)) {
    return ContentType.List;
  }
  
  // Headings (based on length and level)
  if (content.length < 60 && level <= 2) {
    return ContentType.Heading;
  }
  
  // Subheadings
  if (content.length < 100 && level <= 4) {
    return ContentType.Subheading;
  }
  
  // Default to body text
  return ContentType.Body;
}