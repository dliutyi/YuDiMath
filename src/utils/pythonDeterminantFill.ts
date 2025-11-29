import type { DeterminantFill } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { toPoint2D, validateColor } from './pythonValidation'

/**
 * Implementation of fill_determinant(vector1, vector2, color?) function
 * 
 * Fills the parallelogram formed by two vectors to visualize the geometric
 * interpretation of a 2x2 matrix determinant. The filled area represents
 * the absolute value of det([vector1 | vector2]).
 * 
 * @param vector1 - First column vector (numpy array) - e.g., np.array([2, 0])
 * @param vector2 - Second column vector (numpy array) - e.g., np.array([0, 3])
 * @param color - Optional color string (default: semi-transparent blue '#3b82f680')
 * 
 * The parallelogram is formed by:
 * - Origin (0, 0) in frame coordinates
 * - vector1 endpoint
 * - vector1 + vector2 endpoint
 * - vector2 endpoint
 * 
 * Examples:
 *   fill_determinant(np.array([1, 0]), np.array([0, 1]))  # Unit square
 *   fill_determinant(np.array([3, 0]), np.array([0, 2]), color='#ff000080')  # Rectangle
 *   fill_determinant(np.array([2, 1]), np.array([1, 2]))  # Parallelogram
 */
export const fillDeterminantImplementation: FunctionImplementation = (
  args,
  _frameId,
  _storeVector,
  _storeFunction,
  _storeParametricPlot,
  _storeImplicitPlot,
  storeDeterminantFill
) => {
  if (!storeDeterminantFill) {
    throw new Error('fill_determinant() requires determinant fill storage callback')
  }

  if (args.length < 2) {
    throw new Error('fill_determinant() requires at least 2 arguments: vector1, vector2')
  }

  const vector1Arg = args[0]
  const vector2Arg = args[1]
  const colorArg = args.length > 2 ? args[2] : undefined

  // Convert vectors to Point2D
  const vector1 = toPoint2D(vector1Arg)
  const vector2 = toPoint2D(vector2Arg)

  // Calculate determinant: det = vector1[0] * vector2[1] - vector1[1] * vector2[0]
  const determinant = vector1[0] * vector2[1] - vector1[1] * vector2[0]

  // Default color is semi-transparent blue
  const defaultColor = '#3b82f680' // Blue with ~50% opacity
  const color = colorArg ? validateColor(colorArg) : defaultColor

  // If color doesn't have alpha, add it (default to 80 = ~50% opacity)
  let finalColor = color
  if (color.length === 7) {
    // Hex color without alpha, add alpha
    finalColor = color + '80'
  }

  const determinantFill: Omit<DeterminantFill, 'id'> = {
    vector1,
    vector2,
    color: finalColor,
    determinant,
  }

  storeDeterminantFill(determinantFill)
}

