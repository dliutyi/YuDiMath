import type { Point2D } from '../types'

/**
 * Validate and convert a numpy array or list to Point2D
 */
export function toPoint2D(value: unknown): Point2D {
  console.log('[toPoint2D] Input:', value, 'type:', typeof value, 'isArray:', Array.isArray(value))
  
  // Handle regular JavaScript arrays
  if (Array.isArray(value)) {
    if (value.length !== 2) {
      throw new Error(`Vector must have exactly 2 components, got ${value.length}`)
    }
    if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      console.log('[toPoint2D] Returning array:', [value[0], value[1]])
      return [value[0], value[1]]
    }
    if (value.length === 2) {
      // Try to parse as numbers
      const x = typeof value[0] === 'number' ? value[0] : parseFloat(String(value[0]))
      const y = typeof value[1] === 'number' ? value[1] : parseFloat(String(value[1]))
      if (!isNaN(x) && !isNaN(y)) {
        console.log('[toPoint2D] Returning parsed array:', [x, y])
        return [x, y]
      }
    }
  }
  
  // Handle numpy arrays from Pyodide
  // Pyodide numpy arrays have a toJs() method that converts to JavaScript array
  if (value && typeof value === 'object') {
    const obj = value as any
    console.log('[toPoint2D] Object properties:', Object.keys(obj), 'has toJs:', typeof obj.toJs === 'function', 'has tolist:', typeof obj.tolist === 'function', 'length:', obj.length)
    
    // Try toJs() first (Pyodide's recommended way)
    if (typeof obj.toJs === 'function') {
      try {
        console.log('[toPoint2D] Trying toJs()...')
        const jsArray = obj.toJs()
        console.log('[toPoint2D] toJs() result:', jsArray, 'type:', typeof jsArray, 'isArray:', Array.isArray(jsArray))
        if (Array.isArray(jsArray) && jsArray.length === 2) {
          const x = typeof jsArray[0] === 'number' ? jsArray[0] : parseFloat(String(jsArray[0]))
          const y = typeof jsArray[1] === 'number' ? jsArray[1] : parseFloat(String(jsArray[1]))
          if (!isNaN(x) && !isNaN(y)) {
            console.log('[toPoint2D] Returning from toJs():', [x, y])
            return [x, y]
          }
        }
      } catch (e) {
        console.error('[toPoint2D] toJs() error:', e)
      }
    }
    
    // Try tolist() as fallback
    if (typeof obj.tolist === 'function') {
      try {
        console.log('[toPoint2D] Trying tolist()...')
        const list = obj.tolist()
        console.log('[toPoint2D] tolist() result:', list, 'type:', typeof list, 'isArray:', Array.isArray(list))
        if (Array.isArray(list) && list.length === 2) {
          const x = typeof list[0] === 'number' ? list[0] : parseFloat(String(list[0]))
          const y = typeof list[1] === 'number' ? list[1] : parseFloat(String(list[1]))
          if (!isNaN(x) && !isNaN(y)) {
            console.log('[toPoint2D] Returning from tolist():', [x, y])
            return [x, y]
          }
        }
      } catch (e) {
        console.error('[toPoint2D] tolist() error:', e)
      }
    }
    
    // Try to access as array-like (has length and numeric indices)
    if (typeof obj.length === 'number' && obj.length === 2) {
      try {
        const x = typeof obj[0] === 'number' ? obj[0] : parseFloat(String(obj[0]))
        const y = typeof obj[1] === 'number' ? obj[1] : parseFloat(String(obj[1]))
        if (!isNaN(x) && !isNaN(y)) {
          console.log('[toPoint2D] Returning from array-like access:', [x, y])
          return [x, y]
        }
      } catch (e) {
        console.error('[toPoint2D] Array-like access error:', e)
      }
    }
    
    // Try iterator protocol (for Pyodide arrays)
    if (typeof obj[Symbol.iterator] === 'function') {
      try {
        console.log('[toPoint2D] Trying iterator...')
        const iterator = obj[Symbol.iterator]()
        const first = iterator.next()
        const second = iterator.next()
        if (!first.done && !second.done) {
          const x = typeof first.value === 'number' ? first.value : parseFloat(String(first.value))
          const y = typeof second.value === 'number' ? second.value : parseFloat(String(second.value))
          if (!isNaN(x) && !isNaN(y)) {
            console.log('[toPoint2D] Returning from iterator:', [x, y])
            return [x, y]
          }
        }
      } catch (e) {
        console.error('[toPoint2D] Iterator error:', e)
      }
    }
  }
  
  throw new Error(`Cannot convert value to Point2D: ${value}`)
}

/**
 * Validate and convert a color value to a hex color string
 */
export function validateColor(color: unknown): string {
  if (color === undefined || color === null) {
    return '#3b82f6' // Default blue color
  }
  
  if (typeof color === 'string') {
    // Check if it's a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return color
    }
    // Try to parse as hex (add # if missing)
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
      return `#${color}`
    }
  }
  
  // If color is not valid, use default
  console.warn(`Invalid color value: ${color}, using default color`)
  return '#3b82f6'
}

/**
 * Check if an object is a Python callable (lambda/function)
 */
export function isCallable(value: unknown): boolean {
  if (typeof value === 'function') {
    return true
  }
  if (value && typeof value === 'object') {
    const obj = value as any
    // Pyodide callables have __call__ method
    return typeof obj.__call__ === 'function'
  }
  return false
}

