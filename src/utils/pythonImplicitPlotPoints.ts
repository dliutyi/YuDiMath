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
  storeImplicitPlot
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
  if (!Array.isArray(pointsArg)) {
    throw new Error('plot_implicit_points() points must be an array of [x, y] pairs')
  }

  const points: Array<[number, number]> = []
  for (const point of pointsArg) {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error('plot_implicit_points() each point must be an array of [x, y]')
    }
    const x = typeof point[0] === 'number' ? point[0] : parseFloat(String(point[0]))
    const y = typeof point[1] === 'number' ? point[1] : parseFloat(String(point[1]))
    if (isNaN(x) || isNaN(y)) {
      throw new Error('plot_implicit_points() point coordinates must be numbers')
    }
    points.push([x, y])
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
  }

  storeImplicitPlot(implicitPlot)
}

