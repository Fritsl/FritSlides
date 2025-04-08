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
  patternType: 'dots' | 'paths' | 'circles' | 'plus' | 'nodes';
  patternDescription: string; // Describes the pattern in the theme
};

// Root themes for presentations, each with their gradient and patterns
export const PRESENTATION_THEMES: PresentationTheme[] = [
  // Glacier (Sky Blue)
  {
    name: "Glacier",
    colors: {
      base: "#0EA5E9",   // Sky Blue 500
      mid: "#0C4A6E",    // Sky Blue 900
      dark: "#082F49",   // Sky Blue 950
      accent: "#38BDF8"  // Sky Blue 400
    },
    patternType: 'dots',
    patternDescription: "Scattered dots and circles in #38BDF8 at 10% opacity"
  },
  
  // Sand (Orange)
  {
    name: "Sand",
    colors: {
      base: "#F97316",   // Orange 500
      mid: "#9A3412",    // Orange 900
      dark: "#431407",   // Orange 950
      accent: "#FB923C"  // Orange 400
    },
    patternType: 'paths',
    patternDescription: "Interlocking paths in #FB923C at 10% opacity"
  },
  
  // Pearl (Fuchsia)
  {
    name: "Pearl",
    colors: {
      base: "#D946EF",   // Fuchsia 500
      mid: "#86198F",    // Fuchsia 900
      dark: "#4A044E",   // Fuchsia 950
      accent: "#F0ABFC"  // Fuchsia 300
    },
    patternType: 'circles',
    patternDescription: "Small circles in #F0ABFC at 10% opacity"
  },
  
  // Dark (Purple)
  {
    name: "Dark",
    colors: {
      base: "#A855F7",   // Purple 500
      mid: "#6B21A8",    // Purple 900
      dark: "#3B0764",   // Purple 950
      accent: "#A855F7"  // Purple 500
    },
    patternType: 'plus',
    patternDescription: "Plus signs in #A855F7 at 10% opacity"
  },
  
  // Midnight (Cyan)
  {
    name: "Midnight",
    colors: {
      base: "#22D3EE",   // Cyan 400
      mid: "#155E75",    // Cyan 900
      dark: "#083344",   // Cyan 950
      accent: "#22D3EE"  // Cyan 400
    },
    patternType: 'nodes',
    patternDescription: "Circular nodes in #22D3EE at 10% opacity"
  },
  
  // Obsidian (Teal)
  {
    name: "Obsidian",
    colors: {
      base: "#2DD4BF",   // Teal 400
      mid: "#115E59",    // Teal 900
      dark: "#042F2E",   // Teal 950
      accent: "#5EEAD4"  // Teal 300
    },
    patternType: 'dots',
    patternDescription: "Scattered dots in #5EEAD4 at 10% opacity"
  }
];

// SVG patterns for each pattern type
export const generatePatternSvg = (patternType: string, accentColor: string): string => {
  // Set opacity for the patterns
  const opacity = 0.1;
  
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
  
  return {
    background: `radial-gradient(circle, ${theme.colors.mid} 0%, ${theme.colors.dark} 100%)`,
    backgroundImage: `url("${patternUrl}"), radial-gradient(circle, ${theme.colors.mid} 0%, ${theme.colors.dark} 100%)`,
    color: '#FFFFFF',
    textShadow: '-1.5px 1.5px 1.5px rgba(0, 0, 0, 0.4)'
  };
}