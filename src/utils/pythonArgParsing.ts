/**
 * Parse Python function arguments that may include keyword arguments
 * Pyodide passes keyword arguments as objects with special markers
 * This function separates positional and keyword arguments
 */
export function parsePythonArgs(rawArgs: unknown[]): { positional: unknown[]; keywords: Record<string, unknown> } {
  const positional: unknown[] = []
  const keywords: Record<string, unknown> = {}
  
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    
    // Check if this is a keyword arguments object (dict-like)
    // But exclude numpy arrays, callables, and other array-like objects
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      const obj = arg as any
      
      // Skip if it's a numpy array (has toJs, tolist, or length property with numeric value)
      // Also check for callable objects (functions, lambdas)
      const isNumpyArray = typeof obj.toJs === 'function' || typeof obj.tolist === 'function' || 
          (typeof obj.length === 'number' && obj.length >= 0 && obj.length <= 1000)
      const isCallableObj = typeof obj === 'function' || (obj && typeof obj.__call__ === 'function')
      
      if (isNumpyArray || isCallableObj) {
        positional.push(arg)
        continue
      }
      
      // Check if it's a Pyodide dict or regular object with string keys
      const keys = Object.keys(arg)
      // If all keys are strings and it's not an array-like object, treat as kwargs
      // Also check that it's not a function or callable
      if (keys.length > 0 && keys.every(k => typeof k === 'string') && typeof obj !== 'function') {
        // Additional check: make sure it's not a numpy array disguised as an object
        // Numpy arrays might have string keys but also have numeric indexing
        const hasNumericIndices = keys.some(k => !isNaN(Number(k)))
        if (!hasNumericIndices) {
          // Merge keywords into the keywords object
          Object.assign(keywords, arg)
          continue
        }
      }
    }
    
    // Otherwise, treat as positional argument
    positional.push(arg)
  }
  
  return { positional, keywords }
}

