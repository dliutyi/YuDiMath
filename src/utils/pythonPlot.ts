import type { FunctionPlot } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { validateColor, isCallable } from './pythonValidation'

/**
 * Implementation of plot(formula, x_min, x_max, color?) function
 * Supports both string expressions and callable functions (lambdas)
 * For callables, we store a special marker and the callable will be evaluated in Python
 */
export const plotImplementation: FunctionImplementation = (args, _frameId, _storeVector, storeFunction, _storeParametricPlot, _storeImplicitPlot, _storeDeterminantFill) => {
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
export const plotPointsImplementation: FunctionImplementation = (args, _frameId, _storeVector, storeFunction, _storeParametricPlot, _storeImplicitPlot, _storeDeterminantFill) => {
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

