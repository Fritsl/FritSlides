// Typography system for presentation mode
// Creates visual hierarchy with IBM Plex Sans and Bebas Neue fonts

// Font family definitions
export const FONTS = {
  primary: "'IBM Plex Sans', sans-serif",
  display: "'Bebas Neue', sans-serif"
};

// Font weight definitions
export const WEIGHTS = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

// Type of content determines if we use primary or display font
export enum ContentType {
  Root = 'root',       // Root level note (level 0)
  Regular = 'regular', // Standard content
  Section = 'section'  // Section header (section marker)
}

// Font size scaling rules based on depth and content length
export interface FontSettings {
  family: string;
  weight: number;
  size: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'uppercase' | 'none';
}

/**
 * Get font settings based on content type, depth level, and content length
 * Automatically scales text based on content length and hierarchy
 */
export function getTypographyStyles(
  contentType: ContentType,
  level: number = 0,
  contentLength: number = 0
): FontSettings {
  // Short content gets larger fonts
  const isShort = contentLength <= 50;
  
  // Default settings for regular content
  const defaults: FontSettings = {
    family: FONTS.primary,
    weight: WEIGHTS.regular,
    size: '1.5rem',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: 'none'
  };
  
  // Display font for root, start, end slides
  if (contentType === ContentType.Root) {
    return {
      family: FONTS.display,
      weight: WEIGHTS.regular,
      size: isShort ? '10rem' : '9rem',
      lineHeight: '1.1',
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    };
  }
  
  // Section headers (parent notes with children)
  if (contentType === ContentType.Section) {
    // Use display font with size based on level
    return {
      family: FONTS.display,
      weight: WEIGHTS.regular,
      size: getSectionSize(level, isShort),
      lineHeight: '1.1',
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    };
  }
  
  // Regular content - IBM Plex Sans with size based on level
  return {
    family: FONTS.primary,
    weight: getContentWeight(level),
    size: getContentSize(level, isShort),
    lineHeight: '1.5',
    letterSpacing: 'normal',
    textTransform: 'none'
  };
}

/**
 * Gets the appropriate font size for section headers based on level and content length
 */
function getSectionSize(level: number, isShort: boolean): string {
  switch (level) {
    case 0:
      return isShort ? '10rem' : '9rem';
    case 1:
      return isShort ? '9rem' : '8rem';
    case 2:
      return isShort ? '8rem' : '7rem';
    case 3:
      return isShort ? '7rem' : '6rem';
    case 4:
      return '5rem';
    default:
      return '4rem';
  }
}

/**
 * Gets the appropriate font size for regular content based on level and content length
 */
function getContentSize(level: number, isShort: boolean): string {
  switch (level) {
    case 0:
      return isShort ? '3rem' : '2.75rem';
    case 1:
      return isShort ? '2.5rem' : '2.25rem';
    case 2:
      return isShort ? '2rem' : '1.75rem';
    case 3:
      return '1.5rem';
    case 4:
      return '1.25rem';
    default:
      return '1rem';
  }
}

/**
 * Gets the appropriate font weight based on hierarchy level
 */
function getContentWeight(level: number): number {
  switch (level) {
    case 0:
      return WEIGHTS.bold;
    case 1:
      return WEIGHTS.semibold;
    case 2:
      return WEIGHTS.medium;
    default:
      return WEIGHTS.regular;
  }
}

/**
 * Generate CSS styles object for a text element
 */
export function generateTypographyStyles(settings: FontSettings): React.CSSProperties {
  return {
    fontFamily: settings.family,
    fontWeight: settings.weight,
    fontSize: settings.size,
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    textTransform: settings.textTransform,
  };
}

/**
 * Determine content type based on note properties
 */
export function determineContentType(isRootNote: boolean, hasChildren: boolean): ContentType {
  if (isRootNote) {
    return ContentType.Root;
  } else if (hasChildren) {
    return ContentType.Section;
  }
  return ContentType.Regular;
}