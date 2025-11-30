import type { Vector, FunctionPlot, ParametricPlot, ImplicitPlot, DeterminantFill, FormulaLabel } from '../types'

/**
 * Function implementation that processes arguments and stores results
 */
export type FunctionImplementation = (
  args: unknown[],
  frameId: string,
  storeVector: (vector: Omit<Vector, 'id'>) => void,
  storeFunction: (func: Omit<FunctionPlot, 'id'>) => void,
  storeParametricPlot?: (plot: Omit<ParametricPlot, 'id'>) => void,
  storeImplicitPlot?: (plot: Omit<ImplicitPlot, 'id'>) => void,
  storeDeterminantFill?: (fill: Omit<DeterminantFill, 'id'>) => void,
  storeFormula?: (formula: Omit<FormulaLabel, 'id'>) => void
) => void

/**
 * Function registry - maps function names to their implementations
 */
const functionRegistry = new Map<string, FunctionImplementation>()

/**
 * Register a new predefined function
 * @param name Function name (e.g., 'draw', 'plot')
 * @param implementation Function implementation
 */
export function registerFunction(name: string, implementation: FunctionImplementation): void {
  if (functionRegistry.has(name)) {
    console.warn(`[pythonFunctions] Function '${name}' is already registered. Overwriting.`)
  }
  functionRegistry.set(name, implementation)
}

/**
 * Get all registered function names
 */
export function getRegisteredFunctionNames(): string[] {
  return Array.from(functionRegistry.keys())
}

/**
 * Get a registered function implementation
 */
export function getFunctionImplementation(name: string): FunctionImplementation | undefined {
  return functionRegistry.get(name)
}

/**
 * Check if a function is registered
 */
export function isFunctionRegistered(name: string): boolean {
  return functionRegistry.has(name)
}

