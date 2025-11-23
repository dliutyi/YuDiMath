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
  const numPointsArg = args.length > 4 ? args[4] : undefined
  
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
  
  // Validate numPoints if provided
  let numPoints: number | undefined = undefined
  if (numPointsArg !== undefined) {
    numPoints = typeof numPointsArg === 'number' ? numPointsArg : parseInt(String(numPointsArg), 10)
    if (isNaN(numPoints) || numPoints < 2 || !Number.isInteger(numPoints)) {
      throw new Error('plot() num_points must be an integer >= 2')
    }
  }
  
  const functionPlot: Omit<FunctionPlot, 'id'> = {
    expression: formulaString,
    xMin,
    xMax,
    color,
    numPoints: numPoints ?? 1000, // Default to 1000 points
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
  const numPointsArg = args.length > 4 ? args[4] : undefined
  
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
  
  // Validate numPoints if provided
  let numPoints: number | undefined = undefined
  if (numPointsArg !== undefined) {
    numPoints = typeof numPointsArg === 'number' ? numPointsArg : parseInt(String(numPointsArg), 10)
    if (isNaN(numPoints) || numPoints < 2 || !Number.isInteger(numPoints)) {
      throw new Error('plot_points() num_points must be an integer >= 2')
    }
  }
  
  const functionPlot: Omit<FunctionPlot, 'id'> = {
    points, // Store points directly
    xMin,
    xMax,
    color,
    numPoints: numPoints ?? points.length, // Use actual number of points if not specified
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
 */
export function setupFunctionContext(
  frameId: string,
  onVectorCreated: (vector: Omit<Vector, 'id'>) => void,
  onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void
): void {
  currentFrameId = frameId
  storeVectorFn = onVectorCreated
  storeFunctionFn = onFunctionCreated
  capturedCalls = []
}

/**
 * Clear function execution context
 */
export function clearFunctionContext(): void {
  currentFrameId = null
  storeVectorFn = null
  storeFunctionFn = null
  capturedCalls = []
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
      // plot(formula, x_min, x_max, color?, num_points?)
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
      // Add num_points if provided as keyword and is valid
      if ('num_points' in keywords && keywords.num_points !== undefined) {
        args.push(keywords.num_points)
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
      
      // Create Python wrapper functions that handle keyword arguments properly
      // These wrappers convert keyword arguments to positional arguments for the JS functions
      // For plot(), we also handle callables by extracting their expression
      const pythonCode = `
# Inject predefined functions into global scope
import __yudimath_functions as _yudimath
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
        return _yudimath.draw(vector, color)
    else:
        return _yudimath.draw(vector)

# Wrapper for plot() that handles keyword arguments and callables
def plot(formula, x_min=None, x_max=None, color=None, num_points=None):
    # Handle both positional and keyword arguments
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
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
                    formula = expr
                    print(f"[plot wrapper] Extracted expression: {repr(formula)}")
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            try:
                # Use num_points if provided, otherwise default to 1000
                n_points = int(num_points) if num_points is not None else 1000
                if n_points < 2:
                    n_points = 1000
                
                # Sample the function at many points in the range
                x_samples = np.linspace(x_min, x_max, n_points)
                # Evaluate function at each point, handling errors gracefully
                points = []
                for x in x_samples:
                    try:
                        y = float(formula(x))
                        # Only include finite values (skip NaN, Infinity, -Infinity)
                        if np.isfinite(y):
                            points.append([float(x), y])
                    except (ZeroDivisionError, ValueError, OverflowError, TypeError):
                        # Skip points where function is undefined or causes errors
                        # This handles cases like 1/x at x=0, sqrt(x) at x<0, etc.
                        continue
                    except Exception as e:
                        # Log unexpected errors but continue
                        print(f"[plot wrapper] Warning: Error evaluating function at x={x}: {e}")
                        continue
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None, n_points)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Call the underlying JavaScript function with all arguments
    if color is not None and num_points is not None:
        return _yudimath.plot(formula, x_min, x_max, color, num_points)
    elif color is not None:
        return _yudimath.plot(formula, x_min, x_max, color)
    elif num_points is not None:
        return _yudimath.plot(formula, x_min, x_max, None, num_points)
    else:
        return _yudimath.plot(formula, x_min, x_max)
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
def plot(formula, x_min=None, x_max=None, color=None, num_points=None):
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
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
                    formula = expr
                    print(f"[plot wrapper] Extracted expression: {repr(formula)}")
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            try:
                # Use num_points if provided, otherwise default to 1000
                n_points = int(num_points) if num_points is not None else 1000
                if n_points < 2:
                    n_points = 1000
                
                # Sample the function at many points in the range
                x_samples = np.linspace(x_min, x_max, n_points)
                # Evaluate function at each point, handling errors gracefully
                points = []
                for x in x_samples:
                    try:
                        y = float(formula(x))
                        # Only include finite values (skip NaN, Infinity, -Infinity)
                        if np.isfinite(y):
                            points.append([float(x), y])
                    except (ZeroDivisionError, ValueError, OverflowError, TypeError):
                        # Skip points where function is undefined or causes errors
                        # This handles cases like 1/x at x=0, sqrt(x) at x<0, etc.
                        continue
                    except Exception as e:
                        # Log unexpected errors but continue
                        print(f"[plot wrapper] Warning: Error evaluating function at x={x}: {e}")
                        continue
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None, n_points)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    if color is not None:
        return __yudimath_plot(formula, x_min, x_max, color)
    else:
        return __yudimath_plot(formula, x_min, x_max)
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
    
    # Call the underlying JavaScript function with all arguments
    # Handle all combinations of color and num_points
    if color is not None and num_points is not None:
        return __yudimath_plot(formula, x_min, x_max, color, num_points)
    elif color is not None:
        return __yudimath_plot(formula, x_min, x_max, color)
    elif num_points is not None:
        return __yudimath_plot(formula, x_min, x_max, None, num_points)
    else:
        return __yudimath_plot(formula, x_min, x_max)
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

