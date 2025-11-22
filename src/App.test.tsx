import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the application', () => {
    render(<App />)
    expect(screen.getByText('YuDiMath')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<App />)
    expect(screen.getByText('Linear Algebra & Calculus Visualizer')).toBeInTheDocument()
  })

  it('renders success message', () => {
    render(<App />)
    expect(screen.getByText('Project initialized successfully!')).toBeInTheDocument()
  })

  it('applies dark theme classes', () => {
    const { container } = render(<App />)
    const mainDiv = container.querySelector('.bg-bg-primary')
    expect(mainDiv).not.toBeNull()
    expect(mainDiv).toBeInstanceOf(HTMLElement)
  })

  it('renders with correct text colors', () => {
    const { container } = render(<App />)
    const textElements = container.querySelectorAll('.text-text-primary, .text-text-secondary')
    expect(textElements.length).toBeGreaterThan(0)
  })
})
