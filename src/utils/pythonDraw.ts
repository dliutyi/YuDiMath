import type { Vector } from '../types'
import type { FunctionImplementation } from './pythonFunctionRegistry'
import { toPoint2D, validateColor } from './pythonValidation'

/**
 * Implementation of draw(vector, color?) function
 */
export const drawImplementation: FunctionImplementation = (args, _frameId, storeVector, _storeFunction) => {
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

