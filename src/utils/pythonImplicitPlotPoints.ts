import type { ImplicitPlot } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { validateColor } from './pythonValidation'

/**
 * Implementation of plot_implicit_points(points, x_min, x_max, y_min, y_max, color?) function
 * Used when Python has pre-evaluated the implicit contour points (e.g., from a callable function)
 */
export const plotImplicitPointsImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  _storeParametricPlot,
  storeImplicitPlot,
  _storeDeterminantFill
) => {
  if (!storeImplicitPlot) {
    throw new Error('plot_implicit_points() requires implicit plot storage callback')
  }

  if (args.length < 5) {
    throw new Error('plot_implicit_points() requires at least 5 arguments: points, x_min, x_max, y_min, y_max')
  }

  const pointsArg = args[0]
  const xMinArg = args[1]
  const xMaxArg = args[2]
  const yMinArg = args[3]
  const yMaxArg = args[4]
  const colorArg = args.length > 5 ? args[5] : undefined

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
        throw new Error('plot_implicit_points() points must be an array or array-like object')
      }
    }
  } else {
    throw new Error('plot_implicit_points() points must be an array')
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
          throw new Error('plot_implicit_points() each point must be a [x, y] pair')
        }
      }
    } else {
      throw new Error('plot_implicit_points() each point must be a [x, y] pair')
    }

    if (!Array.isArray(pointArray) || pointArray.length !== 2) {
      throw new Error('plot_implicit_points() each point must be a [x, y] pair')
    }
    const x = typeof pointArray[0] === 'number' ? pointArray[0] : parseFloat(String(pointArray[0]))
    const y = typeof pointArray[1] === 'number' ? pointArray[1] : parseFloat(String(pointArray[1]))
    if (isNaN(x) || isNaN(y)) {
      continue // Skip invalid points
    }
    points.push([x, y])
  }

  if (points.length === 0) {
    throw new Error('plot_implicit_points() must have at least one valid point')
  }

  // Validate x_min, x_max, y_min, y_max
  const xMin = typeof xMinArg === 'number' ? xMinArg : parseFloat(String(xMinArg))
  const xMax = typeof xMaxArg === 'number' ? xMaxArg : parseFloat(String(xMaxArg))
  const yMin = typeof yMinArg === 'number' ? yMinArg : parseFloat(String(yMinArg))
  const yMax = typeof yMaxArg === 'number' ? yMaxArg : parseFloat(String(yMaxArg))

  if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
    throw new Error('plot_implicit_points() x_min, x_max, y_min, and y_max must be numbers')
  }

  if (xMin >= xMax) {
    throw new Error('plot_implicit_points() x_min must be less than x_max')
  }

  if (yMin >= yMax) {
    throw new Error('plot_implicit_points() y_min must be less than y_max')
  }

  const color = validateColor(colorArg)

  const implicitPlot: Omit<ImplicitPlot, 'id'> = {
    equation: '', // Empty equation since we have pre-computed points
    xMin,
    xMax,
    yMin,
    yMax,
    color,
    points, // Store points directly
    numPoints: points.length,
    // Generate cache key from range and point count
    cacheKey: `implicit_points_${xMin}_${xMax}_${yMin}_${yMax}_${points.length}`,
  }

  storeImplicitPlot(implicitPlot)
}

