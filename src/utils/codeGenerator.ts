import { CoordinateFrame } from '../types'

/**
 * Generates default Python code template for a frame
 * @param frame - The coordinate frame to generate code for
 * @returns Python code string with frame properties and examples
 */
export function generateDefaultCode(frame: CoordinateFrame): string {
  const { origin, baseI, baseJ, parameters } = frame
  
  // Generate parameter variables (t1, t2, t3, etc.)
  let parameterCode = ''
  if (parameters && Object.keys(parameters).length > 0) {
    // Sort parameter keys to ensure consistent ordering (t1, t2, t3, etc.)
    const sortedKeys = Object.keys(parameters).sort((a, b) => {
      // Extract numbers from keys (e.g., "t1" -> 1, "t2" -> 2)
      const numA = parseInt(a.replace(/\D/g, '')) || 0
      const numB = parseInt(b.replace(/\D/g, '')) || 0
      return numA - numB
    })
    
    parameterCode = sortedKeys
      .map(key => `${key} = ${parameters[key]}  # Parameter slider value`)
      .join('\n')
    
    if (parameterCode) {
      parameterCode = '\n# Parameter sliders\n' + parameterCode
    }
  }
  
  return `import math
import numpy as np
from scipy import linalg

# Coordinate frame definition
origin = np.array([${origin[0]}, ${origin[1]}])  # Frame origin in parent coordinate system
base_i = np.array([${baseI[0]}, ${baseI[1]}])  # Base i vector
base_j = np.array([${baseJ[0]}, ${baseJ[1]}])  # Base j vector

# Base vectors matrix
basis_matrix = np.column_stack([base_i, base_j])${parameterCode}

# Everything above this line can be changed by the code generator


# Predefined functions available:
# - draw(vector, color?) - Draw a vector from origin
#   Example: draw(np.array([2, 3]), color='#00ff00')
# - plot(formula, x_min, x_max, color?, num_points?) - Plot a function
#   Example: plot('2*x + 1', x_min=-5, x_max=5, color='#ff00ff')
#   Example: plot(lambda x: x**2, x_min=-5, x_max=5, color='#00ff00', num_points=1000)
# - plot_parametric(x_func, y_func, t_min, t_max, color?) - Plot a parametric curve
#   Example: plot_parametric('cos(t)', 'sin(t)', 0, 2*np.pi)  # Circle
#   Example: plot_parametric('2*cos(t)', 'sin(t)', 0, 2*np.pi, color='#ff0000')  # Ellipse
#   Example: plot_parametric('t*cos(t)', 't*sin(t)', 0, 4*np.pi)  # Spiral
#   Example: plot_parametric('sin(3*t)', 'cos(2*t)', 0, 2*np.pi)  # Lissajous curve

# Example usage:
# draw(np.array([2, 3]), color='#00ff00')
# plot('x**2', x_min=-5, x_max=5, color='#ff00ff')
# plot_parametric('cos(t)', 'sin(t)', 0, 2*np.pi, color='#0000ff')  # Circle
`
}

/**
 * Extracts user-defined imports from existing code
 * Preserves imports that are not in the generator-managed section
 * @param code - Existing Python code
 * @returns Array of import lines that should be preserved
 */
export function extractUserImports(code: string): string[] {
  const lines = code.split('\n')
  const userImports: string[] = []
  const generatorMarker = '# Everything above this line can be changed by the code generator'
  
  // Standard generator imports that should be replaced
  const generatorImports = new Set([
    'import math',
    'import numpy as np',
    'from scipy import linalg',
  ])
  
  let foundMarker = false
  let beforeMarker = true
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Check if we found the marker
    if (trimmed.includes(generatorMarker)) {
      foundMarker = true
      beforeMarker = false
      continue
    }
    
    // If marker found, everything after is user code
    if (foundMarker) {
      beforeMarker = false
    }
    
    // Extract import statements
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      // If before marker, check if it's a user-defined import (not in generator set)
      if (beforeMarker) {
        // Check if this import is not in the standard generator imports
        const isGeneratorImport = Array.from(generatorImports).some(genImp => 
          trimmed === genImp || trimmed.startsWith(genImp + ' ')
        )
        if (!isGeneratorImport) {
          userImports.push(line)
        }
      } else {
        // After marker, all imports are user-defined (but they shouldn't be there)
        // User imports should be before the marker
      }
    }
  }
  
  return userImports
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
  const generatorMarker = '# Everything above this line can be changed by the code generator'
  
  let foundMarker = false
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Check if we found the marker
    if (trimmed.includes(generatorMarker)) {
      foundMarker = true
      continue
    }
    
    // Only process lines after the marker (or if marker not found, process all)
    if (foundMarker || !code.includes(generatorMarker)) {
      // Check if line contains draw(), plot(), or plot_parametric() calls (not commented out)
      // Also exclude parameter variable assignments (t1 = ..., t2 = ..., etc.)
      if (trimmed && !trimmed.startsWith('#') && 
          !trimmed.match(/^\s*t\d+\s*=\s*-?\d+\.?\d*\s*(?:#.*)?$/i) &&
          (trimmed.includes('draw(') || trimmed.includes('plot(') || trimmed.includes('plot_parametric('))) {
        userCode.push(line)
      }
    }
  }
  
  return userCode
}

/**
 * Extracts parameter variables (t1, t2, t3, etc.) from existing code
 * @param code - Existing Python code
 * @returns Record of parameter names to values
 */
export function extractParameters(code: string): Record<string, number> {
  const parameters: Record<string, number> = {}
  const lines = code.split('\n')
  
  // Pattern to match parameter assignments: t1 = 5.0 or t1 = 5
  const parameterPattern = /^\s*(t\d+)\s*=\s*(-?\d+\.?\d*)\s*(?:#.*)?$/i
  
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    
    const match = trimmed.match(parameterPattern)
    if (match) {
      const paramName = match[1]
      const paramValue = parseFloat(match[2])
      if (!isNaN(paramValue)) {
        parameters[paramName] = paramValue
      }
    }
  }
  
  return parameters
}

/**
 * Generates Python code for a frame, preserving user-added code and parameters
 * @param frame - The coordinate frame to generate code for
 * @param existingCode - Optional existing code to preserve user additions
 * @returns Python code string with frame properties and preserved user code
 */
export function generateCode(frame: CoordinateFrame, existingCode?: string): string {
  // If existing code is provided, try to extract parameters from it
  // This preserves parameter values that might have been manually edited
  let parametersToUse = frame.parameters || {}
  if (existingCode) {
    const extractedParams = extractParameters(existingCode)
    // Merge: use frame.parameters as source of truth, but fill in any missing ones from code
    parametersToUse = { ...extractedParams, ...parametersToUse }
  }
  
  // Create a temporary frame with merged parameters for code generation
  const frameWithParams = { ...frame, parameters: parametersToUse }
  const defaultCode = generateDefaultCode(frameWithParams)
  
  // If no existing code, return default
  if (!existingCode) {
    return defaultCode
  }
  
  // Check if marker exists in existing code
  const marker = '# Everything above this line can be changed by the code generator'
  const markerIndex = existingCode.indexOf(marker)
  
  if (markerIndex >= 0) {
    // Marker found: replace everything above the marker, keep everything below
    const codeBelowMarker = existingCode.substring(markerIndex + marker.length).trim()
    // Remove leading newline if present
    const codeBelow = codeBelowMarker.startsWith('\n') ? codeBelowMarker.substring(1) : codeBelowMarker
    
    // Get the generated code above the marker
    const generatedLines = defaultCode.split('\n')
    const generatedMarkerIndex = generatedLines.findIndex(line => 
      line.includes(marker)
    )
    
    if (generatedMarkerIndex >= 0) {
      // Get everything above the marker from generated code
      const codeAboveMarker = generatedLines.slice(0, generatedMarkerIndex + 1).join('\n')
      // Combine: generated code above marker + everything below marker from existing code
      return codeAboveMarker + (codeBelow ? '\n' + codeBelow : '')
    } else {
      // Generated code doesn't have marker (shouldn't happen), fall back to default
      return defaultCode + (codeBelow ? '\n' + codeBelow : '')
    }
  } else {
    // No marker found: use old behavior for backward compatibility
    // Extract user-defined imports and user code from existing code
    const userImports = extractUserImports(existingCode)
    const userCode = extractUserCode(existingCode)
    
    // Build the final code: default code + user imports + user code
    let finalCode = defaultCode
    
    // Add user imports after the generator marker
    if (userImports.length > 0) {
      const lines = finalCode.split('\n')
      const generatedMarkerIndex = lines.findIndex(line => 
        line.includes(marker)
      )
      
      if (generatedMarkerIndex >= 0) {
        // Insert user imports after the marker
        lines.splice(generatedMarkerIndex + 1, 0, ...userImports)
        finalCode = lines.join('\n')
      } else {
        // Marker not found, append user imports at the end of imports section
        const importEndIndex = lines.findIndex(line => 
          line.trim().startsWith('# Coordinate frame definition')
        )
        if (importEndIndex >= 0) {
          lines.splice(importEndIndex, 0, ...userImports)
          finalCode = lines.join('\n')
        } else {
          // Fallback: append after imports
          finalCode = defaultCode + '\n' + userImports.join('\n')
        }
      }
    }
    
    // Append user code
    if (userCode.length > 0) {
      finalCode = finalCode + '\n' + userCode.join('\n')
    }
    
    return finalCode
  }
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

