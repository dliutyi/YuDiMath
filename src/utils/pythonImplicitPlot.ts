import type { ImplicitPlot } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { validateColor, isCallable } from './pythonValidation'

/**
 * Implementation of plot_implicit(equation, x_min, x_max, y_min, y_max, color?) function
 * 
 * Plots an implicit curve where f(x, y) = 0 (e.g., x² + y² = 16 creates a circle).
 * 
 * @param equation - Function of x and y (string expression or callable)
 *   - String: e.g., 'x**2 + y**2 - 16' (circle)
 *   - Lambda: e.g., lambda x, y: x**2 + y**2 - 16
 * @param x_min - Minimum x value for search range
 * @param x_max - Maximum x value for search range
 * @param y_min - Minimum y value for search range
 * @param y_max - Maximum y value for search range
 * @param color - Optional color string (hex format, e.g., '#ff0000')
 * 
 * Examples:
 *   plot_implicit('x**2 + y**2 - 16', -10, 10, -10, 10)  # Circle
 *   plot_implicit('x**2/4 + y**2 - 1', -5, 5, -5, 5, color='#ff0000')  # Ellipse
 *   plot_implicit(lambda x, y: x**2 + y**2 - 16, -10, 10, -10, 10)  # Circle with lambda
 * 
 * For callables, the Python wrapper will attempt to extract the expression or evaluate
 * the function on a grid to find zero-crossings.
 */
export const plotImplicitImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  _storeParametricPlot,
  storeImplicitPlot,
  _storeDeterminantFill
) => {
  if (!storeImplicitPlot) {
    throw new Error('plot_implicit() requires implicit plot storage callback')
  }

  if (args.length < 5) {
    throw new Error('plot_implicit() requires at least 5 arguments: equation, x_min, x_max, y_min, y_max')
  }

  const equationArg = args[0]
  const xMinArg = args[1]
  const xMaxArg = args[2]
  const yMinArg = args[3]
  const yMaxArg = args[4]
  const colorArg = args.length > 5 ? args[5] : undefined

  // Validate equation - should be a string (Python wrapper should have converted callables)
  let equationString: string
  if (typeof equationArg === 'string') {
    equationString = equationArg
  } else if (isCallable(equationArg)) {
    // If we still receive a callable, the Python wrapper didn't convert it
    // This shouldn't happen, but handle it gracefully
    console.warn('[plotImplicitImplementation] Received callable for equation, Python wrapper should have converted it')
    const obj = equationArg as any
    if (obj.toString && typeof obj.toString === 'function') {
      try {
        equationString = obj.toString()
        // If it's just a generic function representation, we can't use it
        if (equationString.includes('<function') || equationString.includes('<lambda')) {
          throw new Error(
            'plot_implicit() callable functions must be converted to string expressions by the Python wrapper. Please use a string expression like "x**2 + y**2 - 16" instead of lambda x, y: x**2 + y**2 - 16'
          )
        }
      } catch (e: any) {
        throw new Error(
          'plot_implicit() equation callable functions cannot be automatically converted. Please use a string expression like "x**2 + y**2 - 16" instead of lambda x, y: x**2 + y**2 - 16'
        )
      }
    } else {
      throw new Error('plot_implicit() equation callable functions cannot be automatically converted. Please use a string expression instead.')
    }
  } else {
    throw new Error('plot_implicit() equation must be a string expression or callable function')
  }

  // Validate x_min, x_max, y_min, y_max
  const xMin = typeof xMinArg === 'number' ? xMinArg : parseFloat(String(xMinArg))
  const xMax = typeof xMaxArg === 'number' ? xMaxArg : parseFloat(String(xMaxArg))
  const yMin = typeof yMinArg === 'number' ? yMinArg : parseFloat(String(yMinArg))
  const yMax = typeof yMaxArg === 'number' ? yMaxArg : parseFloat(String(yMaxArg))

  if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
    throw new Error('plot_implicit() x_min, x_max, y_min, and y_max must be numbers')
  }

  if (xMin >= xMax) {
    throw new Error('plot_implicit() x_min must be less than x_max')
  }

  if (yMin >= yMax) {
    throw new Error('plot_implicit() y_min must be less than y_max')
  }

  const color = validateColor(colorArg)

  // Calculate optimal grid resolution based on range size
  // Use ~50 points per unit of range, with min 50 and max 500
  const xRange = xMax - xMin
  const yRange = yMax - yMin
  const avgRange = (xRange + yRange) / 2
  const optimalPoints = Math.max(50, Math.min(500, Math.round(avgRange * 50)))

  // Generate cache key from equation, range, and resolution
  const cacheKey = `implicit_${equationString}_${xMin}_${xMax}_${yMin}_${yMax}_${optimalPoints}`

  const implicitPlot: Omit<ImplicitPlot, 'id'> = {
    equation: equationString,
    xMin,
    xMax,
    yMin,
    yMax,
    color,
    numPoints: optimalPoints,
    cacheKey,
  }

  console.log('[plotImplicitImplementation] Storing implicit plot:', {
    equation: equationString,
    xMin,
    xMax,
    yMin,
    yMax,
    color,
    numPoints: optimalPoints,
    cacheKey,
  })

  storeImplicitPlot(implicitPlot)
}

