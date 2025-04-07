// Color palette for note levels - 16 distinguishable colors for dark theme
// Each with a regular version and a lighter version

export type ColorPair = {
  regular: string;
  light: string;
};

export const LEVEL_COLORS: ColorPair[] = [
  // Royal blue
  { regular: '#1a237e', light: '#303f9f' }, 
  // Purple
  { regular: '#4a148c', light: '#6a1b9a' },
  // Teal
  { regular: '#00695c', light: '#00897b' },
  // Red
  { regular: '#b71c1c', light: '#c62828' },
  // Indigo
  { regular: '#283593', light: '#3949ab' },
  // Green
  { regular: '#2e7d32', light: '#388e3c' },
  // Deep pink
  { regular: '#880e4f', light: '#ad1457' },
  // Slate blue
  { regular: '#303f9f', light: '#3f51b5' },
  // Brown
  { regular: '#4e342e', light: '#5d4037' },
  // Blue-purple
  { regular: '#311b92', light: '#4527a0' },
  // Deep green
  { regular: '#1b5e20', light: '#2e7d32' },
  // Crimson
  { regular: '#7b1fa2', light: '#8e24aa' },
  // Navy
  { regular: '#0d47a1', light: '#1565c0' },
  // Burgundy 
  { regular: '#6a1b9a', light: '#7b1fa2' },
  // Dark cyan
  { regular: '#006064', light: '#00796b' },
  // Dark orange
  { regular: '#bf360c', light: '#d84315' }
];

// Get color for a specific level (cycles through if level > colors available)
export function getLevelColor(level: number): ColorPair {
  const index = level % LEVEL_COLORS.length;
  return LEVEL_COLORS[index];
}