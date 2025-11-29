// Export types
export type PythonFunctionCallback = (...args: unknown[]) => void

// Re-export types
export type { FunctionImplementation } from './pythonFunctionRegistry'

// Re-export from function registry
export {
  registerFunction,
  getRegisteredFunctionNames,
  getFunctionImplementation,
  isFunctionRegistered,
} from './pythonFunctionRegistry'

// Re-export from context management
export {
  setupFunctionContext,
  clearFunctionContext,
  getCapturedCalls,
  createPythonFunctionWrapper,
  updateCanvasInfoInPyodide,
} from './pythonContext'

// Re-export validation utilities
export { toPoint2D, validateColor, isCallable } from './pythonValidation'

// Re-export argument parsing
export { parsePythonArgs } from './pythonArgParsing'

// Re-export implementations
export { drawImplementation } from './pythonDraw'
export { plotImplementation, plotPointsImplementation } from './pythonPlot'

// Import and re-export injection (will be created separately)
import { injectFunctionsIntoPyodide } from './pythonInjection'
export { injectFunctionsIntoPyodide }

// Initialize default functions on module load
import { registerFunction } from './pythonFunctionRegistry'
import { drawImplementation } from './pythonDraw'
import { plotImplementation, plotPointsImplementation } from './pythonPlot'

/**
 * Initialize the predefined functions system
 * Registers default functions (draw, plot)
 */
export function initializeFunctions(): void {
  // Register default functions
  registerFunction('draw', drawImplementation)
  registerFunction('plot', plotImplementation)
  registerFunction('plot_points', plotPointsImplementation)
}

// Initialize default functions on module load
initializeFunctions()
