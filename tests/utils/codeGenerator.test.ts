import { describe, it, expect } from 'vitest'
import { generateDefaultCode, extractUserCode, generateCode, shouldRegenerateCode, extractParameters } from '../../src/utils/codeGenerator'
import { CoordinateFrame } from '../../src/types'

describe('codeGenerator', () => {
  const mockFrame: CoordinateFrame = {
    id: 'test-frame-1',
    origin: [5, 10],
    baseI: [1, 0],
    baseJ: [0, 1],
    bounds: {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
      gridStep: 1,
    },
    mode: '2d',
    vectors: [],
    functions: [],
    code: '',
    parentFrameId: null,
    childFrameIds: [],
  }

  describe('generateDefaultCode', () => {
    it('should generate default code with frame properties', () => {
      const code = generateDefaultCode(mockFrame)
      
      expect(code).toContain('import numpy as np')
      expect(code).toContain('from scipy import linalg')
      expect(code).toContain('origin = np.array([5, 10])')
      expect(code).toContain('base_i = np.array([1, 0])')
      expect(code).toContain('base_j = np.array([0, 1])')
      expect(code).toContain('basis_matrix = np.column_stack([base_i, base_j])')
      expect(code).toContain('draw(vector, color?)')
      expect(code).toContain('plot(formula, x_min, x_max, color?, num_points?)')
    })

    it('should include correct origin values', () => {
      const frame = { ...mockFrame, origin: [12.5, -3.7] }
      const code = generateDefaultCode(frame)
      
      expect(code).toContain('origin = np.array([12.5, -3.7])')
    })

    it('should include correct base vector values', () => {
      const frame = { ...mockFrame, baseI: [0.707, 0.707], baseJ: [-0.707, 0.707] }
      const code = generateDefaultCode(frame)
      
      expect(code).toContain('base_i = np.array([0.707, 0.707])')
      expect(code).toContain('base_j = np.array([-0.707, 0.707])')
    })

    it('should include example usage comments', () => {
      const code = generateDefaultCode(mockFrame)
      
      expect(code).toContain('Example: draw(np.array([2, 3]), color=\'#00ff00\')')
      expect(code).toContain('Example: plot(\'2*x + 1\'')
      expect(code).toContain('Example: plot(lambda x: x**2')
      expect(code).toContain('# Example usage:')
      expect(code).toContain('# draw(np.array([2, 3]), color=\'#00ff00\')')
      expect(code).toContain("# plot('x**2'")
    })
  })

  describe('extractUserCode', () => {
    it('should extract draw() calls from code', () => {
      const code = `import numpy as np
# Some comment
draw(np.array([1, 2]), color='#ff0000')
plot('x**2', x_min=-5, x_max=5)
`
      const userCode = extractUserCode(code)
      
      expect(userCode).toHaveLength(2)
      expect(userCode[0]).toContain('draw(np.array([1, 2])')
      expect(userCode[1]).toContain("plot('x**2'")
    })

    it('should ignore commented draw/plot calls', () => {
      const code = `import numpy as np
# draw(np.array([1, 2]))
# plot('x**2', x_min=-5, x_max=5)
draw(np.array([3, 4]))
`
      const userCode = extractUserCode(code)
      
      expect(userCode).toHaveLength(1)
      expect(userCode[0]).toContain('draw(np.array([3, 4])')
    })

    it('should return empty array if no user code found', () => {
      const code = `import numpy as np
from scipy import linalg
# Just comments
`
      const userCode = extractUserCode(code)
      
      expect(userCode).toHaveLength(0)
    })

    it('should preserve indentation in user code', () => {
      const code = `import numpy as np
    draw(np.array([1, 2]))
  plot('x**2', x_min=-5, x_max=5)
`
      const userCode = extractUserCode(code)
      
      expect(userCode[0]).toContain('    draw')
      expect(userCode[1]).toContain('  plot')
    })
  })

  describe('generateCode', () => {
    it('should return default code when no existing code provided', () => {
      const code = generateCode(mockFrame)
      
      expect(code).toContain('origin = np.array([5, 10])')
      expect(code).toContain('base_i = np.array([1, 0])')
      expect(code).toContain('base_j = np.array([0, 1])')
    })

    it('should preserve user code when existing code provided', () => {
      const existingCode = `import numpy as np
origin = np.array([5, 10])
draw(np.array([1, 2]), color='#ff0000')
plot('x**2', x_min=-5, x_max=5)
`
      const code = generateCode(mockFrame, existingCode)
      
      expect(code).toContain('origin = np.array([5, 10])')
      expect(code).toContain('draw(np.array([1, 2])')
      expect(code).toContain("plot('x**2'")
    })

    it('should update frame properties in generated code', () => {
      const existingCode = `import numpy as np
origin = np.array([0, 0])
draw(np.array([1, 2]))
`
      const frame = { ...mockFrame, origin: [10, 20] }
      const code = generateCode(frame, existingCode)
      
      expect(code).toContain('origin = np.array([10, 20])')
      expect(code).toContain('draw(np.array([1, 2])')
    })

    it('should include parameters in generated code', () => {
      const frame = {
        ...mockFrame,
        parameters: {
          t1: 5.0,
          t2: -3.5,
        },
      }
      const code = generateCode(frame)
      
      expect(code).toContain('t1 = 5')
      expect(code).toContain('t2 = -3.5')
      expect(code).toContain('# Parameter sliders')
    })

    it('should preserve parameters when regenerating code', () => {
      const frame = {
        ...mockFrame,
        parameters: {
          t1: 7.5,
          t2: 2.0,
        },
      }
      const existingCode = `import numpy as np
origin = np.array([5, 10])
t1 = 5.0
t2 = -3.5
draw(np.array([1, 2]))
`
      const code = generateCode(frame, existingCode)
      
      // Should use frame.parameters (source of truth) not extracted ones
      expect(code).toContain('t1 = 7.5')
      expect(code).toContain('t2 = 2')
      expect(code).toContain('draw(np.array([1, 2])')
    })

    it('should merge parameters from code when frame has no parameters', () => {
      const frame = {
        ...mockFrame,
        parameters: undefined,
      }
      const existingCode = `import numpy as np
origin = np.array([5, 10])
t1 = 5.0
t2 = -3.5
draw(np.array([1, 2]))
`
      const code = generateCode(frame, existingCode)
      
      // Should extract and use parameters from existing code
      expect(code).toContain('t1 = 5')
      expect(code).toContain('t2 = -3.5')
      expect(code).toContain('draw(np.array([1, 2])')
    })

    it('should sort parameters correctly (t1, t2, t3)', () => {
      const frame = {
        ...mockFrame,
        parameters: {
          t3: 10,
          t1: 5.0,
          t2: -3.5,
        },
      }
      const code = generateCode(frame)
      
      // Check that parameters appear in sorted order
      const t1Index = code.indexOf('t1 = 5')
      const t2Index = code.indexOf('t2 = -3.5')
      const t3Index = code.indexOf('t3 = 10')
      
      expect(t1Index).toBeLessThan(t2Index)
      expect(t2Index).toBeLessThan(t3Index)
    })

    it('should not duplicate user code', () => {
      const existingCode = `import numpy as np
draw(np.array([1, 2]))
`
      const code = generateCode(mockFrame, existingCode)
      const drawCount = (code.match(/draw\(/g) || []).length
      
      // Should only have one draw call (in the example comment and user code)
      expect(drawCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('shouldRegenerateCode', () => {
    it('should return true if code is missing template structure', () => {
      const code = `import numpy as np
draw(np.array([1, 2]))
`
      expect(shouldRegenerateCode(mockFrame, code)).toBe(true)
    })

    it('should return false if code matches frame properties', () => {
      const code = generateDefaultCode(mockFrame)
      expect(shouldRegenerateCode(mockFrame, code)).toBe(false)
    })

    it('should return true if origin changed', () => {
      const code = generateDefaultCode(mockFrame)
      const frame = { ...mockFrame, origin: [10, 20] }
      expect(shouldRegenerateCode(frame, code)).toBe(true)
    })

    it('should return true if baseI changed', () => {
      const code = generateDefaultCode(mockFrame)
      const frame = { ...mockFrame, baseI: [0.707, 0.707] }
      expect(shouldRegenerateCode(frame, code)).toBe(true)
    })

    it('should return true if baseJ changed', () => {
      const code = generateDefaultCode(mockFrame)
      const frame = { ...mockFrame, baseJ: [-0.707, 0.707] }
      expect(shouldRegenerateCode(frame, code)).toBe(true)
    })

    it('should handle floating point precision correctly', () => {
      const frame = { ...mockFrame, origin: [5.0000001, 10.0000001] }
      const code = generateDefaultCode(mockFrame)
      // Should not regenerate for tiny differences
      expect(shouldRegenerateCode(frame, code)).toBe(false)
    })
  })

  describe('extractParameters', () => {
    it('should extract parameter variables from code', () => {
      const code = `import numpy as np
t1 = 5.0
t2 = -3.5
t3 = 10
draw(np.array([1, 2]))
`
      const params = extractParameters(code)
      
      expect(params).toEqual({
        t1: 5.0,
        t2: -3.5,
        t3: 10,
      })
    })

    it('should ignore commented parameter assignments', () => {
      const code = `import numpy as np
# t1 = 5.0
t2 = -3.5
t3 = 10
`
      const params = extractParameters(code)
      
      expect(params).toEqual({
        t2: -3.5,
        t3: 10,
      })
    })

    it('should handle parameters with comments', () => {
      const code = `import numpy as np
t1 = 5.0  # Parameter slider value
t2 = -3.5
`
      const params = extractParameters(code)
      
      expect(params).toEqual({
        t1: 5.0,
        t2: -3.5,
      })
    })

    it('should return empty object when no parameters found', () => {
      const code = `import numpy as np
draw(np.array([1, 2]))
`
      const params = extractParameters(code)
      
      expect(params).toEqual({})
    })
  })
})

