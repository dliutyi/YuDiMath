/**
 * CoordinateFrame module - exports all frame-related functionality
 * This file serves as the main entry point for frame operations
 */

// Re-export coordinate transformation functions
export {
  frameToScreen,
  screenToFrame,
  frameToParent,
  frameCoordsToParentWorld,
  parentToFrame,
  nestedFrameToScreen,
  parentWorldToFrameCoords,
} from '../utils/frameTransforms'

// Re-export drawing functions
export { drawCoordinateFrame } from '../utils/frameDrawing'

// Re-export utility functions
export { getGridColorForLevel, getBackgroundColorForLevel } from '../utils/frameUtils'
