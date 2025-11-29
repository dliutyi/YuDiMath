import type { ParametricPlot } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { validateColor, isCallable } from './pythonValidation'

/**
 * Implementation of plot_parametric(x_func, y_func, t_min, t_max, color?) function
 * Supports both string expressions and callable functions (lambdas) for x_func and y_func
 * For callables, we store a special marker and the callable will be evaluated in Python
 */
export const plotParametricImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  storeParametricPlot
) => {
  if (!storeParametricPlot) {
    throw new Error('plot_parametric() requires parametric plot storage callback')
  }

  if (args.length < 4) {
    throw new Error('plot_parametric() requires at least 4 arguments: x_func, y_func, t_min, t_max')
  }

  const xFuncArg = args[0]
  const yFuncArg = args[1]
  const tMinArg = args[2]
  const tMaxArg = args[3]
  const colorArg = args.length > 4 ? args[4] : undefined

  // Validate x_func - should be a string (Python wrapper should have converted callables)
  let xFuncString: string
  if (typeof xFuncArg === 'string') {
    xFuncString = xFuncArg
  } else if (isCallable(xFuncArg)) {
    // If we still receive a callable, the Python wrapper didn't convert it
    // This shouldn't happen, but handle it gracefully
    console.warn('[plotParametricImplementation] Received callable for x_func, Python wrapper should have converted it')
    const obj = xFuncArg as any
    if (obj.toString && typeof obj.toString === 'function') {
      try {
        xFuncString = obj.toString()
        // If it's just a generic function representation, we can't use it
        if (xFuncString.includes('<function') || xFuncString.includes('<lambda')) {
          throw new Error(
            'plot_parametric() callable functions must be converted to string expressions by the Python wrapper. Please use a string expression like "cos(t)" instead of lambda t: np.cos(t)'
          )
        }
      } catch (e: any) {
        throw new Error(
          'plot_parametric() x_func callable functions cannot be automatically converted. Please use a string expression like "cos(t)" instead of lambda t: np.cos(t)'
        )
      }
    } else {
      throw new Error('plot_parametric() x_func callable functions cannot be automatically converted. Please use a string expression instead.')
    }
  } else {
    throw new Error('plot_parametric() x_func must be a string expression or callable function')
  }

  // Validate y_func - should be a string (Python wrapper should have converted callables)
  let yFuncString: string
  if (typeof yFuncArg === 'string') {
    yFuncString = yFuncArg
  } else if (isCallable(yFuncArg)) {
    // If we still receive a callable, the Python wrapper didn't convert it
    // This shouldn't happen, but handle it gracefully
    console.warn('[plotParametricImplementation] Received callable for y_func, Python wrapper should have converted it')
    const obj = yFuncArg as any
    if (obj.toString && typeof obj.toString === 'function') {
      try {
        yFuncString = obj.toString()
        // If it's just a generic function representation, we can't use it
        if (yFuncString.includes('<function') || yFuncString.includes('<lambda')) {
          throw new Error(
            'plot_parametric() callable functions must be converted to string expressions by the Python wrapper. Please use a string expression like "sin(t)" instead of lambda t: np.sin(t)'
          )
        }
      } catch (e: any) {
        throw new Error(
          'plot_parametric() y_func callable functions cannot be automatically converted. Please use a string expression like "sin(t)" instead of lambda t: np.sin(t)'
        )
      }
    } else {
      throw new Error('plot_parametric() y_func callable functions cannot be automatically converted. Please use a string expression instead.')
    }
  } else {
    throw new Error('plot_parametric() y_func must be a string expression or callable function')
  }

  // Validate t_min and t_max
  const tMin = typeof tMinArg === 'number' ? tMinArg : parseFloat(String(tMinArg))
  const tMax = typeof tMaxArg === 'number' ? tMaxArg : parseFloat(String(tMaxArg))

  if (isNaN(tMin) || isNaN(tMax)) {
    throw new Error('plot_parametric() t_min and t_max must be numbers')
  }

  if (tMin >= tMax) {
    throw new Error('plot_parametric() t_min must be less than t_max')
  }

  const color = validateColor(colorArg)

  // Calculate optimal number of points based on parameter range
  // Use ~75 points per unit of range, with min 200 and max 2000
  const range = tMax - tMin
  const optimalPoints = Math.max(200, Math.min(2000, Math.round(range * 75)))

  const parametricPlot: Omit<ParametricPlot, 'id'> = {
    xFunc: xFuncString,
    yFunc: yFuncString,
    tMin,
    tMax,
    color,
    numPoints: optimalPoints,
  }

  storeParametricPlot(parametricPlot)
}

