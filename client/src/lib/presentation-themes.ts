// Presentation theme system: Each root note and its children follow a distinct theme
// with visual hierarchy through gradients and patterns

export type ThemeColors = {
  base: string;      // Lightest shade - base color
  mid: string;       // Medium shade
  dark: string;      // Darkest shade
  accent: string;    // Accent color for overlay patterns
};

export type PresentationTheme = {
  name: string;
  colors: ThemeColors;
  patternType: 'dots' | 'paths' | 'circles' | 'plus' | 'nodes' | 'neural' | 'circuit' | 'brain' | 'code';
  patternDescription: string; // Describes the pattern in the theme
};

// Special theme for start/end slides with a distinct look - AI Neural theme
export const START_END_THEME: PresentationTheme = {
  name: "AI Neural",
  colors: {
    base: "#4F46E5",   // Indigo 600
    mid: "#312E81",    // Indigo 900
    dark: "#1E1B4B",   // Indigo 950
    accent: "#818CF8"  // Indigo 400
  },
  patternType: 'neural',
  patternDescription: "Neural network pattern in #818CF8 at 15% opacity"
};

// Root themes for presentations, each with their gradient and patterns
export const PRESENTATION_THEMES: PresentationTheme[] = [
  // Neural (Deep Blue) - AI Neural Network Theme
  {
    name: "Neural",
    colors: {
      base: "#4F46E5",   // Indigo 600
      mid: "#312E81",    // Indigo 900
      dark: "#1E1B4B",   // Indigo 950
      accent: "#818CF8"  // Indigo 400
    },
    patternType: 'neural',
    patternDescription: "Neural network pattern in #818CF8 at 15% opacity"
  },
  
  // Circuit (Emerald) - AI Circuit Board Theme
  {
    name: "Circuit",
    colors: {
      base: "#10B981",   // Emerald 500
      mid: "#065F46",    // Emerald 900
      dark: "#022C22",   // Emerald 950
      accent: "#34D399"  // Emerald 400
    },
    patternType: 'circuit',
    patternDescription: "Circuit board pattern in #34D399 at 15% opacity"
  },
  
  // Digital (Violet) - AI Digital Brain Theme
  {
    name: "Digital",
    colors: {
      base: "#8B5CF6",   // Violet 500
      mid: "#5B21B6",    // Violet 900
      dark: "#2E1065",   // Violet 950
      accent: "#A78BFA"  // Violet 400
    },
    patternType: 'brain',
    patternDescription: "Abstract brain pattern in #A78BFA at 15% opacity"
  },
  
  // Code (Cyan) - AI Programming Theme
  {
    name: "Code",
    colors: {
      base: "#06B6D4",   // Cyan 500
      mid: "#155E75",    // Cyan 900
      dark: "#083344",   // Cyan 950
      accent: "#22D3EE"  // Cyan 400
    },
    patternType: 'code',
    patternDescription: "Code brackets pattern in #22D3EE at 15% opacity"
  },
  
  // Quantum (Blue) - AI Quantum Computing Theme
  {
    name: "Quantum",
    colors: {
      base: "#3B82F6",   // Blue 500
      mid: "#1E3A8A",    // Blue 900
      dark: "#172554",   // Blue 950
      accent: "#60A5FA"  // Blue 400
    },
    patternType: 'nodes',
    patternDescription: "Quantum nodes in #60A5FA at 15% opacity"
  },
  
  // Tech (Rose) - AI Technology Theme
  {
    name: "Tech",
    colors: {
      base: "#F43F5E",   // Rose 500
      mid: "#9F1239",    // Rose 900
      dark: "#4C0519",   // Rose 950
      accent: "#FB7185"  // Rose 400
    },
    patternType: 'dots',
    patternDescription: "Tech dots in #FB7185 at 15% opacity"
  }
];

// SVG patterns for each pattern type
export const generatePatternSvg = (patternType: string, accentColor: string): string => {
  // Set opacity for the patterns - increased for better visibility
  const opacity = 0.15;
  
  switch (patternType) {
    case 'dots':
      return `data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3Ccircle cx='8' cy='18' r='1.5'/%3E%3Ccircle cx='18' cy='8' r='1.5'/%3E%3C/g%3E%3C/svg%3E`;
    
    case 'paths':
      return `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40c5-10 10-15 20-15s15 5 20 15M0 20c5-10 10-15 20-15s15 5 20 15M0 0c5 10 10 15 20 15s15-5 20-15' stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' fill='none' stroke-width='2'/%3E%3C/svg%3E`;
    
    case 'circles':
      return `data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Ccircle stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' cx='8' cy='8' r='4'/%3E%3Ccircle stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' cx='18' cy='18' r='4'/%3E%3C/g%3E%3C/svg%3E`;
    
    case 'plus':
      return `data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'%3E%3Cpath d='M8 0h4v20H8z'/%3E%3Cpath d='M0 8h20v4H0z'/%3E%3C/g%3E%3C/svg%3E`;
    
    case 'nodes':
      return `data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Ccircle stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' cx='16' cy='16' r='6'/%3E%3Cpath stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity*0.75}' d='M16 0v6m0 20v6M0 16h6m20 0h6'/%3E%3C/g%3E%3C/svg%3E`;
    
    // Neural network pattern - interconnected nodes representing neural networks
    case 'neural':
      return `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}'%3E%3Ccircle cx='15' cy='15' r='3'/%3E%3Ccircle cx='45' cy='15' r='3'/%3E%3Ccircle cx='15' cy='45' r='3'/%3E%3Ccircle cx='45' cy='45' r='3'/%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3Cpath stroke-width='1' d='M15 15l15 15m0 0l15-15m0 30l-15-15m0 0l-15 15m0-30l30 30'/%3E%3C/g%3E%3C/svg%3E`;
      
    // Circuit board pattern - representing technology and computing
    case 'circuit':
      return `data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' stroke-width='1'%3E%3Cpath d='M10 10h5v5h5v5h-5v5h-5zM35 10h5v5h-5v5h5v5h-5v5h-5v-5h-5v5h-5v-5h5v-5h5v-5h5zM10 35h5v5h-5z'/%3E%3Ccircle cx='5' cy='5' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3Ccircle cx='15' cy='15' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3Ccircle cx='35' cy='35' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3Ccircle cx='45' cy='45' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3C/g%3E%3C/svg%3E`;
      
    // Brain pattern - abstract brain representation
    case 'brain':
      return `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}'%3E%3Cpath d='M30 10c-2.5 0-5 1-6.5 2.5-1.5-1-3.5-1.5-5-1.5-5 0-9 4-9 9 0 2 0.5 3.5 1.5 5-1 1.5-1.5 3-1.5 5 0 5 4 9 9 9 1 0 2-0.5 3-1 1 2.5 3.5 4 6.5 4s5.5-1.5 6.5-4c1 0.5 2 1 3 1 5 0 9-4 9-9 0-2-0.5-3.5-1.5-5 1-1.5 1.5-3 1.5-5 0-5-4-9-9-9-1.5 0-3.5 0.5-5 1.5C35 11 32.5 10 30 10z'/%3E%3Cpath d='M20 20c0 1.5 0.5 3 1.5 4M40 20c0 1.5-0.5 3-1.5 4M25 37.5c1.5 1 3 1.5 5 1.5s3.5-0.5 5-1.5M20 30c-2.5 0-4.5-2-4.5-4.5M40 30c2.5 0 4.5-2 4.5-4.5'/%3E%3Ccircle cx='25' cy='25' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3Ccircle cx='35' cy='25' r='2' fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'/%3E%3C/g%3E%3C/svg%3E`;
      
    // Code pattern - representing programming
    case 'code':
      return `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='${encodeURIComponent(accentColor)}' stroke-opacity='${opacity}' fill='none'%3E%3Cpath d='M10 13l-6 6 6 6M30 13l6 6-6 6M17 8l6 24'/%3E%3C/g%3E%3C/svg%3E`;
      
    default:
      return `data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='${encodeURIComponent(accentColor)}' fill-opacity='${opacity}'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3Ccircle cx='8' cy='18' r='1'/%3E%3Ccircle cx='18' cy='8' r='1'/%3E%3C/g%3E%3C/svg%3E`;
  }
};

// Returns an appropriate theme for a specific note level
// Root notes (level 0) get their own theme from the sequence
// Child notes inherit their parent's theme
export function getPresentationTheme(level: number, rootIndex: number): PresentationTheme {
  // Determine root theme index (cycle through themes)
  const themeIndex = rootIndex % PRESENTATION_THEMES.length;
  return PRESENTATION_THEMES[themeIndex];
}

// Generate CSS for background with theme (gradient + pattern)
export function getThemeBackgroundStyle(theme: PresentationTheme) {
  const patternUrl = generatePatternSvg(theme.patternType, theme.colors.accent);
  
  // Make the gradient more pronounced with base color in center fading to dark
  return {
    background: `radial-gradient(circle at center, ${theme.colors.base} 0%, ${theme.colors.mid} 65%, ${theme.colors.dark} 100%)`,
    backgroundImage: `url("${patternUrl}"), radial-gradient(circle at center, ${theme.colors.base} 0%, ${theme.colors.mid} 65%, ${theme.colors.dark} 100%)`,
    color: '#FFFFFF',
    textShadow: '-1.5px 1.5px 1.5px rgba(0, 0, 0, 0.4)'
  };
}

// Detect if an image is portrait or landscape based on aspect ratio
export function isPortraitImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // If height > width, it's portrait
      resolve(img.height > img.width);
    };
    img.onerror = () => {
      // Default to landscape on error
      resolve(false);
    };
    img.src = url;
  });
}

// Detect if a YouTube URL is for a Shorts video (typically vertical format)
export function isYoutubeShorts(url: string): boolean {
  return url.includes('/shorts/');
}

// Get accent color for markers and accents from theme
export function getAccentColor(theme: PresentationTheme): string {
  return theme.colors.base;
}