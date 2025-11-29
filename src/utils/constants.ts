/**
 * Application-wide constants
 * Centralized location for all constants to avoid duplication
 */

// Main viewport zoom limits
export const MIN_ZOOM = 5.0
export const MAX_ZOOM = 500.0
export const DEFAULT_ZOOM = 50.0

// Frame viewport zoom limits
export const FRAME_MIN_ZOOM = 0.1
export const FRAME_MAX_ZOOM = 10.0

// Zoom sensitivity settings
export const ZOOM_SENSITIVITY = 0.25  // Increased from 0.1 for better desktop responsiveness
export const FRAME_ZOOM_SENSITIVITY = 0.015  // Increased from 0.005 for better desktop responsiveness

// Zoom step multiplier
export const ZOOM_STEP_MULTIPLIER = 1.2

// Pan speed multiplier - makes panning more responsive to mouse movement
export const PAN_SPEED_MULTIPLIER = 1.5  // Multiplier for panning speed (1.0 = 1:1, >1.0 = faster)

