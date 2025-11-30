import type { FormulaLabel } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { toPoint2D, validateColor } from './pythonValidation'

/**
 * Implementation of show_formula(formula, x, y, color?, size?) function
 * 
 * Renders a LaTeX formula at a specific position in the frame coordinate system.
 * The formula position is relative to the frame, and font size adjusts based on
 * both main grid zoom and frame zoom levels.
 * 
 * @param formula - LaTeX string expression - e.g., r'\frac{a}{b}', r'x^2 + y^2 = r^2'
 * @param x - X coordinate in frame coordinate system
 * @param y - Y coordinate in frame coordinate system
 * @param color - Optional color string (default: text primary color '#1f2937')
 * @param size - Optional base font size in pixels (default: 12px, will be adjusted by zoom levels)
 * 
 * Examples:
 *   show_formula(r'x^2 + y^2 = r^2', 0, 0)
 *   show_formula(r'\frac{a}{b}', 2, 2, color='#ff0000')
 *   show_formula(r'\alpha + \beta = \gamma', -2, 2, size=20)
 *   show_formula(r'\int_{0}^{1} x^2 dx = \frac{1}{3}', 0, -2, color='#00ff00', size=18)
 */
export const showFormulaImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  _storeParametricPlot,
  _storeImplicitPlot,
  _storeDeterminantFill,
  storeFormula
) => {
  if (!storeFormula) {
    throw new Error('show_formula() requires formula storage callback')
  }

  if (args.length < 3) {
    throw new Error('show_formula() requires at least 3 arguments: formula, x, y')
  }

  const formulaArg = args[0]
  const xArg = args[1]
  const yArg = args[2]
  // Handle None/null from Python - treat as undefined
  const colorArg = args.length > 3 && args[3] !== null && args[3] !== undefined ? args[3] : undefined
  const sizeArg = args.length > 4 && args[4] !== null && args[4] !== undefined ? args[4] : undefined

  // Validate formula is a string
  if (typeof formulaArg !== 'string') {
    throw new Error(`show_formula() formula must be a string, got ${typeof formulaArg}`)
  }

  // Convert x, y to numbers
  // x and y are always separate arguments (not a point)
  let x: number
  let y: number
  
  // Extract x
  if (typeof xArg === 'number') {
    x = xArg
  } else if (typeof xArg === 'string') {
    x = parseFloat(xArg)
    if (isNaN(x)) {
      throw new Error(`show_formula() x must be a number, got ${xArg}`)
    }
  } else {
    // Try to extract from array/vector (fallback)
    try {
      const point = toPoint2D(xArg)
      x = point[0]
    } catch {
      throw new Error(`show_formula() x must be a number, got ${xArg}`)
    }
  }

  // Extract y
  if (typeof yArg === 'number') {
    y = yArg
  } else if (typeof yArg === 'string') {
    y = parseFloat(yArg)
    if (isNaN(y)) {
      throw new Error(`show_formula() y must be a number, got ${yArg}`)
    }
  } else {
    // Try to extract from array/vector (fallback)
    try {
      const point = toPoint2D(yArg)
      y = point[1]
    } catch {
      throw new Error(`show_formula() y must be a number, got ${yArg}`)
    }
  }

  // Default color is white (suitable for dark backgrounds)
  const defaultColor = '#ffffff'
  const color = colorArg !== undefined && colorArg !== null ? validateColor(colorArg) : defaultColor

  // Default size is 2px (will be adjusted by zoom levels)
  let size: number | undefined
  if (sizeArg !== undefined) {
    if (typeof sizeArg === 'number') {
      size = sizeArg
    } else if (typeof sizeArg === 'string') {
      size = parseFloat(sizeArg)
      if (isNaN(size)) {
        throw new Error(`show_formula() size must be a number, got ${sizeArg}`)
      }
    } else {
      throw new Error(`show_formula() size must be a number, got ${typeof sizeArg}`)
    }
    if (size <= 0) {
      throw new Error(`show_formula() size must be positive, got ${size}`)
    }
  }

  const formulaLabel: Omit<FormulaLabel, 'id'> = {
    formula: formulaArg,
    x,
    y,
    color,
    size,
  }

  storeFormula(formulaLabel)
}

