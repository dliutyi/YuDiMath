/**
 * Get grid color for a given nesting level
 * Each level gets a distinct color that contrasts with its parent
 */
export function getGridColorForLevel(level: number): string {
  // Color palette for different nesting levels
  // Colors chosen to provide good contrast with each other
  const colors = [
    '#6366f1', // indigo-500 - level 0 (top-level frames)
    '#ec4899', // pink-500 - level 1
    '#10b981', // emerald-500 - level 2
    '#f59e0b', // amber-500 - level 3
    '#8b5cf6', // violet-500 - level 4
    '#06b6d4', // cyan-500 - level 5
    '#ef4444', // red-500 - level 6
    '#14b8a6', // teal-500 - level 7
  ]
  
  // Cycle through colors if nesting is deeper than palette
  return colors[level % colors.length]
}

/**
 * Get background color for a given nesting level
 * Each level gets a distinct semi-transparent background tint
 */
export function getBackgroundColorForLevel(level: number): string {
  // Background color palette matching grid colors but with low opacity
  const backgroundColors = [
    'rgba(99, 102, 241, 0.08)',   // indigo tint - level 0
    'rgba(236, 72, 153, 0.08)',   // pink tint - level 1
    'rgba(16, 185, 129, 0.08)',   // emerald tint - level 2
    'rgba(245, 158, 11, 0.08)',   // amber tint - level 3
    'rgba(139, 92, 246, 0.08)',   // violet tint - level 4
    'rgba(6, 182, 212, 0.08)',    // cyan tint - level 5
    'rgba(239, 68, 68, 0.08)',    // red tint - level 6
    'rgba(20, 184, 166, 0.08)',   // teal tint - level 7
  ]
  
  // Cycle through colors if nesting is deeper than palette
  return backgroundColors[level % backgroundColors.length]
}

