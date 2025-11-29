import type { Vector, FunctionPlot, ParametricPlot } from '../types'
import type { PythonFunctionCallback } from './pythonFunctions'
import { getFunctionImplementation } from './pythonFunctionRegistry'
import { parsePythonArgs } from './pythonArgParsing'

// Re-export for convenience
export type { PythonFunctionCallback }

/**
 * Currently captured function calls during execution
 * This is reset before each execution and populated during execution
 */
let capturedCalls: Array<{
  name: string
  args: unknown[]
  frameId: string
}> = []

/**
 * Current frame ID for function calls
 */
let currentFrameId: string | null = null

/**
 * Storage functions for vectors, function plots, and parametric plots
 */
let storeVectorFn: ((vector: Omit<Vector, 'id'>) => void) | null = null
let storeFunctionFn: ((func: Omit<FunctionPlot, 'id'>) => void) | null = null
let storeParametricPlotFn: ((plot: Omit<ParametricPlot, 'id'>) => void) | null = null

/**
 * Canvas and viewport information for screen-resolution-aware sampling
 */
let canvasInfo: {
  canvasWidth: number
  canvasHeight: number
  pixelsPerUnit: number  // Approximate pixels per unit in frame coordinates
} | null = null

/**
 * Set up function execution context for a specific frame
 * @param frameId The ID of the frame where functions will be called
 * @param onVectorCreated Callback to store a vector
 * @param onFunctionCreated Callback to store a function plot
 * @param onParametricPlotCreated Optional callback to store a parametric plot
 * @param canvasWidth Optional canvas width for screen-resolution-aware sampling
 * @param canvasHeight Optional canvas height for screen-resolution-aware sampling
 * @param pixelsPerUnit Optional pixels per unit in frame coordinates for optimal sampling
 */
export function setupFunctionContext(
  frameId: string,
  onVectorCreated: (vector: Omit<Vector, 'id'>) => void,
  onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void,
  onParametricPlotCreated?: (plot: Omit<ParametricPlot, 'id'>) => void,
  canvasWidth?: number,
  canvasHeight?: number,
  pixelsPerUnit?: number
): void {
  currentFrameId = frameId
  storeVectorFn = onVectorCreated
  storeFunctionFn = onFunctionCreated
  storeParametricPlotFn = onParametricPlotCreated || null
  capturedCalls = []
  
  // Store canvas info for screen-resolution-aware sampling
  if (canvasWidth && canvasHeight && pixelsPerUnit) {
    canvasInfo = { canvasWidth, canvasHeight, pixelsPerUnit }
  } else {
    canvasInfo = null
  }
}

/**
 * Clear function execution context
 */
export function clearFunctionContext(): void {
  currentFrameId = null
  storeVectorFn = null
  storeFunctionFn = null
  storeParametricPlotFn = null
  capturedCalls = []
  canvasInfo = null
}

/**
 * Get captured function calls from last execution
 */
export function getCapturedCalls(): Array<{ name: string; args: unknown[]; frameId: string }> {
  return [...capturedCalls]
}

/**
 * Get current canvas info
 */
export function getCanvasInfo(): { canvasWidth: number; canvasHeight: number; pixelsPerUnit: number } | null {
  return canvasInfo
}

/**
 * Create a Python function wrapper that can be injected into Pyodide
 * This creates a JavaScript function that Python can call
 * Handles both positional and keyword arguments
 */
export function createPythonFunctionWrapper(name: string): PythonFunctionCallback {
  return (...rawArgs: unknown[]) => {
    if (!currentFrameId || !storeVectorFn || !storeFunctionFn) {
      throw new Error(`Function '${name}' called outside of execution context`)
    }
    
    const implementation = getFunctionImplementation(name)
    if (!implementation) {
      throw new Error(`Function '${name}' is not registered`)
    }
    
    // Parse arguments (handle keyword arguments)
    const { positional, keywords } = parsePythonArgs(rawArgs)
    
    // Combine positional and keyword arguments into a single args array
    // Keyword arguments are added after positional arguments in the correct order
    const args: unknown[] = [...positional]
    
    // Add keyword arguments in a predictable order based on function name
    if (name === 'draw') {
      // draw(vector, color?)
      // If color is provided as keyword, add it
      if ('color' in keywords) {
        args.push(keywords.color)
      }
    } else if (name === 'plot') {
      // plot(formula, x_min, x_max, color?)
      // Handle keyword arguments for plot
      // If we have formula but missing x_min/x_max, get from keywords
      if (args.length === 1 && 'x_min' in keywords && 'x_max' in keywords) {
        args.push(keywords.x_min)
        args.push(keywords.x_max)
      } else if (args.length === 2) {
        // We have formula and one more arg - check if it's x_min or x_max
        if ('x_max' in keywords) {
          args.push(keywords.x_max)
        } else if ('x_min' in keywords) {
          // Insert x_min before the second arg
          const second = args.pop()
          args.push(keywords.x_min)
          if (second !== undefined) args.push(second)
        }
      }
      // Add color if provided as keyword
      if ('color' in keywords) {
        args.push(keywords.color)
      }
    } else {
      // For other functions, just append all keyword values
      Object.values(keywords).forEach(value => args.push(value))
    }
    
    // Store the call (with original raw args for debugging)
    capturedCalls.push({
      name,
      args: rawArgs,
      frameId: currentFrameId,
    })
    
    // Execute the implementation
    try {
      implementation(args, currentFrameId, storeVectorFn, storeFunctionFn, storeParametricPlotFn || undefined)
    } catch (error: any) {
      throw new Error(`Error in ${name}(): ${error.message}`)
    }
  }
}

/**
 * Update canvas info in Pyodide (called before each execution if canvas info is available)
 */
export function updateCanvasInfoInPyodide(pyodide: any, isSliderChange: boolean = false): void {
  if (canvasInfo) {
    pyodide.globals.set('__yudimath_canvas_width', canvasInfo.canvasWidth)
    pyodide.globals.set('__yudimath_canvas_height', canvasInfo.canvasHeight)
    // For slider changes, use lighter sampling (reduce pixels_per_unit to make it faster)
    const pixelsPerUnit = isSliderChange ? Math.min(canvasInfo.pixelsPerUnit, 50) : canvasInfo.pixelsPerUnit
    pyodide.globals.set('__yudimath_pixels_per_unit', pixelsPerUnit)
    pyodide.globals.set('__yudimath_is_slider_change', isSliderChange)
  } else {
    // Default values if canvas info not available
    pyodide.globals.set('__yudimath_canvas_width', 1920)
    pyodide.globals.set('__yudimath_canvas_height', 1080)
    pyodide.globals.set('__yudimath_pixels_per_unit', isSliderChange ? 50 : 100)
    pyodide.globals.set('__yudimath_is_slider_change', isSliderChange)
  }
}

