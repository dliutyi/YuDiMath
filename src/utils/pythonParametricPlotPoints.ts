import type { ParametricPlot } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { validateColor } from './pythonValidation'

/**
 * Implementation of plot_parametric_points(points, t_min, t_max, color?) function
 * Used for callable functions that are evaluated in Python
 * Points are already evaluated as [[x1, y1], [x2, y2], ...]
 */
export const plotParametricPointsImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  storeParametricPlot
) => {
  if (!storeParametricPlot) {
    throw new Error('plot_parametric_points() requires parametric plot storage callback')
  }

  if (args.length < 3) {
    throw new Error('plot_parametric_points() requires at least 3 arguments: points, t_min, t_max')
  }

  const pointsArg = args[0]
  const tMinArg = args[1]
  const tMaxArg = args[2]
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
        throw new Error('plot_parametric_points() points must be an array or array-like object')
      }
    }
  } else {
    throw new Error('plot_parametric_points() points must be an array')
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
          throw new Error('plot_parametric_points() each point must be a [x, y] pair')
        }
      }
    } else {
      throw new Error('plot_parametric_points() each point must be a [x, y] pair')
    }

    if (!Array.isArray(pointArray) || pointArray.length !== 2) {
      throw new Error('plot_parametric_points() each point must be a [x, y] pair')
    }
    const x = typeof pointArray[0] === 'number' ? pointArray[0] : parseFloat(String(pointArray[0]))
    const y = typeof pointArray[1] === 'number' ? pointArray[1] : parseFloat(String(pointArray[1]))
    if (isNaN(x) || isNaN(y)) {
      continue // Skip invalid points
    }
    points.push([x, y])
  }

  if (points.length === 0) {
    throw new Error('plot_parametric_points() must have at least one valid point')
  }

  // Validate t_min and t_max
  const tMin = typeof tMinArg === 'number' ? tMinArg : parseFloat(String(tMinArg))
  const tMax = typeof tMaxArg === 'number' ? tMaxArg : parseFloat(String(tMaxArg))

  if (isNaN(tMin) || isNaN(tMax)) {
    throw new Error('plot_parametric_points() t_min and t_max must be numbers')
  }

  if (tMin >= tMax) {
    throw new Error('plot_parametric_points() t_min must be less than t_max')
  }

  const color = validateColor(colorArg)

  const parametricPlot: Omit<ParametricPlot, 'id'> = {
    xFunc: '', // Empty for pre-evaluated points
    yFunc: '', // Empty for pre-evaluated points
    tMin,
    tMax,
    color,
    points, // Store points directly
    numPoints: points.length, // Use actual number of points
  }

  console.log('[plotParametricPointsImplementation] Storing parametric plot with', points.length, 'points')
  storeParametricPlot(parametricPlot)
}

