import { Vector, FunctionPlot, Point2D } from '../types'

/**
 * Callback function type for predefined Python functions
 * Functions are called from Python and their calls are captured
 */
export type PythonFunctionCallback = (...args: unknown[]) => void

/**
 * Function implementation that processes arguments and stores results
 */
export type FunctionImplementation = (
  args: unknown[],
  frameId: string,
  storeVector: (vector: Omit<Vector, 'id'>) => void,
  storeFunction: (func: Omit<FunctionPlot, 'id'>) => void
) => void

// Note: The parameter order is: args, frameId, storeVector, storeFunction

/**
 * Function registry - maps function names to their implementations
 */
const functionRegistry = new Map<string, FunctionImplementation>()

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
 * Storage functions for vectors and function plots
 */
let storeVectorFn: ((vector: Omit<Vector, 'id'>) => void) | null = null
let storeFunctionFn: ((func: Omit<FunctionPlot, 'id'>) => void) | null = null

/**
 * Canvas and viewport information for screen-resolution-aware sampling
 */
let canvasInfo: {
  canvasWidth: number
  canvasHeight: number
  pixelsPerUnit: number  // Approximate pixels per unit in frame coordinates
} | null = null

/**
 * Validate and convert a numpy array or list to Point2D
 */
function toPoint2D(value: unknown): Point2D {
  console.log('[toPoint2D] Input:', value, 'type:', typeof value, 'isArray:', Array.isArray(value))
  
  // Handle regular JavaScript arrays
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      console.log('[toPoint2D] Returning array:', [value[0], value[1]])
      return [value[0], value[1]]
    }
    if (value.length === 2) {
      // Try to parse as numbers
      const x = typeof value[0] === 'number' ? value[0] : parseFloat(String(value[0]))
      const y = typeof value[1] === 'number' ? value[1] : parseFloat(String(value[1]))
      if (!isNaN(x) && !isNaN(y)) {
        console.log('[toPoint2D] Returning parsed array:', [x, y])
        return [x, y]
      }
    }
  }
  
  // Handle numpy arrays from Pyodide
  // Pyodide numpy arrays have a toJs() method that converts to JavaScript array
  if (value && typeof value === 'object') {
    const obj = value as any
    console.log('[toPoint2D] Object properties:', Object.keys(obj), 'has toJs:', typeof obj.toJs === 'function', 'has tolist:', typeof obj.tolist === 'function', 'length:', obj.length)
    
    // Try toJs() first (Pyodide's recommended way)
    if (typeof obj.toJs === 'function') {
      try {
        console.log('[toPoint2D] Trying toJs()...')
        const jsArray = obj.toJs()
        console.log('[toPoint2D] toJs() result:', jsArray, 'type:', typeof jsArray, 'isArray:', Array.isArray(jsArray))
        if (Array.isArray(jsArray) && jsArray.length === 2) {
          const x = typeof jsArray[0] === 'number' ? jsArray[0] : parseFloat(String(jsArray[0]))
          const y = typeof jsArray[1] === 'number' ? jsArray[1] : parseFloat(String(jsArray[1]))
          if (!isNaN(x) && !isNaN(y)) {
            console.log('[toPoint2D] Returning from toJs():', [x, y])
            return [x, y]
          }
        }
      } catch (e) {
        console.error('[toPoint2D] toJs() error:', e)
        // Fall through to other methods
      }
    }
    
    // Try tolist() method (numpy array method)
    if (typeof obj.tolist === 'function') {
      try {
        console.log('[toPoint2D] Trying tolist()...')
        const list = obj.tolist()
        console.log('[toPoint2D] tolist() result:', list)
        if (Array.isArray(list) && list.length === 2) {
          const x = typeof list[0] === 'number' ? list[0] : parseFloat(String(list[0]))
          const y = typeof list[1] === 'number' ? list[1] : parseFloat(String(list[1]))
          if (!isNaN(x) && !isNaN(y)) {
            console.log('[toPoint2D] Returning from tolist():', [x, y])
            return [x, y]
          }
        }
      } catch (e) {
        console.error('[toPoint2D] tolist() error:', e)
        // Fall through
      }
    }
    
    // Try direct property access (some Pyodide objects expose data directly)
    if ('length' in obj && typeof obj.length === 'number' && obj.length === 2) {
      try {
        console.log('[toPoint2D] Trying direct access, obj[0]:', obj[0], 'obj[1]:', obj[1])
        const x = typeof obj[0] === 'number' ? obj[0] : parseFloat(String(obj[0]))
        const y = typeof obj[1] === 'number' ? obj[1] : parseFloat(String(obj[1]))
        if (!isNaN(x) && !isNaN(y)) {
          console.log('[toPoint2D] Returning from direct access:', [x, y])
          return [x, y]
        }
      } catch (e) {
        console.error('[toPoint2D] Direct access error:', e)
        // Fall through
      }
    }
    
    // Try accessing via get() method (Pyodide arrays sometimes use this)
    if (typeof obj.get === 'function') {
      try {
        console.log('[toPoint2D] Trying get() method...')
        const x = obj.get(0)
        const y = obj.get(1)
        const xNum = typeof x === 'number' ? x : parseFloat(String(x))
        const yNum = typeof y === 'number' ? y : parseFloat(String(y))
        if (!isNaN(xNum) && !isNaN(yNum)) {
          console.log('[toPoint2D] Returning from get():', [xNum, yNum])
          return [xNum, yNum]
        }
      } catch (e) {
        console.error('[toPoint2D] get() error:', e)
      }
    }
  }
  
  console.error('[toPoint2D] Failed to convert value:', value)
  throw new Error('Vector must be a 2D array or numpy array with exactly 2 elements')
}

/**
 * Validate color string (hex format)
 */
function validateColor(color: unknown): string {
  if (typeof color !== 'string') {
    return '#3b82f6' // Default blue color
  }
  
  // Check if it's a valid hex color
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color
  }
  
  // If it's a 3-digit hex, expand it
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  
  return '#3b82f6' // Default if invalid
}

/**
 * Implementation of draw(vector, color?) function
 */
const drawImplementation: FunctionImplementation = (args, _frameId, storeVector, _storeFunction) => {
  if (args.length < 1) {
    throw new Error('draw() requires at least 1 argument: vector')
  }
  
  const vectorArg = args[0]
  const colorArg = args.length > 1 ? args[1] : undefined
  
  try {
    // Debug: log what we're receiving
    console.log('[drawImplementation] Received args:', args.length, 'vectorArg type:', typeof vectorArg, 'isArray:', Array.isArray(vectorArg), 'has toJs:', vectorArg && typeof (vectorArg as any).toJs === 'function')
    
    const endPoint = toPoint2D(vectorArg)
    const color = validateColor(colorArg)
    
    // Vectors always start at origin [0, 0] in frame coordinates
    const vector: Omit<Vector, 'id'> = {
      start: [0, 0],
      end: endPoint,
      color,
    }
    
    storeVector(vector)
  } catch (error: any) {
    console.error('[drawImplementation] Error:', error)
    throw new Error(`draw() error: ${error.message}`)
  }
}

/**
 * Check if an object is a Python callable (lambda/function)
 */
function isCallable(value: unknown): boolean {
  if (typeof value === 'function') {
    return true
  }
  if (value && typeof value === 'object') {
    const obj = value as any
    // Pyodide callables have __call__ method
    return typeof obj.__call__ === 'function'
  }
  return false
}

/**
 * Implementation of plot(formula, x_min, x_max, color?) function
 * Supports both string expressions and callable functions (lambdas)
 * For callables, we store a special marker and the callable will be evaluated in Python
 */
const plotImplementation: FunctionImplementation = (args, _frameId, _storeVector, storeFunction) => {
  console.log('[plotImplementation] Received args:', args.length, args)
  
  if (args.length < 3) {
    throw new Error('plot() requires at least 3 arguments: formula, x_min, x_max')
  }
  
  const formulaArg = args[0]
  const xMinArg = args[1]
  const xMaxArg = args[2]
  const colorArg = args.length > 3 ? args[3] : undefined
  
  console.log('[plotImplementation] formulaArg:', formulaArg, 'type:', typeof formulaArg, 'isCallable:', isCallable(formulaArg))
  
  // Validate formula - should be a string (Python wrapper should have converted callables)
  let formulaString: string
  if (typeof formulaArg === 'string') {
    formulaString = formulaArg
    console.log('[plotImplementation] Using string formula:', formulaString)
  } else if (isCallable(formulaArg)) {
    // If we still receive a callable, the Python wrapper didn't convert it
    // This shouldn't happen, but handle it gracefully
    console.warn('[plotImplementation] Received callable, Python wrapper should have converted it')
    const obj = formulaArg as any
    if (obj.toString && typeof obj.toString === 'function') {
      try {
        formulaString = obj.toString()
        console.log('[plotImplementation] Callable toString():', formulaString)
        // If it's just a generic function representation, we can't use it
        if (formulaString.includes('<function') || formulaString.includes('<lambda')) {
          throw new Error('plot() callable functions must be converted to string expressions by the Python wrapper. Please use a string expression like "x**2" instead of lambda x: x**2')
        }
      } catch (e: any) {
        throw new Error('plot() callable functions cannot be automatically converted. Please use a string expression like "x**2" instead of lambda x: x**2')
      }
    } else {
      throw new Error('plot() callable functions cannot be automatically converted. Please use a string expression instead.')
    }
  } else {
    throw new Error('plot() formula must be a string expression or callable function')
  }
  
  // Validate x_min and x_max
  const xMin = typeof xMinArg === 'number' ? xMinArg : parseFloat(String(xMinArg))
  const xMax = typeof xMaxArg === 'number' ? xMaxArg : parseFloat(String(xMaxArg))
  
  console.log('[plotImplementation] xMin:', xMin, 'xMax:', xMax, 'color:', colorArg)
  
  if (isNaN(xMin) || isNaN(xMax)) {
    throw new Error('plot() x_min and x_max must be numbers')
  }
  
  if (xMin >= xMax) {
    throw new Error('plot() x_min must be less than x_max')
  }
  
  const color = validateColor(colorArg)

  // Calculate optimal number of points based on range
  // Use ~50-100 points per unit of range, with min 200 and max 2000
  const range = xMax - xMin
  const optimalPoints = Math.max(200, Math.min(2000, Math.round(range * 75)))

  const functionPlot: Omit<FunctionPlot, 'id'> = {
    expression: formulaString,
    xMin,
    xMax,
    color,
    numPoints: optimalPoints,
  }
  
  console.log('[plotImplementation] Storing function plot:', functionPlot)
  storeFunction(functionPlot)
}

/**
 * Implementation of plot_points(points, x_min, x_max, color?, num_points?) function
 * Used for callable functions that are evaluated in Python
 */
const plotPointsImplementation: FunctionImplementation = (args, _frameId, _storeVector, storeFunction) => {
  if (args.length < 3) {
    throw new Error('plot_points() requires at least 3 arguments: points, x_min, x_max')
  }
  
  const pointsArg = args[0]
  const xMinArg = args[1]
  const xMaxArg = args[2]
  const colorArg = args.length > 3 ? args[3] : undefined
  
  // Validate points - should be an array of [x, y] pairs
  // Pyodide may pass this as a Pyodide list/array object, so we need to convert it
  let pointsArray: unknown[]
  if (Array.isArray(pointsArg)) {
    pointsArray = pointsArg
  } else if (pointsArg && typeof pointsArg === 'object') {
    // Try to convert Pyodide list/array to JavaScript array
    const obj = pointsArg as any
    if (typeof obj.toJs === 'function') {
      pointsArray = obj.toJs()
    } else if (typeof obj.tolist === 'function') {
      pointsArray = obj.tolist()
    } else if (Array.from && typeof obj[Symbol.iterator] === 'function') {
      pointsArray = Array.from(obj)
    } else {
      // Try to access as array-like
      const length = obj.length
      if (typeof length === 'number' && length >= 0) {
        pointsArray = []
        for (let i = 0; i < length; i++) {
          pointsArray.push(obj[i])
        }
      } else {
        throw new Error('plot_points() points must be an array or array-like object')
      }
    }
  } else {
    throw new Error('plot_points() points must be an array')
  }
  
  const points: Array<[number, number]> = []
  for (const point of pointsArray) {
    // Convert point if it's a Pyodide object
    let pointArray: unknown[]
    if (Array.isArray(point)) {
      pointArray = point
    } else if (point && typeof point === 'object') {
      const pointObj = point as any
      if (typeof pointObj.toJs === 'function') {
        pointArray = pointObj.toJs()
      } else if (typeof pointObj.tolist === 'function') {
        pointArray = pointObj.tolist()
      } else if (Array.from && typeof pointObj[Symbol.iterator] === 'function') {
        pointArray = Array.from(pointObj)
      } else {
        // Try to access as array-like
        const length = pointObj.length
        if (typeof length === 'number' && length === 2) {
          pointArray = [pointObj[0], pointObj[1]]
        } else {
          throw new Error('plot_points() each point must be a [x, y] pair')
        }
      }
    } else {
      throw new Error('plot_points() each point must be a [x, y] pair')
    }
    
    if (!Array.isArray(pointArray) || pointArray.length !== 2) {
      throw new Error('plot_points() each point must be a [x, y] pair')
    }
    const x = typeof pointArray[0] === 'number' ? pointArray[0] : parseFloat(String(pointArray[0]))
    const y = typeof pointArray[1] === 'number' ? pointArray[1] : parseFloat(String(pointArray[1]))
    if (isNaN(x) || isNaN(y)) {
      continue // Skip invalid points
    }
    points.push([x, y])
  }
  
  if (points.length === 0) {
    throw new Error('plot_points() must have at least one valid point')
  }
  
  // Validate x_min and x_max
  const xMin = typeof xMinArg === 'number' ? xMinArg : parseFloat(String(xMinArg))
  const xMax = typeof xMaxArg === 'number' ? xMaxArg : parseFloat(String(xMaxArg))
  
  if (isNaN(xMin) || isNaN(xMax)) {
    throw new Error('plot_points() x_min and x_max must be numbers')
  }
  
  if (xMin >= xMax) {
    throw new Error('plot_points() x_min must be less than x_max')
  }
  
  const color = validateColor(colorArg)

  const functionPlot: Omit<FunctionPlot, 'id'> = {
    points, // Store points directly
    xMin,
    xMax,
    color,
    numPoints: points.length, // Use actual number of points
  }
  
  console.log('[plotPointsImplementation] Storing function plot with', points.length, 'points')
  storeFunction(functionPlot)
}

/**
 * Register a new predefined function
 * @param name Function name (e.g., 'draw', 'plot')
 * @param implementation Function implementation
 */
export function registerFunction(name: string, implementation: FunctionImplementation): void {
  if (functionRegistry.has(name)) {
    console.warn(`[pythonFunctions] Function '${name}' is already registered. Overwriting.`)
  }
  functionRegistry.set(name, implementation)
}

/**
 * Get all registered function names
 */
export function getRegisteredFunctionNames(): string[] {
  return Array.from(functionRegistry.keys())
}

/**
 * Initialize the predefined functions system
 * Registers default functions (draw, plot)
 */
export function initializeFunctions(): void {
  // Register default functions
  registerFunction('draw', drawImplementation)
  registerFunction('plot', plotImplementation)
  registerFunction('plot_points', plotPointsImplementation)
}

/**
 * Set up function execution context for a specific frame
 * @param frameId The ID of the frame where functions will be called
 * @param onVectorCreated Callback to store a vector
 * @param onFunctionCreated Callback to store a function plot
 * @param canvasWidth Optional canvas width for screen-resolution-aware sampling
 * @param canvasHeight Optional canvas height for screen-resolution-aware sampling
 * @param pixelsPerUnit Optional pixels per unit in frame coordinates for optimal sampling
 */
export function setupFunctionContext(
  frameId: string,
  onVectorCreated: (vector: Omit<Vector, 'id'>) => void,
  onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void,
  canvasWidth?: number,
  canvasHeight?: number,
  pixelsPerUnit?: number
): void {
  currentFrameId = frameId
  storeVectorFn = onVectorCreated
  storeFunctionFn = onFunctionCreated
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
 * Parse arguments from Python call - handles both positional and keyword arguments
 * Pyodide passes keyword arguments as an object in the last argument
 */
function parsePythonArgs(rawArgs: unknown[]): { positional: unknown[]; keywords: Record<string, unknown> } {
  const positional: unknown[] = []
  const keywords: Record<string, unknown> = {}
  
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    
    // Check if this is a keyword arguments object (dict-like)
    // But exclude numpy arrays, callables, and other array-like objects
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      const obj = arg as any
      
      // Skip if it's a numpy array (has toJs, tolist, or length property with numeric value)
      // Also check for callable objects (functions, lambdas)
      const isNumpyArray = typeof obj.toJs === 'function' || typeof obj.tolist === 'function' || 
          (typeof obj.length === 'number' && obj.length >= 0 && obj.length <= 1000)
      const isCallableObj = typeof obj === 'function' || (obj && typeof obj.__call__ === 'function')
      
      if (isNumpyArray || isCallableObj) {
        positional.push(arg)
        continue
      }
      
      // Check if it's a Pyodide dict or regular object with string keys
      const keys = Object.keys(arg)
      // If all keys are strings and it's not an array-like object, treat as kwargs
      // Also check that it's not a function or callable
      if (keys.length > 0 && keys.every(k => typeof k === 'string') && typeof obj !== 'function') {
        // Additional check: make sure it's not a numpy array disguised as an object
        // Numpy arrays might have string keys but also have numeric indexing
        const hasNumericIndices = keys.some(k => !isNaN(Number(k)))
        if (!hasNumericIndices) {
          // Merge keywords into the keywords object
          Object.assign(keywords, arg)
          continue
        }
      }
    }
    
    // Otherwise, treat as positional argument
    positional.push(arg)
  }
  
  return { positional, keywords }
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
    
    const implementation = functionRegistry.get(name)
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
      implementation(args, currentFrameId, storeVectorFn, storeFunctionFn)
    } catch (error: any) {
      throw new Error(`Error in ${name}(): ${error.message}`)
    }
  }
}

/**
 * Inject all registered functions into Pyodide's Python context
 * @param pyodide The Pyodide instance
 */
/**
 * Update canvas info in Pyodide (called before each execution if canvas info is available)
 */
export function updateCanvasInfoInPyodide(pyodide: any): void {
  if (canvasInfo) {
    pyodide.globals.set('__yudimath_canvas_width', canvasInfo.canvasWidth)
    pyodide.globals.set('__yudimath_canvas_height', canvasInfo.canvasHeight)
    pyodide.globals.set('__yudimath_pixels_per_unit', canvasInfo.pixelsPerUnit)
  } else {
    // Default values if canvas info not available
    pyodide.globals.set('__yudimath_canvas_width', 1920)
    pyodide.globals.set('__yudimath_canvas_height', 1080)
    pyodide.globals.set('__yudimath_pixels_per_unit', 100)  // Default: 100 pixels per unit
  }
}

export function injectFunctionsIntoPyodide(pyodide: any): void {
  // Create a Python module that exposes all registered functions
  const functionNames = getRegisteredFunctionNames()
  
  // Create JavaScript objects for each function
  const jsFunctions: Record<string, PythonFunctionCallback> = {}
  for (const name of functionNames) {
    jsFunctions[name] = createPythonFunctionWrapper(name)
  }

  try {
    // Use registerJsModule to make functions available as a Python module
    if (typeof pyodide.registerJsModule === 'function') {
      pyodide.registerJsModule('__yudimath_functions', jsFunctions)
      
      // Initialize canvas info with defaults
      updateCanvasInfoInPyodide(pyodide)
      
      // Create Python wrapper functions that handle keyword arguments properly
      // These wrappers convert keyword arguments to positional arguments for the JS functions
      // For plot(), we also handle callables by extracting their expression
      const pythonCode = `
# Inject predefined functions into global scope
import __yudimath_functions as _yudimath
import numpy as np

# Canvas information for screen-resolution-aware sampling (updated before each execution)
try:
    _canvas_width = __yudimath_canvas_width
    _canvas_height = __yudimath_canvas_height
    _pixels_per_unit = __yudimath_pixels_per_unit
except:
    # Fallback if not available
    _canvas_width = 1920
    _canvas_height = 1080
    _pixels_per_unit = 100

# Wrapper for draw() that handles keyword arguments and numpy arrays
def draw(vector, color=None):
    # Convert numpy array to list if needed
    import numpy as np
    if isinstance(vector, np.ndarray):
        vector = vector.tolist()
    elif hasattr(vector, 'tolist'):
        vector = vector.tolist()
    
    if color is not None:
        return _yudimath.draw(vector, color)
    else:
        return _yudimath.draw(vector)

# Wrapper for plot() that handles keyword arguments and callables
def plot(formula, x_min=None, x_max=None, color=None):
    # Handle both positional and keyword arguments
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                if _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        if _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                for i in range(len(initial_points) - 1):
                    x1, y1_val = initial_points[i]
                    x2, y2_val = initial_points[i + 1]
                    
                    # Calculate gap size in world coordinates
                    x_diff = x2 - x1
                    
                    # Always refine between pixel samples to catch rapid changes
                    # But be more aggressive when zoomed in (higher pixels_per_unit)
                    if _pixels_per_unit > 200:
                        # Extremely zoomed in - refine ALL gaps, no matter how small
                        sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 100:
                        # Very zoomed in - refine even tiny gaps
                        if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                            sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 50:
                        # Moderately zoomed in
                        if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                    else:
                        # Normal zoom - refine if gap is significant
                        if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Call the underlying JavaScript function with all arguments
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None:
        return _yudimath.plot(formula_to_use, x_min, x_max, color)
    else:
        return _yudimath.plot(formula_to_use, x_min, x_max)
`
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Functions injected via registerJsModule with keyword argument support:', functionNames)
    } else {
      // Fallback: directly set functions in global scope
      // Create Python wrappers that handle keyword arguments
      const pythonCode = `
import numpy as np

# Wrapper for draw() that handles keyword arguments and numpy arrays
def draw(vector, color=None):
    # Convert numpy array to list if needed
    import numpy as np
    if isinstance(vector, np.ndarray):
        vector = vector.tolist()
    elif hasattr(vector, 'tolist'):
        vector = vector.tolist()
    
    if color is not None:
        return __yudimath_draw(vector, color)
    else:
        return __yudimath_draw(vector)

# Wrapper for plot() that handles keyword arguments and callables
def plot(formula, x_min=None, x_max=None, color=None):
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                if _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        if _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                for i in range(len(initial_points) - 1):
                    x1, y1_val = initial_points[i]
                    x2, y2_val = initial_points[i + 1]
                    
                    # Calculate gap size in world coordinates
                    x_diff = x2 - x1
                    
                    # Always refine between pixel samples to catch rapid changes
                    # But be more aggressive when zoomed in (higher pixels_per_unit)
                    if _pixels_per_unit > 200:
                        # Extremely zoomed in - refine ALL gaps, no matter how small
                        sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 100:
                        # Very zoomed in - refine even tiny gaps
                        if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                            sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 50:
                        # Moderately zoomed in
                        if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                    else:
                        # Normal zoom - refine if gap is significant
                        if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color)
    else:
        return __yudimath_plot(formula_to_use, x_min, x_max)
`
      // Set JS functions with prefixed names
      for (const name of functionNames) {
        pyodide.globals.set(`__yudimath_${name}`, jsFunctions[name])
      }
      // Then create Python wrappers
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Functions injected via globals.set with keyword argument support:', functionNames)
    }
  } catch (error: any) {
    console.error('[pythonFunctions] Error injecting functions into Python:', error)
    // Try fallback approach
    try {
      console.log('[pythonFunctions] Attempting fallback: direct global assignment')
      const pythonCode = `
def draw(vector, color=None):
    if color is not None:
        return __yudimath_draw(vector, color)
    else:
        return __yudimath_draw(vector)

def plot(formula, x_min=None, x_max=None, color=None, num_points=None):
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                if _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        if _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                for i in range(len(initial_points) - 1):
                    x1, y1_val = initial_points[i]
                    x2, y2_val = initial_points[i + 1]
                    
                    # Calculate gap size in world coordinates
                    x_diff = x2 - x1
                    
                    # Always refine between pixel samples to catch rapid changes
                    # But be more aggressive when zoomed in (higher pixels_per_unit)
                    if _pixels_per_unit > 200:
                        # Extremely zoomed in - refine ALL gaps, no matter how small
                        sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 100:
                        # Very zoomed in - refine even tiny gaps
                        if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                            sample_adaptive(x1, x2, y1_val, 0)
                    elif _pixels_per_unit > 50:
                        # Moderately zoomed in
                        if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                    else:
                        # Normal zoom - refine if gap is significant
                        if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                            sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return __yudimath_plot_points(points_list, x_min, x_max, color if color is not None else None, n_points)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Call the underlying JavaScript function with all arguments
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None and num_points is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color, num_points)
    elif color is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color)
    elif num_points is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, None, num_points)
    else:
        return __yudimath_plot(formula_to_use, x_min, x_max)
`
      for (const name of functionNames) {
        pyodide.globals.set(`__yudimath_${name}`, jsFunctions[name])
      }
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Fallback injection successful:', functionNames)
    } catch (fallbackError: any) {
      console.error('[pythonFunctions] Fallback injection also failed:', fallbackError)
      throw fallbackError
    }
  }
}

// Initialize default functions on module load
initializeFunctions()

