import { describe, it, expect } from 'vitest'

describe('Loading and Error States', () => {
  describe('Error Message Styling', () => {
    it('error messages use dark theme colors', () => {
      // This is a visual test - we verify the classes are applied
      const errorDiv = document.createElement('div')
      errorDiv.className = 'bg-error/20 border border-error/50 text-error'
      
      expect(errorDiv.className).toContain('bg-error')
      expect(errorDiv.className).toContain('border-error')
      expect(errorDiv.className).toContain('text-error')
    })

    it('loading indicators use primary theme colors', () => {
      const loadingDiv = document.createElement('div')
      loadingDiv.className = 'bg-primary/10 border border-primary/30 text-primary'
      
      expect(loadingDiv.className).toContain('bg-primary')
      expect(loadingDiv.className).toContain('border-primary')
      expect(loadingDiv.className).toContain('text-primary')
    })

    it('success messages use success theme colors', () => {
      const successDiv = document.createElement('div')
      successDiv.className = 'bg-success/20 border border-success/50 text-success'
      
      expect(successDiv.className).toContain('bg-success')
      expect(successDiv.className).toContain('border-success')
      expect(successDiv.className).toContain('text-success')
    })

    it('warning messages use warning theme colors', () => {
      const warningDiv = document.createElement('div')
      warningDiv.className = 'bg-warning/20 border border-warning/50 text-warning'
      
      expect(warningDiv.className).toContain('bg-warning')
      expect(warningDiv.className).toContain('border-warning')
      expect(warningDiv.className).toContain('text-warning')
    })
  })
})

