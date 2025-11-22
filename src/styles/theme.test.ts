import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Dark Theme Color Palette', () => {
  const tailwindConfigPath = join(process.cwd(), 'tailwind.config.js')
  const cssPath = join(process.cwd(), 'src', 'styles', 'index.css')

  it('tailwind.config.js contains dark theme colors', () => {
    const config = readFileSync(tailwindConfigPath, 'utf-8')
    
    // Check for key colors
    expect(config).toContain('bg-primary')
    expect(config).toContain('#0f172a') // slate-900
    expect(config).toContain('grid-line')
    expect(config).toContain('#334155') // slate-700
    expect(config).toContain('primary')
    expect(config).toContain('#3b82f6') // blue-500
    expect(config).toContain('text-primary')
    expect(config).toContain('#f1f5f9') // slate-100
  })

  it('CSS file applies dark theme background', () => {
    const css = readFileSync(cssPath, 'utf-8')
    
    // Check for background color
    expect(css).toContain('background-color: #0f172a')
    expect(css).toContain('color: #f1f5f9')
  })

  it('CSS file contains component classes', () => {
    const css = readFileSync(cssPath, 'utf-8')
    
    // Check for component classes
    expect(css).toContain('.panel')
    expect(css).toContain('.btn')
    expect(css).toContain('.input')
  })

  it('all required colors are defined', () => {
    const config = readFileSync(tailwindConfigPath, 'utf-8')
    
    const requiredColors = [
      'bg-primary',
      'grid-line',
      'axis',
      'primary',
      'secondary',
      'success',
      'warning',
      'error',
      'text-primary',
      'text-secondary',
      'panel-bg',
      'border',
      'hover',
    ]

    requiredColors.forEach(color => {
      expect(config).toContain(color)
    })
  })
})

