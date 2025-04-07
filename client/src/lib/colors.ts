// Color palette for note levels - 16 distinguishable colors for dark theme
// Each with a regular version and a lighter version

export type ColorPair = {
  regular: string;
  light: string;
};

export const LEVEL_COLORS: ColorPair[] = [
  // Blue 
  { regular: '#1976d2', light: '#42a5f5' },
  // Purple
  { regular: '#7b1fa2', light: '#9c27b0' },
  // Green
  { regular: '#2e7d32', light: '#43a047' },
  // Red
  { regular: '#c62828', light: '#e53935' },
  // Teal
  { regular: '#00796b', light: '#26a69a' },
  // Orange
  { regular: '#e64a19', light: '#ff7043' },
  // Indigo
  { regular: '#303f9f', light: '#5c6bc0' },
  // Brown
  { regular: '#5d4037', light: '#795548' }
];

// Get color for a specific level (cycles through if level > colors available)
export function getLevelColor(level: number): ColorPair {
  const index = level % LEVEL_COLORS.length;
  return LEVEL_COLORS[index];
}