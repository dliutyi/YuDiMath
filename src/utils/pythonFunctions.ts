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
export { plotParametricImplementation } from './pythonParametricPlot'
export { plotParametricPointsImplementation } from './pythonParametricPlotPoints'
export { plotImplicitImplementation } from './pythonImplicitPlot'
export { plotImplicitPointsImplementation } from './pythonImplicitPlotPoints'
export { fillDeterminantImplementation } from './pythonDeterminantFill'
export { showFormulaImplementation } from './pythonFormula'
export { drawMatrixImplementation } from './pythonMatrix'

// Import and re-export injection (will be created separately)
import { injectFunctionsIntoPyodide } from './pythonInjection'
export { injectFunctionsIntoPyodide }

// Initialize default functions on module load
import { registerFunction } from './pythonFunctionRegistry'
import { drawImplementation } from './pythonDraw'
import { plotImplementation, plotPointsImplementation } from './pythonPlot'
import { plotParametricImplementation } from './pythonParametricPlot'
import { plotParametricPointsImplementation } from './pythonParametricPlotPoints'
import { plotImplicitImplementation } from './pythonImplicitPlot'
import { plotImplicitPointsImplementation } from './pythonImplicitPlotPoints'
import { fillDeterminantImplementation } from './pythonDeterminantFill'
import { showFormulaImplementation } from './pythonFormula'
import { drawMatrixImplementation } from './pythonMatrix'

/**
 * Initialize the predefined functions system
 * Registers default functions (draw, plot, plot_parametric, plot_implicit, fill_determinant, show_formula)
 */
export function initializeFunctions(): void {
  // Register default functions
  registerFunction('draw', drawImplementation)
  registerFunction('plot', plotImplementation)
  registerFunction('plot_points', plotPointsImplementation)
  registerFunction('plot_parametric', plotParametricImplementation)
  registerFunction('plot_parametric_points', plotParametricPointsImplementation)
  registerFunction('plot_implicit', plotImplicitImplementation)
  registerFunction('plot_implicit_points', plotImplicitPointsImplementation)
  registerFunction('fill_determinant', fillDeterminantImplementation)
  registerFunction('show_formula', showFormulaImplementation)
  registerFunction('draw_matrix', drawMatrixImplementation)
}

// Initialize default functions on module load
initializeFunctions()
