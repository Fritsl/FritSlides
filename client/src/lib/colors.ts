// Color palette for note levels - 16 distinguishable colors for dark theme
// Each with a regular version and a lighter version

export type ColorPair = {
  regular: string;
  light: string;
};

export const LEVEL_COLORS: ColorPair[] = [
  // Deep blue
  { regular: '#1a1e2c', light: '#252a3a' }, 
  // Purple
  { regular: '#2d1f3d', light: '#3a294e' },
  // Deep teal
  { regular: '#1d3b36', light: '#254941' },
  // Burgundy
  { regular: '#3d1f2f', light: '#4c2a3c' },
  // Dark blue-green
  { regular: '#1d303d', light: '#263a4a' },
  // Dark olive
  { regular: '#2e331f', light: '#3a4128' },
  // Deep magenta
  { regular: '#351a35', light: '#412541' },
  // Slate
  { regular: '#2c2c3d', light: '#37374c' },
  // Dark brown
  { regular: '#342617', light: '#413020' },
  // Deep indigo
  { regular: '#1f234d', light: '#292d5e' },
  // Dark forest green
  { regular: '#1e2e1e', light: '#284028' },
  // Dark crimson
  { regular: '#3d1919', light: '#4c2424' },
  // Charcoal blue
  { regular: '#232e3d', light: '#2d394a' },
  // Dark mauve
  { regular: '#3d2638', light: '#4b3144' },
  // Dark cyan
  { regular: '#1a3333', light: '#254040' },
  // Dark gold
  { regular: '#33301a', light: '#403d24' }
];

// Get color for a specific level (cycles through if level > colors available)
export function getLevelColor(level: number): ColorPair {
  const index = level % LEVEL_COLORS.length;
  return LEVEL_COLORS[index];
}