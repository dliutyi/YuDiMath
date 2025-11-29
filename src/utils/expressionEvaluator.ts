/**
 * Simple expression evaluator for basic math expressions
 * Supports: x, numbers, +, -, *, /, **, parentheses, and common functions
 * This is a simplified evaluator - for complex expressions, consider using a proper parser
 */
export function evaluateExpression(expression: string, x: number): number {
  // Replace 'x' with the actual value
  let expr = expression.replace(/x/g, `(${x})`)
  
  // Handle common math functions
  expr = expr.replace(/sin\(/g, 'Math.sin(')
  expr = expr.replace(/cos\(/g, 'Math.cos(')
  expr = expr.replace(/tan\(/g, 'Math.tan(')
  expr = expr.replace(/exp\(/g, 'Math.exp(')
  expr = expr.replace(/log\(/g, 'Math.log(')
  expr = expr.replace(/sqrt\(/g, 'Math.sqrt(')
  expr = expr.replace(/abs\(/g, 'Math.abs(')
  expr = expr.replace(/\*\*/g, '**') // Python's ** is same as JS
  
  // Evaluate using Function constructor (safe for our use case)
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + expr)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result
    }
    throw new Error('Invalid result')
  } catch (e) {
    throw new Error(`Failed to evaluate expression: ${expression}`)
  }
}

/**
 * Evaluate a parametric expression (function of parameter t)
 * Similar to evaluateExpression but uses 't' instead of 'x'
 */
export function evaluateParametricExpression(expression: string, t: number): number {
  // Replace 't' with the actual value
  let expr = expression.replace(/\bt\b/g, `(${t})`)
  
  // Handle common math functions
  expr = expr.replace(/sin\(/g, 'Math.sin(')
  expr = expr.replace(/cos\(/g, 'Math.cos(')
  expr = expr.replace(/tan\(/g, 'Math.tan(')
  expr = expr.replace(/exp\(/g, 'Math.exp(')
  expr = expr.replace(/log\(/g, 'Math.log(')
  expr = expr.replace(/sqrt\(/g, 'Math.sqrt(')
  expr = expr.replace(/abs\(/g, 'Math.abs(')
  expr = expr.replace(/\*\*/g, '**') // Python's ** is same as JS
  
  // Evaluate using Function constructor (safe for our use case)
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + expr)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result
    }
    throw new Error('Invalid result')
  } catch (e) {
    throw new Error(`Failed to evaluate parametric expression: ${expression}`)
  }
}

