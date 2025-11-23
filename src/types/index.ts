/**
 * Coordinate system mode
 */
export type CoordinateMode = '2d' | '3d'

/**
 * Viewport state - represents the current view of the infinite coordinate system
 */
export interface ViewportState {
  /** X position in world coordinates */
  x: number
  /** Y position in world coordinates */
  y: number
  /** Zoom level (1.0 = normal, >1.0 = zoomed in, <1.0 = zoomed out) */
  zoom: number
  /** Grid step size for the background coordinate system */
  gridStep: number
}

/**
 * 2D Point/Vector components
 */
export type Point2D = [number, number]

/**
 * 3D Point/Vector components (for future 3D support)
 */
export type Point3D = [number, number, number]

/**
 * Point that can be 2D or 3D depending on mode
 */
export type Point = Point2D | Point3D

/**
 * Vector definition - represents a vector in a coordinate frame
 */
export interface Vector {
  /** Unique identifier for the vector */
  id: string
  /** Start point of the vector (in frame coordinates) */
  start: Point2D
  /** End point of the vector (in frame coordinates) */
  end: Point2D
  /** Color of the vector (hex format, e.g., '#00ff00') */
  color: string
  /** Optional label for the vector */
  label?: string
}

/**
 * Function plot definition - represents a mathematical function to plot
 */
export interface FunctionPlot {
  /** Unique identifier for the function plot */
  id: string
  /** Function expression (string) - used when points are not provided */
  expression?: string
  /** Pre-computed points for the function plot - used when provided instead of expression */
  points?: Array<[number, number]>
  /** Minimum x value for evaluation range */
  xMin: number
  /** Maximum x value for evaluation range */
  xMax: number
  /** Color of the function plot (hex format, e.g., '#ff00ff') */
  color: string
  /** Number of points to sample for plotting (default: 1000) */
  numPoints?: number
}

/**
 * Rectangle bounds - defines the position and size of a frame viewport
 */
export interface FrameBounds {
  /** X position in background coordinate system */
  x: number
  /** Y position in background coordinate system */
  y: number
  /** Width of the frame */
  width: number
  /** Height of the frame */
  height: number
  /** Frame coordinate bounds (for nested frames with non-orthogonal base vectors) */
  frameCoords?: {
    minU: number
    maxU: number
    minV: number
    maxV: number
  }
}

/**
 * Coordinate frame - represents a viewport with its own coordinate system
 * Each frame is a rectangular region snapped to the background coordinate system
 * but has its own independent coordinate grid based on base vectors
 * Supports nested frames (Russian doll pattern)
 */
export interface CoordinateFrame {
  /** Unique identifier for the frame */
  id: string
  /** Origin position in parent coordinate system (background or parent frame, snapped to grid) */
  origin: Point2D
  /** Base i vector (default: [1, 0] - normalized) */
  baseI: Point2D
  /** Base j vector (default: [0, 1] - normalized) */
  baseJ: Point2D
  /** Bounds of the frame viewport (in parent coordinate system) */
  bounds: FrameBounds
  /** Frame's own viewport state (independent panning and zooming) */
  viewport: ViewportState
  /** Coordinate mode (2D or 3D) */
  mode: CoordinateMode
  /** Vectors defined in this frame (via draw() calls) */
  vectors: Vector[]
  /** Function plots defined in this frame (via plot() calls) */
  functions: FunctionPlot[]
  /** Python code for this frame */
  code: string
  /** ID of parent frame (null for top-level frames) */
  parentFrameId: string | null
  /** IDs of child frames (nested frames) */
  childFrameIds: string[]
}

/**
 * Complete workspace state - represents the entire application state
 */
export interface WorkspaceState {
  /** Current viewport state */
  viewport: ViewportState
  /** Array of all coordinate frames */
  frames: CoordinateFrame[]
  /** ID of currently selected frame (null if none selected) */
  selectedFrameId: string | null
}

/**
 * Predefined function call - represents a call to a predefined Python function
 */
export interface PredefinedFunctionCall {
  /** Name of the function (e.g., 'draw', 'plot') */
  name: string
  /** Arguments passed to the function */
  args: unknown[]
  /** Frame ID where this function was called */
  frameId: string
}

/**
 * Python execution result
 */
export interface PythonExecutionResult {
  /** Whether execution was successful */
  success: boolean
  /** Output from execution (if any) */
  output?: string
  /** Error message (if execution failed) */
  error?: string
  /** Function calls captured during execution */
  functionCalls: PredefinedFunctionCall[]
}

