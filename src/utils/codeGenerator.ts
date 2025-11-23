import { CoordinateFrame } from '../types'

/**
 * Generates default Python code template for a frame
 * @param frame - The coordinate frame to generate code for
 * @returns Python code string with frame properties and examples
 */
export function generateDefaultCode(frame: CoordinateFrame): string {
  const { origin, baseI, baseJ } = frame
  
  return `import numpy as np
from scipy import linalg

# Coordinate frame definition
origin = np.array([${origin[0]}, ${origin[1]}])  # Frame origin in parent coordinate system
base_i = np.array([${baseI[0]}, ${baseI[1]}])  # Base i vector
base_j = np.array([${baseJ[0]}, ${baseJ[1]}])  # Base j vector

# Base vectors matrix
basis_matrix = np.column_stack([base_i, base_j])

# Predefined functions available:
# - draw(vector, color?) - Draw a vector from origin
#   Example: draw(np.array([2, 3]), color='#00ff00')
# - plot(formula, x_min, x_max, color?, num_points?) - Plot a function
#   Example: plot('2*x + 1', x_min=-5, x_max=5, color='#ff00ff')
#   Example: plot(lambda x: x**2, x_min=-5, x_max=5, color='#00ff00', num_points=1000)

# Example usage:
# draw(np.array([2, 3]), color='#00ff00')
# plot('x**2', x_min=-5, x_max=5, color='#ff00ff')
`
}

/**
 * Extracts user-added code (draw/plot calls) from existing code
 * This preserves user code when regenerating the template
 * @param code - Existing Python code
 * @returns Array of lines that contain draw() or plot() calls
 */
export function extractUserCode(code: string): string[] {
  const lines = code.split('\n')
  const userCode: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    // Check if line contains draw() or plot() calls (not commented out)
    if (trimmed && !trimmed.startsWith('#') && 
        (trimmed.includes('draw(') || trimmed.includes('plot('))) {
      userCode.push(line)
    }
  }
  
  return userCode
}

/**
 * Generates Python code for a frame, preserving user-added code
 * @param frame - The coordinate frame to generate code for
 * @param existingCode - Optional existing code to preserve user additions
 * @returns Python code string with frame properties and preserved user code
 */
export function generateCode(frame: CoordinateFrame, existingCode?: string): string {
  // Generate the default template
  const defaultCode = generateDefaultCode(frame)
  
  // If no existing code, return default
  if (!existingCode) {
    return defaultCode
  }
  
  // Extract user-added code from existing code
  const userCode = extractUserCode(existingCode)
  
  // If no user code found, return default
  if (userCode.length === 0) {
    return defaultCode
  }
  
  // Append user code to the default template
  return defaultCode + '\n' + userCode.join('\n')
}

/**
 * Checks if code needs to be regenerated based on frame property changes
 * @param frame - The current frame
 * @param existingCode - The existing code
 * @returns true if code should be regenerated
 */
export function shouldRegenerateCode(frame: CoordinateFrame, existingCode: string): boolean {
  // Check if code contains the expected template structure
  const hasOrigin = existingCode.includes('origin = np.array([')
  const hasBaseI = existingCode.includes('base_i = np.array([')
  const hasBaseJ = existingCode.includes('base_j = np.array([')
  
  // If template structure is missing, regenerate
  if (!hasOrigin || !hasBaseI || !hasBaseJ) {
    return true
  }
  
  // Extract current values from code
  const originMatch = existingCode.match(/origin = np\.array\(\[([^\]]+)\]/)
  const baseIMatch = existingCode.match(/base_i = np\.array\(\[([^\]]+)\]/)
  const baseJMatch = existingCode.match(/base_j = np\.array\(\[([^\]]+)\]/)
  
  if (!originMatch || !baseIMatch || !baseJMatch) {
    return true
  }
  
  // Parse values from code
  const codeOrigin = originMatch[1].split(',').map(v => parseFloat(v.trim()))
  const codeBaseI = baseIMatch[1].split(',').map(v => parseFloat(v.trim()))
  const codeBaseJ = baseJMatch[1].split(',').map(v => parseFloat(v.trim()))
  
  // Check if values match frame properties (with small tolerance for floating point)
  const tolerance = 1e-6
  const originMatches = Math.abs(codeOrigin[0] - frame.origin[0]) < tolerance &&
                        Math.abs(codeOrigin[1] - frame.origin[1]) < tolerance
  const baseIMatches = Math.abs(codeBaseI[0] - frame.baseI[0]) < tolerance &&
                       Math.abs(codeBaseI[1] - frame.baseI[1]) < tolerance
  const baseJMatches = Math.abs(codeBaseJ[0] - frame.baseJ[0]) < tolerance &&
                       Math.abs(codeBaseJ[1] - frame.baseJ[1]) < tolerance
  
  // Regenerate if any property doesn't match
  return !(originMatches && baseIMatches && baseJMatches)
}

