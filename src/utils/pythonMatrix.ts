import type { FunctionImplementation } from './pythonFunctionRegistry'
import { toPoint2D } from './pythonValidation'
import { showFormulaImplementation } from './pythonFormula'

/**
 * Convert a number to LaTeX string representation
 * @param num The number to format
 * @returns LaTeX string representation
 */
function formatNumberForLatex(num: number): string {
  if (Number.isInteger(num)) {
    return num.toString()
  }
  // Use toPrecision for numbers with many decimal places, otherwise toFixed
  const absNum = Math.abs(num)
  if (absNum >= 1000 || (absNum < 0.001 && absNum !== 0)) {
    return num.toExponential(2) // Scientific notation for very large/small numbers
  }
  // Max 3 decimal places, remove trailing zeros
  return num.toFixed(3).replace(/\.?0+$/, '')
}

/**
 * Convert a 2D matrix to LaTeX bmatrix string
 * @param matrix 2D array of numbers
 * @returns LaTeX string like \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}
 */
function matrixToLatex(matrix: number[][]): string {
  const rows = matrix.map(row => 
    row.map(val => formatNumberForLatex(val)).join(' & ')
  )
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`
}

/**
 * Implementation of draw_matrix(matrix, x, y, color?, size?) function
 * 
 * Sugar syntax for show_formula - converts matrix to LaTeX and calls show_formula internally.
 * Uses the same rendering pipeline as show_formula with the same defaults.
 * 
 * @param args - Arguments passed to the function: matrix (2D array), x (number), y (number), color (string, optional), size (number, optional)
 * @param frameId - The ID of the current frame
 * @param _storeVector - Callback to store a vector (unused)
 * @param _storeFunction - Callback to store a function plot (unused)
 * @param _storeParametricPlot - Callback to store a parametric plot (unused)
 * @param _storeImplicitPlot - Callback to store an implicit plot (unused)
 * @param _storeDeterminantFill - Callback to store a determinant fill (unused)
 * @param storeFormula - Callback to store a formula label (passed to show_formula)
 * @param _storeMatrix - Callback to store a matrix visualization (unused)
 * 
 * Examples:
 *   draw_matrix(np.array([[1, 2], [3, 4]]), 0, 0)
 *   draw_matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 2, 2, color='#ff0000')
 *   draw_matrix(np.eye(3), -2, -2, size=20)
 */
export const drawMatrixImplementation: FunctionImplementation = (
  args,
  frameId,
  _storeVector,
  _storeFunction,
  _storeParametricPlot,
  _storeImplicitPlot,
  _storeDeterminantFill,
  storeFormula
) => {
  if (!storeFormula) {
    throw new Error('draw_matrix() requires formula storage callback')
  }

  if (args.length < 3) {
    throw new Error('draw_matrix() requires at least 3 arguments: matrix, x, y')
  }

  const matrixArg = args[0]
  const xArg = args[1]
  const yArg = args[2]
  
  // Handle argument extraction carefully:
  // - If args[3] is null/undefined, it means color was not provided
  // - If args[3] is a string, it's the color
  // - If args[3] is a number, it might be size (if color was None and size was provided)
  // - If args[4] exists, it's size (when color was provided)
  // - If args[4] is null/undefined, size was not provided
  
  let colorArg: unknown = undefined
  let sizeArg: unknown = undefined
  
  if (args.length > 3) {
    const arg3 = args[3]
    // If arg3 is a string, it's the color
    if (typeof arg3 === 'string') {
      colorArg = arg3
      // Check if arg4 exists and is a number (size)
      if (args.length > 4 && typeof args[4] === 'number') {
        sizeArg = args[4]
      }
    }
    // If arg3 is a number and arg4 is null/undefined, arg3 is size (color was None)
    else if (typeof arg3 === 'number' && (args.length <= 4 || args[4] === null || args[4] === undefined)) {
      sizeArg = arg3
      // colorArg remains undefined
    }
    // If arg3 is null/undefined, neither was provided
    else if (arg3 !== null && arg3 !== undefined) {
      // Unexpected type, treat as color for backward compatibility
      colorArg = arg3
    }
  }
  
  // If args[4] exists and is a number, and we haven't set sizeArg yet, it's size
  if (args.length > 4 && sizeArg === undefined && typeof args[4] === 'number') {
    sizeArg = args[4]
  }

  // Validate matrix is a 2D array
  let matrix: number[][]
  
  if (Array.isArray(matrixArg)) {
    // Check if it's a 2D array
    if (matrixArg.length === 0) {
      throw new Error('draw_matrix() matrix must not be empty')
    }
    
    // Check if all rows are arrays
    const allRowsAreArrays = matrixArg.every(row => Array.isArray(row))
    if (!allRowsAreArrays) {
      throw new Error('draw_matrix() matrix must be a 2D array (list of lists)')
    }
    
    // Convert to number[][]
    matrix = matrixArg.map((row: unknown) => {
      if (!Array.isArray(row)) {
        throw new Error('draw_matrix() matrix rows must be arrays')
      }
      return row.map((val: unknown) => {
        if (typeof val === 'number') {
          return val
        } else if (typeof val === 'string') {
          const num = parseFloat(val)
          if (isNaN(num)) {
            throw new Error(`draw_matrix() matrix element must be a number, got ${val}`)
          }
          return num
        } else {
          throw new Error(`draw_matrix() matrix element must be a number, got ${typeof val}`)
        }
      })
    })
    
    // Validate all rows have the same length
    const firstRowLength = matrix[0].length
    if (firstRowLength === 0) {
      throw new Error('draw_matrix() matrix rows must not be empty')
    }
    const allRowsSameLength = matrix.every(row => row.length === firstRowLength)
    if (!allRowsSameLength) {
      throw new Error('draw_matrix() matrix must have all rows of the same length')
    }
  } else {
    // Try to convert from numpy array or other object
    // Check if it has toJs() method (Pyodide proxy)
    if (matrixArg && typeof (matrixArg as any).toJs === 'function') {
      try {
        const jsArray = (matrixArg as any).toJs()
        if (Array.isArray(jsArray)) {
          // Recursively process
          if (jsArray.length === 0) {
            throw new Error('draw_matrix() matrix must not be empty')
          }
          
          const allRowsAreArrays = jsArray.every((row: unknown) => Array.isArray(row))
          if (!allRowsAreArrays) {
            throw new Error('draw_matrix() matrix must be a 2D array')
          }
          
          matrix = jsArray.map((row: unknown[]) => {
            return row.map((val: unknown) => {
              if (typeof val === 'number') {
                return val
              } else if (typeof val === 'string') {
                const num = parseFloat(val)
                if (isNaN(num)) {
                  throw new Error(`draw_matrix() matrix element must be a number, got ${val}`)
                }
                return num
              } else {
                throw new Error(`draw_matrix() matrix element must be a number, got ${typeof val}`)
              }
            })
          })
          
          // Validate all rows have the same length
          const firstRowLength = matrix[0].length
          if (firstRowLength === 0) {
            throw new Error('draw_matrix() matrix rows must not be empty')
          }
          const allRowsSameLength = matrix.every(row => row.length === firstRowLength)
          if (!allRowsSameLength) {
            throw new Error('draw_matrix() matrix must have all rows of the same length')
          }
        } else {
          throw new Error('draw_matrix() matrix must be a 2D array')
        }
      } catch (error: any) {
        throw new Error(`draw_matrix() matrix conversion failed: ${error.message}`)
      }
    } else {
      throw new Error(`draw_matrix() matrix must be a 2D array, got ${typeof matrixArg}`)
    }
  }

  // Convert x, y to numbers
  let x: number
  let y: number
  
  // Extract x
  if (typeof xArg === 'number') {
    x = xArg
  } else if (typeof xArg === 'string') {
    x = parseFloat(xArg)
    if (isNaN(x)) {
      throw new Error(`draw_matrix() x must be a number, got ${xArg}`)
    }
  } else {
    try {
      const point = toPoint2D(xArg)
      x = point[0]
    } catch {
      throw new Error(`draw_matrix() x must be a number, got ${xArg}`)
    }
  }

  // Extract y
  if (typeof yArg === 'number') {
    y = yArg
  } else if (typeof yArg === 'string') {
    y = parseFloat(yArg)
    if (isNaN(y)) {
      throw new Error(`draw_matrix() y must be a number, got ${yArg}`)
    }
  } else {
    try {
      const point = toPoint2D(yArg)
      y = point[1]
    } catch {
      throw new Error(`draw_matrix() y must be a number, got ${yArg}`)
    }
  }

  // Convert matrix to LaTeX string
  const latexString = matrixToLatex(matrix)

  // Build arguments for show_formula: [formula, x, y, color?, size?]
  // We need to preserve the argument order: if size is provided but color is not,
  // we must pass undefined for color so that size is at the correct position
  const showFormulaArgs: unknown[] = [latexString, x, y]
  
  // If both are provided, add both
  if (colorArg !== undefined && colorArg !== null && sizeArg !== undefined && sizeArg !== null) {
    showFormulaArgs.push(colorArg)
    showFormulaArgs.push(sizeArg)
  }
  // If only color is provided, add just color
  else if (colorArg !== undefined && colorArg !== null) {
    showFormulaArgs.push(colorArg)
  }
  // If only size is provided, add undefined for color, then size
  else if (sizeArg !== undefined && sizeArg !== null) {
    showFormulaArgs.push(undefined)
    showFormulaArgs.push(sizeArg)
  }
  // If neither is provided, don't add anything

  // Call show_formula implementation with the LaTeX string
  showFormulaImplementation(
    showFormulaArgs,
    frameId,
    _storeVector,
    _storeFunction,
    _storeParametricPlot,
    _storeImplicitPlot,
    _storeDeterminantFill,
    storeFormula
  )
}

